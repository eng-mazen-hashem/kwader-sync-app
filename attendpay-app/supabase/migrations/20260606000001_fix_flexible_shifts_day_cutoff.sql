-- Migration: 20260606000001_fix_flexible_shifts_day_cutoff.sql
-- Description: Introduces Logical Date for Flexible Shifts (05:00 AM cutoff) and adds reprocessing RPC.

CREATE OR REPLACE FUNCTION process_raw_attendance_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_id uuid;
    v_shift record;
    v_new_time text;
    v_new_date date;
    v_logical_start timestamp;
    v_logical_end timestamp;
    
    -- Metrics
    v_start_mins int;
    v_end_mins   int;
    v_in_mins    int;
    v_out_mins   int;
    v_grace_mins int;
    v_late_mins  int := 0;
    v_early_leave_mins int := 0;
    v_work_hours numeric := 0;
    v_status  text := 'present';
    v_diff int;

    v_max_shift_hours numeric;
    v_expected_hours  numeric;
    
    -- Variables for previous day open record
    v_prev_open_record record;
    v_check_in_ts timestamp;
    v_hours_diff numeric;
    
    -- Variables for chronological sorting
    v_today_record_id uuid;
    v_today_status text;
    v_punch_ts timestamp;
    v_first_punch timestamp := NULL;
    v_last_punch timestamp := NULL;
    v_punch_count int := 0;
    
    -- For deduct_actual
    v_prev_ts timestamp := NULL;
    v_total_seconds numeric := 0;
    
    -- For early_leave / breaks
    v_is_inside_break boolean := false;
    v_break_start_mins int;
    v_break_end_mins int;
