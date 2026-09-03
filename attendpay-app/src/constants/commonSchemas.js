import { z } from 'zod';

export const LeaveSchema = z.object({
  employee_id: z.string().min(1, 'يرجى اختيار موظف'),
  leave_type: z.enum(['annual', 'sick', 'unpaid', 'emergency']),
  start_date: z.string().min(1, 'يرجى تحديد تاريخ البداية'),
  end_date: z.string().min(1, 'يرجى تحديد تاريخ النهاية'),
  reason: z.string().min(5, 'يرجى ذكر سبب الإجازة (5 أحرف على الأقل)').max(500),
  attachment_url: z.string().optional(),
}).refine((data) => {
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  return end >= start;
}, {
  message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية',
  path: ['end_date'],
});

export const LoanSchema = z.object({
  employee_id: z.string().min(1, 'يرجى اختيار موظف'),
  total_amount: z.number({ invalid_type_error: 'يجب إدخال مبلغ' }).min(1, 'يجب أن يكون المبلغ أكبر من 0'),
  repayment_months: z.number({ invalid_type_error: '' }).min(1).optional().nullable(),
  monthly_installment: z.number({ invalid_type_error: '' }).min(0).optional().nullable(),
});
