CREATE OR REPLACE FUNCTION claim_whatsapp_messages(p_node_id TEXT, p_channel_id TEXT DEFAULT NULL, p_limit INT DEFAULT 5)
RETURNS SETOF whatsapp_queue
LANGUAGE plpgsql
AS $body
BEGIN
  RETURN QUERY
  UPDATE whatsapp_queue
  SET status = 'processing',
      node_id = p_node_id,
      processed_at = NOW()
  WHERE id IN (
    SELECT id FROM whatsapp_queue
    WHERE status = 'pending'
      AND (p_channel_id IS NULL OR channel_id = p_channel_id OR channel_id IS NULL)
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
END;
$body;
