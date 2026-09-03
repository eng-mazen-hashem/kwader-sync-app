-- ==============================================================================
-- Migration: Employee Portal & GPS Punch Features
-- ==============================================================================

-- 1. Add allow_gps_punch to employees
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS allow_gps_punch BOOLEAN DEFAULT false;

-- 2. Add GPS and Method tracking to attendance logs
ALTER TABLE public.raw_attendance_logs
ADD COLUMN IF NOT EXISTS punch_method TEXT DEFAULT 'device', -- 'device', 'mobile_gps', 'manual'
ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION;

-- 3. Create a custom RPC function for Employee Login (Mobile App)
-- Employees don't have Supabase Auth accounts, so we verify phone and PIN
CREATE OR REPLACE FUNCTION public.employee_login(p_phone text, p_pin text)
RETURNS json AS $$
DECLARE
    emp_record record;
BEGIN
    SELECT id, company_id, name, status INTO emp_record
    FROM public.employees
    WHERE phone = p_phone AND device_pin = p_pin
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid phone number or PIN';
    END IF;

    IF emp_record.status != 'active' THEN
        RAISE EXCEPTION 'Employee account is not active';
    END IF;

    -- Return employee info (client will store this in localStorage)
    RETURN json_build_object(
        'success', true,
        'employee_id', emp_record.id,
        'company_id', emp_record.company_id,
        'name', emp_record.name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable employees to fetch their own data
-- Since they don't use Supabase Auth, they connect anonymously or with a generic public anon key.
-- But wait, public anon key can't bypass RLS if it's restricted.
-- Actually, the client will use standard Supabase client. 
-- RLS policies need to allow read/write if the request passes the employee_id, BUT this is insecure without an auth token.
-- A better way: Provide RPC functions for the mobile app that use SECURITY DEFINER to bypass RLS safely.

-- RPC to get employee details
CREATE OR REPLACE FUNCTION public.get_employee_portal_data(p_employee_id uuid, p_pin text)
RETURNS json AS $$
DECLARE
    emp_data json;
BEGIN
    -- Verify employee
    IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND device_pin = p_pin AND status = 'active') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT row_to_json(e) INTO emp_data
    FROM (
        SELECT id, name, phone, base_salary, status, allow_gps_punch, 
               (SELECT name FROM public.companies WHERE id = company_id) as company_name
        FROM public.employees 
        WHERE id = p_employee_id
    ) e;

    RETURN emp_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to submit a GPS punch
CREATE OR REPLACE FUNCTION public.submit_gps_punch(
    p_employee_id uuid, 
    p_pin text, 
    p_lat DOUBLE PRECISION, 
    p_lng DOUBLE PRECISION
)
RETURNS json AS $$
DECLARE
    v_company_id uuid;
    v_allow_gps boolean;
    v_last_punch record;
    v_punch_type text;
BEGIN
    -- Verify employee
    SELECT company_id, allow_gps_punch INTO v_company_id, v_allow_gps
    FROM public.employees 
    WHERE id = p_employee_id AND device_pin = p_pin AND status = 'active';

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized or inactive';
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
