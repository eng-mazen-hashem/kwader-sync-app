-- ─── تحديث جدول السلف والـ RPCs لدعم نظام الموافقات والسداد قصير الأجل ─────────────────

-- 1. تحديث قيد التحقق من حالة السلفة للسماح بـ 'pending' و 'rejected'
ALTER TABLE public.employee_loans DROP CONSTRAINT IF EXISTS employee_loans_status_check;

ALTER TABLE public.employee_loans ADD CONSTRAINT employee_loans_status_check 
  CHECK (status = ANY (ARRAY['active'::text, 'paid'::text, 'cancelled'::text, 'pending'::text, 'rejected'::text]));

-- 2. تحديث دالة تقديم طلب السلفة لتُنشئ الطلب بحالة 'pending'
CREATE OR REPLACE FUNCTION public.submit_loan_request(
    p_employee_id uuid,
    p_pin text,
    p_amount numeric,
    p_months integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    emp_record record;
    new_id uuid;
    monthly_inst numeric;
BEGIN
    SELECT * INTO emp_record 
    FROM public.employees 
    WHERE id = p_employee_id AND device_pin = p_pin AND status = 'active';

    IF emp_record IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero';
    END IF;

    IF p_months <= 0 THEN
        RAISE EXCEPTION 'Repayment months must be greater than zero';
    END IF;

    monthly_inst := p_amount / p_months;

    INSERT INTO public.employee_loans (
        employee_id,
        company_id,
        total_amount,
        monthly_installment,
        remaining_amount,
        repayment_months,
        status,
        created_at
    ) VALUES (
        p_employee_id,
        emp_record.company_id,
        p_amount,
        monthly_inst,
        p_amount,
        p_months,
        'pending',
        NOW()
    ) RETURNING id INTO new_id;

    RETURN json_build_object('success', true, 'loan_id', new_id);
END;
$$;

-- 3. دالة جلب طلبات الموظف (الإجازات والسلف)
CREATE OR REPLACE FUNCTION public.get_employee_requests(p_employee_id uuid, p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    emp_record record;
    leaves json;
    loans json;
BEGIN
    SELECT * INTO emp_record 
    FROM public.employees 
    WHERE id = p_employee_id AND device_pin = p_pin AND status = 'active';

    IF emp_record IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Fetch leave requests (last 50)
    SELECT json_agg(l) INTO leaves
    FROM (
        SELECT id, leave_type, start_date, end_date, status, created_at
        FROM public.leave_requests
        WHERE employee_id = p_employee_id
        ORDER BY created_at DESC
        LIMIT 50
    ) l;

    -- Fetch loan requests (last 50)
    SELECT json_agg(ln) INTO loans
    FROM (
        SELECT id, total_amount, repayment_months, monthly_installment, status, created_at
        FROM public.employee_loans
        WHERE employee_id = p_employee_id
        ORDER BY created_at DESC
        LIMIT 50
    ) ln;

    RETURN json_build_object(
        'success', true,
        'leaves', COALESCE(leaves, '[]'::json),
        'loans', COALESCE(loans, '[]'::json)
    );
END;
$$;

-- 4. تحديث دالة إحصائيات لوحة التحكم للموظف لترجع repayment_months
CREATE OR REPLACE FUNCTION public.get_employee_dashboard_stats(p_employee_id uuid, p_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    emp_record record;
    today_punch json;
    processed_att json;
    approved_leaves json;
    active_loans json;
    shift_info json;
    result json;
BEGIN
    -- 1. Validate employee and PIN
    SELECT * INTO emp_record 
    FROM public.employees 
    WHERE id = p_employee_id AND device_pin = p_pin AND status = 'active';

    IF emp_record IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 2. Fetch today's last punch from raw_attendance_logs
    SELECT row_to_json(r) INTO today_punch
    FROM (
        SELECT timestamp, status
        FROM public.raw_attendance_logs
        WHERE user_pin = emp_record.device_pin
          AND timestamp >= CURRENT_DATE
        ORDER BY timestamp DESC
        LIMIT 1
    ) r;

    -- 3. Fetch processed attendance for the current month
    SELECT json_agg(p) INTO processed_att
    FROM (
        SELECT date, status, work_hours
        FROM public.processed_attendance
        WHERE employee_id = p_employee_id
          AND date >= date_trunc('month', CURRENT_DATE)::date
          AND date <= (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date
    ) p;

    -- 4. Fetch approved leaves for the current month
    SELECT json_agg(l) INTO approved_leaves
    FROM (
        SELECT start_date, end_date, leave_type
        FROM public.leave_requests
        WHERE employee_id = p_employee_id
          AND status = 'approved'
          AND end_date >= date_trunc('month', CURRENT_DATE)::date
          AND start_date <= (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date
    ) l;

    -- 5. Fetch active loans
    SELECT json_agg(ln) INTO active_loans
    FROM (
        SELECT id, monthly_installment, remaining_amount, repayment_months
        FROM public.employee_loans
        WHERE employee_id = p_employee_id
          AND status = 'active'
    ) ln;

    -- 6. Fetch active shift details
    SELECT row_to_json(s) INTO shift_info
    FROM (
        SELECT sh.work_days, sh.start_time, sh.end_time
        FROM public.shift_employees se
        JOIN public.shifts sh ON sh.id = se.shift_id
        WHERE se.employee_id = p_employee_id
        LIMIT 1
    ) s;

    -- Assemble everything
    result := json_build_object(
        'today_punch', today_punch,
        'processed_attendance', COALESCE(processed_att, '[]'::json),
        'leave_requests', COALESCE(approved_leaves, '[]'::json),
        'employee_loans', COALESCE(active_loans, '[]'::json),
        'shift', shift_info
    );

    RETURN result;
END;
$$;
