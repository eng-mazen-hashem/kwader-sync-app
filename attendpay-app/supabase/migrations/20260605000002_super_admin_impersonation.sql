-- Migration: Super Admin Impersonation & Force Hard Refresh Policies
-- Enable Super Admins to select/write rows across all multi-tenant tables for impersonation.

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'employees', 
            'payrolls', 
            'shifts', 
            'shift_employees',
            'departments', 
            'devices',
            'employee_documents', 
            'employee_loans', 
            'leave_requests', 
            'hr_rules', 
            'processed_attendance',
            'raw_attendance_logs',
            'report_schedules',
            'company_users',
            'company_invites'
        ])
    LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('DROP POLICY IF EXISTS "%I_superadmin_access" ON public.%I', tbl, tbl);
            EXECUTE format('CREATE POLICY "%I_superadmin_access" ON public.%I FOR ALL USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()))', tbl, tbl);
        END IF;
    END LOOP;
END $$;
