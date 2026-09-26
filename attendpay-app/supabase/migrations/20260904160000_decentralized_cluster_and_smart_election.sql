-- Migration: 20260904160000_decentralized_cluster_and_smart_election.sql

-- 1. Upgrade whatsapp_nodes table
ALTER TABLE whatsapp_nodes 
  ADD COLUMN IF NOT EXISTS is_leader BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS memory_rss_mb NUMERIC,
  ADD COLUMN IF NOT EXISTS uptime_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS channel_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'online';

-- 2. Upgrade acquire_whatsapp_lock with p_lock_key & p_health_score
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
    SELECT * INTO v_lock_record
    FROM system_settings
    WHERE key = p_lock_key
    FOR UPDATE;

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

-- 3. Upgrade renew_whatsapp_heartbeat with p_lock_key
CREATE OR REPLACE FUNCTION public.renew_whatsapp_heartbeat(
    p_node_id text,
    p_lock_key text DEFAULT 'whatsapp_lock'
)
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
    WHERE key = p_lock_key AND value->>'node_id' = p_node_id;

    RETURN FOUND;
END;
$$;

-- 4. Create release_whatsapp_lock for fast cooperative failover
CREATE OR REPLACE FUNCTION public.release_whatsapp_lock(
    p_node_id text,
    p_lock_key text DEFAULT 'whatsapp_lock',
    p_reason text DEFAULT 'graceful_shutdown'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now timestamptz := clock_timestamp();
BEGIN
    UPDATE system_settings
    SET value = jsonb_build_object(
        'node_id', null,
        'last_heartbeat', null,
        'released_at', v_now,
        'released_by', p_node_id,
        'reason', p_reason
    ),
    updated_at = v_now
    WHERE key = p_lock_key AND (value->>'node_id' = p_node_id OR value->>'node_id' IS NULL);

    RETURN FOUND;
END;
$$;

-- 5. Realtime Publication Enablement for Reactive Failover & Cluster Visibility
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'system_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_channels'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_channels;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_nodes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_nodes;
    END IF;
END $$;

ALTER TABLE system_settings REPLICA IDENTITY FULL;
ALTER TABLE whatsapp_channels REPLICA IDENTITY FULL;
ALTER TABLE whatsapp_nodes REPLICA IDENTITY FULL;
