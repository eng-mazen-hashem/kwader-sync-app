// بيانات تجريبية - AttendPay Mock Data

export const companyInfo = {
  id: 1,
  name: 'شركة التقنية المتقدمة',
  subscription_end_date: '2026-12-31',
  settings: {
    work_start: '08:00',
    work_end: '17:00',
    work_days: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
    overtime_rate: 1.5,
    late_deduction_per_minute: 2,
    absence_deduction_formula: 'daily_rate',
    housing_allowance: 500,
    transport_allowance: 300,
  }
};

export const employees = [
  { id: 1, company_id: 1, name: 'أحمد محمد العلي', phone: '0501234567', device_pin: '001', base_salary: 8000, joining_date: '2024-01-15', status: 'نشط' },
  { id: 2, company_id: 1, name: 'سارة خالد الأحمد', phone: '0559876543', device_pin: '002', base_salary: 7500, joining_date: '2024-03-01', status: 'نشط' },
  { id: 3, company_id: 1, name: 'محمد عبدالله الحربي', phone: '0541112233', device_pin: '003', base_salary: 9000, joining_date: '2023-11-20', status: 'نشط' },
  { id: 4, company_id: 1, name: 'فاطمة سعيد النعيمي', phone: '0567778899', device_pin: '004', base_salary: 6500, joining_date: '2024-06-10', status: 'نشط' },
  { id: 5, company_id: 1, name: 'خالد يوسف الشمري', phone: '0523334455', device_pin: '005', base_salary: 7000, joining_date: '2024-02-28', status: 'نشط' },
  { id: 6, company_id: 1, name: 'نورة فهد الدوسري', phone: '0538885566', device_pin: '006', base_salary: 8500, joining_date: '2023-08-15', status: 'نشط' },
  { id: 7, company_id: 1, name: 'عمر حسن المالكي', phone: '0512223344', device_pin: '007', base_salary: 6000, joining_date: '2025-01-05', status: 'نشط' },
  { id: 8, company_id: 1, name: 'ريم عادل القحطاني', phone: '0547776655', device_pin: '008', base_salary: 7200, joining_date: '2024-09-12', status: 'غير نشط' },
];

export const devices = [
  { id: 1, company_id: 1, device_name: 'جهاز البوابة الرئيسية', serial_number: 'ZK-2024-001', last_sync: '2026-03-07T02:30:00', status: 'متصل' },
  { id: 2, company_id: 1, device_name: 'جهاز المدخل الخلفي', serial_number: 'ZK-2024-002', last_sync: '2026-03-07T02:28:00', status: 'متصل' },
  { id: 3, company_id: 1, device_name: 'جهاز الطابق الثاني', serial_number: 'ZK-2024-003', last_sync: '2026-03-06T18:00:00', status: 'غير متصل' },
];

// الحضور اليومي المعالج
export const processedAttendance = [
  { id: 1, employee_id: 1, employee_name: 'أحمد محمد العلي', date: '2026-03-06', check_in: '07:55', check_out: '17:05', work_hours: 9.17, status: 'حاضر', late_minutes: 0, early_leave_minutes: 0 },
  { id: 2, employee_id: 2, employee_name: 'سارة خالد الأحمد', date: '2026-03-06', check_in: '08:15', check_out: '17:00', work_hours: 8.75, status: 'متأخر', late_minutes: 15, early_leave_minutes: 0 },
  { id: 3, employee_id: 3, employee_name: 'محمد عبدالله الحربي', date: '2026-03-06', check_in: '08:00', check_out: '17:30', work_hours: 9.5, status: 'حاضر', late_minutes: 0, early_leave_minutes: 0 },
  { id: 4, employee_id: 4, employee_name: 'فاطمة سعيد النعيمي', date: '2026-03-06', check_in: null, check_out: null, work_hours: 0, status: 'غائب', late_minutes: 0, early_leave_minutes: 0 },
  { id: 5, employee_id: 5, employee_name: 'خالد يوسف الشمري', date: '2026-03-06', check_in: '08:00', check_out: '16:30', work_hours: 8.5, status: 'انصراف مبكر', late_minutes: 0, early_leave_minutes: 30 },
  { id: 6, employee_id: 6, employee_name: 'نورة فهد الدوسري', date: '2026-03-06', check_in: '07:50', check_out: '18:00', work_hours: 10.17, status: 'حاضر', late_minutes: 0, early_leave_minutes: 0 },
  { id: 7, employee_id: 7, employee_name: 'عمر حسن المالكي', date: '2026-03-06', check_in: '08:45', check_out: '17:00', work_hours: 8.25, status: 'متأخر', late_minutes: 45, early_leave_minutes: 0 },
];

