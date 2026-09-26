-- Fix employee_otp_verifications column defaults
ALTER TABLE public.employee_otp_verifications 
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '10 minutes');

ALTER TABLE public.employee_otp_verifications 
  ALTER COLUMN created_at SET DEFAULT now();

-- Resync whatsapp_queue sequence if out of sync
SELECT setval(pg_get_serial_sequence('public.whatsapp_queue', 'id'), COALESCE((SELECT MAX(id) FROM public.whatsapp_queue), 0) + 1, false);

-- Resync all serial sequences in public schema
DO $$
DECLARE
    r RECORD;
    max_val bigint;
BEGIN
    FOR r IN (
        SELECT table_schema, table_name, column_name, 
               pg_get_serial_sequence(table_schema || '.' || table_name, column_name) as sequence_name
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND column_default LIKE 'nextval%'
    ) LOOP
        IF r.sequence_name IS NOT NULL THEN
            EXECUTE format('SELECT COALESCE(MAX(%I), 0) + 1 FROM %I.%I', r.column_name, r.table_schema, r.table_name) INTO max_val;
            EXECUTE format('SELECT setval(%L, %s, false)', r.sequence_name, max_val);
        END IF;
    END LOOP;
END $$;

-- Update employee_login function to explicitly supply expires_at and created_at
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

        -- Insert new OTP with explicit expires_at
        INSERT INTO employee_otp_verifications (
            employee_id, 
            phone, 
            otp_code, 
            device_id, 
            device_name, 
            expires_at, 
            created_at
        )
        VALUES (
            emp_record.id, 
            emp_record.phone, 
            v_otp, 
            COALESCE(p_device_id, 'unknown_device'), 
            p_device_name,
            now() + interval '10 minutes',
            now()
        );

        -- Format WhatsApp phone
        v_intl_phone := format_whatsapp_phone(emp_record.phone);

        IF v_intl_phone IS NOT NULL AND v_intl_phone != '' THEN
            -- Queue high-priority WhatsApp message
            INSERT INTO whatsapp_queue (phone, message, priority, status)
            VALUES (
                v_intl_phone,
                '🔐 *كود التحقق لتسجيل الدخول إلى كـوادر:* ' || v_otp || chr(10) || chr(10) ||
                '📱 *الجهاز:* ' || COALESCE(p_device_name, 'جهاز جديد') || chr(10) ||
                '⏳ *الصلاحية:* 10 دقائق' || chr(10) ||
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
