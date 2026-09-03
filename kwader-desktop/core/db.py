"""
KWADER Desktop Pro — SQLite Database Layer
قاعدة البيانات المحلية: أوفلاين أولاً، مع دعم مزامنة السحابة عند الاتصال
"""
import sqlite3
import json
import threading
from pathlib import Path
from datetime import datetime, date
from typing import Optional, List, Dict, Any

DB_PATH: Optional[Path] = None
_lock = threading.Lock()


def init_db(db_path: Path):
    """تهيئة قاعدة البيانات وإنشاء الجداول إذا لم تكن موجودة"""
    global DB_PATH
    DB_PATH = db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with _get_conn() as conn:
        _create_tables(conn)
        _seed_defaults(conn)


def _get_conn() -> sqlite3.Connection:
    if DB_PATH is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    conn = sqlite3.connect(str(DB_PATH), timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def _create_tables(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS companies (
            id          INTEGER PRIMARY KEY,
            name        TEXT NOT NULL DEFAULT 'شركتي',
            name_en     TEXT,
            license_key TEXT,
            plan        TEXT NOT NULL DEFAULT 'local',
            employee_limit INTEGER NOT NULL DEFAULT 25,
            offline_grace_days INTEGER NOT NULL DEFAULT 30,
            last_online_check  TEXT,
            logo_path   TEXT,
            country     TEXT DEFAULT 'EG',
            currency    TEXT DEFAULT 'EGP',
            working_days TEXT DEFAULT '["Sun","Mon","Tue","Wed","Thu"]',
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS employees (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id      INTEGER NOT NULL DEFAULT 1,
            employee_number TEXT,
            name            TEXT NOT NULL,
            name_en         TEXT,
            national_id     TEXT,
            phone           TEXT,
            email           TEXT,
            department      TEXT,
            job_title       TEXT,
            branch          TEXT,
            hire_date       TEXT,
            status          TEXT NOT NULL DEFAULT 'active',
            base_salary     REAL NOT NULL DEFAULT 0,
            housing_allowance    REAL NOT NULL DEFAULT 0,
            transport_allowance  REAL NOT NULL DEFAULT 0,
            meal_allowance       REAL NOT NULL DEFAULT 0,
            other_allowances     REAL NOT NULL DEFAULT 0,
            social_insurance_pct REAL NOT NULL DEFAULT 0,
            income_tax_rate      REAL NOT NULL DEFAULT 0,
            custom_deductions    REAL NOT NULL DEFAULT 0,
            overtime_rate        REAL NOT NULL DEFAULT 1.5,
            device_pin      TEXT,
            notes           TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id, status);
        CREATE INDEX IF NOT EXISTS idx_employees_pin ON employees(device_pin);

        CREATE TABLE IF NOT EXISTS attendance_raw (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            device_sn   TEXT NOT NULL,
            device_pin  TEXT NOT NULL,
            punch_time  TEXT NOT NULL,
            device_id   INTEGER,
            synced_to_cloud INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(device_sn, device_pin, punch_time)
        );

        CREATE INDEX IF NOT EXISTS idx_araw_pin_time ON attendance_raw(device_pin, punch_time);

        CREATE TABLE IF NOT EXISTS attendance_records (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL REFERENCES employees(id),
            work_date   TEXT NOT NULL,
            check_in    TEXT,
            check_out   TEXT,
            worked_minutes   INTEGER NOT NULL DEFAULT 0,
            overtime_minutes INTEGER NOT NULL DEFAULT 0,
            status      TEXT NOT NULL DEFAULT 'present',
            raw_log_id  INTEGER,
            is_manual_override INTEGER NOT NULL DEFAULT 0,
            override_by TEXT,
            notes       TEXT,
            synced_to_cloud INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(employee_id, work_date)
        );

        CREATE INDEX IF NOT EXISTS idx_arec_emp_date ON attendance_records(employee_id, work_date);
        CREATE INDEX IF NOT EXISTS idx_arec_date ON attendance_records(work_date);

        CREATE TABLE IF NOT EXISTS payroll_runs (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id   INTEGER NOT NULL DEFAULT 1,
            period_start TEXT NOT NULL,
            period_end   TEXT NOT NULL,
            status       TEXT NOT NULL DEFAULT 'draft',
            total_gross  REAL NOT NULL DEFAULT 0,
            total_deductions REAL NOT NULL DEFAULT 0,
            total_net    REAL NOT NULL DEFAULT 0,
            employee_count INTEGER NOT NULL DEFAULT 0,
            notes        TEXT,
            created_at   TEXT NOT NULL DEFAULT (datetime('now')),
            approved_at  TEXT,
            locked_at    TEXT
        );

        CREATE TABLE IF NOT EXISTS payroll_items (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id          INTEGER NOT NULL REFERENCES payroll_runs(id),
            employee_id     INTEGER NOT NULL REFERENCES employees(id),
            worked_days     INTEGER NOT NULL DEFAULT 0,
            total_working_days INTEGER NOT NULL DEFAULT 0,
            base_salary     REAL NOT NULL DEFAULT 0,
            housing_allowance    REAL NOT NULL DEFAULT 0,
            transport_allowance  REAL NOT NULL DEFAULT 0,
            meal_allowance       REAL NOT NULL DEFAULT 0,
            other_allowances     REAL NOT NULL DEFAULT 0,
            overtime_hours       REAL NOT NULL DEFAULT 0,
            overtime_pay         REAL NOT NULL DEFAULT 0,
            gross_pay            REAL NOT NULL DEFAULT 0,
            social_insurance     REAL NOT NULL DEFAULT 0,
            income_tax           REAL NOT NULL DEFAULT 0,
            custom_deductions    REAL NOT NULL DEFAULT 0,
            total_deductions     REAL NOT NULL DEFAULT 0,
            net_pay              REAL NOT NULL DEFAULT 0,
            calculation_log      TEXT,
            UNIQUE(run_id, employee_id)
        );

        CREATE TABLE IF NOT EXISTS devices (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id  INTEGER NOT NULL DEFAULT 1,
            name        TEXT NOT NULL,
            device_type TEXT NOT NULL DEFAULT 'zkteco',
            ip_address  TEXT NOT NULL,
            port        INTEGER NOT NULL DEFAULT 4370,
            serial_number TEXT,
            username    TEXT DEFAULT 'admin',
            password    TEXT DEFAULT '',
            use_https   INTEGER NOT NULL DEFAULT 0,
            sync_interval_min INTEGER NOT NULL DEFAULT 5,
            is_active   INTEGER NOT NULL DEFAULT 1,
            last_sync   TEXT,
            last_status TEXT DEFAULT 'unknown',
            last_error  TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            body        TEXT,
            type        TEXT NOT NULL DEFAULT 'info',
            action_url  TEXT,
            is_read     INTEGER NOT NULL DEFAULT 0,
            source      TEXT DEFAULT 'cloud',
            received_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    """)
    conn.commit()


def _seed_defaults(conn: sqlite3.Connection):
    """إضافة بيانات افتراضية إذا لم تكن موجودة"""
    existing = conn.execute("SELECT COUNT(*) FROM companies").fetchone()[0]
    if existing == 0:
        conn.execute("""
            INSERT INTO companies (id, name, name_en, plan, employee_limit)
            VALUES (1, 'شركتي', 'My Company', 'local', 25)
        """)
        conn.commit()


# ─────────────────────────────────────────────────────────────
# App Settings
# ─────────────────────────────────────────────────────────────

def get_setting(key: str, default: Any = None) -> Any:
    with _lock:
        with _get_conn() as conn:
            row = conn.execute("SELECT value FROM app_settings WHERE key=?", (key,)).fetchone()
            if row is None:
                return default
            try:
                return json.loads(row[0])
            except Exception:
                return row[0]


def set_setting(key: str, value: Any):
    with _lock:
        with _get_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
                (key, json.dumps(value, ensure_ascii=False))
            )
            conn.commit()


def get_all_settings() -> Dict:
    with _get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
        result = {}
        for row in rows:
            try:
                result[row[0]] = json.loads(row[1])
            except Exception:
                result[row[0]] = row[1]
        return result


# ─────────────────────────────────────────────────────────────
# Company
# ─────────────────────────────────────────────────────────────

def get_company() -> Dict:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM companies WHERE id=1").fetchone()
        return dict(row) if row else {}


def update_company(data: Dict) -> bool:
    allowed = ['name', 'name_en', 'license_key', 'plan', 'employee_limit',
               'logo_path', 'country', 'currency', 'working_days',
               'last_online_check', 'offline_grace_days']
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return False
    sets = ', '.join(f"{k}=?" for k in fields)
    with _lock:
        with _get_conn() as conn:
            conn.execute(f"UPDATE companies SET {sets} WHERE id=1", list(fields.values()))
            conn.commit()
    return True


# ─────────────────────────────────────────────────────────────
# Employees
# ─────────────────────────────────────────────────────────────

def get_employees(status: str = None, search: str = None) -> List[Dict]:
    with _get_conn() as conn:
        query = "SELECT * FROM employees WHERE company_id=1"
        params = []
        if status:
            query += " AND status=?"
            params.append(status)
        if search:
            query += " AND (name LIKE ? OR employee_number LIKE ? OR department LIKE ?)"
            s = f"%{search}%"
            params.extend([s, s, s])
        query += " ORDER BY name"
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def get_employee(emp_id: int) -> Optional[Dict]:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM employees WHERE id=?", (emp_id,)).fetchone()
        return dict(row) if row else None


def get_employee_by_pin(pin: str) -> Optional[Dict]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM employees WHERE device_pin=? AND status='active' AND company_id=1",
            (str(pin),)
        ).fetchone()
        return dict(row) if row else None


def add_employee(data: Dict) -> Dict:
    allowed = ['name', 'name_en', 'national_id', 'phone', 'email',
               'department', 'job_title', 'branch', 'hire_date', 'status',
               'base_salary', 'housing_allowance', 'transport_allowance',
               'meal_allowance', 'other_allowances', 'social_insurance_pct',
               'income_tax_rate', 'custom_deductions', 'overtime_rate',
               'device_pin', 'notes', 'employee_number']
    fields = {k: v for k, v in data.items() if k in allowed}
    fields['company_id'] = 1
    fields['updated_at'] = datetime.now().isoformat()

    if not fields.get('employee_number'):
        with _get_conn() as conn:
            count = conn.execute("SELECT COUNT(*) FROM employees WHERE company_id=1").fetchone()[0]
            fields['employee_number'] = f"EMP{count + 1:04d}"

    cols = ', '.join(fields.keys())
    placeholders = ', '.join(['?'] * len(fields))
    with _lock:
        with _get_conn() as conn:
            cur = conn.execute(
                f"INSERT INTO employees ({cols}) VALUES ({placeholders})",
                list(fields.values())
            )
            conn.commit()
            new_id = cur.lastrowid
    return get_employee(new_id) or {}


def update_employee(emp_id: int, data: Dict) -> bool:
    allowed = ['name', 'name_en', 'national_id', 'phone', 'email',
               'department', 'job_title', 'branch', 'hire_date', 'status',
               'base_salary', 'housing_allowance', 'transport_allowance',
               'meal_allowance', 'other_allowances', 'social_insurance_pct',
               'income_tax_rate', 'custom_deductions', 'overtime_rate',
               'device_pin', 'notes', 'employee_number']
    fields = {k: v for k, v in data.items() if k in allowed}
    fields['updated_at'] = datetime.now().isoformat()
    sets = ', '.join(f"{k}=?" for k in fields)
    with _lock:
        with _get_conn() as conn:
            conn.execute(f"UPDATE employees SET {sets} WHERE id=? AND company_id=1",
                         [*fields.values(), emp_id])
            conn.commit()
    return True


def delete_employee(emp_id: int) -> bool:
    """حذف ناعم: تغيير الحالة إلى terminated"""
    with _lock:
        with _get_conn() as conn:
            conn.execute(
                "UPDATE employees SET status='terminated', updated_at=? WHERE id=?",
                (datetime.now().isoformat(), emp_id)
            )
            conn.commit()
    return True


def get_employee_stats() -> Dict:
    with _get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM employees WHERE company_id=1 AND status='active'"
        ).fetchone()[0]
        today = date.today().isoformat()
        present = conn.execute(
            "SELECT COUNT(DISTINCT employee_id) FROM attendance_records "
            "WHERE work_date=? AND status IN ('present','late')",
            (today,)
        ).fetchone()[0]
        company = conn.execute(
            "SELECT employee_limit, plan FROM companies WHERE id=1"
        ).fetchone()
        return {
            'total_active': total,
            'present_today': present,
            'absent_today': max(0, total - present),
            'employee_limit': company[0] if company else 25,
            'plan': company[1] if company else 'local',
            'limit_reached': total >= (company[0] if company else 25),
        }


# ─────────────────────────────────────────────────────────────
# Attendance Raw
# ─────────────────────────────────────────────────────────────

def insert_raw_log(device_sn: str, device_pin: str, punch_time: str, device_id: int = None) -> bool:
    """إضافة سجل بصمة خام مع تجنب التكرار"""
    try:
        with _lock:
            with _get_conn() as conn:
                conn.execute(
                    "INSERT OR IGNORE INTO attendance_raw (device_sn, device_pin, punch_time, device_id) "
                    "VALUES (?, ?, ?, ?)",
                    (device_sn, device_pin, punch_time, device_id)
                )
                conn.commit()
        return True
    except Exception:
        return False


def get_unprocessed_raw_logs() -> List[Dict]:
    """جلب السجلات الخام التي لم تُعالج بعد"""
    with _get_conn() as conn:
        rows = conn.execute("""
            SELECT ar.*, e.id as employee_id
            FROM attendance_raw ar
            LEFT JOIN employees e ON e.device_pin = ar.device_pin
                AND e.company_id = 1 AND e.status = 'active'
            WHERE ar.synced_to_cloud = 0
            ORDER BY ar.punch_time
        """).fetchall()
        return [dict(r) for r in rows]


def process_raw_logs():
    """تحويل السجلات الخام إلى سجلات حضور مُعالجة"""
    logs = get_unprocessed_raw_logs()
    if not logs:
        return 0

    processed = 0
    for log in logs:
        if not log.get('employee_id'):
            continue  # لا يوجد موظف مرتبط بهذا PIN

        emp_id = log['employee_id']
        punch_dt = _parse_dt(log['punch_time'])
        if not punch_dt:
            continue

        work_date = punch_dt.date().isoformat()

        with _lock:
            with _get_conn() as conn:
                existing = conn.execute(
                    "SELECT * FROM attendance_records WHERE employee_id=? AND work_date=?",
                    (emp_id, work_date)
                ).fetchone()

                if not existing:
                    # أول بصمة في اليوم → check_in
                    conn.execute("""
                        INSERT INTO attendance_records
                        (employee_id, work_date, check_in, status, raw_log_id)
                        VALUES (?, ?, ?, 'present', ?)
                    """, (emp_id, work_date, log['punch_time'], log['id']))
                else:
                    # بصمة لاحقة → تحديث check_out
                    existing_check_in = existing['check_in']
                    if existing_check_in and log['punch_time'] > existing_check_in:
                        ci_dt = _parse_dt(existing_check_in)
                        co_dt = punch_dt
                        worked = int((co_dt - ci_dt).total_seconds() / 60)
                        overtime = max(0, worked - 480)  # 8 ساعات = 480 دقيقة
                        conn.execute("""
                            UPDATE attendance_records
                            SET check_out=?, worked_minutes=?, overtime_minutes=?
                            WHERE employee_id=? AND work_date=?
                        """, (log['punch_time'], worked, overtime, emp_id, work_date))

                # علامة السجل الخام كمُعالج
                conn.execute(
                    "UPDATE attendance_raw SET synced_to_cloud=1 WHERE id=?",
                    (log['id'],)
                )
                conn.commit()
                processed += 1

    return processed


def _parse_dt(value: str) -> Optional[datetime]:
    if not value:
        return None
    for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f'):
        try:
            return datetime.strptime(value[:19], fmt[:len(fmt)])
        except Exception:
            continue
    return None


# ─────────────────────────────────────────────────────────────
# Attendance Records
# ─────────────────────────────────────────────────────────────

def get_attendance(date_from: str, date_to: str, emp_id: int = None) -> List[Dict]:
    with _get_conn() as conn:
        query = """
            SELECT ar.*, e.name as employee_name, e.employee_number,
                   e.department, e.job_title
            FROM attendance_records ar
            JOIN employees e ON e.id = ar.employee_id
            WHERE ar.work_date BETWEEN ? AND ?
              AND e.company_id = 1
        """
        params = [date_from, date_to]
        if emp_id:
            query += " AND ar.employee_id=?"
            params.append(emp_id)
        query += " ORDER BY ar.work_date DESC, e.name"
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def add_manual_attendance(emp_id: int, work_date: str, check_in: str,
                          check_out: str = None, notes: str = '') -> bool:
    ci_dt = _parse_dt(check_in)
    worked = 0
    overtime = 0
    if ci_dt and check_out:
        co_dt = _parse_dt(check_out)
        if co_dt:
            worked = int((co_dt - ci_dt).total_seconds() / 60)
            overtime = max(0, worked - 480)

    with _lock:
        with _get_conn() as conn:
            conn.execute("""
                INSERT INTO attendance_records
                    (employee_id, work_date, check_in, check_out,
                     worked_minutes, overtime_minutes, status,
                     is_manual_override, notes)
                VALUES (?, ?, ?, ?, ?, ?, 'present', 1, ?)
                ON CONFLICT(employee_id, work_date) DO UPDATE SET
                    check_in=excluded.check_in,
                    check_out=excluded.check_out,
                    worked_minutes=excluded.worked_minutes,
                    overtime_minutes=excluded.overtime_minutes,
                    is_manual_override=1,
                    notes=excluded.notes
            """, (emp_id, work_date, check_in, check_out, worked, overtime, notes))
            conn.commit()
    return True


def get_today_summary() -> Dict:
    today = date.today().isoformat()
    with _get_conn() as conn:
        present = conn.execute(
            "SELECT COUNT(*) FROM attendance_records WHERE work_date=? AND status IN ('present','late')",
            (today,)
        ).fetchone()[0]
        total = conn.execute(
            "SELECT COUNT(*) FROM employees WHERE company_id=1 AND status='active'"
        ).fetchone()[0]
        last_punch = conn.execute("""
            SELECT ar.punch_time, e.name, e.device_pin
            FROM attendance_raw ar
            LEFT JOIN employees e ON e.device_pin = ar.device_pin AND e.company_id=1
            ORDER BY ar.punch_time DESC LIMIT 1
        """).fetchone()
        return {
            'date': today,
            'present': present,
            'absent': max(0, total - present),
            'total': total,
            'attendance_rate': round(present / total * 100, 1) if total > 0 else 0,
            'last_punch': {
                'time': last_punch['punch_time'] if last_punch else None,
                'name': last_punch['name'] if last_punch else None,
            } if last_punch else None,
        }


# ─────────────────────────────────────────────────────────────
# Devices
# ─────────────────────────────────────────────────────────────

def get_devices() -> List[Dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM devices WHERE company_id=1 ORDER BY name"
        ).fetchall()
        return [dict(r) for r in rows]


def get_device(device_id: int) -> Optional[Dict]:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM devices WHERE id=?", (device_id,)).fetchone()
        return dict(row) if row else None


def add_device(data: Dict) -> Dict:
    allowed = ['name', 'device_type', 'ip_address', 'port', 'serial_number',
               'username', 'password', 'use_https', 'sync_interval_min']
    fields = {k: v for k, v in data.items() if k in allowed}
    fields['company_id'] = 1
    cols = ', '.join(fields.keys())
    placeholders = ', '.join(['?'] * len(fields))
    with _lock:
        with _get_conn() as conn:
            cur = conn.execute(
                f"INSERT INTO devices ({cols}) VALUES ({placeholders})",
                list(fields.values())
            )
            conn.commit()
            return get_device(cur.lastrowid) or {}


def update_device(device_id: int, data: Dict) -> bool:
    allowed = ['name', 'device_type', 'ip_address', 'port', 'serial_number',
               'username', 'password', 'use_https', 'sync_interval_min',
               'is_active', 'last_sync', 'last_status', 'last_error']
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return False
    sets = ', '.join(f"{k}=?" for k in fields)
    with _lock:
        with _get_conn() as conn:
            conn.execute(f"UPDATE devices SET {sets} WHERE id=?",
                         [*fields.values(), device_id])
            conn.commit()
    return True


def delete_device(device_id: int) -> bool:
    with _lock:
        with _get_conn() as conn:
            conn.execute("DELETE FROM devices WHERE id=?", (device_id,))
            conn.commit()
    return True


# ─────────────────────────────────────────────────────────────
# Payroll
# ─────────────────────────────────────────────────────────────

def create_payroll_run(period_start: str, period_end: str) -> int:
    with _lock:
        with _get_conn() as conn:
            cur = conn.execute("""
                INSERT INTO payroll_runs (company_id, period_start, period_end, status)
                VALUES (1, ?, ?, 'draft')
            """, (period_start, period_end))
            conn.commit()
            return cur.lastrowid


def save_payroll_items(run_id: int, items: List[Dict]) -> bool:
    totals = {'gross': 0.0, 'deductions': 0.0, 'net': 0.0}
    with _lock:
        with _get_conn() as conn:
            conn.execute("DELETE FROM payroll_items WHERE run_id=?", (run_id,))
            for item in items:
                totals['gross'] += float(item.get('gross_pay', 0))
                totals['deductions'] += float(item.get('total_deductions', 0))
                totals['net'] += float(item.get('net_pay', 0))
                conn.execute("""
                    INSERT OR REPLACE INTO payroll_items
                    (run_id, employee_id, worked_days, total_working_days,
                     base_salary, housing_allowance, transport_allowance,
                     meal_allowance, other_allowances,
                     overtime_hours, overtime_pay, gross_pay,
                     social_insurance, income_tax, custom_deductions,
                     total_deductions, net_pay, calculation_log)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    run_id,
                    item['employee_id'],
                    item.get('worked_days', 0),
                    item.get('total_working_days', 0),
                    item.get('base_salary', 0),
                    item.get('housing_allowance', 0),
                    item.get('transport_allowance', 0),
                    item.get('meal_allowance', 0),
                    item.get('other_allowances', 0),
                    item.get('overtime_hours', 0),
                    item.get('overtime_pay', 0),
                    item.get('gross_pay', 0),
                    item.get('social_insurance', 0),
                    item.get('income_tax', 0),
                    item.get('custom_deductions', 0),
                    item.get('total_deductions', 0),
                    item.get('net_pay', 0),
                    json.dumps(item.get('calculation_log', []), ensure_ascii=False),
                ))
            conn.execute("""
                UPDATE payroll_runs SET
                    total_gross=?, total_deductions=?, total_net=?, employee_count=?
                WHERE id=?
            """, (totals['gross'], totals['deductions'], totals['net'], len(items), run_id))
            conn.commit()
    return True


def approve_payroll_run(run_id: int) -> bool:
    with _lock:
        with _get_conn() as conn:
            conn.execute("""
                UPDATE payroll_runs SET status='approved', approved_at=?
                WHERE id=? AND status='draft'
            """, (datetime.now().isoformat(), run_id))
            conn.commit()
    return True


def lock_payroll_run(run_id: int) -> bool:
    with _lock:
        with _get_conn() as conn:
            conn.execute("""
                UPDATE payroll_runs SET status='locked', locked_at=?
                WHERE id=? AND status='approved'
            """, (datetime.now().isoformat(), run_id))
            conn.commit()
    return True


def get_payroll_runs() -> List[Dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM payroll_runs WHERE company_id=1 ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def get_payroll_items(run_id: int) -> List[Dict]:
    with _get_conn() as conn:
        rows = conn.execute("""
            SELECT pi.*, e.name as employee_name, e.employee_number,
                   e.department, e.job_title
            FROM payroll_items pi
            JOIN employees e ON e.id = pi.employee_id
            WHERE pi.run_id=?
            ORDER BY e.name
        """, (run_id,)).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            try:
                d['calculation_log'] = json.loads(d.get('calculation_log') or '[]')
            except Exception:
                d['calculation_log'] = []
            result.append(d)
        return result


def get_attendance_for_payroll(period_start: str, period_end: str) -> Dict[int, Dict]:
    """جلب إجمالي أيام العمل والأوفرتايم لكل موظف في فترة الراتب"""
    with _get_conn() as conn:
        rows = conn.execute("""
            SELECT employee_id,
                   COUNT(*) as worked_days,
                   SUM(overtime_minutes) as total_overtime_minutes
            FROM attendance_records
            WHERE work_date BETWEEN ? AND ?
              AND status IN ('present', 'late', 'half_day')
            GROUP BY employee_id
        """, (period_start, period_end)).fetchall()
        return {
            r['employee_id']: {
                'worked_days': r['worked_days'],
                'overtime_hours': round(r['total_overtime_minutes'] / 60, 2),
            }
            for r in rows
        }


# ─────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────

def save_notification(notif_id: str, title: str, body: str,
                       notif_type: str = 'info', action_url: str = None) -> bool:
    with _lock:
        with _get_conn() as conn:
            conn.execute("""
                INSERT OR IGNORE INTO notifications (id, title, body, type, action_url)
                VALUES (?, ?, ?, ?, ?)
            """, (notif_id, title, body or '', notif_type, action_url))
            conn.commit()
    return True


def get_notifications(unread_only: bool = False) -> List[Dict]:
    with _get_conn() as conn:
        query = "SELECT * FROM notifications"
        if unread_only:
            query += " WHERE is_read=0"
        query += " ORDER BY received_at DESC LIMIT 50"
        rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]


def mark_notification_read(notif_id: str) -> bool:
    with _lock:
        with _get_conn() as conn:
            conn.execute("UPDATE notifications SET is_read=1 WHERE id=?", (notif_id,))
            conn.commit()
    return True


def get_unread_count() -> int:
    with _get_conn() as conn:
        return conn.execute("SELECT COUNT(*) FROM notifications WHERE is_read=0").fetchone()[0]
