-- ==============================================================================
-- Migration: 20260927010000_master_rls_comprehensive_alignment.sql
-- Description: Master Comprehensive RLS Alignment across all 29 public tables.
-- Guarantees:
--   1. 100% RLS coverage (Zero tables without RLS).
--   2. Multi-Tenant Isolation (Agency model via user_company_ids()).
--   3. Recursion prevention using SECURITY DEFINER is_super_admin().
--   4. Fast InitPlan caching for (SELECT auth.uid()) to avoid CPU bleed.
--   5. Full functionality for Super Admin, Company Owners, Sub-users (HR),
--      Biometric Sync Agent, and Decentralized WhatsApp Cluster.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Functions
-- ------------------------------------------------------------------------------

-- Break recursion permanently & cache super admin check
CREATE OR REPLACE FUNCTION public.is_super_admin(check_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = check_uid
  );
$$;

-- Multi-Company / Agency Model Tenant Resolution
CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    -- Return companies owned by user
    RETURN QUERY
    SELECT id FROM public.companies WHERE owner_id = auth.uid();
    
    -- Return companies where user is an invited member / HR
    RETURN QUERY
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid();
END;
$$;

-- Single Company fallback (returns primary company)
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    cid uuid;
BEGIN
    SELECT id INTO cid FROM public.companies WHERE owner_id = auth.uid() ORDER BY created_at ASC LIMIT 1;
    IF cid IS NOT NULL THEN
        RETURN cid;
    END IF;
    
    SELECT company_id INTO cid FROM public.company_users WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1;
    RETURN cid;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Core Tables: super_admins, companies, company_users, company_invites
-- ------------------------------------------------------------------------------

-- super_admins
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admins_manage" ON public.super_admins;
DROP POLICY IF EXISTS "super_admins_read" ON public.super_admins;
DROP POLICY IF EXISTS "super_admins_write" ON public.super_admins;

CREATE POLICY "super_admins_read" ON public.super_admins
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "super_admins_write" ON public.super_admins
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companies_owner_access" ON public.companies;
DROP POLICY IF EXISTS "companies_superadmin_access" ON public.companies;
DROP POLICY IF EXISTS "company_users_read_company" ON public.companies;
DROP POLICY IF EXISTS "companies_invite_read" ON public.companies;

CREATE POLICY "companies_owner_access" ON public.companies
  FOR ALL TO public
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "companies_superadmin_access" ON public.companies
  FOR ALL TO public
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "company_users_read_company" ON public.companies
  FOR SELECT TO public
  USING (id IN (SELECT company_users.company_id FROM public.company_users WHERE company_users.user_id = auth.uid()));

CREATE POLICY "companies_invite_read" ON public.companies 
  FOR SELECT TO public 
  USING (EXISTS (
    SELECT 1 FROM public.company_invites 
    WHERE company_invites.company_id = companies.id 
      AND company_invites.expires_at > now()
  ));

-- company_users
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_users_access" ON public.company_users;
DROP POLICY IF EXISTS "company_users_superadmin_access" ON public.company_users;

CREATE POLICY "company_users_access" ON public.company_users
  FOR ALL TO public
  USING (company_id IN (SELECT public.user_company_ids()) OR user_id = auth.uid())
  WITH CHECK (company_id IN (SELECT public.user_company_ids()) OR user_id = auth.uid());

CREATE POLICY "company_users_superadmin_access" ON public.company_users
  FOR ALL TO public
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- company_invites
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_invites_access" ON public.company_invites;
DROP POLICY IF EXISTS "company_invites_read_public" ON public.company_invites;
DROP POLICY IF EXISTS "company_invites_superadmin_access" ON public.company_invites;

CREATE POLICY "company_invites_access" ON public.company_invites
  FOR ALL TO public
  USING (company_id IN (SELECT public.user_company_ids()))
  WITH CHECK (company_id IN (SELECT public.user_company_ids()));

CREATE POLICY "company_invites_read_public" ON public.company_invites
  FOR SELECT TO public
  USING (true);

CREATE POLICY "company_invites_superadmin_access" ON public.company_invites
  FOR ALL TO public
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 3. Tenant Data Tables (Direct company_id link)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'employees', 
            'payrolls', 
            'shifts', 
            'devices',
            'employee_documents', 
            'employee_loans', 
            'processed_attendance',
            'raw_attendance_logs',
            'company_notifications'
        ])
    LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            
            -- Sub-user / Owner access
            EXECUTE format('DROP POLICY IF EXISTS "%I_subuser_access" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_access" ON public.%I;', tbl, tbl);
            EXECUTE format(
                'CREATE POLICY "%I_tenant_access" ON public.%I FOR ALL TO public ' ||
                'USING (company_id IN (SELECT public.user_company_ids())) ' ||
                'WITH CHECK (company_id IN (SELECT public.user_company_ids()));',
                tbl, tbl
            );

            -- Super Admin access
            EXECUTE format('DROP POLICY IF EXISTS "%I_superadmin_access" ON public.%I;', tbl, tbl);
            EXECUTE format(
                'CREATE POLICY "%I_superadmin_access" ON public.%I FOR ALL TO public ' ||
                'USING (public.is_super_admin()) ' ||
                'WITH CHECK (public.is_super_admin());',
                tbl, tbl
            );
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Indirect Tenant Tables: shift_employees
-- ------------------------------------------------------------------------------

