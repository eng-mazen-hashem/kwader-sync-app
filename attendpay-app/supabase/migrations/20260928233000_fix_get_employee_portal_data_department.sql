-- Migration: 20260928233000_fix_get_employee_portal_data_department.sql
-- Description: Fix get_employee_portal_data to use department_id and subquery department name instead of nonexistent employees.department

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
        SELECT id, name, phone, position, job_title, department_id,
               (SELECT name FROM public.departments WHERE id = department_id) as department,
               base_salary, 
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
