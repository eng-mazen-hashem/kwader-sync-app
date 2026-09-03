-- Migration: Add 35-day trial period on company creation
-- This migration updates the new user registration trigger to automatically assign a 35-day trial to the company's settings.

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
        -- Insert into companies with a 35-day trial
        INSERT INTO public.companies (
            owner_id, 
            name, 
            settings
        ) VALUES (
            NEW.id, 
            c_name, 
            jsonb_build_object(
                'country', c_country,
                'trial_end_date', to_char(now() + interval '35 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            )
        ) RETURNING id INTO new_company_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Raise exception so the transaction rolls back and signup fails clearly
    RAISE EXCEPTION 'Failed to create company profile during registration: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
