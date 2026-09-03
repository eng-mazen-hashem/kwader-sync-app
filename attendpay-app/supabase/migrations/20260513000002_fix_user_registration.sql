-- ==============================================================================
-- Migration: Fix User Registration (Company Auto-Creation)
-- ==============================================================================

-- 1. Create or replace the function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_company_id uuid;
    c_name text;
    c_country text;
BEGIN
    -- Check if user is an invited sub-user/HR
    IF EXISTS (SELECT 1 FROM public.company_invites WHERE email = NEW.email AND expires_at > now()) THEN
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
    -- This prevents orphaned users without a company profile.
    RAISE EXCEPTION 'Failed to create company profile during registration: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing trigger if it exists (to avoid conflicts)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create the trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
