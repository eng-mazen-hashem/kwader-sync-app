-- Migration: 20260909020000_fix_whatsapp_lock_prevent_deadlocks.sql
-- Description: Hardens acquire_whatsapp_lock with FOR UPDATE NOWAIT and exception handling
-- to permanently prevent database-wide row locks, connection queue exhaustion, and WAL archiving failures.

CREATE OR REPLACE FUNCTION public.acquire_whatsapp_lock(
    p_node_id text,
    p_timeout_seconds integer DEFAULT 120,
    p_lock_key text DEFAULT 'whatsapp_lock',
    p_health_score integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_record record;
    v_now timestamptz := clock_timestamp();
    v_current_node text := null;
    v_last_beat timestamptz;
BEGIN
    -- Use NOWAIT to immediately fail fast if another transaction is locking the row
    -- This eliminates lock queueing and prevents WAL archiving collapse.
    BEGIN
        SELECT * INTO v_lock_record
        FROM system_settings
        WHERE key = p_lock_key
        FOR UPDATE NOWAIT;
    EXCEPTION WHEN lock_not_available THEN
        RETURN jsonb_build_object(
            'acquired', false,
            'reason', 'lock_contention_busy',
            'message', 'Another node is actively holding or evaluating the lock'
        );
    END;

    IF NOT FOUND THEN
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (p_lock_key, jsonb_build_object(
            'node_id', p_node_id,
            'last_heartbeat', v_now,
            'acquired_at', v_now,
            'health_score', p_health_score
        ), v_now);
        RETURN jsonb_build_object('acquired', true, 'node_id', p_node_id, 'reason', 'new_lock');
    END IF;

    IF v_lock_record.value IS NOT NULL THEN
        v_current_node := v_lock_record.value->>'node_id';
        IF v_lock_record.value->>'last_heartbeat' IS NOT NULL THEN
            v_last_beat := (v_lock_record.value->>'last_heartbeat')::timestamptz;
        END IF;
    END IF;

    -- Conditions to acquire lock:
    -- 1. Same node already owns it
    -- 2. Previous owner vacated/released (v_current_node IS NULL)
    -- 3. Heartbeat timed out (v_last_beat IS NULL or age > timeout)
    IF v_current_node = p_node_id 
       OR v_current_node IS NULL 
       OR v_last_beat IS NULL 
       OR (v_now - v_last_beat) > (p_timeout_seconds || ' seconds')::interval THEN
       
        UPDATE system_settings
        SET value = jsonb_build_object(
            'node_id', p_node_id,
            'last_heartbeat', v_now,
            'acquired_at', COALESCE(
                CASE WHEN v_current_node = p_node_id THEN (v_lock_record.value->>'acquired_at')::timestamptz ELSE v_now END, 
                v_now
            ),
            'health_score', p_health_score,
            'previous_leader', v_current_node
        ),
        updated_at = v_now
        WHERE key = p_lock_key;

        RETURN jsonb_build_object('acquired', true, 'node_id', p_node_id, 'preempted', (v_current_node IS NOT NULL AND v_current_node != p_node_id));
    ELSE
        RETURN jsonb_build_object('acquired', false, 'leader_node', v_current_node, 'last_heartbeat', v_last_beat);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_whatsapp_lock(text, integer, text, integer) TO anon, authenticated, service_role;
