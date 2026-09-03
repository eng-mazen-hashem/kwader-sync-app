-- Migration: Create system_settings table for dynamic landing page & trial days
-- Storing system settings in the database makes them customizable via the Super Admin dashboard.

CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop policies if exist
DROP POLICY IF EXISTS "Allow public read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow super admin write system_settings" ON public.system_settings;

-- Allow public select access to system_settings
CREATE POLICY "Allow public read system_settings" ON public.system_settings FOR SELECT USING (true);

-- Allow Super Admins full write access
CREATE POLICY "Allow super admin write system_settings" ON public.system_settings FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() AND (raw_user_meta_data->>'is_super_admin')::boolean = true
    )
);

-- Seed values
INSERT INTO public.system_settings (key, value) VALUES
('pricing_monthly', '[29, 79, 199]'::jsonb),
('pricing_yearly', '[23, 63, 159]'::jsonb),
('trial_days', '35'::jsonb),
('platform_name', '"Kwader"'::jsonb),
('support_email', '"support@kwader.io"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
