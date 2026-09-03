-- Migration: 20260512010000_fix_attendance_missing_checkout.sql
-- ─── إصلاح: معالجة نسيان بصمة الانصراف في الشيفتات الليلية والمرنة ──────────

CREATE OR REPLACE FUNCTION process_raw_attendance_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_id uuid;
    v_last_record record;
    v_hours_diff numeric;
    v_shift record;
    v_check_in_ts timestamp;
    v_new_time text;
    v_new_date date;
    
    -- Variables for metrics
    v_start_mins int;
    v_end_mins   int;
    v_in_mins    int;
    v_out_mins   int;
    v_grace_mins int;
    v_late_mins  int := 0;
    v_early_leave_mins int := 0;
    v_work_hours numeric := 0;
    v_status  text := 'present';
    v_shift_duration int;
    v_out_from_start int;
    v_diff int;

    -- ─── جديد: حد الساعات الأقصى للشيفت ──────────────────────────────────
    v_max_shift_hours numeric;
    v_expected_hours  numeric;
BEGIN
    -- Only process unprocessed logs
    IF NEW.is_processed THEN
        RETURN NEW;
    END IF;

    -- Find employee_id from user_pin
    SELECT id INTO v_employee_id
    FROM employees
    WHERE device_pin = NEW.user_pin AND company_id = NEW.company_id
    LIMIT 1;

    IF v_employee_id IS NULL THEN
        NEW.is_processed := true;
        RETURN NEW;
    END IF;

    v_new_time := to_char(NEW.timestamp, 'HH24:MI');
    v_new_date := NEW.timestamp::date;

    -- Get shift info for employee
    SELECT s.* INTO v_shift
    FROM shifts s
    JOIN shift_employees se ON se.shift_id = s.id
    WHERE se.employee_id = v_employee_id AND s.company_id = NEW.company_id
    LIMIT 1;

    -- ─── تحديد الحد الزمني الأقصى للشيفت ─────────────────────────────────
    -- الشيفت المرن: target_hours × 1.5 (بحد أقصى 20 ساعة)
    -- الشيفت الثابت: مدة الشيفت × 1.5 (بحد أدنى 12 ساعة وأقصى 20)
    IF v_shift.id IS NOT NULL THEN
        IF v_shift.shift_type = 'flexible' THEN
            v_expected_hours := COALESCE(v_shift.target_hours, 8);
            v_max_shift_hours := LEAST(v_expected_hours * 1.5, 20);
        ELSE
            -- حساب مدة الشيفت الثابت
            v_start_mins := (cast(substring(v_shift.start_time::text from 1 for 2) as int) * 60)
                          + cast(substring(v_shift.start_time::text from 4 for 2) as int);
            v_end_mins   := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                          + cast(substring(v_shift.end_time::text from 4 for 2) as int);
            IF v_end_mins <= v_start_mins THEN
                v_end_mins := v_end_mins + (24 * 60); -- شيفت ليلي
            END IF;
            v_expected_hours  := ROUND((v_end_mins - v_start_mins)::numeric / 60, 1);
            -- حد 150% من مدة الشيفت، بحد أدنى 12 وأقصى 22 ساعة
            v_max_shift_hours := LEAST(GREATEST(v_expected_hours * 1.5, 12), 22);
        END IF;
    ELSE
        -- لا يوجد شيفت: حد افتراضي 16 ساعة
        v_max_shift_hours := 16;
        v_expected_hours  := 8;
    END IF;

    -- Find the last record in processed_attendance
    SELECT * INTO v_last_record
    FROM processed_attendance
    WHERE employee_id = v_employee_id
      AND company_id = NEW.company_id
    ORDER BY date DESC, check_in DESC
    LIMIT 1;

    IF v_last_record.id IS NOT NULL AND v_last_record.check_out IS NULL THEN
        -- لدينا سجل مفتوح (بدون check_out)
        v_check_in_ts := (v_last_record.date::text || ' ' || v_last_record.check_in)::timestamp;
        v_hours_diff  := EXTRACT(EPOCH FROM (NEW.timestamp - v_check_in_ts)) / 3600;

        IF v_hours_diff > 0 AND v_hours_diff <= v_max_shift_hours THEN
            -- ─── الحالة الطبيعية: البصمة ضمن نافذة الشيفت → انصراف ──────────
            
            -- حساب المقاييس
            v_in_mins  := (cast(substring(v_last_record.check_in from 1 for 2) as int) * 60)
                        + cast(substring(v_last_record.check_in from 4 for 2) as int);
            v_out_mins := (cast(substring(v_new_time from 1 for 2) as int) * 60)
                        + cast(substring(v_new_time from 4 for 2) as int);

            -- إعادة تعيين start/end بعد الحد الزمني (قد تُحسب مرة أخرى)
            IF v_shift.id IS NOT NULL THEN
                v_start_mins := (cast(substring(v_shift.start_time::text from 1 for 2) as int) * 60)
                              + cast(substring(v_shift.start_time::text from 4 for 2) as int);
                v_end_mins   := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                              + cast(substring(v_shift.end_time::text from 4 for 2) as int);
                v_grace_mins := COALESCE(v_shift.grace_minutes, 0);
            ELSE
                v_start_mins := 8 * 60;
                v_end_mins   := 17 * 60;
                v_grace_mins := 0;
            END IF;

            -- للشيفت المرن: لا نحسب تأخير بناءً على start_time (هو استرشادي فقط)
            IF v_shift.id IS NOT NULL AND v_shift.shift_type = 'flexible' THEN
                -- الشيفت المرن: التأخير يُقاس فقط إذا كان المستخدم قد ضبط start_time
                -- ولكن الأهم هو عدد ساعات العمل الفعلية مقابل target_hours
                v_late_mins := 0; -- لا تأخير في المرن (الملاحظة للإدارة فقط)
            ELSE
                -- الشيفت الثابت: حساب التأخير الطبيعي
                IF v_in_mins > v_start_mins + v_grace_mins THEN
                    v_late_mins := v_in_mins - v_start_mins;
                END IF;
            END IF;

            -- حساب ساعات العمل الفعلية
            v_diff := v_out_mins - v_in_mins;
            IF v_diff < 0 THEN v_diff := v_diff + (24 * 60); END IF;

            BEGIN
                IF v_shift.id IS NOT NULL AND v_shift.break_duration IS NOT NULL THEN
                    v_diff := v_diff - cast(v_shift.break_duration as int);
                END IF;
            EXCEPTION WHEN OTHERS THEN
                NULL; -- تجاهل آمن
            END;

            v_work_hours := ROUND(GREATEST(0, v_diff::numeric / 60.0), 2);

            -- حساب الانصراف المبكر (للشيفت الثابت فقط)
            IF v_shift.id IS NULL OR v_shift.shift_type != 'flexible' THEN
                v_shift_duration := v_end_mins - v_start_mins;
                IF v_shift_duration < 0 THEN v_shift_duration := v_shift_duration + (24 * 60); END IF;

                v_out_from_start := v_out_mins - v_start_mins;
                IF v_out_from_start < 0 THEN v_out_from_start := v_out_from_start + (24 * 60); END IF;

                IF v_out_from_start < v_shift_duration THEN
                    v_early_leave_mins := v_shift_duration - v_out_from_start;
                END IF;
            END IF;

            -- الحالة النهائية
            IF v_late_mins > 0 THEN v_status := 'late';
            ELSIF v_early_leave_mins > 0 THEN v_status := 'early_leave';
            ELSE v_status := 'present';
            END IF;

            -- تحديث سجل الحضور
            UPDATE processed_attendance
            SET check_out          = v_new_time,
                work_hours         = v_work_hours,
                late_minutes       = v_late_mins,
                early_leave_minutes= v_early_leave_mins,
                status             = v_status
            WHERE id = v_last_record.id;

            NEW.is_processed := true;
            RETURN NEW;

        ELSIF v_hours_diff > v_max_shift_hours THEN
            -- ─── المشكلة الرئيسية: فجوة كبيرة = نسيان بصمة انصراف ─────────
            -- الإصلاح: أغلق السجل المفتوح بـ "انصراف تقديري" ثم أنشئ check_in جديد
            
            -- 1. أغلق السجل المفتوح بـ end_time الشيفت كتقدير (أو check_in + expected_hours)
            DECLARE
                v_estimated_out_mins int;
                v_estimated_out text;
                v_estimated_work numeric;
            BEGIN
                IF v_shift.id IS NOT NULL THEN
                    v_start_mins := (cast(substring(v_shift.start_time::text from 1 for 2) as int) * 60)
                                  + cast(substring(v_shift.start_time::text from 4 for 2) as int);
                    v_end_mins   := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                                  + cast(substring(v_shift.end_time::text from 4 for 2) as int);
                    IF v_end_mins <= v_start_mins THEN v_end_mins := v_end_mins + (24 * 60); END IF;

                    -- وقت الانصراف التقديري = check_in + expected_hours
                    v_in_mins := (cast(substring(v_last_record.check_in from 1 for 2) as int) * 60)
                               + cast(substring(v_last_record.check_in from 4 for 2) as int);
                    v_estimated_out_mins := (v_in_mins + ROUND(v_expected_hours * 60)::int) % (24 * 60);
                    v_estimated_work     := v_expected_hours;
                ELSE
                    v_in_mins := (cast(substring(v_last_record.check_in from 1 for 2) as int) * 60)
                               + cast(substring(v_last_record.check_in from 4 for 2) as int);
                    v_estimated_out_mins := (v_in_mins + 8 * 60) % (24 * 60);
                    v_estimated_work     := 8;
                END IF;

                v_estimated_out := lpad((v_estimated_out_mins / 60)::text, 2, '0') || ':' 
                                 || lpad((v_estimated_out_mins % 60)::text, 2, '0');

                -- أغلق السجل المفتوح بوقت تقديري مع ملاحظة
                UPDATE processed_attendance
                SET check_out           = v_estimated_out,
                    work_hours          = v_estimated_work,
                    status              = 'missing_checkout', -- حالة جديدة تشير لغياب البصمة
                    early_leave_minutes = 0
                WHERE id = v_last_record.id;
            END;
        END IF;
        -- بعد إغلاق السجل (سواء بالحالتين) → سقط عبر الكود ليُنشئ check_in جديد
    END IF;

    -- ─── إنشاء سجل check_in جديد ─────────────────────────────────────────────
    v_late_mins := 0;
    v_status    := 'present';
    v_in_mins   := (cast(substring(v_new_time from 1 for 2) as int) * 60)
                 + cast(substring(v_new_time from 4 for 2) as int);
    
    IF v_shift.id IS NOT NULL THEN
        v_start_mins := (cast(substring(v_shift.start_time::text from 1 for 2) as int) * 60)
                      + cast(substring(v_shift.start_time::text from 4 for 2) as int);
        v_grace_mins := COALESCE(v_shift.grace_minutes, 0);

        -- الشيفت المرن: لا نحسب تأخيراً من start_time الاسترشادي
        IF v_shift.shift_type != 'flexible' THEN
            IF v_in_mins > v_start_mins + v_grace_mins THEN
                v_late_mins := v_in_mins - v_start_mins;
                v_status    := 'late';
            END IF;
        END IF;
    ELSE
        v_start_mins := 8 * 60;
        v_grace_mins := 0;
        IF v_in_mins > v_start_mins + v_grace_mins THEN
            v_late_mins := v_in_mins - v_start_mins;
            v_status    := 'late';
        END IF;
    END IF;

    INSERT INTO processed_attendance (
        company_id, employee_id, date, check_in, status, late_minutes, early_leave_minutes, work_hours
    ) VALUES (
        NEW.company_id, v_employee_id, v_new_date, v_new_time, v_status, v_late_mins, 0, 0
    );

    NEW.is_processed := true;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── إعادة إنشاء التريجر ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_raw_attendance_insert ON raw_attendance_logs;

CREATE TRIGGER on_raw_attendance_insert
BEFORE INSERT ON raw_attendance_logs
FOR EACH ROW
EXECUTE FUNCTION process_raw_attendance_trigger();

-- ─── إضافة حالة "بصمة الانصراف مفقودة" إلى القيم المسموحة ──────────────────
-- تأكد من أن العمود يقبل هذه القيمة الجديدة إذا كان مقيداً
DO $$
BEGIN
    -- إضافة القيمة 'missing_checkout' إذا كان العمود enum (آمن إذا لم يكن كذلك)
    ALTER TABLE processed_attendance
        DROP CONSTRAINT IF EXISTS processed_attendance_status_check;
    
    ALTER TABLE processed_attendance
        ADD CONSTRAINT processed_attendance_status_check
        CHECK (status IN ('present', 'absent', 'late', 'early_leave', 'missing_checkout', 'on_leave'));
EXCEPTION WHEN OTHERS THEN
    NULL; -- تجاهل آمن إذا لم يكن constraint موجوداً
END;
$$;

COMMENT ON COLUMN processed_attendance.status IS 
  'present | late | early_leave | absent | on_leave | missing_checkout (أُغلق تلقائياً لنسيان بصمة الانصراف)';
