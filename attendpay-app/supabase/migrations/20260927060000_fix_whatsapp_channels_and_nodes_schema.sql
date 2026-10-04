-- =========================================================================
-- Migration: Add Missing Columns to WhatsApp Infrastructure Tables
-- =========================================================================

-- 1. Add missing columns to whatsapp_channels
ALTER TABLE public.whatsapp_channels
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS active_node_id TEXT,
  ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;

UPDATE public.whatsapp_channels 
SET phone_number = phone 
WHERE phone_number IS NULL AND phone IS NOT NULL;

-- 2. Add missing columns to whatsapp_nodes
ALTER TABLE public.whatsapp_nodes
  ADD COLUMN IF NOT EXISTS hostname TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'worker',
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_time_ms INTEGER DEFAULT 0;

-- 3. Add missing columns to whatsapp_queue
ALTER TABLE public.whatsapp_queue
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES public.whatsapp_api_keys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_channel_status 
  ON public.whatsapp_queue(channel_id, status, priority DESC, created_at ASC);

-- 4. Insert Default General Channel if none exists
INSERT INTO public.whatsapp_channels (name, description, is_default, is_active, status)
SELECT 'القناة الافتراضية العامة', 'القناة الأساسية لإرسال إشعارات المنصة والتقارير والـ OTP', true, true, 'disconnected'
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_channels WHERE is_default = true);
