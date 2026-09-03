-- ==============================================================================
-- Migration: RBAC and Sub-Users (HR Roles)
-- ==============================================================================

-- 1. Create company_users table (stores HR employees linked to a company)
CREATE TABLE IF NOT EXISTS public.company_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'hr',
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(company_id, user_id)
);

-- 2. Create company_invites table (stores pending invitations)
CREATE TABLE IF NOT EXISTS public.company_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email text NOT NULL,
    token uuid NOT NULL DEFAULT gen_random_uuid(),
    permissions jsonb DEFAULT '{}'::jsonb,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    created_at timestamptz DEFAULT now(),
    UNIQUE(token)
);

-- 3. Create a helper function to get the current user's company_id 
-- This securely returns the company_id whether the user is the owner OR an HR sub-user
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS uuid AS $$
DECLARE
    cid uuid;
BEGIN
    -- 1. Check if user is the owner of a company
    SELECT id INTO cid FROM public.companies WHERE owner_id = auth.uid() LIMIT 1;
    IF cid IS NOT NULL THEN
        RETURN cid;
    END IF;
    
    -- 2. Check if user is an HR employee in company_users
    SELECT company_id INTO cid FROM public.company_users WHERE user_id = auth.uid() LIMIT 1;
    RETURN cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create RPC to accept an invite
CREATE OR REPLACE FUNCTION public.accept_invite(invite_token uuid)
RETURNS json AS $$
DECLARE
    invite_record record;
    new_user_id uuid;
BEGIN
    new_user_id := auth.uid();
    
    IF new_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Find the invite
    SELECT * INTO invite_record FROM public.company_invites 
    WHERE token = invite_token AND expires_at > now();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invite token';
    END IF;

    -- Insert into company_users
    INSERT INTO public.company_users (company_id, user_id, role, permissions)
    VALUES (invite_record.company_id, new_user_id, 'hr', invite_record.permissions)
    ON CONFLICT (company_id, user_id) DO UPDATE 
    SET permissions = EXCLUDED.permissions;

    -- Delete the invite
    DELETE FROM public.company_invites WHERE id = invite_record.id;

    RETURN json_build_object('success', true, 'company_id', invite_record.company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- RLS POLICIES (Adding Permissive Policies for Sub-Users)
-- ==============================================================================

-- Enable RLS on new tables
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

-- company_users: Users can view their own, Owners can view their company's
CREATE POLICY "company_users_access" ON public.company_users FOR ALL 
USING (
    company_id = public.user_company_id() OR user_id = auth.uid()
);

-- company_invites: Owners can manage their company's invites
CREATE POLICY "company_invites_access" ON public.company_invites FOR ALL 
USING (
    company_id = public.user_company_id()
);
-- Allow public read of company_invites (to validate token on the signup page)
CREATE POLICY "company_invites_read_public" ON public.company_invites FOR SELECT 
USING (true);

-- companies: Allow company_users to read their company
CREATE POLICY "company_users_read_company" ON public.companies FOR SELECT 
USING (
    id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid())
);

-- Safely apply policies only to tables that exist
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'employees', 
            'attendance', 
            'payrolls', 
            'loans', 
            'shifts', 
            'departments', 
            'company_notifications', 
            'employee_documents'
        ])
    LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('CREATE POLICY "%I_subuser_access" ON public.%I FOR ALL USING (company_id = public.user_company_id())', tbl, tbl);
        END IF;
    END LOOP;
END $$;

