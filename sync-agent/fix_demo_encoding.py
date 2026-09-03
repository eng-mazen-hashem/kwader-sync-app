content = r"""import random
from datetime import datetime, timedelta

DEMO_EMPLOYEES = [
    {'pin': '101', 'name': 'أحمد محمد'},
    {'pin': '102', 'name': 'سارة أحمد'},
    {'pin': '103', 'name': 'خالد محمود'},
    {'pin': '104', 'name': 'ليلى علي'},
    {'pin': '105', 'name': 'عمر حسن'},
    {'pin': '106', 'name': 'نور الدين'},
    {'pin': '107', 'name': 'مريم إبراهيم'},
    {'pin': '108', 'name': 'ياسين يوسف'},
]


def generate_day_attendance(target_date):
    """Generates random attendance for a specific day."""
    logs = []
    # Skip Fridays (weekend)
    if target_date.weekday() == 4:
        return []

    for emp in DEMO_EMPLOYEES:
        # 90% chance of attending
        if random.random() > 0.1:
            # Check-in: between 07:30 and 09:15
            check_in_hour = 7 if random.random() > 0.3 else 8
            check_in_min = random.randint(30, 59) if check_in_hour == 7 else random.randint(0, 15)
            check_in_time = target_date.replace(hour=check_in_hour, minute=check_in_min, second=random.randint(0, 59))

            logs.append({
                'pin': emp['pin'],
                'time': check_in_time.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
                'status': '0'
            })

            # Check-out: between 15:30 and 17:00
            check_out_hour = 15 if random.random() > 0.5 else 16
            check_out_min = random.randint(30, 59) if check_out_hour == 15 else random.randint(0, 59)
            check_out_time = target_date.replace(hour=check_out_hour, minute=check_out_min, second=random.randint(0, 59))

            logs.append({
                'pin': emp['pin'],
                'time': check_out_time.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
                'status': '1'
            })
    return logs


def generate_demo_attendance():
    """Generates today's demo attendance logs."""
    return generate_day_attendance(datetime.now())


def generate_historical_data(days=7):
    """Generates historical data for the last N days."""
    all_logs = []
    end_date = datetime.now()
    for i in range(days):
        target_date = end_date - timedelta(days=i)
        day_logs = generate_day_attendance(target_date)
        all_logs.extend(day_logs)

    all_logs.sort(key=lambda l: l['time'])
    return all_logs


__all__ = [
    'DEMO_EMPLOYEES',
    'generate_demo_attendance',
    'generate_historical_data',
    'generate_day_attendance',
]
"""

with open("demo_generator.py", "w", encoding="utf-8-sig") as f:
    f.write(content)