// بيانات الرواتب الشهرية
export const payrolls = [
  { id: 1, employee_id: 1, employee_name: 'أحمد محمد العلي', month: '2026-02', base_salary: 8000, days_worked: 22, total_days: 22, deductions: 0, overtime_hours: 8, overtime_amount: 545, housing: 500, transport: 300, net_salary: 9345 },
  { id: 2, employee_id: 2, employee_name: 'سارة خالد الأحمد', month: '2026-02', base_salary: 7500, days_worked: 20, total_days: 22, deductions: 681, overtime_hours: 0, overtime_amount: 0, housing: 500, transport: 300, net_salary: 7619 },
  { id: 3, employee_id: 3, employee_name: 'محمد عبدالله الحربي', month: '2026-02', base_salary: 9000, days_worked: 22, total_days: 22, deductions: 0, overtime_hours: 12, overtime_amount: 982, housing: 500, transport: 300, net_salary: 10782 },
  { id: 4, employee_id: 4, employee_name: 'فاطمة سعيد النعيمي', month: '2026-02', base_salary: 6500, days_worked: 18, total_days: 22, deductions: 1182, overtime_hours: 0, overtime_amount: 0, housing: 500, transport: 300, net_salary: 6118 },
  { id: 5, employee_id: 5, employee_name: 'خالد يوسف الشمري', month: '2026-02', base_salary: 7000, days_worked: 21, total_days: 22, deductions: 318, overtime_hours: 3, overtime_amount: 191, housing: 500, transport: 300, net_salary: 7673 },
  { id: 6, employee_id: 6, employee_name: 'نورة فهد الدوسري', month: '2026-02', base_salary: 8500, days_worked: 22, total_days: 22, deductions: 0, overtime_hours: 15, overtime_amount: 1159, housing: 500, transport: 300, net_salary: 10459 },
  { id: 7, employee_id: 7, employee_name: 'عمر حسن المالكي', month: '2026-02', base_salary: 6000, days_worked: 19, total_days: 22, deductions: 818, overtime_hours: 0, overtime_amount: 0, housing: 500, transport: 300, net_salary: 5982 },
];

// بيانات الرسم البياني (آخر 7 أيام)
export const weeklyAttendanceChart = [
  { day: 'السبت', حاضر: 5, غائب: 2, متأخر: 1 },
  { day: 'الأحد', حاضر: 6, غائب: 1, متأخر: 1 },
  { day: 'الإثنين', حاضر: 7, غائب: 0, متأخر: 0 },
  { day: 'الثلاثاء', حاضر: 5, غائب: 1, متأخر: 2 },
  { day: 'الأربعاء', حاضر: 6, غائب: 1, متأخر: 1 },
  { day: 'الخميس', حاضر: 5, غائب: 1, متأخر: 1 },
  { day: 'الجمعة', حاضر: 0, غائب: 0, متأخر: 0 },
];

// آخر النشاطات
export const recentActivities = [
  { id: 1, type: 'check_in', employee_name: 'أحمد محمد العلي', time: '07:55', message: 'تسجيل حضور' },
  { id: 2, type: 'check_in', employee_name: 'محمد عبدالله الحربي', time: '08:00', message: 'تسجيل حضور' },
  { id: 3, type: 'late', employee_name: 'سارة خالد الأحمد', time: '08:15', message: 'تسجيل حضور متأخر (15 دقيقة)' },
  { id: 4, type: 'check_out', employee_name: 'خالد يوسف الشمري', time: '16:30', message: 'انصراف مبكر (30 دقيقة)' },
  { id: 5, type: 'absent', employee_name: 'فاطمة سعيد النعيمي', time: '--:--', message: 'غياب بدون إذن' },
  { id: 6, type: 'sync', employee_name: 'النظام', time: '02:30', message: 'تمت مزامنة جهاز البوابة الرئيسية' },
];
