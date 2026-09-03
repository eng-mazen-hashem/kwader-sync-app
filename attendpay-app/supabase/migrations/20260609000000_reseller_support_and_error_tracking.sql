-- Migration: Allow active resellers to update company status and view/reply to support tickets

-- 1. Companies Table: Allow reseller to update company status
DROP POLICY IF EXISTS reseller_updates_own_companies ON public.companies;
CREATE POLICY reseller_updates_own_companies ON public.companies
FOR UPDATE
TO authenticated
USING (
  reseller_id IN (
    SELECT id FROM public.resellers
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
WITH CHECK (
  reseller_id IN (
    SELECT id FROM public.resellers
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 2. Support Tickets Table: Allow reseller to view their companies' support tickets
DROP POLICY IF EXISTS reseller_sees_own_tickets ON public.support_tickets;
CREATE POLICY reseller_sees_own_tickets ON public.support_tickets
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT id FROM public.companies
    WHERE reseller_id IN (
      SELECT id FROM public.resellers
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

-- 3. Support Tickets Table: Allow reseller to update their companies' support tickets
DROP POLICY IF EXISTS reseller_updates_own_tickets ON public.support_tickets;
CREATE POLICY reseller_updates_own_tickets ON public.support_tickets
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT id FROM public.companies
    WHERE reseller_id IN (
      SELECT id FROM public.resellers
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT id FROM public.companies
    WHERE reseller_id IN (
      SELECT id FROM public.resellers
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

-- 4. Support Ticket Replies Table: Allow reseller to view replies
DROP POLICY IF EXISTS reseller_sees_own_ticket_replies ON public.support_ticket_replies;
CREATE POLICY reseller_sees_own_ticket_replies ON public.support_ticket_replies
FOR SELECT
TO authenticated
USING (
  ticket_id IN (
    SELECT id FROM public.support_tickets
    WHERE company_id IN (
      SELECT id FROM public.companies
      WHERE reseller_id IN (
        SELECT id FROM public.resellers
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);

-- 5. Support Ticket Replies Table: Allow reseller to write replies
DROP POLICY IF EXISTS reseller_inserts_own_ticket_replies ON public.support_ticket_replies;
CREATE POLICY reseller_inserts_own_ticket_replies ON public.support_ticket_replies
FOR INSERT
TO authenticated
WITH CHECK (
  ticket_id IN (
    SELECT id FROM public.support_tickets
    WHERE company_id IN (
      SELECT id FROM public.companies
      WHERE reseller_id IN (
        SELECT id FROM public.resellers
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  )
);
