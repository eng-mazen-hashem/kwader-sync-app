-- Migration: 20260605000000_add_sync_telemetry.sql
-- Description: Creates an RPC to allow the Sync Agent (via anon key) to update telemetry and ping status securely.

CREATE OR REPLACE FUNCTION update_sync_telemetry(
  p_license_key TEXT,
  p_device_sn TEXT,
  p_ping_status BOOLEAN,
  p_service_version TEXT,
  p_error_msg TEXT DEFAULT NULL
) RETURNS json AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- 1. Find the company associated with the license key
  SELECT company_id INTO v_company_id 
  FROM company_subscriptions 
  WHERE license_key = p_license_key AND active = true
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
    COALESCE(p_service_version, '1.1.2'), 
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
  -- This ensures the UI considers the device connected.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add last_error_message column if it doesn't exist
ALTER TABLE sync_service_status ADD COLUMN IF NOT EXISTS last_error_message TEXT;
