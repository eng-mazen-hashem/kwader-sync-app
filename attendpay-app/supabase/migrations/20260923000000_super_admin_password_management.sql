-- Migration: 20260923000000_super_admin_password_management.sql
-- Description: RPC for Super Admin to securely reset or update user passwords

CREATE OR REPLACE FUNCTION public.super_admin_update_user_password(
    p_target_user_id uuid DEFAULT NULL,
    p_new_password text DEFAULT NULL,
    p_target_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id uuid;
    v_email text;
    v_updated_at timestamptz;
BEGIN
    -- 1. Security Check: Only Super Admins can execute this
    IF NOT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Super Admin privileges required.';
    END IF;

    -- 2. Validate Password
    IF p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
        RAISE EXCEPTION 'Password must be at least 6 characters.';
    END IF;

    -- 3. Find target user
    IF p_target_user_id IS NOT NULL THEN
        SELECT id, email INTO v_user_id, v_email FROM auth.users WHERE id = p_target_user_id;
    ELSIF p_target_email IS NOT NULL THEN
        SELECT id, email INTO v_user_id, v_email FROM auth.users WHERE lower(email) = lower(trim(p_target_email));
    ELSE
        RAISE EXCEPTION 'Either target_user_id or target_email must be provided.';
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    -- 4. Update password securely using Bcrypt (extensions.crypt)
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(trim(p_new_password), extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id
    RETURNING updated_at INTO v_updated_at;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', v_email,
        'updated_at', v_updated_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_update_user_password(uuid, text, text) TO authenticated;
