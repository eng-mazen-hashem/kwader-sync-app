-- ==============================================================================
-- Migration: 20260927040000_employee_loans_column_alignment.sql
-- Description: Align employee_loans schema to support both legacy and modern column names.
-- Adds: amount, monthly_deduction, total_installments as generated columns,
--       plus start_month text column.
-- Fixes: "Could not find column 'amount' of 'employee_loans' in the schema cache"
-- ==============================================================================

ALTER TABLE public.employee_loans 
    ADD COLUMN IF NOT EXISTS amount numeric GENERATED ALWAYS AS (COALESCE(total_amount, 0)) STORED,
    ADD COLUMN IF NOT EXISTS monthly_deduction numeric GENERATED ALWAYS AS (COALESCE(monthly_installment, 0)) STORED,
    ADD COLUMN IF NOT EXISTS total_installments integer GENERATED ALWAYS AS (COALESCE(repayment_months, 1)) STORED,
    ADD COLUMN IF NOT EXISTS start_month text;
