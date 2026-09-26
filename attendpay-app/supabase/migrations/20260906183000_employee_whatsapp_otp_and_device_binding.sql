-- Migration: 20260906183000_employee_whatsapp_otp_and_device_binding.sql
-- Description: Employee first-time WhatsApp OTP verification & Anti-Collusion Device Binding

-- 1. Add device binding columns to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bound_device_id text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bound_device_name text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS device_bound_at timestamptz;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS first_login_at timestamptz;

-- 2. Create index for fast device lookup
CREATE INDEX IF NOT EXISTS idx_employees_bound_device_id ON employees(bound_device_id);

-- 3. Create employee_otp_verifications table
CREATE TABLE IF NOT EXISTS employee_otp_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    phone text NOT NULL,
    otp_code text NOT NULL,
    device_id text NOT NULL,
    device_name text,
    attempts int DEFAULT 0,
    expires_at timestamptz DEFAULT (now() + interval '10 minutes'),
    created_at timestamptz DEFAULT now()
);

-- Index for fast OTP lookup
CREATE INDEX IF NOT EXISTS idx_employee_otp_verifications_emp ON employee_otp_verifications(employee_id, created_at DESC);

-- Allow anon and authenticated on employee_otp_verifications if RLS is enabled
ALTER TABLE employee_otp_verifications ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'employee_otp_verifications' AND policyname = 'Allow all on employee_otp_verifications'
    ) THEN
        CREATE POLICY "Allow all on employee_otp_verifications" ON employee_otp_verifications FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Helper to format phone for WhatsApp international format
CREATE OR REPLACE FUNCTION format_whatsapp_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_clean text;
BEGIN
    IF p_phone IS NULL OR trim(p_phone) = '' THEN
        RETURN NULL;
    END IF;

    -- Remove all non-digits
    v_clean := regexp_replace(p_phone, '[^0-9]', '', 'g');

    -- Strip leading 00
    IF substring(v_clean from 1 for 2) = '00' THEN
        v_clean := substring(v_clean from 3);
    END IF;

    -- Egyptian number: starts with 01 and length is 11 -> prefix with 2
    IF length(v_clean) = 11 AND substring(v_clean from 1 for 2) = '01' THEN
        v_clean := '2' || v_clean;
    -- Saudi number: starts with 05 and length is 10 -> prefix 966 (strip 0)
    ELSIF length(v_clean) = 10 AND substring(v_clean from 1 for 2) = '05' THEN
        v_clean := '966' || substring(v_clean from 2);
    END IF;

    RETURN v_clean;
END;
$$;

