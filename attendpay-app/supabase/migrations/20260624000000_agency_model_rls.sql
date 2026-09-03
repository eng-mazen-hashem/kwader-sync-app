-- ==============================================================================
-- Migration: HR Agency Model - Multi-Company RLS Support
-- ==============================================================================

-- 1. Create a function that returns ALL companies the user has access to
CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS SETOF uuid AS $$
BEGIN
    -- Return companies where user is the owner
    RETURN QUERY
    SELECT id FROM public.companies WHERE owner_id = auth.uid();
    
    -- Return companies where user is an HR employee
    RETURN QUERY
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update RLS Policies to use the new function
-- company_users:
DROP POLICY IF EXISTS "company_users_access" ON public.company_users;
CREATE POLICY "company_users_access" ON public.company_users FOR ALL 
USING (
    company_id IN (SELECT public.user_company_ids()) OR user_id = auth.uid()
);

-- company_invites:
DROP POLICY IF EXISTS "company_invites_access" ON public.company_invites;
CREATE POLICY "company_invites_access" ON public.company_invites FOR ALL 
USING (
    company_id IN (SELECT public.user_company_ids())
);

-- Safely update other tables
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
            -- Drop old policy if exists
            EXECUTE format('DROP POLICY IF EXISTS "%I_subuser_access" ON public.%I', tbl, tbl);
            -- Create new policy
            EXECUTE format('CREATE POLICY "%I_subuser_access" ON public.%I FOR ALL USING (company_id IN (SELECT public.user_company_ids()))', tbl, tbl);
        END IF;
    END LOOP;
END $$;
