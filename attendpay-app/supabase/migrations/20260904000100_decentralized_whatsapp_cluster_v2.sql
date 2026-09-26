-- Migration: Decentralized WhatsApp Cluster Architecture v2.0
-- Standards: Atomic Lock CAS, Queue Priority, Deadlock Recovery, Node Telemetry

-- 1. Queue Priority & Performance Index
ALTER TABLE whatsapp_queue ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_priority_status 
ON whatsapp_queue (status, priority DESC, created_at ASC);

-- 2. Atomic Compare-And-Swap Leader Election RPC
CREATE OR REPLACE FUNCTION acquire_whatsapp_lock(
    p_node_id text, 
    p_timeout_seconds int DEFAULT 120
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
    SELECT * INTO v_lock_record
    FROM system_settings
    WHERE key = 'whatsapp_lock'
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('whatsapp_lock', jsonb_build_object(
            'node_id', p_node_id,
            'last_heartbeat', v_now,
            'acquired_at', v_now
        ), v_now);
        RETURN jsonb_build_object('acquired', true, 'node_id', p_node_id, 'reason', 'new_lock');
    END IF;

    IF v_lock_record.value IS NOT NULL THEN
        v_current_node := v_lock_record.value->>'node_id';
        IF v_lock_record.value->>'last_heartbeat' IS NOT NULL THEN
            v_last_beat := (v_lock_record.value->>'last_heartbeat')::timestamptz;
        END IF;
    END IF;

    -- If current node is already the leader, or lock is free, or expired
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
            )
        ),
        updated_at = v_now
        WHERE key = 'whatsapp_lock';

        RETURN jsonb_build_object('acquired', true, 'node_id', p_node_id);
    ELSE
        RETURN jsonb_build_object('acquired', false, 'leader_node', v_current_node, 'last_heartbeat', v_last_beat);
    END IF;
END;
$$;

-- 3. Atomic Heartbeat Renewal RPC
CREATE OR REPLACE FUNCTION renew_whatsapp_heartbeat(p_node_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now timestamptz := clock_timestamp();
BEGIN
    UPDATE system_settings
    SET value = jsonb_set(
        jsonb_set(value, '{last_heartbeat}', to_jsonb(v_now)),
        '{node_id}', to_jsonb(p_node_id)
    ),
    updated_at = v_now
    WHERE key = 'whatsapp_lock' AND value->>'node_id' = p_node_id;

    RETURN FOUND;
END;
$$;

-- 4. Node Telemetry Table for Cluster Visibility
CREATE TABLE IF NOT EXISTS whatsapp_nodes (
    node_id text PRIMARY KEY,
    role text NOT NULL DEFAULT 'standby',
    hostname text,
    version text DEFAULT '2.0',
    last_seen timestamptz DEFAULT clock_timestamp(),
    created_at timestamptz DEFAULT clock_timestamp()
);

ALTER TABLE whatsapp_nodes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'whatsapp_nodes' 
        AND policyname = 'Allow anon all on whatsapp_nodes'
    ) THEN
        CREATE POLICY "Allow anon all on whatsapp_nodes"
        ON whatsapp_nodes
        FOR ALL
        TO anon, authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- 5. Permissions
GRANT EXECUTE ON FUNCTION acquire_whatsapp_lock(text, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION renew_whatsapp_heartbeat(text) TO anon, authenticated, service_role;
