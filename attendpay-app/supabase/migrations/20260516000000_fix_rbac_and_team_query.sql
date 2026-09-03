-- ==============================================================================
-- Migration: Fix RBAC, avoid org_admin trap, and add team query RPC
-- ==============================================================================

-- 1. Fix accept_invite to prevent org_admin trap
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

    -- Cleanup: If the system accidentally created an empty company for this user (due to trigger race conditions or missing invite link during signup), delete it.
    -- This ensures the user isn't trapped as an 'org_admin' of an empty company.
    DELETE FROM public.companies 
    WHERE owner_id = new_user_id 
    AND NOT EXISTS (SELECT 1 FROM public.employees WHERE company_id = public.companies.id);

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

-- 2. Create RPC for fetching team members with emails
CREATE OR REPLACE FUNCTION public.get_company_team(c_id uuid)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    role text,
    permissions jsonb,
    created_at timestamptz,
    email text,
    full_name text
) AS $$
BEGIN
    -- Check permissions: caller must be org_admin of this company
    IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = c_id AND c.owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        cu.id,
        cu.user_id,
        cu.role,
        cu.permissions,
        cu.created_at,
        au.email::text,
        COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '')::text as full_name
    FROM public.company_users cu
    JOIN auth.users au ON cu.user_id = au.id
    WHERE cu.company_id = c_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add missing RLS policies for sub-users
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'employee_loans', 
            'leave_requests', 
            'hr_rules', 
            'processed_attendance',
            'raw_attendance_logs',
            'support_tickets',
            'report_schedules'
        ])
    LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('DROP POLICY IF EXISTS "%I_subuser_access" ON public.%I', tbl, tbl);
            EXECUTE format('CREATE POLICY "%I_subuser_access" ON public.%I FOR ALL USING (company_id = public.user_company_id())', tbl, tbl);
        END IF;
    END LOOP;
END $$;
