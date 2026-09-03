-- Migration: Allow active resellers to insert companies with their own reseller_id
DROP POLICY IF EXISTS reseller_inserts_own_companies ON public.companies;
CREATE POLICY reseller_inserts_own_companies ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  reseller_id IN (
    SELECT id FROM public.resellers
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Configure trigger functions that write to public.admin_activity as SECURITY DEFINER
-- so they can bypass direct table RLS policies of the executing user (e.g. reseller)
ALTER FUNCTION public.log_company_signup() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.log_company_status_change() SECURITY DEFINER SET search_path = public;
