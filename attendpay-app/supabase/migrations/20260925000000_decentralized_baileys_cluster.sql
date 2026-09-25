-- ============================================================
-- Migration: 20260925000000_decentralized_baileys_cluster.sql
-- Description: Phase 1 Database Infrastructure for Baileys
--              Decentralized WhatsApp Cluster & Seamless Failover
-- ============================================================

-- 1. Upgrade whatsapp_channels
ALTER TABLE public.whatsapp_channels 
  ADD COLUMN IF NOT EXISTS current_epoch BIGINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS active_leader_id TEXT;

-- Synchronize active_leader_id with active_node_id if needed
UPDATE public.whatsapp_channels
SET active_leader_id = active_node_id
WHERE active_leader_id IS NULL AND active_node_id IS NOT NULL;

-- 2. Create whatsapp_session_keys for Pure Cryptographic Key Storage (< 500 KB)
CREATE TABLE IF NOT EXISTS public.whatsapp_session_keys (
    channel_id UUID NOT NULL REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE,
    key_type TEXT NOT NULL, -- 'creds', 'pre-key', 'session', 'sender-key', 'app-state-sync-key'
    key_id TEXT NOT NULL,
    key_data TEXT NOT NULL, -- Encrypted JSON payload (AES-256-GCM)
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    PRIMARY KEY (channel_id, key_type, key_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_session_keys_channel_type 
ON public.whatsapp_session_keys(channel_id, key_type);

CREATE INDEX IF NOT EXISTS idx_wa_session_keys_updated_at 
ON public.whatsapp_session_keys(channel_id, updated_at);

-- Enable RLS on whatsapp_session_keys
ALTER TABLE public.whatsapp_session_keys ENABLE ROW LEVEL SECURITY;

-- Allow service_role and authenticated access
DROP POLICY IF EXISTS "Service role manage session keys" ON public.whatsapp_session_keys;
CREATE POLICY "Service role manage session keys" 
ON public.whatsapp_session_keys 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon cluster read session keys" ON public.whatsapp_session_keys;
CREATE POLICY "Allow anon cluster read session keys" 
ON public.whatsapp_session_keys 
FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Allow anon cluster write session keys" ON public.whatsapp_session_keys;
CREATE POLICY "Allow anon cluster write session keys" 
ON public.whatsapp_session_keys 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Upgrade whatsapp_nodes
ALTER TABLE public.whatsapp_nodes 
  ADD COLUMN IF NOT EXISTS is_leader BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_score INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS memory_rss_mb NUMERIC,
  ADD COLUMN IF NOT EXISTS uptime_seconds INT,
  ADD COLUMN IF NOT EXISTS channel_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'standby';

-- Enable RLS on whatsapp_nodes
ALTER TABLE public.whatsapp_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow cluster nodes manage whatsapp_nodes" ON public.whatsapp_nodes;
CREATE POLICY "Allow cluster nodes manage whatsapp_nodes" 
ON public.whatsapp_nodes 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- 4. Atomic RPC: acquire_whatsapp_lease
-- Implements Fenced Distributed Lease with Monotonic Epochs to prevent Split-Brain
CREATE OR REPLACE FUNCTION public.acquire_whatsapp_lease(
    p_node_id TEXT,
    p_channel_id UUID,
    p_lease_duration_seconds INT DEFAULT 15,
    p_health_score INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_channel RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_new_epoch BIGINT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_channel
    FROM public.whatsapp_channels
    WHERE id = p_channel_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('acquired', false, 'error', 'channel_not_found');
    END IF;

    v_expires_at := v_now + (p_lease_duration_seconds || ' seconds')::INTERVAL;

    -- Conditions to acquire lease:
    -- 1. Same node already holds lease (re-acquisition/renewal)
    -- 2. Lease is vacated (active_node_id IS NULL or active_leader_id IS NULL)
    -- 3. Previous lease expired (lease_expires_at IS NULL or lease_expires_at < v_now)
    IF v_channel.active_node_id = p_node_id 
       OR v_channel.active_leader_id = p_node_id 
       OR v_channel.active_node_id IS NULL 
       OR v_channel.lease_expires_at IS NULL 
       OR v_channel.lease_expires_at < v_now THEN
       
        -- If switching leaders, increment epoch strictly
        IF v_channel.active_node_id = p_node_id OR v_channel.active_leader_id = p_node_id THEN
            v_new_epoch := COALESCE(v_channel.current_epoch, 1);
        ELSE
            v_new_epoch := COALESCE(v_channel.current_epoch, 0) + 1;
        END IF;

        UPDATE public.whatsapp_channels
        SET active_node_id = p_node_id,
            active_leader_id = p_node_id,
            current_epoch = v_new_epoch,
            lease_expires_at = v_expires_at,
            last_heartbeat = v_now,
            updated_at = v_now
        WHERE id = p_channel_id;

        -- Upsert node status
        INSERT INTO public.whatsapp_nodes (node_id, role, status, is_leader, health_score, channel_id, last_seen)
        VALUES (p_node_id, 'leader', 'leader', true, p_health_score, p_channel_id, v_now)
        ON CONFLICT (node_id) DO UPDATE
        SET is_leader = true,
            role = 'leader',
            status = 'leader',
            health_score = p_health_score,
            channel_id = p_channel_id,
            last_seen = v_now;

        -- Downgrade other nodes for this channel
        UPDATE public.whatsapp_nodes
        SET is_leader = false,
            role = 'standby',
            status = 'standby'
        WHERE node_id != p_node_id AND (channel_id = p_channel_id OR channel_id IS NULL) AND is_leader = true;

        RETURN jsonb_build_object(
            'acquired', true,
            'node_id', p_node_id,
            'epoch', v_new_epoch,
            'expires_at', v_expires_at,
            'role', 'leader'
        );
    ELSE
        -- Lease occupied by an active leader
        RETURN jsonb_build_object(
            'acquired', false,
            'current_leader', COALESCE(v_channel.active_leader_id, v_channel.active_node_id),
            'epoch', v_channel.current_epoch,
            'expires_at', v_channel.lease_expires_at,
            'role', 'standby'
        );
    END IF;
END;
$$;

-- 5. Atomic RPC: renew_whatsapp_heartbeat
-- Renews lease if and only if epoch and node_id match
CREATE OR REPLACE FUNCTION public.renew_whatsapp_heartbeat(
    p_node_id TEXT,
    p_channel_id UUID,
    p_epoch BIGINT,
    p_lease_duration_seconds INT DEFAULT 15,
    p_health_score INT DEFAULT 100,
    p_memory_rss_mb NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_channel RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_channel
    FROM public.whatsapp_channels
    WHERE id = p_channel_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('renewed', false, 'error', 'channel_not_found');
    END IF;

    -- Verify fencing token and identity
    IF (v_channel.active_leader_id = p_node_id OR v_channel.active_node_id = p_node_id)
       AND v_channel.current_epoch = p_epoch THEN
       
        v_expires_at := v_now + (p_lease_duration_seconds || ' seconds')::INTERVAL;

        UPDATE public.whatsapp_channels
        SET lease_expires_at = v_expires_at,
            last_heartbeat = v_now,
            updated_at = v_now
        WHERE id = p_channel_id;

        INSERT INTO public.whatsapp_nodes (node_id, role, status, is_leader, health_score, memory_rss_mb, channel_id, last_seen)
        VALUES (p_node_id, 'leader', 'leader', true, p_health_score, p_memory_rss_mb, p_channel_id, v_now)
        ON CONFLICT (node_id) DO UPDATE
        SET last_seen = v_now,
            health_score = p_health_score,
            memory_rss_mb = COALESCE(p_memory_rss_mb, public.whatsapp_nodes.memory_rss_mb),
            status = 'leader',
            is_leader = true;

        RETURN jsonb_build_object(
            'renewed', true,
            'epoch', p_epoch,
            'expires_at', v_expires_at
        );
    ELSE
        -- Preempted or stale epoch! Node must step down immediately.
        RETURN jsonb_build_object(
            'renewed', false,
            'error', 'fencing_token_expired',
            'current_epoch', v_channel.current_epoch,
            'current_leader', COALESCE(v_channel.active_leader_id, v_channel.active_node_id),
            'action', 'step_down'
        );
    END IF;
END;
$$;

-- 6. Atomic RPC: release_whatsapp_lease
-- For fast cooperative handover on graceful shutdown (app closed, computer restart)
CREATE OR REPLACE FUNCTION public.release_whatsapp_lease(
    p_node_id TEXT,
    p_channel_id UUID,
    p_reason TEXT DEFAULT 'graceful_shutdown'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_released BOOLEAN := false;
BEGIN
    UPDATE public.whatsapp_channels
    SET active_node_id = NULL,
        active_leader_id = NULL,
        lease_expires_at = NULL,
        last_heartbeat = v_now,
        updated_at = v_now
    WHERE id = p_channel_id AND (active_leader_id = p_node_id OR active_node_id = p_node_id);

    v_released := FOUND;

    UPDATE public.whatsapp_nodes
    SET is_leader = false,
        role = 'standby',
        status = 'standby',
        last_seen = v_now
    WHERE node_id = p_node_id;

    RETURN v_released;
END;
$$;

-- 7. Realtime Publication Enablement
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_channels'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_channels;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_session_keys'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_session_keys;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_nodes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_nodes;
    END IF;
END $$;

ALTER TABLE public.whatsapp_channels REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_session_keys REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_nodes REPLICA IDENTITY FULL;
