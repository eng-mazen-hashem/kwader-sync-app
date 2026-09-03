-- Migration: 20260602000000_fix_attendance_bounces.sql
-- Fix biometric bounces and missing checkout cascades

CREATE OR REPLACE FUNCTION process_raw_attendance_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_id uuid;
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
    v_diff int;

    v_max_shift_hours numeric;
    v_expected_hours  numeric;
    
    -- Additional variables
    v_prev_open_record record;
    v_today_record record;
    v_punch_ts timestamp;
    v_prev_ts timestamp := NULL;
    v_total_seconds numeric := 0;
    v_punch_count int := 0;
    v_last_punch_ts timestamp;
    v_checkout_time time;
    v_is_inside_break boolean := false;
    v_break_start_mins int;
    v_break_end_mins int;
BEGIN
    -- Only process unprocessed logs
    IF NEW.is_processed THEN
        RETURN NEW;
    END IF;

    -- ─── 1. DEBOUNCE / LOCKOUT PERIOD (5 MINUTES) ─────────
    -- Check if there is any previous punch within 5 minutes (300 seconds)
    IF EXISTS (
        SELECT 1 
        FROM raw_attendance_logs
        WHERE user_pin = NEW.user_pin 
          AND company_id = NEW.company_id
          AND ABS(EXTRACT(EPOCH FROM (NEW.timestamp - timestamp))) < 300
    ) THEN
        -- Bounce detected! Ignore this punch and mark it as processed.
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
    v_new_date := NEW.timestamp::date;

    -- Get shift info for employee
    SELECT s.* INTO v_shift
    FROM shifts s
    JOIN shift_employees se ON se.shift_id = s.id
    WHERE se.employee_id = v_employee_id AND s.company_id = NEW.company_id
    LIMIT 1;

    -- ─── 2. Calculate Maximum Shift Duration ──────────────
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

    -- ─── 3. Check for open record on a PREVIOUS day ────────
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
        v_hours_diff  := EXTRACT(EPOCH FROM (NEW.timestamp::timestamp - v_check_in_ts)) / 3600;

        IF v_hours_diff > 0 AND v_hours_diff <= v_max_shift_hours THEN
            -- Update the previous day's open record (night shift checkout)
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

            -- Calculate early leave for previous record (if fixed shift)
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
            -- Mark previous day's open record as missing checkout
            UPDATE processed_attendance
            SET check_out           = NULL,
                work_hours          = 0,
                status              = 'missing_checkout',
                early_leave_minutes = 0
            WHERE id = v_prev_open_record.id;
        END IF;
    END IF;

    -- ─── 4. Process the Punch for Today ──────────────────
    SELECT * INTO v_today_record
    FROM processed_attendance
    WHERE employee_id = v_employee_id
      AND company_id = NEW.company_id
      AND date = v_new_date;

    IF v_today_record.id IS NOT NULL THEN
        -- Today's record already exists.
        IF v_today_record.status = 'missing_checkout' THEN
            NEW.is_processed := true;
            RETURN NEW;
        END IF;

        IF COALESCE(v_shift.break_policy, 'ignore_temp') = 'early_leave' AND v_today_record.status = 'early_leave' THEN
            NEW.is_processed := true;
            RETURN NEW;
        END IF;

        IF COALESCE(v_shift.break_policy, 'ignore_temp') = 'deduct_actual' THEN
            -- Deduct Actual: Sum up only the active work intervals
            v_total_seconds := 0;
            v_prev_ts := NULL;
            v_punch_count := 0;

            FOR v_punch_ts IN (
                SELECT timestamp
                FROM raw_attendance_logs
                WHERE user_pin = NEW.user_pin
                  AND company_id = NEW.company_id
                  AND DATE(timestamp) = v_new_date
                  AND is_processed = true
                UNION ALL
                SELECT NEW.timestamp
                ORDER BY 1 ASC
            ) LOOP
                v_punch_count := v_punch_count + 1;
                v_last_punch_ts := v_punch_ts;

                IF v_prev_ts IS NOT NULL THEN
                    v_total_seconds := v_total_seconds + EXTRACT(EPOCH FROM (v_punch_ts - v_prev_ts));
                    v_prev_ts := NULL;
                ELSE
                    v_prev_ts := v_punch_ts;
                END IF;
            END LOOP;

            v_work_hours := ROUND(v_total_seconds::numeric / 3600.0, 2);

            IF v_punch_count % 2 = 0 THEN
                v_checkout_time := v_last_punch_ts::time;
                v_out_mins := (cast(substring(to_char(v_last_punch_ts, 'HH24:MI') from 1 for 2) as int) * 60)
                            + cast(substring(to_char(v_last_punch_ts, 'HH24:MI') from 4 for 2) as int);

                -- Early leave check for checkout
                v_early_leave_mins := 0;
                IF v_shift.id IS NOT NULL AND v_shift.shift_type != 'flexible' THEN
                    v_end_mins := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                                + cast(substring(v_shift.end_time::text from 4 for 2) as int);
                    v_diff := v_end_mins - v_out_mins;
                    IF v_diff > 0 THEN
                        v_early_leave_mins := v_diff;
                    END IF;
                END IF;

                IF v_today_record.late_minutes > 0 THEN v_status := 'late';
                ELSIF v_early_leave_mins > 0 THEN v_status := 'early_leave';
                ELSE v_status := 'present';
                END IF;

                UPDATE processed_attendance
                SET check_out           = v_checkout_time,
                    work_hours          = v_work_hours,
                    early_leave_minutes = v_early_leave_mins,
                    status              = v_status
                WHERE id = v_today_record.id;
            ELSE
                -- Odd punch count means it is currently an open session
                IF v_today_record.late_minutes > 0 THEN v_status := 'late';
                ELSE v_status := 'present';
                END IF;

                UPDATE processed_attendance
                SET check_out           = NULL,
                    work_hours          = v_work_hours,
                    early_leave_minutes = 0,
                    status              = v_status
                WHERE id = v_today_record.id;
            END IF;

        ELSIF COALESCE(v_shift.break_policy, 'ignore_temp') = 'early_leave' THEN
            -- Early Leave: Lock upon first early checkout outside break window
            v_punch_count := 0;
            FOR v_punch_ts IN (
                SELECT timestamp
                FROM raw_attendance_logs
                WHERE user_pin = NEW.user_pin
                  AND company_id = NEW.company_id
                  AND DATE(timestamp) = v_new_date
                  AND is_processed = true
                UNION ALL
                SELECT NEW.timestamp
                ORDER BY 1 ASC
            ) LOOP
                v_punch_count := v_punch_count + 1;
                v_last_punch_ts := v_punch_ts;
            END LOOP;

            IF v_punch_count % 2 = 0 THEN
                v_checkout_time := v_last_punch_ts::time;
                v_in_mins := (cast(substring(v_today_record.check_in::text from 1 for 2) as int) * 60)
                           + cast(substring(v_today_record.check_in::text from 4 for 2) as int);
                v_out_mins := (cast(substring(to_char(v_last_punch_ts, 'HH24:MI') from 1 for 2) as int) * 60)
                            + cast(substring(to_char(v_last_punch_ts, 'HH24:MI') from 4 for 2) as int);

                v_diff := v_out_mins - v_in_mins;
                IF v_diff < 0 THEN v_diff := v_diff + (24 * 60); END IF;

                IF v_shift.id IS NOT NULL AND v_shift.break_duration IS NOT NULL THEN
                    v_diff := v_diff - cast(v_shift.break_duration as int);
                END IF;
                v_work_hours := ROUND(GREATEST(0, v_diff::numeric / 60.0), 2);

                -- Determine if checkout is within break window
                v_is_inside_break := false;
                IF v_shift.id IS NOT NULL AND v_shift.has_break AND v_shift.break_start IS NOT NULL AND v_shift.break_duration IS NOT NULL THEN
                    v_break_start_mins := (cast(substring(v_shift.break_start::text from 1 for 2) as int) * 60)
                                        + cast(substring(v_shift.break_start::text from 4 for 2) as int);
                    v_break_end_mins := v_break_start_mins + v_shift.break_duration;
                    IF v_out_mins >= v_break_start_mins AND v_out_mins <= v_break_end_mins THEN
                        v_is_inside_break := true;
                    END IF;
                END IF;

                v_early_leave_mins := 0;
                IF NOT v_is_inside_break AND (v_shift.id IS NULL OR v_shift.shift_type != 'flexible') THEN
                    v_end_mins := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                                + cast(substring(v_shift.end_time::text from 4 for 2) as int);
                    v_diff := v_end_mins - v_out_mins;
                    IF v_diff > 0 THEN
                        v_early_leave_mins := v_diff;
                    END IF;
                END IF;

                IF v_today_record.late_minutes > 0 THEN v_status := 'late';
                ELSIF v_early_leave_mins > 0 THEN v_status := 'early_leave';
                ELSE v_status := 'present';
                END IF;

                UPDATE processed_attendance
                SET check_out           = v_checkout_time,
                    work_hours          = v_work_hours,
                    early_leave_minutes = v_early_leave_mins,
                    status              = v_status
                WHERE id = v_today_record.id;
            ELSE
                -- Odd punch means the employee checked back in
                IF v_today_record.late_minutes > 0 THEN v_status := 'late';
                ELSE v_status := 'present';
                END IF;

                UPDATE processed_attendance
                SET check_out           = NULL,
                    early_leave_minutes = 0,
                    status              = v_status
                WHERE id = v_today_record.id;
            END IF;

        ELSE
            -- Default (ignore_temp): First check-in and last check-out
            v_in_mins := (cast(substring(v_today_record.check_in::text from 1 for 2) as int) * 60)
                       + cast(substring(v_today_record.check_in::text from 4 for 2) as int);
            v_out_mins := (cast(substring(v_new_time from 1 for 2) as int) * 60)
                        + cast(substring(v_new_time from 4 for 2) as int);

            v_diff := v_out_mins - v_in_mins;
            IF v_diff < 0 THEN v_diff := v_diff + (24 * 60); END IF;

            IF v_shift.id IS NOT NULL AND v_shift.break_duration IS NOT NULL THEN
                v_diff := v_diff - cast(v_shift.break_duration as int);
            END IF;
            v_work_hours := ROUND(GREATEST(0, v_diff::numeric / 60.0), 2);

            v_early_leave_mins := 0;
            IF v_shift.id IS NULL OR v_shift.shift_type != 'flexible' THEN
                v_end_mins := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                            + cast(substring(v_shift.end_time::text from 4 for 2) as int);
                v_diff := v_end_mins - v_out_mins;
                IF v_diff > 0 THEN
                    v_early_leave_mins := v_diff;
                END IF;
            END IF;

            IF v_today_record.late_minutes > 0 THEN v_status := 'late';
            ELSIF v_early_leave_mins > 0 THEN v_status := 'early_leave';
            ELSE v_status := 'present';
            END IF;

            UPDATE processed_attendance
            SET check_out           = v_new_time::time,
                work_hours          = v_work_hours,
                early_leave_minutes = v_early_leave_mins,
                status              = v_status
            WHERE id = v_today_record.id;
        END IF;

    ELSE
        -- ─── 5. Create a NEW Check-In for Today ──────────────
        v_late_mins := 0;
        v_status := 'present';
        v_in_mins := (cast(substring(v_new_time from 1 for 2) as int) * 60)
                   + cast(substring(v_new_time from 4 for 2) as int);
        
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
                    v_status := 'late';
                END IF;
            END IF;
        ELSE
            v_start_mins := 8 * 60;
            v_grace_mins := 0;
            v_diff := v_in_mins - v_start_mins;
            IF v_diff < -720 THEN
                v_diff := v_diff + (24 * 60);
            END IF;
            IF v_diff > v_grace_mins THEN
                v_late_mins := v_diff;
                v_status := 'late';
            END IF;
        END IF;

        INSERT INTO processed_attendance (
            company_id, employee_id, date, check_in, status, late_minutes, early_leave_minutes, work_hours
        ) VALUES (
            NEW.company_id, v_employee_id, v_new_date, v_new_time::time, v_status, v_late_mins, 0, 0
        );
    END IF;

    NEW.is_processed := true;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace trigger