-- 5. Employee Login with Device Verification and WhatsApp OTP
CREATE OR REPLACE FUNCTION public.employee_login(
    p_phone text, 
    p_pin text, 
    p_device_id text DEFAULT NULL, 
    p_device_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    emp_record record;
    other_emp record;
    v_otp text;
    v_intl_phone text;
    v_masked_phone text;
BEGIN
    -- 1. Find employee by phone and PIN
    SELECT id, company_id, name, phone, device_pin, status, bound_device_id, bound_device_name INTO emp_record
    FROM public.employees
    WHERE phone = p_phone AND device_pin = p_pin
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'بيانات الدخول غير صحيحة (تأكد من رقم الهاتف ورقم البصمة PIN)';
    END IF;

    IF emp_record.status != 'active' THEN
        RAISE EXCEPTION 'حساب الموظف غير نشط، يرجى مراجعة إدارة الشركة';
    END IF;

    -- 2. Anti-Collusion Check: Is this device already bound to ANOTHER employee in the same company?
    IF p_device_id IS NOT NULL AND p_device_id != '' THEN
        SELECT id, name INTO other_emp
        FROM public.employees
        WHERE company_id = emp_record.company_id
          AND bound_device_id = p_device_id
          AND id != emp_record.id
          AND status = 'active'
        LIMIT 1;

        IF FOUND THEN
            RAISE EXCEPTION 'هذا الجهاز مسجل بالفعل لموظف آخر بالمنشأة (% ). منعاً لتسجيل الحضور بالنيابة، لا يمكن مشاركة نفس الجهاز بين الموظفين.', other_emp.name;
        END IF;
    END IF;

    -- 3. Check Device Binding Status:
    -- If employee has NO device bound yet (First login), OR logging in from a different device:
    -- Require WhatsApp OTP verification!
    IF emp_record.bound_device_id IS NULL OR (p_device_id IS NOT NULL AND emp_record.bound_device_id != p_device_id) THEN
        
        -- Generate 6-digit OTP
        v_otp := lpad(floor(random() * 1000000)::text, 6, '0');
        
        -- Delete any previous pending OTPs for this employee
        DELETE FROM employee_otp_verifications WHERE employee_id = emp_record.id;

        -- Insert new OTP
        INSERT INTO employee_otp_verifications (employee_id, phone, otp_code, device_id, device_name)
        VALUES (emp_record.id, emp_record.phone, v_otp, COALESCE(p_device_id, 'unknown_device'), p_device_name);

        -- Format WhatsApp phone
        v_intl_phone := format_whatsapp_phone(emp_record.phone);

        IF v_intl_phone IS NOT NULL AND v_intl_phone != '' THEN
            -- Queue high-priority WhatsApp message
            INSERT INTO whatsapp_queue (phone, message, priority, status)
            VALUES (
                v_intl_phone,
                '🔐 *كود التحقق لتسجيل الدخول إلى كـوادر:* ' || v_otp || E'\n\n' ||
                '📱 *الجهاز:* ' || COALESCE(p_device_name, 'جهاز جديد') || E'\n' ||
                '⏳ *الصلاحية:* 10 دقائق\n' ||
                '⚠️ *تنبيه أمني:* لا تشارك هذا الرمز مع أي شخص لمنع الدخول إلى حسابك أو تسجيل الحضور بالنيابة.',
                10,
                'pending'
            );
        END IF;

        -- Mask phone for privacy in UI (e.g. ***1234)
        v_masked_phone := '***' || substring(emp_record.phone from greatest(1, length(emp_record.phone) - 3));

        RETURN json_build_object(
            'success', false,
            'requires_otp', true,
            'is_first_login', (emp_record.bound_device_id IS NULL),
            'masked_phone', v_masked_phone,
            'employee_name', emp_record.name,
            'message', 'تم إرسال كود التحقق (OTP) إلى رقم واتساب الخاص بك لتأكيد هويتك وتوثيق جهازك'
        );
    END IF;

    -- 4. Authorized Device (Already bound and matches): Instant login!
    RETURN json_build_object(
        'success', true,
        'requires_otp', false,
        'employee_id', emp_record.id,
        'company_id', emp_record.company_id,
        'name', emp_record.name
    );
END;
$function$;

-- 6. Verify Employee Login OTP
CREATE OR REPLACE FUNCTION public.verify_employee_login_otp(
    p_phone text,
    p_pin text,
    p_otp text,
    p_device_id text,
    p_device_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    emp_record record;
    otp_record record;
BEGIN
    -- 1. Validate employee credentials
    SELECT id, company_id, name, phone, device_pin, status INTO emp_record
    FROM public.employees
    WHERE phone = p_phone AND device_pin = p_pin
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'بيانات الموظف غير صحيحة';
    END IF;

    -- 2. Find active OTP
    SELECT id, otp_code, attempts, expires_at INTO otp_record
    FROM employee_otp_verifications
    WHERE employee_id = emp_record.id
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'انتهت صلاحية رمز التحقق أو لم يتم طلبه، يرجى طلب رمز جديد';
    END IF;

    IF otp_record.attempts >= 3 THEN
        DELETE FROM employee_otp_verifications WHERE id = otp_record.id;
        RAISE EXCEPTION 'تم تجاوز عدد المحاولات الخاطئة المسموح بها (3 محاولات). يرجى طلب رمز جديد.';
    END IF;

    IF otp_record.otp_code != trim(p_otp) THEN
        UPDATE employee_otp_verifications 
        SET attempts = attempts + 1 
        WHERE id = otp_record.id;
        
        RAISE EXCEPTION 'رمز التحقق غير صحيح. المتبقي: % محاولات', (2 - otp_record.attempts);
    END IF;

    -- 3. Success: Bind device to employee & record first login
    UPDATE public.employees
    SET bound_device_id = p_device_id,
        bound_device_name = COALESCE(p_device_name, bound_device_name, 'Unknown Device'),
        device_bound_at = now(),
        first_login_at = COALESCE(first_login_at, now())
    WHERE id = emp_record.id;

    -- Delete used OTP
    DELETE FROM employee_otp_verifications WHERE id = otp_record.id;

    RETURN json_build_object(
        'success', true,
        'employee_id', emp_record.id,
        'company_id', emp_record.company_id,
        'name', emp_record.name,
        'message', 'تم توثيق الجهاز وتسجيل الدخول بنجاح'
    );
END;
$function$;

-- 7. Admin RPC to reset bound device if employee changed their phone
DROP FUNCTION IF EXISTS public.admin_reset_employee_device(uuid, uuid);

CREATE OR REPLACE FUNCTION public.admin_reset_employee_device(
    p_employee_id uuid,
    p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    UPDATE public.employees
    SET bound_device_id = NULL,
        bound_device_name = NULL,
        device_bound_at = NULL
    WHERE id = p_employee_id AND company_id = p_company_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم فك ربط الجهاز بنجاح. سيطلب منه رمز OTP عند تسجيل الدخول القادم.'
    );
END;
$function$;
