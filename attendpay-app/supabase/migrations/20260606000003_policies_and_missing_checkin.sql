-- Migration: 20260606000003_policies_and_missing_checkin.sql
-- Description: Implements missing check-in logic and 3 robust break policies.

ALTER TABLE processed_attendance DROP CONSTRAINT IF EXISTS processed_attendance_status_check;
ALTER TABLE processed_attendance ADD CONSTRAINT processed_attendance_status_check CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'early_leave'::text, 'missing_checkout'::text, 'missing_checkin'::text, 'on_leave'::text]));

CREATE OR REPLACE FUNCTION process_raw_attendance_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_id uuid;
    v_shift record;
    v_new_date date;
    v_offset_interval interval;
    v_logical_start timestamp;
    v_logical_end timestamp;
    v_policy text;
    
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
    
    v_expected_hours numeric;
    v_expected_mins numeric;
    
    -- Variables for chronological sorting
    v_today_record_id uuid;
    v_today_status text;
    v_punch_ts timestamp;
    v_first_punch timestamp := NULL;
    v_last_punch timestamp := NULL;
    v_punch_count int := 0;
    
    -- For missing check-in
    v_is_missing_checkin boolean := false;
    v_mins_since_logical_start numeric;
    
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

    -- Get shift info for employee
    SELECT s.* INTO v_shift
    FROM shifts s
    JOIN shift_employees se ON se.shift_id = s.id
    WHERE se.employee_id = v_employee_id AND s.company_id = NEW.company_id
    LIMIT 1;

    -- ─── 2. UNIVERSAL LOGICAL DATE ASSIGNMENT ───────────────────
    IF v_shift.id IS NOT NULL THEN
        IF v_shift.shift_type = 'flexible' THEN
            v_offset_interval := '05:00:00'::interval;
            v_expected_hours := COALESCE(v_shift.target_hours, 8);
        ELSE
            v_offset_interval := v_shift.start_time::interval - '04:00:00'::interval;
            v_start_mins := (cast(substring(v_shift.start_time::text from 1 for 2) as int) * 60)
                          + cast(substring(v_shift.start_time::text from 4 for 2) as int);
            v_end_mins   := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                          + cast(substring(v_shift.end_time::text from 4 for 2) as int);
            IF v_end_mins <= v_start_mins THEN
                v_end_mins := v_end_mins + 1440;
            END IF;
            v_expected_hours := ROUND((v_end_mins - v_start_mins)::numeric / 60, 1);
        END IF;
    ELSE
        v_offset_interval := '04:00:00'::interval;
        v_expected_hours := 8;
    END IF;

    v_new_date := (NEW.timestamp - v_offset_interval)::date;

    -- ─── 3. CLEANUP PREVIOUS OPEN DAYS ──────────────────────────
    UPDATE processed_attendance
    SET status = 'missing_checkout', work_hours = 0
    WHERE employee_id = v_employee_id
      AND company_id = NEW.company_id
      AND date < v_new_date
      AND check_out IS NULL
      AND status != 'missing_checkout';

    -- ─── 4. SMART CHRONOLOGICAL SORTING AND POLICIES ────────────
    v_logical_start := (v_new_date::timestamp + v_offset_interval);
    v_logical_end   := v_logical_start + INTERVAL '23 hours 59 minutes 59 seconds';
    v_policy := COALESCE(v_shift.break_policy, 'ignore_temp');

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
        
        -- Policy: deduct_actual
        IF v_policy = 'deduct_actual' THEN
            IF v_prev_ts IS NOT NULL THEN
                v_total_seconds := v_total_seconds + EXTRACT(EPOCH FROM (v_punch_ts - v_prev_ts));
                v_prev_ts := NULL;
            ELSE
                v_prev_ts := v_punch_ts;
            END IF;
            
        -- Policy: early_leave
        ELSIF v_policy = 'early_leave' THEN
            IF v_punch_count % 2 = 0 THEN
                v_out_mins := (EXTRACT(HOUR FROM v_punch_ts) * 60) + EXTRACT(MINUTE FROM v_punch_ts);
                v_is_inside_break := false;
                IF v_shift.has_break AND v_shift.break_start IS NOT NULL AND v_shift.break_duration IS NOT NULL THEN
                    v_break_start_mins := (cast(substring(v_shift.break_start::text from 1 for 2) as int) * 60)
                                        + cast(substring(v_shift.break_start::text from 4 for 2) as int);
                    v_break_end_mins := v_break_start_mins + v_shift.break_duration;
                    IF v_out_mins >= v_break_start_mins AND v_out_mins <= v_break_end_mins THEN
                        v_is_inside_break := true;
                    END IF;
                END IF;

                IF NOT v_is_inside_break THEN
                    -- Unauthorized checkout! Terminate day here.
                    v_last_punch := v_punch_ts;
                    EXIT;
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- ─── 5. RECALCULATE CHECK-IN & LATE MINUTES ──────────────
    IF v_first_punch IS NOT NULL THEN
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
    END IF;

    -- ─── 6. MISSING CHECKIN / CHECKOUT LOGIC ───────────
    v_work_hours := 0;
    v_early_leave_mins := 0;
    
    SELECT id, status INTO v_today_record_id, v_today_status
    FROM processed_attendance
    WHERE employee_id = v_employee_id
      AND company_id = NEW.company_id
      AND date = v_new_date
    LIMIT 1;
    
    IF v_punch_count = 1 THEN
        v_mins_since_logical_start := EXTRACT(EPOCH FROM (v_first_punch - v_logical_start)) / 60;
        v_expected_mins := ROUND(v_expected_hours * 60);
        
        IF v_shift.id IS NOT NULL AND v_shift.shift_type != 'flexible' THEN
            -- Offset is always 4 hours (240 mins). Halfway is 240 + (expected/2).
            IF v_mins_since_logical_start > (240 + (v_expected_mins / 2)) THEN
                v_is_missing_checkin := true;
                v_last_punch := v_first_punch;
                v_first_punch := NULL;
                v_late_mins := 0;
            ELSE
                v_last_punch := NULL;
            END IF;
        ELSE
            -- Flexible shifts (24h logical window, midpoint is 12h)
            IF v_mins_since_logical_start > (12 * 60) THEN
                v_is_missing_checkin := true;
                v_last_punch := v_first_punch;
                v_first_punch := NULL;
                v_late_mins := 0;
            ELSE
                v_last_punch := NULL;
            END IF;
        END IF;
    ELSE
        IF v_policy = 'deduct_actual' AND v_punch_count % 2 != 0 THEN
            v_last_punch := NULL;
        END IF;
    END IF;

    -- ─── 7. WORK HOURS AND EARLY LEAVE ─────────────────
    IF v_last_punch IS NOT NULL AND v_first_punch IS NOT NULL THEN
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
            IF v_diff < -720 THEN v_diff := v_diff + (24 * 60); END IF;
            IF v_diff > 0 AND v_diff < 720 THEN
                v_early_leave_mins := v_diff;
            END IF;
        END IF;
        
        IF v_policy = 'deduct_actual' THEN
            v_work_hours := ROUND(v_total_seconds::numeric / 3600.0, 2);
        ELSE
            v_diff := v_out_mins - v_in_mins;
            IF v_diff < 0 THEN v_diff := v_diff + (24 * 60); END IF;
            IF v_shift.id IS NOT NULL AND v_shift.break_duration IS NOT NULL THEN
                v_diff := GREATEST(0, v_diff - cast(v_shift.break_duration as int));
            END IF;
            v_work_hours := ROUND(v_diff::numeric / 60.0, 2);
        END IF;
    END IF;

    -- ─── 8. DETERMINE FINAL STATUS ──────────────
    IF v_is_missing_checkin THEN
        v_status := 'missing_checkin';
    ELSIF v_first_punch IS NOT NULL AND v_last_punch IS NULL THEN
        v_status := 'missing_checkout';
    ELSIF v_late_mins > 0 THEN 
        v_status := 'late';
    ELSIF v_early_leave_mins > 0 THEN 
        v_status := 'early_leave';
    ELSE 
        v_status := 'present';
    END IF;

    -- ─── 9. UPSERT PROCESSED RECORD ──────────────
    IF v_today_record_id IS NOT NULL THEN
        UPDATE processed_attendance
        SET check_in            = CASE WHEN v_first_punch IS NOT NULL THEN v_first_punch::time ELSE NULL END,
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
            CASE WHEN v_first_punch IS NOT NULL THEN v_first_punch::time ELSE NULL END, 
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
