-- Migration: Delete auth user when removed from company_users (HR Employees)
-- When a company sub-user (HR role) is deleted from company_users table, this trigger will automatically delete their authentication account in auth.users completely.

CREATE OR REPLACE FUNCTION public.delete_auth_user_on_company_user_delete()
RETURNS trigger AS $$
BEGIN
    -- Check if the auth user still exists in auth.users to avoid recursion or exceptions
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
        DELETE FROM auth.users WHERE id = OLD.user_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS tr_delete_auth_user_on_company_user_delete ON public.company_users;

-- Create the trigger
CREATE TRIGGER tr_delete_auth_user_on_company_user_delete
AFTER DELETE ON public.company_users
FOR EACH ROW
EXECUTE FUNCTION public.delete_auth_user_on_company_user_delete();
