"""
KWADER Desktop Pro — Payroll Engine (محرك الرواتب الحتمي)
⚠️ لا يُستخدم AI أو منطق احتمالي. كل العمليات حتمية ومُسجَّلة.
"""
import json
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple
from calendar import monthrange

from core import db


# ─────────────────────────────────────────────────────────────
# Main Entry Point
# ─────────────────────────────────────────────────────────────

def run_payroll(period_start: str, period_end: str) -> Dict:
    """
    تنفيذ دورة راتب كاملة للفترة المحددة.
    يُرجع:
      {
        'run_id': int,
        'items': [...],
        'totals': {...},
        'errors': [...]
      }
    """
    errors = []
    items = []

    # 1. جلب الموظفين النشطين
    employees = db.get_employees(status='active')
    if not employees:
        return {'run_id': None, 'items': [], 'totals': {}, 'errors': ['لا يوجد موظفون نشطون']}

    # 2. حساب أيام العمل الفعلية في الفترة
    total_working_days = _count_working_days(period_start, period_end)

    # 3. جلب سجلات الحضور للفترة
    attendance_map = db.get_attendance_for_payroll(period_start, period_end)

    # 4. إنشاء دورة راتب في قاعدة البيانات
    run_id = db.create_payroll_run(period_start, period_end)

    # 5. حساب راتب كل موظف
    for emp in employees:
        try:
            emp_att = attendance_map.get(emp['id'], {'worked_days': 0, 'overtime_hours': 0.0})
            item = _calculate_employee_payroll(emp, emp_att, total_working_days)
            items.append(item)
        except Exception as exc:
            errors.append(f"خطأ في حساب راتب {emp['name']}: {exc}")

    # 6. حفظ البنود في قاعدة البيانات
    db.save_payroll_items(run_id, items)

    # 7. إعداد الإجماليات
    totals = {
        'gross': round(sum(i['gross_pay'] for i in items), 2),
        'deductions': round(sum(i['total_deductions'] for i in items), 2),
        'net': round(sum(i['net_pay'] for i in items), 2),
        'employee_count': len(items),
        'period_start': period_start,
        'period_end': period_end,
        'total_working_days': total_working_days,
    }

    return {
        'run_id': run_id,
        'items': items,
        'totals': totals,
        'errors': errors,
    }


# ─────────────────────────────────────────────────────────────
# Per-Employee Calculation Engine
# ─────────────────────────────────────────────────────────────

