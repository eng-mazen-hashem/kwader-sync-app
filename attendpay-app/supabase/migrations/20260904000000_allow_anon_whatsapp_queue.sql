-- Enable RLS policy on whatsapp_queue for decentralized nodes using anon/authenticated role
CREATE POLICY "Allow anon and authenticated all on whatsapp_queue"
ON whatsapp_queue
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
