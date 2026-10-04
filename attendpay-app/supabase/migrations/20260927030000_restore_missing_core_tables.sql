-- ==============================================================================
-- Migration: 20260927030000_restore_missing_core_tables.sql
-- Description: Restores missing public tables (departments, leave_requests,
--              hr_rules, audit_logs, report_schedules) and seeds existing departments.
-- Fixes: "Could not find a relationship between 'employees' and 'departments' in the schema cache"
-- ==============================================================================

-- 1. Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    manager_id uuid,
    created_at timestamptz DEFAULT now()
);

-- Seed existing departments to preserve existing employee department_ids
INSERT INTO public.departments (id, company_id, name) VALUES
    ('4636d14f-0b09-4357-be03-000645859bff', '127294a0-1438-42fb-a4f9-3e92d6b4b493', 'خدمة الصالة والكباتن'),
    ('96db1ed1-24ff-41ac-bee8-18838c2c0df2', '127294a0-1438-42fb-a4f9-3e92d6b4b493', 'قسم البار والمشروبات'),
    ('a0ddfd71-4189-49a0-bf96-48401eccea0f', '127294a0-1438-42fb-a4f9-3e92d6b4b493', 'استيور ونظافة'),
    ('d11ad995-8114-459b-90c7-3d0585e5aeaf', '127294a0-1438-42fb-a4f9-3e92d6b4b493', 'المطبخ والتجهيز'),
    ('f51e55be-653f-4c98-b824-0ebf782e2f4b', '127294a0-1438-42fb-a4f9-3e92d6b4b493', 'الكاشير والحسابات'),
    ('294d96c2-fc1b-44e8-ac02-f85eca4be59d', '127294a0-1438-42fb-a4f9-3e92d6b4b493', 'خدمة العملاء'),
    ('5172f769-f8b9-4764-b07e-862593f99765', '127294a0-1438-42fb-a4f9-3e92d6b4b493', 'التشغيل والدعم'),
    ('8048cbf9-f7d9-4d98-a09f-8b09b88c641f', '127294a0-1438-42fb-a4f9-3e92d6b4b493', 'المخازن والتوريد'),
    ('c915f0dd-a431-4ff8-bae9-d3c159e59c45', '127294a0-1438-42fb-a4f9-3e92d6b4b493', 'الضيافة'),
    ('ee0bab21-fa1d-4790-8228-a62d6894cbb9', '127294a0-1438-42fb-a4f9-3e92d6b4b493', 'الإشراف العام'),
    ('68d77e22-0e7a-415a-ae0f-19b316a9eceb', '88d4c96c-9489-482d-a8c9-c1f017674af7', 'قسم الحسابات والمالية'),
    ('641c1262-9fe7-4fcb-a306-a9f30ac98671', '88d4c96c-9489-482d-a8c9-c1f017674af7', 'قسم الإنتاج والتصنيع'),
    ('4179b949-78b3-498a-ac0c-115453a4127a', '88d4c96c-9489-482d-a8c9-c1f017674af7', 'قسم التجميع والتشطيب'),
    ('162a6bbb-fecb-49e1-90bc-f6ee90f0f6a2', '88d4c96c-9489-482d-a8c9-c1f017674af7', 'قسم التنجيد والتفصيل'),
    ('cbe21239-b23d-4208-b476-13b82540f9ee', '88d4c96c-9489-482d-a8c9-c1f017674af7', 'قسم النجارة والقص'),
    ('f2b92aa7-da33-4fc1-b6b5-51b49c4d73e1', '88d4c96c-9489-482d-a8c9-c1f017674af7', 'قسم الدهانات والجودة'),
    ('f7eb9eb7-825a-4b47-8297-7dd521cbb139', '88d4c96c-9489-482d-a8c9-c1f017674af7', 'قسم المبيعات والمعارض'),
    ('eb3fd3ab-1497-4294-a78e-f705fe904854', 'a1c4f5a9-fe9c-4cc6-be28-a4ef44b4b361', 'قسم التشغيل والصيانة'),
    ('7739109d-32de-49ee-87b2-221ab33c581c', 'aa7f0b6f-927a-403a-b820-633cda2e60d1', 'قسم المبيعات'),
    ('6d6cf064-564f-4c57-96f6-20969d0dc7f0', '8803f83c-22c9-4d40-a1af-c417d31cbc59', 'الإدارة العامة'),
    ('ee2d78a0-405b-49f8-a0f6-79ee0bca0990', '8803f83c-22c9-4d40-a1af-c417d31cbc59', 'تقنية المعلومات'),
    ('fce7be62-7da8-4038-961e-064f37d2ae87', '2668b23a-b363-4d52-9d73-4ebd90025aec', 'القسم العام')
ON CONFLICT (id) DO NOTHING;

-- Link foreign key from employees to departments
ALTER TABLE public.employees
    DROP CONSTRAINT IF EXISTS fk_employees_department,
    ADD CONSTRAINT fk_employees_department 
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_departments_company_id ON public.departments(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON public.employees(department_id);

-- 2. Create leave_requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type text NOT NULL DEFAULT 'annual',
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    attachment_url text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_company ON public.leave_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(company_id, status);

-- 3. Create hr_rules table
CREATE TABLE IF NOT EXISTS public.hr_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    icon text,
    color text,
    category text,
    trigger_event text,
    logic_mode text,
    scope text,
    scope_ids jsonb DEFAULT '[]'::jsonb,
    priority integer DEFAULT 0,
    is_active boolean DEFAULT true,
    apply_once boolean DEFAULT false,
    conditions jsonb DEFAULT '[]'::jsonb,
    actions jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_rules_company ON public.hr_rules(company_id);

-- 4. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id uuid,
    action text NOT NULL,
    table_name text,
    record_id text,
    old_data jsonb,
    new_data jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs(company_id);

-- 5. Create report_schedules table
CREATE TABLE IF NOT EXISTS public.report_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    report_type text NOT NULL,
    frequency text NOT NULL DEFAULT 'weekly',
    recipients jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    last_sent_at timestamptz,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_company ON public.report_schedules(company_id);

-- 6. Enable RLS and Configure Multi-Tenant Policies
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY['departments', 'leave_requests', 'hr_rules', 'audit_logs', 'report_schedules'])
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Tenant Access
        EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_access" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "%I_tenant_access" ON public.%I FOR ALL TO public ' ||
            'USING (company_id IN (SELECT public.user_company_ids())) ' ||
            'WITH CHECK (company_id IN (SELECT public.user_company_ids()));',
            tbl, tbl
        );

        -- Super Admin Access
        EXECUTE format('DROP POLICY IF EXISTS "%I_superadmin_access" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "%I_superadmin_access" ON public.%I FOR ALL TO public ' ||
            'USING (public.is_super_admin()) ' ||
            'WITH CHECK (public.is_super_admin());',
            tbl, tbl
        );
    END LOOP;
END $$;

-- 7. Add updated_at trigger
DROP TRIGGER IF EXISTS tr_update_leave_requests_modtime ON public.leave_requests;
CREATE TRIGGER tr_update_leave_requests_modtime BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

DROP TRIGGER IF EXISTS tr_update_hr_rules_modtime ON public.hr_rules;
CREATE TRIGGER tr_update_hr_rules_modtime BEFORE UPDATE ON public.hr_rules FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

DROP TRIGGER IF EXISTS tr_update_report_schedules_modtime ON public.report_schedules;
CREATE TRIGGER tr_update_report_schedules_modtime BEFORE UPDATE ON public.report_schedules FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
