-- =========================================================================
-- Migration: WhatsApp Channels, Client Routing, and External API Gateway
-- =========================================================================

-- 1. Create WhatsApp Channels Table
CREATE TABLE IF NOT EXISTS whatsapp_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    phone_number text,
    is_default boolean DEFAULT false,
    status text DEFAULT 'disconnected', -- 'connected', 'qr_pending', 'disconnected'
    qr_code text,
    active_node_id text,
    last_heartbeat timestamptz,
    created_at timestamptz DEFAULT clock_timestamp(),
    updated_at timestamptz DEFAULT clock_timestamp()
);

-- 2. Create WhatsApp External API Keys Table
CREATE TABLE IF NOT EXISTS whatsapp_api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    api_key text UNIQUE NOT NULL,
    channel_id uuid REFERENCES whatsapp_channels(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    rate_limit_per_minute int DEFAULT 60,
    total_sent int DEFAULT 0,
    last_used_at timestamptz,
    created_at timestamptz DEFAULT clock_timestamp()
);

-- 3. Add Channel Reference to Companies Table (Client Routing)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_channel_id uuid REFERENCES whatsapp_channels(id) ON DELETE SET NULL;

-- 4. Add Channel & API Key References to WhatsApp Queue Table
ALTER TABLE whatsapp_queue ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES whatsapp_channels(id) ON DELETE SET NULL;
ALTER TABLE whatsapp_queue ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES whatsapp_api_keys(id) ON DELETE SET NULL;

-- 5. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_channel_status ON whatsapp_queue(channel_id, status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_api_keys_lookup ON whatsapp_api_keys(api_key) WHERE is_active = true;

-- 6. Insert Default Channel if none exists
INSERT INTO whatsapp_channels (name, description, is_default, status)
SELECT 'القناة الافتراضية العامة', 'القناة الأساسية لإرسال إشعارات المنصة والتقارير والـ OTP', true, 'disconnected'
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_channels WHERE is_default = true);

-- 7. Enable RLS
ALTER TABLE whatsapp_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_api_keys ENABLE ROW LEVEL SECURITY;

-- 8. Policies for whatsapp_channels
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_channels' AND policyname = 'Allow public read whatsapp_channels') THEN
        CREATE POLICY "Allow public read whatsapp_channels" ON whatsapp_channels FOR SELECT TO anon, authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_channels' AND policyname = 'Allow all write whatsapp_channels') THEN
        CREATE POLICY "Allow all write whatsapp_channels" ON whatsapp_channels FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 9. Policies for whatsapp_api_keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_api_keys' AND policyname = 'Allow all whatsapp_api_keys') THEN
        CREATE POLICY "Allow all whatsapp_api_keys" ON whatsapp_api_keys FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 10. Atomic Verification RPC for External API Keys
CREATE OR REPLACE FUNCTION verify_whatsapp_api_key(p_api_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_key_record record;
    v_channel_record record;
    v_target_channel_id uuid;
    v_target_channel_name text;
    v_now timestamptz := clock_timestamp();
BEGIN
    -- Look up the active API Key
    SELECT * INTO v_key_record
    FROM whatsapp_api_keys
    WHERE api_key = p_api_key AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid or inactive API key');
    END IF;

    -- Determine the target channel
    IF v_key_record.channel_id IS NOT NULL THEN
        SELECT * INTO v_channel_record FROM whatsapp_channels WHERE id = v_key_record.channel_id;
    END IF;

    IF v_channel_record.id IS NULL THEN
        -- Fall back to default channel
        SELECT * INTO v_channel_record FROM whatsapp_channels WHERE is_default = true LIMIT 1;
    END IF;

    v_target_channel_id := v_channel_record.id;
    v_target_channel_name := COALESCE(v_channel_record.name, 'Default Channel');

    -- Increment sent counter and update last used
    UPDATE whatsapp_api_keys
    SET total_sent = total_sent + 1,
        last_used_at = v_now
    WHERE id = v_key_record.id;

    RETURN jsonb_build_object(
        'valid', true,
        'key_id', v_key_record.id,
        'key_name', v_key_record.name,
        'channel_id', v_target_channel_id,
        'channel_name', v_target_channel_name,
        'rate_limit', v_key_record.rate_limit_per_minute
    );
END;
$$;

GRANT EXECUTE ON FUNCTION verify_whatsapp_api_key(text) TO anon, authenticated, service_role;
