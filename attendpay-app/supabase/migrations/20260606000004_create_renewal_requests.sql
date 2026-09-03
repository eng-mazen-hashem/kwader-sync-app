-- Create renewal_requests table
CREATE TABLE IF NOT EXISTS public.renewal_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    requested_at timestamptz DEFAULT now(),
    details jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.renewal_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "client_select_access" ON public.renewal_requests;
DROP POLICY IF EXISTS "client_insert_access" ON public.renewal_requests;
DROP POLICY IF EXISTS "super_admin_all_access" ON public.renewal_requests;

-- Policies
CREATE POLICY "client_select_access" ON public.renewal_requests FOR SELECT
USING (company_id = public.user_company_id());

CREATE POLICY "client_insert_access" ON public.renewal_requests FOR INSERT
WITH CHECK (company_id = public.user_company_id());

CREATE POLICY "super_admin_all_access" ON public.renewal_requests FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.super_admins 
        WHERE user_id = auth.uid()
    )
);

-- Insert default values for whatsapp settings in system_settings if they don't exist
INSERT INTO public.system_settings (key, value) VALUES
('whatsapp_notifications_enabled', 'false'::jsonb),
('whatsapp_recipient_phone', '""'::jsonb),
('whatsapp_api_url', '"http://localhost:3000"'::jsonb),
('whatsapp_api_key', '"kwader-super-secret-key"'::jsonb)
ON CONFLICT (key) DO NOTHING;