BEGIN
    -- Only process unprocessed logs
    IF NEW.is_processed THEN
        RETURN NEW;
    END IF;

    -- ─── 1. DEBOUNCE / LOCKOUT PERIOD (5 MINUTES) ─────────
    IF EXISTS (
        SELECT 1 
        FROM raw_attendance_logs
        WHERE user_pin = NEW.user_pin 
          AND company_id = NEW.company_id
          AND id != NEW.id
          AND ABS(EXTRACT(EPOCH FROM (NEW.timestamp - timestamp))) < 300
    ) THEN
        NEW.is_processed := true;
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

    -- Get shift info for employee
    SELECT s.* INTO v_shift
    FROM shifts s
    JOIN shift_employees se ON se.shift_id = s.id
    WHERE se.employee_id = v_employee_id AND s.company_id = NEW.company_id
    LIMIT 1;

    -- ─── LOGICAL DATE ASSIGNMENT ─────────────────────────
    IF v_shift.id IS NOT NULL AND v_shift.shift_type = 'flexible' THEN
        -- Smart Day Cutoff for Flexible Shifts (05:00 AM)
        IF NEW.timestamp::time < '05:00:00'::time THEN
            v_new_date := (NEW.timestamp - INTERVAL '1 day')::date;
        ELSE
            v_new_date := NEW.timestamp::date;
        END IF;
    ELSE
        v_new_date := NEW.timestamp::date;
    END IF;

    -- Calculate Maximum Shift Duration
    IF v_shift.id IS NOT NULL THEN
        IF v_shift.shift_type = 'flexible' THEN
            v_expected_hours := COALESCE(v_shift.target_hours, 8);
            v_max_shift_hours := LEAST(v_expected_hours * 1.5, 20);
        ELSE
            v_start_mins := (cast(substring(v_shift.start_time::text from 1 for 2) as int) * 60)
                          + cast(substring(v_shift.start_time::text from 4 for 2) as int);
            v_end_mins   := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                          + cast(substring(v_shift.end_time::text from 4 for 2) as int);
            IF v_end_mins <= v_start_mins THEN
                v_end_mins := v_end_mins + (24 * 60);
            END IF;
            v_expected_hours  := ROUND((v_end_mins - v_start_mins)::numeric / 60, 1);
            v_max_shift_hours := LEAST(GREATEST(v_expected_hours * 1.5, 12), 22);
        END IF;
    ELSE
        v_max_shift_hours := 16;
        v_expected_hours  := 8;
    END IF;

    -- ─── 2. PREVIOUS DAY NIGHT SHIFT CHECK ────────
    SELECT * INTO v_prev_open_record
    FROM processed_attendance
    WHERE employee_id = v_employee_id
      AND company_id = NEW.company_id
      AND date < v_new_date
      AND check_out IS NULL
      AND status != 'missing_checkout'
    ORDER BY date DESC
    LIMIT 1;

    IF v_prev_open_record.id IS NOT NULL THEN
        v_check_in_ts := (v_prev_open_record.date::text || ' ' || v_prev_open_record.check_in)::timestamp;
        
        -- If the previous date was a flexible shift, the check_in_ts might be logically off if they punched after midnight.
        -- But since we store the logical date in `date`, calculating difference is mostly accurate.
        v_hours_diff  := EXTRACT(EPOCH FROM (NEW.timestamp::timestamp - v_check_in_ts)) / 3600;

        -- If this punch naturally belongs to the previous day's open session (Night shift checkout)
        IF v_hours_diff > 0 AND v_hours_diff <= v_max_shift_hours THEN
            v_in_mins  := (cast(substring(v_prev_open_record.check_in::text from 1 for 2) as int) * 60)
                        + cast(substring(v_prev_open_record.check_in::text from 4 for 2) as int);
            v_out_mins := (cast(substring(v_new_time from 1 for 2) as int) * 60)
                        + cast(substring(v_new_time from 4 for 2) as int);

            v_diff := v_out_mins - v_in_mins;
            IF v_diff < 0 THEN v_diff := v_diff + (24 * 60); END IF;

            IF v_shift.id IS NOT NULL AND v_shift.break_duration IS NOT NULL THEN
                v_diff := v_diff - cast(v_shift.break_duration as int);
            END IF;

            v_work_hours := ROUND(GREATEST(0, v_diff::numeric / 60.0), 2);

            v_early_leave_mins := 0;
            IF v_shift.id IS NOT NULL AND v_shift.shift_type != 'flexible' THEN
                v_end_mins := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                            + cast(substring(v_shift.end_time::text from 4 for 2) as int);
                v_diff := v_end_mins - v_out_mins;
                IF v_diff > 0 AND v_diff < 720 THEN
                    v_early_leave_mins := v_diff;
                END IF;
            END IF;

            IF v_prev_open_record.late_minutes > 0 THEN v_status := 'late';
            ELSIF v_early_leave_mins > 0 THEN v_status := 'early_leave';
            ELSE v_status := 'present';
            END IF;

            UPDATE processed_attendance
            SET check_out           = v_new_time::time,
                work_hours          = v_work_hours,
                early_leave_minutes = v_early_leave_mins,
                status              = v_status
            WHERE id = v_prev_open_record.id;

            NEW.is_processed := true;
            RETURN NEW;

        ELSIF v_hours_diff > v_max_shift_hours THEN
            -- Close it out as missing_checkout
            UPDATE processed_attendance
            SET check_out           = NULL,
                work_hours          = 0,
                status              = 'missing_checkout',
                early_leave_minutes = 0
            WHERE id = v_prev_open_record.id;
        END IF;
    END IF;

    -- ─── 3. SMART CHRONOLOGICAL SORTING FOR TODAY ──────────────
    IF v_shift.id IS NOT NULL AND v_shift.shift_type = 'flexible' THEN
        v_logical_start := (v_new_date::text || ' 05:00:00')::timestamp;
        -- Use INTERVAL to correctly handle end of month/year
        v_logical_end   := (v_new_date + INTERVAL '1 day')::date::text::timestamp + INTERVAL '04:59:59';
    ELSE
        v_logical_start := (v_new_date::text || ' 00:00:00')::timestamp;
        v_logical_end   := (v_new_date::text || ' 23:59:59')::timestamp;
    END IF;

    FOR v_punch_ts IN (
        SELECT timestamp
        FROM raw_attendance_logs
        WHERE user_pin = NEW.user_pin
          AND company_id = NEW.company_id
          AND timestamp >= v_logical_start
          AND timestamp <= v_logical_end
          AND id != NEW.id
        UNION ALL
        SELECT NEW.timestamp
        ORDER BY 1 ASC
    ) LOOP
        v_punch_count := v_punch_count + 1;
        IF v_first_punch IS NULL THEN
            v_first_punch := v_punch_ts;
        END IF;
        v_last_punch := v_punch_ts;
        
        -- Logic for deduct_actual (pairing check-ins and check-outs)
        IF COALESCE(v_shift.break_policy, 'ignore_temp') = 'deduct_actual' THEN
            IF v_prev_ts IS NOT NULL THEN
                v_total_seconds := v_total_seconds + EXTRACT(EPOCH FROM (v_punch_ts - v_prev_ts));
                v_prev_ts := NULL;
            ELSE
                v_prev_ts := v_punch_ts;
            END IF;
        END IF;
    END LOOP;

    -- ─── 4. RECALCULATE CHECK-IN & LATE MINUTES ──────────────
    v_in_mins := (cast(substring(to_char(v_first_punch, 'HH24:MI') from 1 for 2) as int) * 60)
               + cast(substring(to_char(v_first_punch, 'HH24:MI') from 4 for 2) as int);
               
    v_late_mins := 0;
    IF v_shift.id IS NOT NULL THEN
        v_start_mins := (cast(substring(v_shift.start_time::text from 1 for 2) as int) * 60)
                      + cast(substring(v_shift.start_time::text from 4 for 2) as int);
        v_grace_mins := COALESCE(v_shift.grace_minutes, 0);

        IF v_shift.shift_type != 'flexible' THEN
            v_diff := v_in_mins - v_start_mins;
            IF v_diff < -720 THEN
                v_diff := v_diff + (24 * 60);
            END IF;
            IF v_diff > v_grace_mins THEN
                v_late_mins := v_diff;
            END IF;
        END IF;
    ELSE
        v_start_mins := 8 * 60;
        v_grace_mins := 0;
        v_diff := v_in_mins - v_start_mins;
        IF v_diff < -720 THEN v_diff := v_diff + (24 * 60); END IF;
        IF v_diff > v_grace_mins THEN
            v_late_mins := v_diff;
        END IF;
    END IF;

    -- ─── 5. RECALCULATE CHECK-OUT, EARLY LEAVE & WORK HOURS ───
    v_work_hours := 0;
    v_early_leave_mins := 0;
    
    SELECT id, status INTO v_today_record_id, v_today_status
    FROM processed_attendance
    WHERE employee_id = v_employee_id
      AND company_id = NEW.company_id
      AND date = v_new_date
    LIMIT 1;
    
    IF v_punch_count = 1 THEN
        v_last_punch := NULL;
    ELSE
        IF COALESCE(v_shift.break_policy, 'ignore_temp') = 'deduct_actual' AND v_punch_count % 2 != 0 THEN
            v_last_punch := NULL;
            v_work_hours := ROUND(v_total_seconds::numeric / 3600.0, 2);
        END IF;
    END IF;

    IF v_last_punch IS NOT NULL THEN
        v_out_mins := (cast(substring(to_char(v_last_punch, 'HH24:MI') from 1 for 2) as int) * 60)
                    + cast(substring(to_char(v_last_punch, 'HH24:MI') from 4 for 2) as int);

        v_is_inside_break := false;
        IF v_shift.id IS NOT NULL AND v_shift.has_break AND v_shift.break_start IS NOT NULL AND v_shift.break_duration IS NOT NULL THEN
            v_break_start_mins := (cast(substring(v_shift.break_start::text from 1 for 2) as int) * 60)
                                + cast(substring(v_shift.break_start::text from 4 for 2) as int);
            v_break_end_mins := v_break_start_mins + v_shift.break_duration;
            IF v_out_mins >= v_break_start_mins AND v_out_mins <= v_break_end_mins THEN
                v_is_inside_break := true;
            END IF;
        END IF;

        IF NOT v_is_inside_break AND (v_shift.id IS NULL OR v_shift.shift_type != 'flexible') THEN
            v_end_mins := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                        + cast(substring(v_shift.end_time::text from 4 for 2) as int);
            v_diff := v_end_mins - v_out_mins;
            IF v_diff > 0 THEN
                v_early_leave_mins := v_diff;
            END IF;
        END IF;
        
        IF COALESCE(v_shift.break_policy, 'ignore_temp') = 'deduct_actual' THEN
            v_work_hours := ROUND(v_total_seconds::numeric / 3600.0, 2);
        ELSE
            v_diff := v_out_mins - v_in_mins;
            IF v_diff < 0 THEN v_diff := v_diff + (24 * 60); END IF;
            IF v_shift.id IS NOT NULL AND v_shift.break_duration IS NOT NULL THEN
                v_diff := v_diff - cast(v_shift.break_duration as int);
            END IF;
            v_work_hours := ROUND(GREATEST(0, v_diff::numeric / 60.0), 2);
        END IF;
    END IF;

    -- ─── 6. DETERMINE FINAL STATUS ──────────────
    IF v_today_status = 'missing_checkout' AND v_last_punch IS NULL THEN
        v_status := 'missing_checkout';
    ELSIF v_late_mins > 0 THEN 
        v_status := 'late';
    ELSIF v_early_leave_mins > 0 THEN 
        v_status := 'early_leave';
    ELSE 
        v_status := 'present';
    END IF;

    -- ─── 7. UPSERT PROCESSED RECORD ──────────────
    IF v_today_record_id IS NOT NULL THEN
        UPDATE processed_attendance
        SET check_in            = v_first_punch::time,
            check_out           = CASE WHEN v_last_punch IS NOT NULL THEN v_last_punch::time ELSE NULL END,
            work_hours          = v_work_hours,
            late_minutes        = v_late_mins,
            early_leave_minutes = v_early_leave_mins,
            status              = v_status
        WHERE id = v_today_record_id;
    ELSE
        INSERT INTO processed_attendance (
            company_id, employee_id, date, check_in, check_out, status, late_minutes, early_leave_minutes, work_hours
        ) VALUES (
            NEW.company_id, v_employee_id, v_new_date, 
            v_first_punch::time, 
            CASE WHEN v_last_punch IS NOT NULL THEN v_last_punch::time ELSE NULL END, 
            v_status, v_late_mins, v_early_leave_mins, v_work_hours
        );
    END IF;

    NEW.is_processed := true;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach the trigger for both INSERT and UPDATE of is_processed
