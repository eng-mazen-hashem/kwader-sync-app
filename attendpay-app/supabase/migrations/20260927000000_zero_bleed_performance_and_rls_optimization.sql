-- Migration: zero_bleed_performance_and_rls_optimization
-- 1. Index on super_admins(user_id) for instantaneous RLS evaluations
CREATE INDEX IF NOT EXISTS idx_super_admins_user_id ON public.super_admins(user_id);

-- 2. Refactor Super Admin RLS Policies to use (select auth.uid()) InitPlan caching
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
            EXECUTE format('CREATE POLICY "%I_superadmin_access" ON public.%I FOR ALL USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = (SELECT auth.uid())))', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- 3. Composite High-Traffic Performance Indexes (applied conditionally to existing tables)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'raw_attendance_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_raw_att_logs_company_punch ON public.raw_attendance_logs(company_id, timestamp);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'processed_attendance') THEN
        CREATE INDEX IF NOT EXISTS idx_proc_att_company_date ON public.processed_attendance(company_id, date);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests') THEN
        CREATE INDEX IF NOT EXISTS idx_leave_requests_company_status ON public.leave_requests(company_id, status, created_at DESC);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_loans') THEN
        CREATE INDEX IF NOT EXISTS idx_employee_loans_company_status ON public.employee_loans(company_id, status, created_at DESC);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_queue') THEN
        CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_claim ON public.whatsapp_queue(company_id, status, priority DESC, created_at ASC);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_messages') THEN
        CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created ON public.ai_messages(conversation_id, created_at ASC);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_conversations') THEN
        CREATE INDEX IF NOT EXISTS idx_ai_conversations_company_lastmsg ON public.ai_conversations(company_id, last_message_at DESC);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shift_employees') THEN
        CREATE INDEX IF NOT EXISTS idx_shift_employees_shift_emp ON public.shift_employees(shift_id, employee_id);
    END IF;
END $$;

