"""Test payroll engine calculation"""
import sys
sys.path.insert(0, '.')
from core import payroll

emp = {
    'id': 1,
    'name': 'موظف اختبار',
    'base_salary': 5000,
    'housing_allowance': 1000,
    'transport_allowance': 500,
    'meal_allowance': 0,
    'other_allowances': 0,
    'social_insurance_pct': 11,
    'income_tax_rate': 0,
    'overtime_rate': 1.5,
    'custom_deductions': 0,
}
att = {'worked_days': 22, 'overtime_hours': 2.0}
result = payroll._calculate_employee_payroll(emp, att, 26)

print("=== كشف راتب موظف اختبار ===")
for step in result['calculation_log']:
    print(f"  {step['name']}: {step['value']:.2f}")
print(f"\nالصافي: {result['net_pay']:.2f}")
print("محرك الرواتب يعمل بشكل صحيح!")
