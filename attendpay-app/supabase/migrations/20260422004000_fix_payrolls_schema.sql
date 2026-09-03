-- ======================================================================
-- Migration: Fix payrolls table schema
-- Adds columns required by the process-payroll Edge Function
-- that may be missing if the table was created before these fields
-- were introduced.
-- ======================================================================

ALTER TABLE payrolls
  ADD COLUMN IF NOT EXISTS allowances       numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS housing          numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport        numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_days       integer       NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS total_work_hours numeric(8,1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breakdown        jsonb                  DEFAULT '[]'::jsonb;

-- Ensure deductions column exists with correct type
ALTER TABLE payrolls
  ADD COLUMN IF NOT EXISTS deductions       numeric(12,2) NOT NULL DEFAULT 0;

-- Ensure net_salary and base_salary exist (should already exist but be safe)
ALTER TABLE payrolls
  ADD COLUMN IF NOT EXISTS net_salary       numeric(12,2),
  ADD COLUMN IF NOT EXISTS base_salary      numeric(12,2);

-- Index for fast period lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_payrolls_period
  ON payrolls (company_id, start_date, end_date);
