-- ─── إضافة حقل عدد أشهر السداد لجدول السلف ──────────────────────────────────
-- يُخزَّن عدد الأشهر الإجمالية للسداد (اختياري، للعرض وللمرجع فقط)
-- الحساب الفعلي يعتمد على monthly_installment في خدمة الرواتب

ALTER TABLE employee_loans
  ADD COLUMN IF NOT EXISTS repayment_months integer;

COMMENT ON COLUMN employee_loans.repayment_months
  IS 'عدد أشهر خطة السداد المتفق عليها. القيمة اختيارية ولا تؤثر على منطق الخصم.';