DROP TRIGGER IF EXISTS on_raw_attendance_insert ON raw_attendance_logs;
CREATE TRIGGER on_raw_attendance_insert
BEFORE INSERT ON raw_attendance_logs
FOR EACH ROW
EXECUTE FUNCTION process_raw_attendance_trigger();

-- ─── 4. Recalculation Utility Function ──────────────────
CREATE OR REPLACE FUNCTION recalculate_attendance_for_company(p_start_date date, p_end_date date, p_company_id uuid)
RETURNS void AS $$
BEGIN
    -- Delete processed records
    DELETE FROM processed_attendance 
    WHERE company_id = p_company_id 
      AND date >= p_start_date 
      AND date <= p_end_date;

    -- Create temp table to hold raw logs
    CREATE TEMP TABLE temp_raw_logs ON COMMIT DROP AS
    SELECT id, device_id, company_id, user_pin, timestamp, status, punch_method, gps_lat, gps_lng, created_at, false::boolean AS is_processed
    FROM raw_attendance_logs
    WHERE company_id = p_company_id
      AND DATE(timestamp) >= p_start_date
      AND DATE(timestamp) <= p_end_date;

    -- Delete original raw logs to re-insert them
    DELETE FROM raw_attendance_logs
    WHERE company_id = p_company_id
      AND DATE(timestamp) >= p_start_date
      AND DATE(timestamp) <= p_end_date;

    -- Re-insert to trigger BEFORE INSERT processing
    INSERT INTO raw_attendance_logs (id, device_id, company_id, user_pin, timestamp, status, punch_method, gps_lat, gps_lng, created_at, is_processed)
    SELECT id, device_id, company_id, user_pin, timestamp, status, punch_method, gps_lat, gps_lng, created_at, is_processed
    FROM temp_raw_logs
    ORDER BY timestamp ASC;

    -- Drop temp table to allow consecutive runs inside the same transaction
    DROP TABLE IF EXISTS temp_raw_logs;
END;
$$ LANGUAGE plpgsql;
