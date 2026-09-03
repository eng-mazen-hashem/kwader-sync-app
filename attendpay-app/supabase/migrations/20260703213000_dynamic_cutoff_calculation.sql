-- Migration: 20260703213000_dynamic_cutoff_calculation.sql
-- Description: Dynamic logical day boundary (cutoff) calculation based on shift end times, preserving the local-time-as-UTC storage pattern to avoid shifting historical logs.

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
    v_today_override_status text := 'none';
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

    -- Conflict detection variables
    v_has_device boolean := false;
    v_has_manual boolean := false;
    v_is_conflicted boolean := false;
    v_conflict_details jsonb := NULL;
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
        IF v_shift.start_time IS NOT NULL AND v_shift.end_time IS NOT NULL THEN
            v_start_mins := (cast(substring(v_shift.start_time::text from 1 for 2) as int) * 60)
                          + cast(substring(v_shift.start_time::text from 4 for 2) as int);
            v_end_mins   := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60)
                          + cast(substring(v_shift.end_time::text from 4 for 2) as int);
            IF v_end_mins <= v_start_mins THEN
                v_end_mins := v_end_mins + 1440;
            END IF;

            -- Default cutoff is 4 hours before start_time
            v_in_mins := v_start_mins - 240;
            
            -- If shift ends past midnight, cutoff must be at least 3 hours after shift ends
            IF v_end_mins > 1440 THEN
                v_break_start_mins := (v_end_mins - 1440 + 180);
                IF v_in_mins < v_break_start_mins THEN
                    v_in_mins := v_break_start_mins;
                END IF;
            END IF;
            
            v_offset_interval := (v_in_mins || ' minutes')::interval;
        ELSE
            v_offset_interval := '05:00:00'::interval;
        END IF;
        
        IF v_shift.shift_type = 'flexible' THEN
            v_expected_hours := COALESCE(v_shift.target_hours, 8);
        ELSE
            v_expected_hours := ROUND((v_end_mins - v_start_mins)::numeric / 60, 1);
        END IF;
    ELSE
        v_offset_interval := '04:00:00'::interval;
        v_expected_hours := 8;
    END IF;

    -- Treat NEW.timestamp as local time without shifting
    v_new_date := (NEW.timestamp - v_offset_interval)::date;

    -- Fetch existing record to check override_status
    SELECT id, status, COALESCE(override_status, 'none') INTO v_today_record_id, v_today_status, v_today_override_status
    FROM processed_attendance
    WHERE employee_id = v_employee_id
      AND company_id = NEW.company_id
      AND date = v_new_date
    LIMIT 1;

    -- ─── 3. CLEANUP PREVIOUS OPEN DAYS ──────────────────────────
    UPDATE processed_attendance
    SET status = 'missing_checkout', work_hours = 0
    WHERE employee_id = v_employee_id
      AND company_id = NEW.company_id
      AND date < v_new_date
      AND check_out IS NULL
      AND status != 'missing_checkout';

    -- ─── 4. CONFLICT DETECTION ──────────────────────────────────
    v_logical_start := (v_new_date::timestamp + v_offset_interval);
    v_logical_end   := v_logical_start + INTERVAL '23 hours 59 minutes 59 seconds';

    SELECT 
      EXISTS(SELECT 1 FROM raw_attendance_logs WHERE user_pin = NEW.user_pin AND company_id = NEW.company_id AND timestamp >= v_logical_start AND timestamp <= v_logical_end AND COALESCE(punch_method, 'device') = 'device'),
      EXISTS(SELECT 1 FROM raw_attendance_logs WHERE user_pin = NEW.user_pin AND company_id = NEW.company_id AND timestamp >= v_logical_start AND timestamp <= v_logical_end AND COALESCE(punch_method, 'device') = 'manual')
    INTO v_has_device, v_has_manual;

    -- Include the new row being processed into counts
    IF COALESCE(NEW.punch_method, 'device') = 'device' THEN
        v_has_device := true;
    ELSIF COALESCE(NEW.punch_method, 'device') = 'manual' THEN
        v_has_manual := true;
    END IF;

    IF v_has_device AND v_has_manual THEN
        v_is_conflicted := true;
        
        -- Build JSON details of the conflict
        v_conflict_details := jsonb_build_object(
            'device_first', (SELECT MIN(timestamp) FROM raw_attendance_logs WHERE user_pin = NEW.user_pin AND company_id = NEW.company_id AND timestamp >= v_logical_start AND timestamp <= v_logical_end AND COALESCE(punch_method, 'device') = 'device'),
            'device_last', (SELECT MAX(timestamp) FROM raw_attendance_logs WHERE user_pin = NEW.user_pin AND company_id = NEW.company_id AND timestamp >= v_logical_start AND timestamp <= v_logical_end AND COALESCE(punch_method, 'device') = 'device'),
            'manual_first', (SELECT MIN(timestamp) FROM raw_attendance_logs WHERE user_pin = NEW.user_pin AND company_id = NEW.company_id AND timestamp >= v_logical_start AND timestamp <= v_logical_end AND COALESCE(punch_method, 'device') = 'manual'),
            'manual_last', (SELECT MAX(timestamp) FROM raw_attendance_logs WHERE user_pin = NEW.user_pin AND company_id = NEW.company_id AND timestamp >= v_logical_start AND timestamp <= v_logical_end AND COALESCE(punch_method, 'device') = 'manual')
        );
    END IF;

    -- ─── 5. SMART CHRONOLOGICAL SORTING AND POLICIES ────────────
    v_policy := COALESCE(v_shift.break_policy, 'ignore_temp');

    FOR v_punch_ts IN (
        SELECT timestamp::timestamp
        FROM raw_attendance_logs
        WHERE user_pin = NEW.user_pin
          AND company_id = NEW.company_id
          AND timestamp >= v_logical_start
          AND timestamp <= v_logical_end
          AND id != NEW.id
          -- Filter based on override status
          AND (
            v_today_override_status = 'none' 
            OR (v_today_override_status = 'approved_manual' AND COALESCE(punch_method, 'device') = 'manual')
            OR (v_today_override_status = 'approved_device' AND COALESCE(punch_method, 'device') = 'device')
          )
        UNION ALL
        SELECT NEW.timestamp::timestamp
        WHERE (
          v_today_override_status = 'none' 
          OR (v_today_override_status = 'approved_manual' AND COALESCE(NEW.punch_method, 'device') = 'manual')
          OR (v_today_override_status = 'approved_device' AND COALESCE(NEW.punch_method, 'device') = 'device')
        )
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
                    v_last_punch := v_punch_ts;
                    EXIT;
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- ─── 6. RECALCULATE CHECK-IN & LATE MINUTES ──────────────
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

    -- ─── 7. MISSING CHECKIN / CHECKOUT LOGIC ───────────
    v_work_hours := 0;
    v_early_leave_mins := 0;
    
    IF v_punch_count = 1 THEN
        v_mins_since_logical_start := EXTRACT(EPOCH FROM (v_first_punch - v_logical_start)) / 60;
        v_expected_mins := ROUND(v_expected_hours * 60);
        
        IF v_shift.id IS NOT NULL AND v_shift.shift_type != 'flexible' THEN
            IF v_mins_since_logical_start > (240 + (v_expected_mins / 2)) THEN
                v_is_missing_checkin := true;
                v_last_punch := v_first_punch;
                v_first_punch := NULL;
                v_late_mins := 0;
            ELSE
                v_last_punch := NULL;
            END IF;
        ELSE
            IF v_mins_since_logical_start > (12 * 60) THEN
                v_is_missing_checkin := true;
                v_last_punch := v_first_punch;
                v_first_punch := NULL;
                v_late_mins := 0;
            ELSE
                v_last_punch := NULL;
            END IF;
        END IF;
    END IF;

    -- ─── 8. WORK HOURS AND EARLY LEAVE ─────────────────
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

    -- ─── 9. DETERMINE FINAL STATUS ──────────────
    IF v_is_missing_checkin THEN
        v_status := 'missing_checkin';
    ELSIF (v_first_punch IS NOT NULL AND v_last_punch IS NULL) OR (v_policy = 'deduct_actual' AND v_punch_count % 2 != 0) THEN
        v_status := 'missing_checkout';
    ELSIF v_late_mins > 0 THEN 
        v_status := 'late';
    ELSIF v_early_leave_mins > 0 THEN 
        v_status := 'early_leave';
    ELSE 
        v_status := 'present';
    END IF;

    -- ─── 10. UPSERT PROCESSED RECORD ──────────────
    IF v_today_record_id IS NOT NULL THEN
        UPDATE processed_attendance
        SET check_in            = CASE WHEN v_first_punch IS NOT NULL THEN v_first_punch::time ELSE NULL END,
            check_out           = CASE WHEN v_last_punch IS NOT NULL THEN v_last_punch::time ELSE NULL END,
            work_hours          = v_work_hours,
            late_minutes        = v_late_mins,
            early_leave_minutes = v_early_leave_mins,
            status              = v_status,
            is_conflicted       = v_is_conflicted,
            conflict_details    = v_conflict_details
        WHERE id = v_today_record_id;
    ELSE
        INSERT INTO processed_attendance (
            company_id, employee_id, date, check_in, check_out, status, late_minutes, early_leave_minutes, work_hours, is_conflicted, conflict_details, override_status
        ) VALUES (
            NEW.company_id, v_employee_id, v_new_date, 
            CASE WHEN v_first_punch IS NOT NULL THEN v_first_punch::time ELSE NULL END, 
            CASE WHEN v_last_punch IS NOT NULL THEN v_last_punch::time ELSE NULL END, 
            v_status, v_late_mins, v_early_leave_mins, v_work_hours, v_is_conflicted, v_conflict_details, 'none'
        );
    END IF;

    NEW.is_processed := true;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
