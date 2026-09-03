-- Migration: Fix user_company_id logic to be deterministic
-- Add ORDER BY created_at ASC so it matches how AuthContext fetches the active company.

CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS uuid AS $$
DECLARE
    cid uuid;
BEGIN
    -- 1. Check if user is the owner of a company
    SELECT id INTO cid FROM public.companies WHERE owner_id = auth.uid() ORDER BY created_at ASC LIMIT 1;
    IF cid IS NOT NULL THEN
        RETURN cid;
    END IF;
    
    -- 2. Check if user is an HR employee in company_users
    SELECT company_id INTO cid FROM public.company_users WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1;
    RETURN cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
