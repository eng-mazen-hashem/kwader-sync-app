-- Migration: 20260928170000_fix_license_key_type_mismatch_and_sync_rpcs.sql
-- Description: Fixes operator does not exist (uuid = text) in check_subscription, sync_attendance, and adds update_sync_telemetry.

-- 1. Ensure required columns on sync_service_status and raw_attendance_logs
ALTER TABLE public.sync_service_status ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;
ALTER TABLE public.sync_service_status ADD COLUMN IF NOT EXISTS device_ping_status BOOLEAN;
ALTER TABLE public.sync_service_status ADD COLUMN IF NOT EXISTS service_version TEXT;
ALTER TABLE public.sync_service_status ADD COLUMN IF NOT EXISTS last_error_message TEXT;
ALTER TABLE public.raw_attendance_logs ADD COLUMN IF NOT EXISTS device_serial TEXT;

-- 2. Indexes for fast license lookup
CREATE INDEX IF NOT EXISTS idx_companies_license_key ON public.companies (license_key);
CREATE INDEX IF NOT EXISTS idx_companies_license_key_text ON public.companies ((license_key::text));

-- 3. Function: check_subscription (Fixed safe UUID cast and safe date parsing)
CREATE OR REPLACE FUNCTION public.check_subscription(p_license_key text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_company RECORD;
  v_force_sync BOOLEAN := false;
  v_quota INT := 1;
  v_clean_key TEXT;
  v_is_expired BOOLEAN := false;
  v_exp_date DATE;
  v_is_unlimited BOOLEAN := false;
BEGIN
  v_clean_key := TRIM(COALESCE(p_license_key, ''));
  IF v_clean_key = '' THEN
    RETURN json_build_object('active', false, 'message', 'مفتاح الترخيص مطلوب.');
  END IF;

  SELECT id, name, subscription_end_date, plan, status, settings
  INTO v_company
  FROM companies
  WHERE license_key::text = v_clean_key
     OR LOWER(license_key::text) = LOWER(v_clean_key);

  IF NOT FOUND THEN
    RETURN json_build_object('active', false, 'message', 'مفتاح الترخيص غير صالح');
  END IF;

  -- Determine device quota from settings or plan
  v_quota := COALESCE(
    (v_company.settings->'limits'->>'max_devices')::int,
    (v_company.settings->>'device_quota')::int,
    (v_company.settings->>'max_devices')::int,
    CASE 
      WHEN LOWER(COALESCE(v_company.plan, '')) = 'enterprise' THEN 999
      WHEN LOWER(COALESCE(v_company.plan, '')) = 'pro' THEN 3
      ELSE 1
    END
  );

  v_is_unlimited := (v_quota >= 999);

  -- Safe date check
  IF v_company.subscription_end_date IS NOT NULL AND TRIM(v_company.subscription_end_date) <> '' THEN
    BEGIN
      v_exp_date := (SUBSTRING(TRIM(v_company.subscription_end_date) FROM 1 FOR 10))::DATE;
      IF v_exp_date < CURRENT_DATE THEN
        v_is_expired := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_is_expired := false;
    END;
  END IF;

  IF v_is_expired THEN
    RETURN json_build_object(
      'active', false,
      'message', 'انتهى الاشتراك بتاريخ ' || v_company.subscription_end_date::text,
      'company_name', v_company.name,
      'plan', COALESCE(v_company.plan, 'Enterprise'),
      'status', COALESCE(v_company.status, 'expired'),
      'expires', v_company.subscription_end_date,
      'device_quota', v_quota,
      'is_unlimited', v_is_unlimited,
      'device_quota_label', CASE 
        WHEN v_is_unlimited THEN 'غير محدود' 
        WHEN v_quota = 1 THEN '1 جهاز' 
        WHEN v_quota = 2 THEN '2 جهاز' 
        ELSE v_quota::text || ' أجهزة' 
      END
    );
  END IF;

  -- Check if force_full_sync is set for this company
  SELECT force_full_sync INTO v_force_sync
  FROM sync_service_status
  WHERE company_id = v_company.id;

  IF v_force_sync = true THEN
    UPDATE sync_service_status
    SET force_full_sync = false, updated_at = NOW()
    WHERE company_id = v_company.id;
  END IF;

  RETURN json_build_object(
    'active', true,
    'company_id', v_company.id,
    'company_name', v_company.name,
    'plan', COALESCE(v_company.plan, 'Enterprise'),
    'status', COALESCE(v_company.status, 'active'),
    'expires', v_company.subscription_end_date,
    'device_quota', v_quota,
    'is_unlimited', v_is_unlimited,
    'device_quota_label', CASE 
      WHEN v_is_unlimited THEN 'غير محدود' 
      WHEN v_quota = 1 THEN '1 جهاز' 
      WHEN v_quota = 2 THEN '2 جهاز' 
      ELSE v_quota::text || ' أجهزة' 
    END,
    'settings', v_company.settings,
    'force_full_sync', COALESCE(v_force_sync, false)
  );
END;
$function$;

-- 4. Function: sync_attendance (Fixed safe UUID cast and safe date parsing)
CREATE OR REPLACE FUNCTION public.sync_attendance(p_license_key text, p_device_sn text, p_logs jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_company_id UUID;
  v_sub_end    TEXT;
  v_device_id  UUID;
  v_inserted   INTEGER := 0;
  v_total      INTEGER := 0;
  v_clean_key  TEXT;
  v_exp_date   DATE;
BEGIN
  v_clean_key := TRIM(COALESCE(p_license_key, ''));
  IF v_clean_key = '' THEN
    RETURN json_build_object('success', false, 'message', 'مفتاح الترخيص مطلوب');
  END IF;

  -- 1. التحقق من الترخيص
  SELECT id, subscription_end_date INTO v_company_id, v_sub_end
  FROM companies
  WHERE license_key::text = v_clean_key
     OR LOWER(license_key::text) = LOWER(v_clean_key);

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'ترخيص غير صالح');
  END IF;

  -- التحقق من تاريخ الصلاحية
  IF v_sub_end IS NOT NULL AND TRIM(v_sub_end) <> '' THEN
    BEGIN
      v_exp_date := (SUBSTRING(TRIM(v_sub_end) FROM 1 FOR 10))::DATE;
      IF v_exp_date < CURRENT_DATE THEN
        RETURN json_build_object('success', false, 'message', 'انتهى الاشتراك بتاريخ ' || v_sub_end);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 2. جهاز البصمة (إن وجد)
  SELECT id INTO v_device_id
  FROM devices
  WHERE company_id = v_company_id AND (serial_number = p_device_sn OR ip_address = p_device_sn)
  LIMIT 1;

  -- 3. احسب العدد الكلي
  SELECT COUNT(*) INTO v_total FROM jsonb_array_elements(p_logs);

  -- 4. إدراج السجلات مع تجاهل المكررة (Unique Index يمنع التكرار)
  INSERT INTO raw_attendance_logs (company_id, device_id, device_serial, user_pin, timestamp, status)
  SELECT
    v_company_id,
    v_device_id,
    p_device_sn,
    log->>'pin',
    (log->>'time')::TIMESTAMPTZ,
    COALESCE(
      CASE 
        WHEN (log->>'status') ~ '^[0-9]+$' THEN (log->>'status')::INTEGER 
        ELSE 0 
      END, 
      0
    )
  FROM jsonb_array_elements(p_logs) AS log
  ON CONFLICT (company_id, user_pin, timestamp) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 5. تحديث حالة الجهاز
  IF v_device_id IS NOT NULL THEN
    UPDATE devices SET last_sync = NOW(), status = 'connected' WHERE id = v_device_id;
  END IF;

  RETURN json_build_object(
    'success', true, 
    'inserted', v_inserted,
    'total_sent', v_total,
    'skipped_duplicates', v_total - v_inserted
  );
END;
$function$;

-- 5. Function: update_sync_telemetry (Secure heartbeat and telemetry logging)
CREATE OR REPLACE FUNCTION public.update_sync_telemetry(
  p_license_key TEXT,
  p_device_sn TEXT,
  p_ping_status BOOLEAN,
  p_service_version TEXT,
  p_error_msg TEXT DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_clean_key TEXT;
BEGIN
  v_clean_key := TRIM(COALESCE(p_license_key, ''));
  IF v_clean_key = '' THEN
    RETURN json_build_object('success', false, 'message', 'License key required');
  END IF;

  -- 1. Find the company associated with the license key
  SELECT id INTO v_company_id 
  FROM companies 
  WHERE license_key::text = v_clean_key
     OR LOWER(license_key::text) = LOWER(v_clean_key)
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Invalid or inactive license key');
  END IF;

  -- 2. Update or Insert the sync service status securely
  INSERT INTO sync_service_status (
    company_id, 
    last_heartbeat, 
    device_ping_status, 
    service_version, 
    updated_at,
    last_error_message
  )
  VALUES (
    v_company_id, 
    NOW(), 
    p_ping_status, 
    COALESCE(p_service_version, '1.5.8'), 
    NOW(),
    p_error_msg
  )
  ON CONFLICT (company_id) DO UPDATE SET
    last_heartbeat = EXCLUDED.last_heartbeat,
    device_ping_status = EXCLUDED.device_ping_status,
    service_version = EXCLUDED.service_version,
    updated_at = EXCLUDED.updated_at,
    last_error_message = EXCLUDED.last_error_message;

  -- 3. Also update the device's last_sync if ping was successful
  IF p_ping_status = true AND p_device_sn IS NOT NULL THEN
    UPDATE devices 
    SET 
      status = 'connected', 
      last_sync = NOW() 
    WHERE 
      company_id = v_company_id 
      AND (serial_number = p_device_sn OR ip_address = p_device_sn);
  END IF;

  RETURN json_build_object('success', true, 'message', 'Telemetry updated successfully');
END;
$$;

-- 6. Permissions
GRANT EXECUTE ON FUNCTION public.check_subscription(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_attendance(text, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_sync_telemetry(text, text, boolean, text, text) TO anon, authenticated, service_role;

-- 7. Notify PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
