-- Migration: Fix HR Invitation & Signup Orphaning
-- This migration updates the new user registration trigger to automatically associate newly signed up users with the company if they have a pending invite.
-- It also updates the accept_invite RPC to be idempotent.

-- 1. Create or replace the function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_company_id uuid;
    c_name text;
    c_country text;
    invite_record record;
BEGIN
    -- Check if user is an invited sub-user/HR
    SELECT * INTO invite_record FROM public.company_invites 
    WHERE email = NEW.email AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        -- Insert into company_users
        INSERT INTO public.company_users (company_id, user_id, role, permissions)
        VALUES (invite_record.company_id, NEW.id, 'hr', invite_record.permissions)
        ON CONFLICT (company_id, user_id) DO UPDATE 
        SET permissions = EXCLUDED.permissions;

        -- Delete the invite
        DELETE FROM public.company_invites WHERE id = invite_record.id;

        RETURN NEW;
    END IF;

    -- Extract company name from metadata, fallback to email prefix if missing
    c_name := COALESCE(
        NEW.raw_user_meta_data->>'company_name', 
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
    );
    
    -- Extract country
    c_country := NEW.raw_user_meta_data->>'country';

    -- Check if a company with this owner already exists to prevent duplicate errors
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE owner_id = NEW.id) THEN
        -- Insert into companies
        INSERT INTO public.companies (
            owner_id, 
            name, 
            settings
        ) VALUES (
            NEW.id, 
            c_name, 
            jsonb_build_object('country', c_country)
        ) RETURNING id INTO new_company_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Raise exception so the transaction rolls back and signup fails clearly
    RAISE EXCEPTION 'Failed to create company profile during registration: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create or replace public.accept_invite to be idempotent
CREATE OR REPLACE FUNCTION public.accept_invite(invite_token uuid)
RETURNS json AS $$
DECLARE
    invite_record record;
    new_user_id uuid;
BEGIN
    new_user_id := auth.uid();
    
    IF new_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Find the invite
    SELECT * INTO invite_record FROM public.company_invites 
    WHERE token = invite_token AND expires_at > now();

    IF NOT FOUND THEN
        -- Fallback: If the user is already a member of a company in company_users, return success
        IF EXISTS (SELECT 1 FROM public.company_users WHERE user_id = new_user_id) THEN
            RETURN json_build_object(
                'success', true, 
                'company_id', (SELECT company_id FROM public.company_users WHERE user_id = new_user_id LIMIT 1)
            );
        END IF;

        RAISE EXCEPTION 'Invalid or expired invite token';
    END IF;

    -- Cleanup: If the system accidentally created an empty company for this user, delete it.
    DELETE FROM public.companies 
    WHERE owner_id = new_user_id 
    AND NOT EXISTS (SELECT 1 FROM public.employees WHERE company_id = public.companies.id);

    -- Insert into company_users
    INSERT INTO public.company_users (company_id, user_id, role, permissions)
    VALUES (invite_record.company_id, new_user_id, 'hr', invite_record.permissions)
    ON CONFLICT (company_id, user_id) DO UPDATE 
    SET permissions = EXCLUDED.permissions;

    -- Delete the invite
    DELETE FROM public.company_invites WHERE id = invite_record.id;

    RETURN json_build_object('success', true, 'company_id', invite_record.company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
