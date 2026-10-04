-- 1. Ensure columns exist on whatsapp_queue for full backward and forward compatibility
ALTER TABLE whatsapp_queue 
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

-- 2. Create sync trigger to keep processed_at <-> sent_at, error <-> error_message, attempts <-> retry_count in sync
CREATE OR REPLACE FUNCTION sync_whatsapp_queue_compatibility_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync processed_at and sent_at
  IF NEW.processed_at IS NOT NULL AND NEW.sent_at IS NULL THEN
    NEW.sent_at := NEW.processed_at;
  ELSIF NEW.sent_at IS NOT NULL AND NEW.processed_at IS NULL THEN
    NEW.processed_at := NEW.sent_at;
  END IF;

  -- Sync error and error_message
  IF NEW.error IS NOT NULL AND NEW.error_message IS NULL THEN
    NEW.error_message := NEW.error;
  ELSIF NEW.error_message IS NOT NULL AND NEW.error IS NULL THEN
    NEW.error := NEW.error_message;
  END IF;

  -- Sync attempts and retry_count
  IF NEW.attempts IS NOT NULL AND (NEW.retry_count IS NULL OR NEW.retry_count = 0) THEN
    NEW.retry_count := NEW.attempts;
  ELSIF NEW.retry_count IS NOT NULL AND (NEW.attempts IS NULL OR NEW.attempts = 0) THEN
    NEW.attempts := NEW.retry_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_whatsapp_queue_compat ON whatsapp_queue;
CREATE TRIGGER trg_sync_whatsapp_queue_compat
BEFORE INSERT OR UPDATE ON whatsapp_queue
FOR EACH ROW EXECUTE FUNCTION sync_whatsapp_queue_compatibility_fields();

-- 3. Replace claim_whatsapp_messages RPC with robust UUID handling
CREATE OR REPLACE FUNCTION public.claim_whatsapp_messages(
    p_node_id text, 
    p_channel_id text DEFAULT NULL::text, 
    p_limit integer DEFAULT 5
)
RETURNS SETOF whatsapp_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_channel_uuid uuid := NULL;
BEGIN
  IF p_channel_id IS NOT NULL AND p_channel_id <> '' AND p_channel_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_channel_uuid := p_channel_id::uuid;
  END IF;

  RETURN QUERY
  UPDATE whatsapp_queue
  SET status = 'processing',
      node_id = p_node_id,
      locked_at = NOW(),
      processed_at = NOW(),
      channel_id = COALESCE(whatsapp_queue.channel_id, v_channel_uuid)
  WHERE id IN (
    SELECT id FROM whatsapp_queue
    WHERE (status = 'pending' OR (status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes'))
      AND (
        v_channel_uuid IS NULL
        OR channel_id IS NULL 
        OR channel_id = v_channel_uuid
      )
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
END;
$function$;
