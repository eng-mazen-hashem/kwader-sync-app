-- ==============================================================================
-- BASELINE CORE SCHEMA FOR KWADER SYSTEM
-- Creates all core tables before incremental migrations run
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Super Admins
CREATE TABLE IF NOT EXISTS public.super_admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. Companies
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid,
    name text NOT NULL,
    phone text,
    subscription_end_date text,
    license_key uuid DEFAULT gen_random_uuid(),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    plan text DEFAULT 'Starter',
    status text DEFAULT 'active',
    subscription_expires_at timestamptz,
    reseller_id uuid,
    restriction_level text DEFAULT 'none',
    subscription_amount numeric DEFAULT 0,
    whatsapp_channel_id uuid
);

-- 3. Company Users (HR & Staff)
CREATE TABLE IF NOT EXISTS public.company_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    role text DEFAULT 'hr',
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 4. Company Invites
CREATE TABLE IF NOT EXISTS public.company_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text DEFAULT 'hr',
    permissions jsonb DEFAULT '{}'::jsonb,
    token text DEFAULT encode(gen_random_bytes(16), 'hex'),
    expires_at timestamptz DEFAULT (now() + interval '7 days'),
    created_at timestamptz DEFAULT now()
);

-- 5. Devices
CREATE TABLE IF NOT EXISTS public.devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    device_name text NOT NULL,
    serial_number text,
    ip_address text,
    port integer DEFAULT 4370,
    last_sync timestamptz,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now()
);

-- 6. Shifts
CREATE TABLE IF NOT EXISTS public.shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text DEFAULT '#4f46e5',
    start_time text NOT NULL,
    end_time text NOT NULL,
    work_days jsonb DEFAULT '[]'::jsonb,
    has_break boolean DEFAULT false,
    break_start text,
    break_duration numeric DEFAULT 0,
    overtime_rate numeric DEFAULT 1.5,
    grace_minutes integer DEFAULT 15,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    break_policy text,
    shift_type text DEFAULT 'fixed',
    target_hours numeric,
    deduct_half_on_missing boolean DEFAULT false,
    early_arrival_grace_minutes integer DEFAULT 0,
    overtime_start_after_minutes integer DEFAULT 0,
    overtime_rate_start_hours numeric
);

-- 7. Employees
CREATE TABLE IF NOT EXISTS public.employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text,
    device_pin text,
    base_salary numeric DEFAULT 0,
    joining_date date,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    national_id text,
    job_title text,
    department_id uuid,
    email text,
    employment_type text DEFAULT 'permanent',
    position text,
    termination_date date,
    notes text,
    inactive_reason text,
    housing_allowance numeric DEFAULT 0,
    transport_allowance numeric DEFAULT 0,
    allow_gps_punch boolean DEFAULT false,
    exclude_from_weekly_advance boolean DEFAULT false,
    annual_leave_balance numeric DEFAULT 21,
    bound_device_id text,
    bound_device_name text,
    device_bound_at timestamptz,
    first_login_at timestamptz
);

-- 8. Shift Employees
CREATE TABLE IF NOT EXISTS public.shift_employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id uuid REFERENCES public.shifts(id) ON DELETE CASCADE,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    assigned_at timestamptz DEFAULT now(),
    UNIQUE(shift_id, employee_id)
);

-- 9. Employee Loans
CREATE TABLE IF NOT EXISTS public.employee_loans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    total_amount numeric DEFAULT 0,
    monthly_installment numeric DEFAULT 0,
    remaining_amount numeric DEFAULT 0,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    repayment_months integer DEFAULT 1,
    is_fixed boolean DEFAULT false,
    notes text
);

-- 10. Raw Attendance Logs
CREATE TABLE IF NOT EXISTS public.raw_attendance_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id uuid,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    user_pin text NOT NULL,
    timestamp timestamptz NOT NULL,
    status text DEFAULT '0',
    is_processed boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    punch_method text DEFAULT 'device',
    gps_lat numeric,
    gps_lng numeric
);

-- 11. Processed Attendance
CREATE TABLE IF NOT EXISTS public.processed_attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    date date NOT NULL,
    check_in timestamptz,
    check_out timestamptz,
    work_hours numeric DEFAULT 0,
    status text DEFAULT 'present',
    late_minutes integer DEFAULT 0,
    early_leave_minutes integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    is_conflicted boolean DEFAULT false,
    conflict_details jsonb,
    override_status text DEFAULT 'none',
    punch_details jsonb DEFAULT '[]'::jsonb,
    status_reason text
);

-- 12. Payrolls
CREATE TABLE IF NOT EXISTS public.payrolls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    start_date date,
    end_date date,
    base_salary numeric DEFAULT 0,
    days_worked numeric DEFAULT 0,
    total_days integer DEFAULT 0,
    total_work_hours numeric DEFAULT 0,
    deductions numeric DEFAULT 0,
    overtime_hours numeric DEFAULT 0,
    overtime_amount numeric DEFAULT 0,
    housing numeric DEFAULT 0,
    transport numeric DEFAULT 0,
    net_salary numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    extra_allowances jsonb DEFAULT '[]'::jsonb,
    extra_deductions jsonb DEFAULT '[]'::jsonb,
    breakdown jsonb DEFAULT '[]'::jsonb,
    run_type text DEFAULT 'regular',
    advance_rate numeric DEFAULT 0,
    gross_earned numeric DEFAULT 0,
    advance_paid numeric DEFAULT 0,
    status text DEFAULT 'draft'
);

-- 13. WhatsApp Channels
CREATE TABLE IF NOT EXISTS public.whatsapp_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    phone text,
    name text,
    status text DEFAULT 'disconnected',
    ai_enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 14. WhatsApp Queue
CREATE TABLE IF NOT EXISTS public.whatsapp_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid,
    phone text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'pending',
    priority integer DEFAULT 0,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    error_message text,
    scheduled_at timestamptz DEFAULT now(),
    sent_at timestamptz,
    created_at timestamptz DEFAULT now(),
    node_id text,
    locked_at timestamptz
);

-- 15. WhatsApp Nodes
CREATE TABLE IF NOT EXISTS public.whatsapp_nodes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id text UNIQUE NOT NULL,
    ip_address text,
    is_active boolean DEFAULT true,
    last_heartbeat timestamptz DEFAULT now(),
    is_leader boolean DEFAULT false,
    lease_expires_at timestamptz,
    version text,
    metrics jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 16. Company Notifications
CREATE TABLE IF NOT EXISTS public.company_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    title text,
    message text,
    type text DEFAULT 'info',
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Seed Super Admin (eng.mazenhashem@gmail.com)
INSERT INTO public.super_admins (user_id) 
SELECT id FROM auth.users WHERE email = 'eng.mazenhashem@gmail.com'
ON CONFLICT DO NOTHING;
