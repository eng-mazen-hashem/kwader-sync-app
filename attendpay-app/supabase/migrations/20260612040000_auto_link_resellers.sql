-- Migration: 20260612040000_auto_link_resellers.sql
-- Description: Automatically links resellers to their auth.users profile when registering.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_company_id uuid;
    c_name text;
    c_country text;
    invite_record record;
    reseller_record record;
BEGIN
    -- 1. Check if user is a reseller by email
    SELECT * INTO reseller_record FROM public.resellers
    WHERE email = NEW.email
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.resellers
        SET user_id = NEW.id
        WHERE id = reseller_record.id;
        
        -- Since they are a reseller, we do not auto-create a client company for them
        RETURN NEW;
    END IF;

    -- 2. Check if user has a pending invite (either hr or owner)
    SELECT * INTO invite_record FROM public.company_invites 
    WHERE email = NEW.email AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        IF invite_record.role = 'owner' THEN
            -- Update companies to set owner_id to the new user ID
            UPDATE public.companies 
            SET owner_id = NEW.id
            WHERE id = invite_record.company_id;
        ELSE
            -- Insert into company_users (default hr role or as specified in invite)
            INSERT INTO public.company_users (company_id, user_id, role, permissions)
            VALUES (invite_record.company_id, NEW.id, COALESCE(invite_record.role, 'hr'), invite_record.permissions)
            ON CONFLICT (company_id, user_id) DO UPDATE 
            SET permissions = EXCLUDED.permissions;
        END IF;

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
    RAISE EXCEPTION 'Failed to create company profile during registration: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