DROP TRIGGER IF EXISTS on_raw_attendance_insert ON raw_attendance_logs;
CREATE TRIGGER on_raw_attendance_insert
BEFORE INSERT OR UPDATE OF is_processed ON raw_attendance_logs
FOR EACH ROW
EXECUTE FUNCTION process_raw_attendance_trigger();

-- Create RPC to safely reprocess all flexible shift employees
CREATE OR REPLACE FUNCTION reprocess_flexible_shifts()
RETURNS void AS $$
DECLARE
    emp_record record;
BEGIN
    FOR emp_record IN 
        SELECT se.employee_id 
        FROM shift_employees se
        JOIN shifts s ON s.id = se.shift_id
        WHERE s.shift_type = 'flexible'
    LOOP
        -- Delete all their processed attendance
        DELETE FROM processed_attendance WHERE employee_id = emp_record.employee_id;
        
        -- Touch raw logs chronologically to fire the UPDATE trigger
        -- We must process them strictly in chronological order.
        -- In PostgreSQL, an UPDATE statement processes rows in an arbitrary order unless using a cursor or loop.
        -- Therefore, we must loop through each row.
        DECLARE
            log_rec record;
        BEGIN
            FOR log_rec IN 
                SELECT id 
                FROM raw_attendance_logs 
                WHERE employee_id = emp_record.employee_id 
                ORDER BY timestamp ASC
            LOOP
                UPDATE raw_attendance_logs
                SET is_processed = false
                WHERE id = log_rec.id;
            END LOOP;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
