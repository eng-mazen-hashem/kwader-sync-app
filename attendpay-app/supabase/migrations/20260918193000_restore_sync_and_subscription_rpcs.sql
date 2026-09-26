-- Migration: 20260918193000_restore_sync_and_subscription_rpcs.sql
-- Description: Restores essential RPC functions for KWADER Sync desktop app and background workers:
--              1. check_subscription(p_license_key)
--              2. sync_attendance(p_license_key, p_device_sn, p_logs)
--              3. create_company_for_user(p_user_id, p_company_name)
--              4. verify_whatsapp_api_key(p_api_key)
--              5. Required unique and performance indexes on raw_attendance_logs

-- 1. Ensure required indexes on raw_attendance_logs for ON CONFLICT and querying
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_logs_unique_punch 
  ON public.raw_attendance_logs (company_id, user_pin, "timestamp");

CREATE INDEX IF NOT EXISTS idx_raw_logs_unprocessed 
  ON public.raw_attendance_logs (company_id, "timestamp") 
  WHERE (is_processed = false);

CREATE INDEX IF NOT EXISTS idx_raw_logs_company 
  ON public.raw_attendance_logs (company_id);


-- 2. Function: check_subscription
CREATE OR REPLACE FUNCTION public.check_subscription(p_license_key text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_company RECORD;
  v_force_sync BOOLEAN := false;
  v_quota INT := 10;
BEGIN
  SELECT id, name, subscription_end_date, plan, status, settings
  INTO v_company
  FROM companies
  WHERE license_key = p_license_key;

  IF NOT FOUND THEN
    RETURN json_build_object('active', false, 'message', 'مفتاح الترخيص غير صالح');
  END IF;

  -- Determine device quota from settings or plan
  v_quota := COALESCE(
    (v_company.settings->>'device_quota')::int,
    (v_company.settings->>'max_devices')::int,
    CASE 
      WHEN LOWER(COALESCE(v_company.plan, '')) = 'enterprise' THEN 50
      WHEN LOWER(COALESCE(v_company.plan, '')) = 'pro' THEN 15
      ELSE 5
    END
  );

  IF v_company.subscription_end_date IS NOT NULL AND v_company.subscription_end_date < CURRENT_DATE THEN
    RETURN json_build_object(
      'active', false,
      'message', 'انتهى الاشتراك بتاريخ ' || v_company.subscription_end_date::text,
      'company_name', v_company.name,
      'plan', COALESCE(v_company.plan, 'Enterprise'),
      'status', COALESCE(v_company.status, 'expired'),
      'expires', v_company.subscription_end_date,
      'device_quota', v_quota
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
    'settings', v_company.settings,
    'force_full_sync', COALESCE(v_force_sync, false)
  );
END;
$function$;


-- 3. Function: sync_attendance
CREATE OR REPLACE FUNCTION public.sync_attendance(p_license_key text, p_device_sn text, p_logs jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_company_id UUID;
  v_device_id  UUID;
  v_inserted   INTEGER := 0;
  v_total      INTEGER := 0;
BEGIN
  -- التحقق من الترخيص
  SELECT id INTO v_company_id
  FROM companies
  WHERE license_key = p_license_key AND subscription_end_date >= CURRENT_DATE;

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'ترخيص غير صالح أو منتهي');
  END IF;

  -- جهاز البصمة (إن وجد)
  SELECT id INTO v_device_id
  FROM devices
  WHERE company_id = v_company_id AND (serial_number = p_device_sn OR ip_address = p_device_sn)
  LIMIT 1;

  -- احسب العدد الكلي
  SELECT COUNT(*) INTO v_total FROM jsonb_array_elements(p_logs);

  -- إدراج السجلات مع تجاهل المكررة (Unique Index يمنع التكرار)
  -- الـ AFTER trigger يعالج كل سجل تلقائياً عند الإدراج
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

  -- تحديث حالة الجهاز
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


-- 4. Function: create_company_for_user
CREATE OR REPLACE FUNCTION public.create_company_for_user(p_user_id uuid, p_company_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_company RECORD;
BEGIN
  INSERT INTO companies (owner_id, name)
  VALUES (p_user_id, p_company_name)
  RETURNING * INTO v_company;

  RETURN json_build_object(
    'id', v_company.id,
    'owner_id', v_company.owner_id,
    'name', v_company.name,
    'license_key', v_company.license_key,
    'subscription_end_date', v_company.subscription_end_date,
    'settings', v_company.settings,
    'created_at', v_company.created_at
  );
END;
$function$;


-- 5. Function: verify_whatsapp_api_key
CREATE OR REPLACE FUNCTION public.verify_whatsapp_api_key(p_api_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_key_record record;
  v_channel_record record;
  v_target_channel_id uuid;
  v_target_channel_name text;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_key_record
  FROM whatsapp_api_keys
  WHERE api_key = p_api_key AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or inactive API key');
  END IF;

  IF v_key_record.channel_id IS NOT NULL THEN
    SELECT * INTO v_channel_record FROM whatsapp_channels WHERE id = v_key_record.channel_id;
  END IF;

  IF v_channel_record.id IS NULL THEN
    SELECT * INTO v_channel_record FROM whatsapp_channels WHERE is_default = true LIMIT 1;
  END IF;

  v_target_channel_id := v_channel_record.id;
  v_target_channel_name := COALESCE(v_channel_record.name, 'Default Channel');

  UPDATE whatsapp_api_keys
  SET total_sent = total_sent + 1,
      last_used_at = v_now
  WHERE id = v_key_record.id;

  RETURN jsonb_build_object(
    'valid', true,
    'key_id', v_key_record.id,
    'key_name', v_key_record.name,
    'channel_id', v_target_channel_id,
    'channel_name', v_target_channel_name,
    'rate_limit', v_key_record.rate_limit_per_minute
  );
END;
$function$;


-- 6. Permissions
GRANT EXECUTE ON FUNCTION public.check_subscription(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_attendance(text, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_company_for_user(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_whatsapp_api_key(text) TO anon, authenticated, service_role;

-- 7. Invalidate PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
