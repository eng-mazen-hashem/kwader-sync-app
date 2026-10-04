-- =========================================================================
-- Migration: Create Missing Core & Admin Tables and Fix delete_tenant_completely
-- =========================================================================

-- 1. Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Open',
    assignee TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Support Ticket Replies
CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_type TEXT DEFAULT 'customer',
    sender_name TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'paid',
    due_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Payment Requests
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    amount NUMERIC DEFAULT 0,
    payment_method TEXT,
    transaction_ref TEXT,
    status TEXT DEFAULT 'pending',
    subscription_duration_months INT DEFAULT 1,
    notes TEXT,
    proof_url TEXT,
    requested_at TIMESTAMPTZ DEFAULT now(),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Payment Config
CREATE TABLE IF NOT EXISTS public.payment_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Quick Payments
CREATE TABLE IF NOT EXISTS public.quick_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    project_name TEXT,
    amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    transaction_ref TEXT,
    payment_method TEXT,
    payment_receipt_url TEXT,
    notes TEXT,
    confirmed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Resellers
CREATE TABLE IF NOT EXISTS public.resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active',
    settings JSONB DEFAULT '{"commission_rate": 30}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'companies_reseller_id_fkey' AND table_name = 'companies'
    ) THEN
        ALTER TABLE public.companies 
        ADD CONSTRAINT companies_reseller_id_fkey 
        FOREIGN KEY (reseller_id) REFERENCES public.resellers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 8. System Alerts