def _calculate_employee_payroll(
    emp: Dict,
    attendance: Dict,
    total_working_days: int
) -> Dict:
    """
    حساب راتب موظف واحد بخطوات مفصّلة.
    كل خطوة مُسجَّلة في calculation_log.
    """
    log = []  # سجل خطوات الحساب

    emp_id = emp['id']
    worked_days = int(attendance.get('worked_days', 0))
    overtime_hours = float(attendance.get('overtime_hours', 0.0))

    # ── المرتب الأساسي ──────────────────────────────────────
    base_salary = _to_float(emp.get('base_salary', 0))
    log.append(_step('المرتب الأساسي', f"قيمة ثابتة من ملف الموظف", base_salary))

    # ── الراتب اليومي ────────────────────────────────────────
    if total_working_days > 0:
        daily_rate = base_salary / total_working_days
    else:
        daily_rate = 0.0
    log.append(_step('الراتب اليومي',
                     f"{base_salary} ÷ {total_working_days} يوم عمل",
                     daily_rate))

    # ── الراتب الفعلي بعد الأيام المعمولة ────────────────────
    actual_base = round(daily_rate * worked_days, 2)
    log.append(_step('الراتب الفعلي',
                     f"{daily_rate:.2f} × {worked_days} يوم حاضر",
                     actual_base))

    # ── الإضافات ─────────────────────────────────────────────
    housing = _to_float(emp.get('housing_allowance', 0))
    transport = _to_float(emp.get('transport_allowance', 0))
    meal = _to_float(emp.get('meal_allowance', 0))
    other = _to_float(emp.get('other_allowances', 0))
    total_allowances = round(housing + transport + meal + other, 2)

    log.append(_step('بدل السكن', "قيمة ثابتة", housing))
    log.append(_step('بدل النقل', "قيمة ثابتة", transport))
    if meal > 0:
        log.append(_step('بدل الوجبات', "قيمة ثابتة", meal))
    if other > 0:
        log.append(_step('بدلات أخرى', "قيمة ثابتة", other))
    log.append(_step('إجمالي الإضافات', "مجموع الإضافات", total_allowances))

    # ── أجر الأوفرتايم ───────────────────────────────────────
    overtime_rate = _to_float(emp.get('overtime_rate', 1.5))
    hourly_rate = base_salary / (total_working_days * 8) if total_working_days > 0 else 0.0
    overtime_pay = round(overtime_hours * hourly_rate * overtime_rate, 2)
    if overtime_hours > 0:
        log.append(_step('أجر الأوفرتايم',
                         f"{overtime_hours:.2f} ساعة × {hourly_rate:.2f} معدل ساعي × {overtime_rate}x",
                         overtime_pay))

    # ── الإجمالي ──────────────────────────────────────────────
    gross_pay = round(actual_base + total_allowances + overtime_pay, 2)
    log.append(_step('الراتب الإجمالي (Gross)',
                     f"{actual_base} + {total_allowances} إضافات + {overtime_pay} أوفرتايم",
                     gross_pay))

    # ── الخصومات ──────────────────────────────────────────────
    si_pct = _to_float(emp.get('social_insurance_pct', 0))
    social_insurance = round(base_salary * si_pct / 100, 2)
    if si_pct > 0:
        log.append(_step('التأمينات الاجتماعية',
                         f"{base_salary} × {si_pct}%",
                         social_insurance))

    tax_rate = _to_float(emp.get('income_tax_rate', 0))
    income_tax = round(gross_pay * tax_rate / 100, 2)
    if tax_rate > 0:
        log.append(_step('ضريبة الدخل',
                         f"{gross_pay} × {tax_rate}%",
                         income_tax))

    custom_deductions = _to_float(emp.get('custom_deductions', 0))
    if custom_deductions > 0:
        log.append(_step('خصومات أخرى', "خصومات يدوية مُضافة", custom_deductions))

    total_deductions = round(social_insurance + income_tax + custom_deductions, 2)
    log.append(_step('إجمالي الخصومات',
                     f"{social_insurance} تأمين + {income_tax} ضريبة + {custom_deductions} أخرى",
                     total_deductions))

    # ── الصافي ────────────────────────────────────────────────
    net_pay = round(gross_pay - total_deductions, 2)
    log.append(_step('صافي الراتب (Net Pay)',
                     f"{gross_pay} إجمالي - {total_deductions} خصومات",
                     net_pay))

    return {
        'employee_id': emp_id,
        'employee_name': emp.get('name', ''),
        'employee_number': emp.get('employee_number', ''),
        'department': emp.get('department', ''),
        'worked_days': worked_days,
        'total_working_days': total_working_days,
        'base_salary': base_salary,
        'housing_allowance': housing,
        'transport_allowance': transport,
        'meal_allowance': meal,
        'other_allowances': other,
        'overtime_hours': overtime_hours,
        'overtime_pay': overtime_pay,
        'gross_pay': gross_pay,
        'social_insurance': social_insurance,
        'income_tax': income_tax,
        'custom_deductions': custom_deductions,
        'total_deductions': total_deductions,
        'net_pay': net_pay,
        'calculation_log': log,
    }


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _step(name: str, formula: str, value: float) -> Dict:
    return {'name': name, 'formula': formula, 'value': round(value, 2)}


def _to_float(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _count_working_days(period_start: str, period_end: str,
                         weekend_days: Tuple[int, ...] = (4, 5)) -> int:
    """
    احتساب أيام العمل الفعلية في الفترة.
    weekend_days: أرقام أيام الإجازة الأسبوعية (0=Monday..6=Sunday)
    الافتراضي: الجمعة والسبت (4، 5) — يمكن تخصيصه من إعدادات الشركة
    """
    try:
        start = date.fromisoformat(period_start)
        end = date.fromisoformat(period_end)
    except Exception:
        return 26  # قيمة افتراضية آمنة

    count = 0
    current = start
    while current <= end:
        if current.weekday() not in weekend_days:
            count += 1
        current = date.fromordinal(current.toordinal() + 1)
    return count


def get_payroll_summary_for_export(run_id: int) -> Dict:
    """تجهيز بيانات كاملة لتصدير PDF/Excel"""
    run = None
    runs = db.get_payroll_runs()
    for r in runs:
        if r['id'] == run_id:
            run = r
            break

    items = db.get_payroll_items(run_id)
    company = db.get_company()

    return {
        'company': company,
        'run': run,
        'items': items,
        'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M'),
    }
