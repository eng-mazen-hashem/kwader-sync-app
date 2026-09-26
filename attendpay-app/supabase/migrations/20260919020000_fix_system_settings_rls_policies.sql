-- Migration: Fix system_settings RLS policies
-- Drops broken policy that directly queries auth.users causing 42501 permission denied
-- Establishes clean policies for public read, super_admin full access, and service_role access

-- 1. Drop old and broken policies
DROP POLICY IF EXISTS "Allow super admin write system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated write system settings" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_superadmin_access" ON public.system_settings;
DROP POLICY IF EXISTS "Public read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Super admin manage system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Service role manage system settings" ON public.system_settings;

-- 2. Ensure RLS is enabled
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 3. Public read policy
CREATE POLICY "Public read system settings" 
  ON public.system_settings 
  FOR SELECT 
  TO public 
  USING (true);

-- 4. Super Admin full management policy
CREATE POLICY "Super admin manage system settings" 
  ON public.system_settings 
  FOR ALL 
  TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

-- 5. Service Role full management policy
CREATE POLICY "Service role manage system settings" 
  ON public.system_settings 
  FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);
