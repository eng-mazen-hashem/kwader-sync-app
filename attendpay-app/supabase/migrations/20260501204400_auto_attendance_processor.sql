-- Migration: 20260501204400_auto_attendance_processor.sql

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
    v_end_mins int;
    v_in_mins int;
    v_out_mins int;
    v_grace_mins int;
    v_late_mins int := 0;
    v_early_leave_mins int := 0;
    v_work_hours numeric := 0;
    v_status text := 'present';
    v_shift_duration int;
    v_out_from_start int;
    v_diff int;
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

    -- Find the last record in processed_attendance
    SELECT * INTO v_last_record
    FROM processed_attendance
    WHERE employee_id = v_employee_id
      AND company_id = NEW.company_id
    ORDER BY date DESC, check_in DESC
    LIMIT 1;

    IF v_last_record.id IS NOT NULL AND v_last_record.check_out IS NULL THEN
        -- We have an open check_in
        v_check_in_ts := (v_last_record.date::text || ' ' || v_last_record.check_in)::timestamp;
        v_hours_diff := EXTRACT(EPOCH FROM (NEW.timestamp - v_check_in_ts)) / 3600;

        IF v_hours_diff > 0 AND v_hours_diff <= 16 THEN
            -- Treat this as a check-out for the open record
            
            -- Calculate Metrics
            v_in_mins := (cast(substring(v_last_record.check_in from 1 for 2) as int) * 60) + cast(substring(v_last_record.check_in from 4 for 2) as int);
            v_out_mins := (cast(substring(v_new_time from 1 for 2) as int) * 60) + cast(substring(v_new_time from 4 for 2) as int);
            
            IF v_shift.id IS NOT NULL THEN
                v_start_mins := (cast(substring(v_shift.start_time::text from 1 for 2) as int) * 60) + cast(substring(v_shift.start_time::text from 4 for 2) as int);
                v_end_mins := (cast(substring(v_shift.end_time::text from 1 for 2) as int) * 60) + cast(substring(v_shift.end_time::text from 4 for 2) as int);
                v_grace_mins := COALESCE(v_shift.grace_minutes, 0);
            ELSE
                v_start_mins := 8 * 60;
                v_end_mins := 17 * 60;
                v_grace_mins := 0;
            END IF;

            -- 1. Late Minutes
            IF v_in_mins > v_start_mins + v_grace_mins THEN
                v_late_mins := v_in_mins - v_start_mins;
            END IF;

            -- 2. Work Hours
            v_diff := v_out_mins - v_in_mins;
            IF v_diff < 0 THEN v_diff := v_diff + (24 * 60); END IF;
            
            -- Note: Using break_duration if it exists, otherwise 0
            BEGIN
                IF v_shift.id IS NOT NULL AND v_shift.break_duration IS NOT NULL THEN
                    v_diff := v_diff - cast(v_shift.break_duration as int);
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- column might not exist or be named differently, safe ignore
            END;

            v_work_hours := ROUND(GREATEST(0, v_diff::numeric / 60.0), 2);

            -- 3. Early Leave
            v_shift_duration := v_end_mins - v_start_mins;
            IF v_shift_duration < 0 THEN v_shift_duration := v_shift_duration + (24 * 60); END IF;

            v_out_from_start := v_out_mins - v_start_mins;
            IF v_out_from_start < 0 THEN v_out_from_start := v_out_from_start + (24 * 60); END IF;

            IF v_out_from_start < v_shift_duration THEN
                v_early_leave_mins := v_shift_duration - v_out_from_start;
            END IF;

            -- 4. Status
            IF v_late_mins > 0 THEN v_status := 'late';
            ELSIF v_early_leave_mins > 0 THEN v_status := 'early_leave';
            END IF;

            -- Update processed_attendance
            UPDATE processed_attendance
            SET check_out = v_new_time,
                work_hours = v_work_hours,
                late_minutes = v_late_mins,
                early_leave_minutes = v_early_leave_mins,
                status = v_status
            WHERE id = v_last_record.id;

            NEW.is_processed := true;
            RETURN NEW;
        END IF;
    END IF;

    -- If we reached here: Create a NEW check_in record
    -- Calculate metrics for check-in only (no check-out yet)
    v_in_mins := (cast(substring(v_new_time from 1 for 2) as int) * 60) + cast(substring(v_new_time from 4 for 2) as int);
    
    IF v_shift.id IS NOT NULL THEN
        v_start_mins := (cast(substring(v_shift.start_time::text from 1 for 2) as int) * 60) + cast(substring(v_shift.start_time::text from 4 for 2) as int);
        v_grace_mins := COALESCE(v_shift.grace_minutes, 0);
    ELSE
        v_start_mins := 8 * 60;
        v_grace_mins := 0;
    END IF;

    IF v_in_mins > v_start_mins + v_grace_mins THEN
        v_late_mins := v_in_mins - v_start_mins;
        v_status := 'late';
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

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_raw_attendance_insert ON raw_attendance_logs;

-- Create the trigger
CREATE TRIGGER on_raw_attendance_insert
BEFORE INSERT ON raw_attendance_logs
FOR EACH ROW
EXECUTE FUNCTION process_raw_attendance_trigger();
