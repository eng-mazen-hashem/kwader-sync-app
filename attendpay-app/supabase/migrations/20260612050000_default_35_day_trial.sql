-- Update handle_new_user to assign a 35-day trial (subscription_expires_at) on client self-registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_company_id uuid;
    c_name text;
    c_country text;
    invite_record record;
BEGIN
    -- Check if user has a pending invite (either hr or owner)
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
        -- Insert into companies with 35-day trial subscription
        INSERT INTO public.companies (
            owner_id, 
            name,
            plan,
            subscription_amount,
            subscription_expires_at,
            settings
        ) VALUES (
            NEW.id, 
            c_name, 
            'Pro', -- Default trial tier
            0,     -- Free trial amount
            now() + interval '35 days',
            jsonb_build_object(
                'country', c_country,
                'subscription_amount', 0,
                'subscription_expires_at', to_char(now() + interval '35 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'subscription_end_date', to_char(now() + interval '35 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'trial_end_date', to_char(now() + interval '35 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            )
        ) RETURNING id INTO new_company_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Raise exception so the transaction rolls back and signup fails clearly
    RAISE EXCEPTION 'Failed to create company profile during registration: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