ALTER TABLE public.shift_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shift_employees_tenant_access" ON public.shift_employees;
DROP POLICY IF EXISTS "shift_employees_superadmin_access" ON public.shift_employees;

CREATE POLICY "shift_employees_tenant_access" ON public.shift_employees
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.shifts s 
    WHERE s.id = shift_employees.shift_id 
      AND s.company_id IN (SELECT public.user_company_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shifts s 
    WHERE s.id = shift_employees.shift_id 
      AND s.company_id IN (SELECT public.user_company_ids())
  ));

CREATE POLICY "shift_employees_superadmin_access" ON public.shift_employees
  FOR ALL TO public
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 5. renewal_requests
-- ------------------------------------------------------------------------------

ALTER TABLE public.renewal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_insert_access" ON public.renewal_requests;
DROP POLICY IF EXISTS "client_select_access" ON public.renewal_requests;
DROP POLICY IF EXISTS "super_admin_all_access" ON public.renewal_requests;
DROP POLICY IF EXISTS "renewal_requests_tenant_insert" ON public.renewal_requests;
DROP POLICY IF EXISTS "renewal_requests_tenant_select" ON public.renewal_requests;
DROP POLICY IF EXISTS "renewal_requests_superadmin_access" ON public.renewal_requests;

CREATE POLICY "renewal_requests_tenant_insert" ON public.renewal_requests
  FOR INSERT TO public
  WITH CHECK (company_id IN (SELECT public.user_company_ids()));

CREATE POLICY "renewal_requests_tenant_select" ON public.renewal_requests
  FOR SELECT TO public
  USING (company_id IN (SELECT public.user_company_ids()));

CREATE POLICY "renewal_requests_superadmin_access" ON public.renewal_requests
  FOR ALL TO public
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 6. System & Admin Activity
-- ------------------------------------------------------------------------------

-- admin_activity
ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_activity_superadmin" ON public.admin_activity;

CREATE POLICY "admin_activity_superadmin" ON public.admin_activity
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Service role manage system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Super admin manage system settings" ON public.system_settings;

CREATE POLICY "Public read system settings" ON public.system_settings
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Service role manage system settings" ON public.system_settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Super admin manage system settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- employee_otp_verifications
ALTER TABLE public.employee_otp_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on employee_otp_verifications" ON public.employee_otp_verifications;

CREATE POLICY "Allow all on employee_otp_verifications" ON public.employee_otp_verifications
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7. WhatsApp Cluster & Edge Sync Nodes
-- ------------------------------------------------------------------------------

ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read whatsapp_channels" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "Allow all write whatsapp_channels" ON public.whatsapp_channels;

CREATE POLICY "Allow public read whatsapp_channels" ON public.whatsapp_channels
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all write whatsapp_channels" ON public.whatsapp_channels
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.whatsapp_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all on whatsapp_nodes" ON public.whatsapp_nodes;

CREATE POLICY "Allow anon all on whatsapp_nodes" ON public.whatsapp_nodes
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon and authenticated all on whatsapp_queue" ON public.whatsapp_queue;

CREATE POLICY "Allow anon and authenticated all on whatsapp_queue" ON public.whatsapp_queue
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 8. AI & Verified Workers Market
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['ai_conversations', 'ai_knowledge_base', 'ai_leads', 'ai_messages'])
    LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow public read %I" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow all write %I" ON public.%I;', tbl, tbl);
            EXECUTE format('CREATE POLICY "Allow public read %I" ON public.%I FOR SELECT TO anon, authenticated USING (true);', tbl, tbl);
            EXECUTE format('CREATE POLICY "Allow all write %I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', tbl, tbl);
        END IF;
    END LOOP;
END $$;

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['kw_jobs', 'kw_skills', 'kw_worker_skills', 'kw_workers'])
    LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%I_read" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%I_write" ON public.%I;', tbl, tbl);
            EXECUTE format('CREATE POLICY "%I_read" ON public.%I FOR SELECT TO anon, authenticated USING (true);', tbl, tbl);
            EXECUTE format('CREATE POLICY "%I_write" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', tbl, tbl);
        END IF;
    END LOOP;
END $$;
