-- Migration: 20260918200000_fix_employee_portal_rpc_signatures.sql
-- Description: Update get_employee_portal_data and submit_gps_punch to support p_device_id parameter for device binding

-- 1. Update get_employee_portal_data to accept p_device_id with DEFAULT NULL
DROP FUNCTION IF EXISTS public.get_employee_portal_data(uuid, text);

CREATE OR REPLACE FUNCTION public.get_employee_portal_data(
    p_employee_id uuid, 
    p_pin text, 
    p_device_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    emp_data json;
    v_bound_device text;
BEGIN
    -- Verify employee credentials & status
    SELECT bound_device_id INTO v_bound_device
    FROM public.employees 
    WHERE id = p_employee_id AND device_pin = p_pin AND status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- If employee has a bound device and p_device_id is provided, verify device matches
    IF v_bound_device IS NOT NULL AND p_device_id IS NOT NULL AND p_device_id != '' AND v_bound_device != p_device_id THEN
        RAISE EXCEPTION 'الجهاز غير مصرح به لهذا الحساب';
    END IF;

    SELECT row_to_json(e) INTO emp_data
    FROM (
        SELECT id, name, phone, position, job_title, department, base_salary, 
               housing_allowance, transport_allowance, annual_leave_balance,
               status, allow_gps_punch, bound_device_id, bound_device_name,
               (SELECT name FROM public.companies WHERE id = company_id) as company_name,
               (SELECT settings FROM public.companies WHERE id = company_id) as company_settings
        FROM public.employees 
        WHERE id = p_employee_id
    ) e;

    RETURN emp_data;
END;
$function$;

-- 2. Update submit_gps_punch to accept p_device_id with DEFAULT NULL
DROP FUNCTION IF EXISTS public.submit_gps_punch(uuid, text, double precision, double precision);

CREATE OR REPLACE FUNCTION public.submit_gps_punch(
    p_employee_id uuid, 
    p_pin text, 
    p_lat DOUBLE PRECISION, 
    p_lng DOUBLE PRECISION,
    p_device_id text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
    v_company_id uuid;
    v_allow_gps boolean;
    v_bound_device text;
    v_last_punch record;
    v_punch_type text;
BEGIN
    -- Verify employee
    SELECT company_id, allow_gps_punch, bound_device_id INTO v_company_id, v_allow_gps, v_bound_device
    FROM public.employees 
    WHERE id = p_employee_id AND device_pin = p_pin AND status = 'active';

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized or inactive';
    END IF;

    -- If device is bound and p_device_id is provided, verify anti-spoofing
    IF v_bound_device IS NOT NULL AND p_device_id IS NOT NULL AND p_device_id != '' AND v_bound_device != p_device_id THEN
        RAISE EXCEPTION 'لا يمكن تسجيل الحضور من جهاز غير موثق بحسابك';
    END IF;

    IF NOT v_allow_gps THEN
        RAISE EXCEPTION 'GPS punch is not allowed for this employee';
    END IF;

    -- Determine punch type (check_in vs check_out)
    -- We look for the last punch today in raw_attendance_logs
    SELECT status INTO v_last_punch
    FROM public.raw_attendance_logs
    WHERE user_pin = p_pin 
      AND date(timestamp) = current_date
    ORDER BY timestamp DESC
    LIMIT 1;

    -- status 0 = check_in, 1 = check_out
    IF v_last_punch IS NULL OR v_last_punch.status = '1' THEN
        v_punch_type := '0'; -- check_in
    ELSE
        v_punch_type := '1'; -- check_out
    END IF;

    -- Insert raw attendance record
    INSERT INTO public.raw_attendance_logs (
        company_id, user_pin, timestamp, status, 
        is_processed, punch_method, gps_lat, gps_lng
    ) VALUES (
        v_company_id, p_pin, now(), v_punch_type, 
        false, 'mobile_gps', p_lat, p_lng
    );

    RETURN json_build_object(
        'success', true,
        'punch_type', CASE WHEN v_punch_type = '0' THEN 'check_in' ELSE 'check_out' END,
        'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
