-- Migration: Fix delete_tenant_completely to protect owners of multiple companies/branches
-- When a tenant is deleted, do not delete the owner from auth.users if they still own other companies.

CREATE OR REPLACE FUNCTION delete_tenant_completely(target_company_id UUID)
RETURNS void AS $$
DECLARE
    v_owner_id UUID;
    v_other_companies_count INT;
BEGIN
    -- 1. Get the owner_id before company deletion
    SELECT owner_id INTO v_owner_id FROM public.companies WHERE id = target_company_id;

    -- 2. Delete support tickets and replies
    DELETE FROM public.support_ticket_replies WHERE ticket_id IN (
        SELECT id FROM public.support_tickets WHERE company_id = target_company_id
    );
    DELETE FROM public.support_tickets WHERE company_id = target_company_id;

    -- 3. Delete invoices
    DELETE FROM public.invoices WHERE company_id = target_company_id;
    
    -- 4. Delete auth users that belong specifically to this company (employees / sub-users)
    DELETE FROM auth.users 
    WHERE id IN (
        SELECT id FROM auth.users 
        WHERE raw_user_meta_data->>'company_id' = target_company_id::text 
           OR raw_app_meta_data->>'company_id' = target_company_id::text
    );
    
    -- 5. Delete the company itself (cascades to employees, departments, shifts, devices, etc.)
    DELETE FROM public.companies WHERE id = target_company_id;

    -- 6. Only delete the owner from auth.users if they do NOT own any other remaining companies
    IF v_owner_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_other_companies_count 
        FROM public.companies 
        WHERE owner_id = v_owner_id;
        
        IF v_other_companies_count = 0 THEN
            DELETE FROM auth.users WHERE id = v_owner_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
