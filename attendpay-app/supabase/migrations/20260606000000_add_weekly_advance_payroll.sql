-- ============================================================================
-- Migration: Add weekly advance payroll support
-- الفكرة: نضيف حقول لجدول payrolls تحدد نوع المسيرة (أسبوعية سلفة / شهرية نهائية)
-- ============================================================================

-- 1. إضافة حقول نوع المسيرة والسلفة لجدول payrolls الحالي
ALTER TABLE payrolls
  ADD COLUMN IF NOT EXISTS run_type          text    NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS advance_rate      numeric(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_earned      numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_paid      numeric(12,2) NOT NULL DEFAULT 0;

-- run_type values:
--   'regular'        → مسيرة عادية (الوضع الافتراضي)
--   'weekly_advance' → مسيرة أسبوعية بسلفة (جزء من الشهر، يُدفع نسبة منها)
--   'monthly_final'  → مسيرة شهرية نهائية تخصم السلف الأسبوعية السابقة

-- 2. Index لتسريع استعلام "السلف الأسبوعية في هذا الشهر"
CREATE INDEX IF NOT EXISTS idx_payrolls_run_type_company
  ON payrolls(company_id, run_type, start_date, end_date);

-- 3. Check constraint لقيم run_type
ALTER TABLE payrolls
  ADD CONSTRAINT IF NOT EXISTS payrolls_run_type_check
  CHECK (run_type IN ('regular', 'weekly_advance', 'monthly_final'));

-- 4. الـ advance_rate يجب أن يكون بين 0 و 100
ALTER TABLE payrolls
  ADD CONSTRAINT IF NOT EXISTS payrolls_advance_rate_check
  CHECK (advance_rate >= 0 AND advance_rate <= 100);

-- 5. تحديث السجلات القديمة لتكون 'regular'
UPDATE payrolls SET run_type = 'regular' WHERE run_type IS NULL OR run_type = '';

COMMENT ON COLUMN payrolls.run_type     IS 'regular | weekly_advance | monthly_final';
COMMENT ON COLUMN payrolls.advance_rate IS 'النسبة المئوية المدفوعة كسلفة (0-100)';
COMMENT ON COLUMN payrolls.gross_earned IS 'الراتب المستحق الكامل قبل تطبيق نسبة السلفة';
COMMENT ON COLUMN payrolls.advance_paid IS 'المبلغ الفعلي المدفوع كسلفة = gross_earned × advance_rate / 100';