CREATE TABLE IF NOT EXISTS public.system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Employee Notifications
CREATE TABLE IF NOT EXISTS public.employee_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Sync Service Status
CREATE TABLE IF NOT EXISTS public.sync_service_status (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    force_full_sync BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Landing Reviews
CREATE TABLE IF NOT EXISTS public.landing_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company TEXT,
    avatar_url TEXT,
    review TEXT NOT NULL,
    rating NUMERIC DEFAULT 5,
    approved BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Payroll Items
CREATE TABLE IF NOT EXISTS public.payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id UUID REFERENCES public.payrolls(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. WhatsApp API Keys
CREATE TABLE IF NOT EXISTS public.whatsapp_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    rate_limit_per_minute INT DEFAULT 60,
    total_sent INT DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- 14. WhatsApp Node Assignments
CREATE TABLE IF NOT EXISTS public.whatsapp_node_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostname TEXT UNIQUE NOT NULL,
    target_channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Default Payment Config entries
INSERT INTO public.payment_config (key, value)
VALUES 
    ('admin_whatsapp', '201016834191'),
    ('vodafone_cash_number', '01016834191'),
    ('vodafone_cash_name', 'Kwader System'),
    ('instapay_number', '01016834191'),
    ('instapay_name', 'Kwader')
ON CONFLICT (key) DO NOTHING;

-- 16. Enable RLS on newly created tables
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_node_assignments ENABLE ROW LEVEL SECURITY;

-- 17. Security Policies
-- Support tickets
DROP POLICY IF EXISTS support_tickets_super_admin ON public.support_tickets;
CREATE POLICY support_tickets_super_admin ON public.support_tickets FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS support_tickets_tenant_access ON public.support_tickets;
CREATE POLICY support_tickets_tenant_access ON public.support_tickets FOR ALL TO authenticated USING (company_id IN (SELECT public.user_company_ids())) WITH CHECK (company_id IN (SELECT public.user_company_ids()));

-- Support ticket replies
DROP POLICY IF EXISTS support_ticket_replies_super_admin ON public.support_ticket_replies;
CREATE POLICY support_ticket_replies_super_admin ON public.support_ticket_replies FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS support_ticket_replies_tenant_access ON public.support_ticket_replies;
CREATE POLICY support_ticket_replies_tenant_access ON public.support_ticket_replies FOR ALL TO authenticated USING (
    ticket_id IN (SELECT id FROM public.support_tickets WHERE company_id IN (SELECT public.user_company_ids()))
) WITH CHECK (
    ticket_id IN (SELECT id FROM public.support_tickets WHERE company_id IN (SELECT public.user_company_ids()))
);

-- Invoices
DROP POLICY IF EXISTS invoices_super_admin ON public.invoices;
CREATE POLICY invoices_super_admin ON public.invoices FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS invoices_tenant_select ON public.invoices;
CREATE POLICY invoices_tenant_select ON public.invoices FOR SELECT TO authenticated USING (company_id IN (SELECT public.user_company_ids()));

-- Payment requests
DROP POLICY IF EXISTS payment_requests_super_admin ON public.payment_requests;
CREATE POLICY payment_requests_super_admin ON public.payment_requests FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS payment_requests_tenant_access ON public.payment_requests;
CREATE POLICY payment_requests_tenant_access ON public.payment_requests FOR ALL TO authenticated USING (company_id IN (SELECT public.user_company_ids())) WITH CHECK (company_id IN (SELECT public.user_company_ids()));

-- Payment config
DROP POLICY IF EXISTS payment_config_super_admin ON public.payment_config;
CREATE POLICY payment_config_super_admin ON public.payment_config FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS payment_config_read ON public.payment_config;
CREATE POLICY payment_config_read ON public.payment_config FOR SELECT TO anon, authenticated USING (true);

-- Quick payments
DROP POLICY IF EXISTS quick_payments_super_admin ON public.quick_payments;
CREATE POLICY quick_payments_super_admin ON public.quick_payments FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS quick_payments_public_insert ON public.quick_payments;
CREATE POLICY quick_payments_public_insert ON public.quick_payments FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS quick_payments_public_select ON public.quick_payments;
CREATE POLICY quick_payments_public_select ON public.quick_payments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS quick_payments_public_update ON public.quick_payments;
CREATE POLICY quick_payments_public_update ON public.quick_payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Resellers
DROP POLICY IF EXISTS resellers_super_admin ON public.resellers;
CREATE POLICY resellers_super_admin ON public.resellers FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS resellers_own_access ON public.resellers;
CREATE POLICY resellers_own_access ON public.resellers FOR SELECT TO authenticated USING (user_id = auth.uid());

-- System alerts
DROP POLICY IF EXISTS system_alerts_super_admin ON public.system_alerts;
CREATE POLICY system_alerts_super_admin ON public.system_alerts FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Employee notifications
DROP POLICY IF EXISTS employee_notifications_all ON public.employee_notifications;
CREATE POLICY employee_notifications_all ON public.employee_notifications FOR ALL TO authenticated USING (
    public.is_super_admin(auth.uid()) OR employee_id IN (SELECT id FROM public.employees WHERE company_id IN (SELECT public.user_company_ids()))
) WITH CHECK (
    public.is_super_admin(auth.uid()) OR employee_id IN (SELECT id FROM public.employees WHERE company_id IN (SELECT public.user_company_ids()))
);

-- Sync service status
DROP POLICY IF EXISTS sync_service_status_all ON public.sync_service_status;
CREATE POLICY sync_service_status_all ON public.sync_service_status FOR ALL TO authenticated USING (
    public.is_super_admin(auth.uid()) OR company_id IN (SELECT public.user_company_ids())
) WITH CHECK (
    public.is_super_admin(auth.uid()) OR company_id IN (SELECT public.user_company_ids())
);

-- Landing reviews
DROP POLICY IF EXISTS landing_reviews_public_read ON public.landing_reviews;
CREATE POLICY landing_reviews_public_read ON public.landing_reviews FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS landing_reviews_public_insert ON public.landing_reviews;
CREATE POLICY landing_reviews_public_insert ON public.landing_reviews FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS landing_reviews_super_admin ON public.landing_reviews;
CREATE POLICY landing_reviews_super_admin ON public.landing_reviews FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Payroll items
DROP POLICY IF EXISTS payroll_items_all ON public.payroll_items;
CREATE POLICY payroll_items_all ON public.payroll_items FOR ALL TO authenticated USING (
    public.is_super_admin(auth.uid()) OR employee_id IN (SELECT id FROM public.employees WHERE company_id IN (SELECT public.user_company_ids()))
) WITH CHECK (
    public.is_super_admin(auth.uid()) OR employee_id IN (SELECT id FROM public.employees WHERE company_id IN (SELECT public.user_company_ids()))
);

-- WhatsApp API Keys
DROP POLICY IF EXISTS whatsapp_api_keys_super_admin ON public.whatsapp_api_keys;
CREATE POLICY whatsapp_api_keys_super_admin ON public.whatsapp_api_keys FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- WhatsApp Node Assignments
DROP POLICY IF EXISTS whatsapp_node_assignments_super_admin ON public.whatsapp_node_assignments;
CREATE POLICY whatsapp_node_assignments_super_admin ON public.whatsapp_node_assignments FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS whatsapp_node_assignments_public_read ON public.whatsapp_node_assignments;
CREATE POLICY whatsapp_node_assignments_public_read ON public.whatsapp_node_assignments FOR SELECT TO anon, authenticated USING (true);

-- 18. Grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.landing_reviews, public.payment_config, public.quick_payments, public.whatsapp_node_assignments TO anon;
GRANT INSERT ON public.landing_reviews, public.quick_payments TO anon;
GRANT UPDATE ON public.quick_payments TO anon;

-- 19. Realtime Publication
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.support_tickets, 
            public.support_ticket_replies, 
            public.payment_requests, 
            public.renewal_requests, 
            public.whatsapp_node_assignments;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

-- 20. Update delete_tenant_completely with absolute safety
CREATE OR REPLACE FUNCTION public.delete_tenant_completely(target_company_id UUID)
RETURNS void AS $$
DECLARE
    v_owner_id UUID;
    v_other_companies_count INT;
BEGIN
    -- 1. Get the owner_id before company deletion
    SELECT owner_id INTO v_owner_id FROM public.companies WHERE id = target_company_id;

    -- 2. Safely delete from child tables with explicit company references
    BEGIN
        DELETE FROM public.support_ticket_replies WHERE ticket_id IN (
            SELECT id FROM public.support_tickets WHERE company_id = target_company_id
        );
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.support_tickets WHERE company_id = target_company_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.invoices WHERE company_id = target_company_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.payment_requests WHERE company_id = target_company_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.renewal_requests WHERE company_id = target_company_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.sync_service_status WHERE company_id = target_company_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- 3. Delete auth users that belong specifically to this company (employees / sub-users)
    DELETE FROM auth.users 
    WHERE id IN (
        SELECT id FROM auth.users 
        WHERE raw_user_meta_data->>'company_id' = target_company_id::text 
           OR raw_app_meta_data->>'company_id' = target_company_id::text
    );

    -- 4. Delete the company itself (cascades to all other child tables)
    DELETE FROM public.companies WHERE id = target_company_id;

    -- 5. Only delete the owner from auth.users if they do NOT own any other remaining companies
    IF v_owner_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_other_companies_count 
        FROM public.companies 
        WHERE owner_id = v_owner_id;
        
        IF v_other_companies_count = 0 THEN
            DELETE FROM auth.users WHERE id = v_owner_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
