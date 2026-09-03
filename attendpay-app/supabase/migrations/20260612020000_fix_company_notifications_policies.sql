-- Drop old policies to avoid conflicts
DROP POLICY IF EXISTS "Company owners can delete their notifications" ON public.company_notifications;
DROP POLICY IF EXISTS "Companies can delete notifications" ON public.company_notifications;
DROP POLICY IF EXISTS "company_notifications_subuser_access" ON public.company_notifications;
DROP POLICY IF EXISTS "company_notifications_superadmin_access" ON public.company_notifications;
DROP POLICY IF EXISTS "company_notifications_reseller_access" ON public.company_notifications;

-- 1. Super Admins: Full access to all company notifications
CREATE POLICY "company_notifications_superadmin_access" ON public.company_notifications
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid()
  )
);

-- 2. Resellers: Full access to notifications of companies they manage
CREATE POLICY "company_notifications_reseller_access" ON public.company_notifications
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT c.id FROM public.companies c
    JOIN public.resellers r ON c.reseller_id = r.id
    WHERE r.user_id = auth.uid() AND r.status = 'active'
  )
)
WITH CHECK (
  company_id IN (
    SELECT c.id FROM public.companies c
    JOIN public.resellers r ON c.reseller_id = r.id
    WHERE r.user_id = auth.uid() AND r.status = 'active'
  )
);

-- 3. Company Users (Owners & HR Sub-users): Full access to their own company's notifications
CREATE POLICY "company_notifications_company_user_access" ON public.company_notifications
FOR ALL
TO authenticated
USING (
  company_id = public.user_company_id()
)
WITH CHECK (
  company_id = public.user_company_id()
);
