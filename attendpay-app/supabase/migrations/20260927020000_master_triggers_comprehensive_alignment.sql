-- ==============================================================================
-- Migration: 20260927020000_master_triggers_comprehensive_alignment.sql
-- Description: Master Comprehensive Database Triggers Suite
-- Ensures:
--   1. on_auth_user_created (auth.users) handles 35-day trial, owner/HR invites,
--      and auto-creates companies securely without orphaned profiles.
--   2. tr_delete_auth_user_on_company_user_delete (company_users) includes
--      multi-tenant ownership and super admin guards before deleting auth.users.
--   3. tr_log_company_signup & tr_log_company_status_change (companies) provide
--      automated administrative audit logging to admin_activity.
--   4. on_raw_attendance_insert (raw_attendance_logs) is protected with
--      SECURITY DEFINER to prevent RLS blocks during biometric punch syncing.
--   5. Automatic updated_at synchronization across all tables with updated_at columns.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Auth User Created Trigger: 35-Day Trial, Invites & Company Initialization
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_company_id uuid;
    c_name text;
    c_country text;
    invite_record record;
    trial_expiry timestamptz := now() + interval '35 days';
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
            status,
            restriction_level,
            subscription_amount,
            subscription_expires_at,
            subscription_end_date,
            settings
        ) VALUES (
            NEW.id, 
            c_name, 
            'Pro',       -- Default trial tier
            'active',    -- Active status
            'none',
            0,           -- Free trial
            trial_expiry,
            to_char(trial_expiry, 'YYYY-MM-DD'),
            jsonb_build_object(
                'country', c_country,
                'subscription_amount', 0,
                'subscription_expires_at', to_char(trial_expiry, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'subscription_end_date', to_char(trial_expiry, 'YYYY-MM-DD'),
                'trial_end_date', to_char(trial_expiry, 'YYYY-MM-DD')
            )
        ) RETURNING id INTO new_company_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create company profile during registration: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. Safe Auth User Cleanup Trigger on company_users
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_auth_user_on_company_user_delete()
RETURNS trigger AS $$
BEGIN
    -- Only delete the auth account if the user does NOT own any company, 
    -- does NOT have any remaining company memberships, and is NOT a super_admin.
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE owner_id = OLD.user_id)
       AND NOT EXISTS (SELECT 1 FROM public.company_users WHERE user_id = OLD.user_id AND id != OLD.id)
       AND NOT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = OLD.user_id) THEN
        IF EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
            DELETE FROM auth.users WHERE id = OLD.user_id;
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_delete_auth_user_on_company_user_delete ON public.company_users;
CREATE TRIGGER tr_delete_auth_user_on_company_user_delete
  AFTER DELETE ON public.company_users
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_auth_user_on_company_user_delete();

-- ------------------------------------------------------------------------------
-- 3. Administrative Audit Logging Triggers on companies
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_company_signup()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.admin_activity (event, action, description, actor)
  VALUES ('New Company', 'signup', 'New company registered: ' || NEW.name, 'System');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.log_company_status_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_activity (event, action, description, actor)
    VALUES ('Company Status', 'status_changed', 'Status changed: ' || COALESCE(OLD.status, 'none') || ' → ' || COALESCE(NEW.status, 'none'), 'System');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_log_company_signup ON public.companies;
CREATE TRIGGER tr_log_company_signup
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.log_company_signup();

DROP TRIGGER IF EXISTS tr_log_company_status_change ON public.companies;
CREATE TRIGGER tr_log_company_status_change
  AFTER UPDATE OF status ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.log_company_status_change();

-- ------------------------------------------------------------------------------
-- 4. Attendance Processor Security Definer Protection
-- ------------------------------------------------------------------------------
ALTER FUNCTION public.process_raw_attendance_trigger() SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- 5. Standardized updated_at Triggers Across All Applicable Tables
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'whatsapp_channels',
            'employee_documents',
            'system_settings',
            'ai_conversations',
            'ai_knowledge_base',
            'ai_leads',
            'kw_jobs',
            'kw_workers'
        ])
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_at') THEN
            EXECUTE format('DROP TRIGGER IF EXISTS tr_update_%I_modtime ON public.%I;', tbl, tbl);
            EXECUTE format('DROP TRIGGER IF EXISTS update_%I_modtime ON public.%I;', tbl, tbl);
            EXECUTE format('CREATE TRIGGER tr_update_%I_modtime BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();', tbl, tbl);
        END IF;
    END LOOP;
END $$;
