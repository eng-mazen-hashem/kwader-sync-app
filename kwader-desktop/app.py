"""
KWADER Desktop Pro — Main Application Entry
Python + PyWebView + PyInstaller
قاعدة بيانات محلية SQLite + مزامنة أجهزة البصمة مدمجة + إشعارات السحابة
"""
import base64
import ctypes
import json
import os
import sys
import subprocess
import threading
import time
import webbrowser
from datetime import datetime, date
from pathlib import Path

import webview
from platformdirs import user_data_dir
from dotenv import load_dotenv

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

APP_TITLE = 'KWADER Desktop Pro'
APP_ID = 'kwader-desktop'
WINDOWS_APP_ID = 'com.kwader.desktop.pro'
ORG_NAME = 'KWADER'
APP_VERSION = '2.0.0'

ENCODED_URL = 'aHR0cHM6Ly9vbGNydGZlb2JldHZkZG9jYm1ucy5zdXBhYmFzZS5jbw=='
ENCODED_KEY = 'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW05c1kzSjBabVZ2WW1WMGRtUmtiMk5pYlc1eklpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTnpJNE16WXlNVGNzSW1WNGNDSTZNakE0T0RReE1qSXhOMzAuUWdNRFdkUE43VldyNmZObW9VaDFZQngzYlRwYWxOWVFMOTBBdXVIcVY3cw=='


def resource_path(*parts):
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        base = Path(sys._MEIPASS)
    else:
        base = Path(__file__).resolve().parent
    return base.joinpath(*parts)


def resolve_data_dir() -> Path:
    appdata = os.getenv('APPDATA')
    if appdata:
        return Path(appdata) / APP_ID
    return Path(user_data_dir(APP_ID, ORG_NAME))


DATA_DIR = resolve_data_dir()
DB_FILE = DATA_DIR / 'kwader.db'
WEB_DIR = resource_path('web')

# ─────────────────────────────────────────────────────────────
# Load env & init Supabase
# ─────────────────────────────────────────────────────────────

load_dotenv(resource_path('.env'))

SUPABASE_URL = (os.getenv('SUPABASE_URL')
                or base64.b64decode(ENCODED_URL).decode('utf-8'))
SUPABASE_KEY = (os.getenv('SUPABASE_KEY')
                or os.getenv('SUPABASE_ANON_KEY')
                or base64.b64decode(ENCODED_KEY).decode('utf-8'))

try:
    from supabase import create_client
    SUPABASE = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    SUPABASE = None

# ─────────────────────────────────────────────────────────────
# Global State
# ─────────────────────────────────────────────────────────────

MAIN_WINDOW = None
IS_QUITTING = False
WINDOW_READY = threading.Event()
PENDING_JS = []
_js_lock = threading.Lock()

try:
    import pystray
    from PIL import Image
except Exception:
    pystray = None
    Image = None

TRAY_ICON = None


# ─────────────────────────────────────────────────────────────
# Suppress console windows (Windows)
# ─────────────────────────────────────────────────────────────

def suppress_console_windows():
    if os.name != 'nt':
        return
    original = subprocess.Popen
    def _p(*a, **kw):
        kw['creationflags'] = kw.get('creationflags', 0) | subprocess.CREATE_NO_WINDOW
        return original(*a, **kw)
    subprocess.Popen = _p


suppress_console_windows()


def set_windows_app_id():
    if sys.platform != 'win32':
        return
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(WINDOWS_APP_ID)
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────
# JS Bridge
# ─────────────────────────────────────────────────────────────

def post_js(js: str):
    with _js_lock:
        if not MAIN_WINDOW:
            PENDING_JS.append(js)
            return
        try:
            MAIN_WINDOW.evaluate_js(js)
        except Exception:
            PENDING_JS.append(js)


def flush_pending():
    if not MAIN_WINDOW:
        return
    while PENDING_JS:
        js = PENDING_JS.pop(0)
        try:
            MAIN_WINDOW.evaluate_js(js)
        except Exception:
            PENDING_JS.insert(0, js)
            break


def send_event(event_name: str, payload=None):
    safe = json.dumps(payload, ensure_ascii=False, default=str)
    post_js(f"window.dispatchKwaderEvent && window.dispatchKwaderEvent({json.dumps(event_name)}, {safe})")


# ─────────────────────────────────────────────────────────────
# API Class (JS ↔ Python Bridge)
# ─────────────────────────────────────────────────────────────

class Api:

    # ─── App Info ────────────────────────────────────────────

    def get_app_info(self):
        from core import notifications as notif
        from core import db
        stats = db.get_employee_stats()
        return {
            'version': APP_VERSION,
            'is_online': notif.is_online(),
            'unread_notifications': db.get_unread_count(),
            'stats': stats,
        }

    def open_url(self, url: str):
        """فتح رابط في المتصفح الافتراضي"""
        try:
            webbrowser.open(url)
        except Exception:
            pass

    # ─── Company ──────────────────────────────────────────────

    def get_company(self):
        from core import db
        return db.get_company()

    def update_company(self, data: dict):
        from core import db
        return db.update_company(data)

    # ─── Employees ────────────────────────────────────────────

    def get_employees(self, status: str = None, search: str = None):
        from core import db
        return db.get_employees(status=status, search=search)

    def get_employee(self, emp_id: int):
        from core import db
        return db.get_employee(emp_id)

    def add_employee(self, data: dict):
        from core import db
        # فحص حد الخطة
        stats = db.get_employee_stats()
        if stats.get('limit_reached'):
            return {'error': 'limit_reached', 'limit': stats.get('employee_limit')}
        return db.add_employee(data)

    def update_employee(self, emp_id: int, data: dict):
        from core import db
        return db.update_employee(emp_id, data)

    def delete_employee(self, emp_id: int):
        from core import db
        return db.delete_employee(emp_id)

    def get_employee_stats(self):
        from core import db
        return db.get_employee_stats()

    # ─── Attendance ───────────────────────────────────────────

    def get_attendance(self, date_from: str, date_to: str, emp_id: int = None):
        from core import db
        return db.get_attendance(date_from, date_to, emp_id)

    def add_manual_attendance(self, emp_id: int, work_date: str,
                               check_in: str, check_out: str = None, notes: str = ''):
        from core import db
        return db.add_manual_attendance(emp_id, work_date, check_in, check_out, notes)

    def get_today_summary(self):
        from core import db
        return db.get_today_summary()

    def process_raw_logs(self):
        """معالجة السجلات الخام يدوياً"""
        from core import db
        processed = db.process_raw_logs()
        return {'processed': processed}

    # ─── Payroll ──────────────────────────────────────────────

    def calculate_payroll(self, period_start: str, period_end: str):
        from core import payroll
        return payroll.run_payroll(period_start, period_end)

    def approve_payroll(self, run_id: int):
        from core import db
        return db.approve_payroll_run(run_id)

    def lock_payroll(self, run_id: int):
        from core import db
        return db.lock_payroll_run(run_id)

    def get_payroll_runs(self):
        from core import db
        return db.get_payroll_runs()

    def get_payroll_items(self, run_id: int):
        from core import db
        return db.get_payroll_items(run_id)

    def export_payroll_html(self, run_id: int):
        """تصدير الرواتب كـ HTML للطباعة"""
        from core import payroll
        summary = payroll.get_payroll_summary_for_export(run_id)
        html = _build_payroll_html(summary)
        out_path = DATA_DIR / f"payroll_export_{run_id}.html"
        out_path.write_text(html, encoding='utf-8')
        return str(out_path)

    # ─── Devices ──────────────────────────────────────────────

    def get_devices(self):
        from core import db
        return db.get_devices()

    def add_device(self, data: dict):
        from core import db
        return db.add_device(data)

    def update_device(self, device_id: int, data: dict):
        from core import db
        return db.update_device(device_id, data)

    def delete_device(self, device_id: int):
        from core import sync_engine, db
        sync_engine.stop_device_sync(device_id)
        return db.delete_device(device_id)

    def test_device_connection(self, device_id: int):
        from core import db, sync_engine
        device = db.get_device(device_id)
        if not device:
            return {'success': False, 'message': 'الجهاز غير موجود'}
        dtype = str(device.get('device_type', 'zkteco')).lower()
        if dtype == 'hikvision':
            return sync_engine.test_hikvision_connection(
                ip=device['ip_address'],
                port=int(device.get('port') or 80),
                username=device.get('username', 'admin'),
                password=device.get('password', ''),
                use_https=bool(device.get('use_https', False)),
            )
        else:
            return sync_engine.test_zkteco_connection(
                ip=device['ip_address'],
                port=int(device.get('port') or 4370),
            )

    def start_device_sync(self, device_id: int):
        from core import sync_engine

        def on_sync_complete(result):
            send_event('sync_complete', result)

        sync_engine.start_device_sync(device_id, on_complete=on_sync_complete)
        return {'started': True}

    def stop_device_sync(self, device_id: int):
        from core import sync_engine
        sync_engine.stop_device_sync(device_id)
        return {'stopped': True}

    def sync_device_now(self, device_id: int):
        from core import sync_engine

        def _run():
            result = sync_engine.sync_device_now(device_id)
            send_event('sync_complete', result)

        threading.Thread(target=_run, daemon=True).start()
        return {'queued': True}

    def get_all_device_statuses(self):
        from core import sync_engine
        return sync_engine.get_all_device_statuses()

    # ─── Notifications & Cloud ────────────────────────────────

    def get_notifications(self, unread_only: bool = False):
        from core import db
        return db.get_notifications(unread_only=unread_only)

    def mark_notification_read(self, notif_id: str):
        from core import db
        return db.mark_notification_read(notif_id)

    def get_cloud_status(self):
        from core import notifications as notif
        return {
            'is_online': notif.is_online(),
            'app_version': APP_VERSION,
        }

    def check_for_updates(self):
        from core import notifications as notif
        notif.force_check()
        return {'checking': True}

    def get_active_ad(self):
        from core import notifications as notif
        return notif.get_current_ad()

    def get_upsell_banner(self):
        from core import notifications as notif
        return notif.get_upsell_banner()

    # ─── Settings ────────────────────────────────────────────

    def get_settings(self):
        from core import db
        return db.get_all_settings()

    def set_setting(self, key: str, value):
        from core import db
        db.set_setting(key, value)
        return True

    def get_language(self):
        from core import db
        return db.get_setting('language', 'ar')

    def set_language(self, lang: str):
        from core import db
        lang = 'ar' if str(lang).lower() == 'ar' else 'en'
        db.set_setting('language', lang)
        return lang

    def set_auto_start(self, enabled: bool):
        _set_windows_autostart(bool(enabled))
        from core import db
        db.set_setting('autoStart', bool(enabled))
        return bool(enabled)

    def get_auto_start(self):
        from core import db
        return bool(db.get_setting('autoStart', False))

    # ─── License (Cloud) ──────────────────────────────────────

    def verify_license(self, license_key: str):
        if SUPABASE is None:
            return {'valid': False, 'message': 'لا يوجد اتصال بالإنترنت'}
        try:
            resp = SUPABASE.rpc('check_subscription', {'p_license_key': license_key}).execute()
            data = getattr(resp, 'data', None)
            if data and data.get('active'):
                from core import db
                db.update_company({'license_key': license_key, 'plan': data.get('plan', 'cloud_free')})
                db.set_setting('licenseKey', license_key)
                return {'valid': True, 'company_name': data.get('company_name')}
            msg = data.get('message') if data else 'مفتاح غير صالح'
            return {'valid': False, 'message': msg}
        except Exception as exc:
            return {'valid': False, 'message': str(exc)}


# ─────────────────────────────────────────────────────────────
# Payroll HTML Export Helper
# ─────────────────────────────────────────────────────────────

def _build_payroll_html(summary: dict) -> str:
    company = summary.get('company', {})
    run = summary.get('run', {})
    items = summary.get('items', [])
    gen_at = summary.get('generated_at', '')

    rows = ''
    for i, item in enumerate(items, 1):
        rows += f"""
        <tr>
            <td>{i}</td>
            <td>{item.get('employee_name', '')}</td>
            <td>{item.get('employee_number', '')}</td>
            <td>{item.get('department', '')}</td>
            <td>{item.get('worked_days', 0)} / {item.get('total_working_days', 0)}</td>
            <td>{item.get('base_salary', 0):,.2f}</td>
            <td>{item.get('overtime_pay', 0):,.2f}</td>
            <td>{item.get('gross_pay', 0):,.2f}</td>
            <td>{item.get('total_deductions', 0):,.2f}</td>
            <td><strong>{item.get('net_pay', 0):,.2f}</strong></td>
        </tr>"""

    total_net = sum(i.get('net_pay', 0) for i in items)
    total_gross = sum(i.get('gross_pay', 0) for i in items)
    total_ded = sum(i.get('total_deductions', 0) for i in items)

    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>كشف المرتبات — {company.get('name', 'الشركة')}</title>
<style>
  body {{ font-family: 'Segoe UI', Tahoma, sans-serif; margin: 20px; color: #1a1a2e; direction: rtl; }}
  h1 {{ color: #0f3460; border-bottom: 3px solid #6c63ff; padding-bottom: 8px; }}
  .meta {{ color: #666; margin-bottom: 20px; font-size: 14px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }}
  th {{ background: #0f3460; color: white; padding: 10px 8px; text-align: center; }}
  td {{ padding: 8px; text-align: center; border-bottom: 1px solid #e0e0e0; }}
  tr:nth-child(even) {{ background: #f8f8ff; }}
  tfoot td {{ background: #e8e8ff; font-weight: bold; border-top: 2px solid #0f3460; }}
  .print-btn {{ background: #6c63ff; color: white; border: none; padding: 10px 24px;
                 border-radius: 6px; cursor: pointer; margin-bottom: 16px; font-size: 14px; }}
  @media print {{ .print-btn {{ display: none; }} }}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ طباعة</button>
<h1>كشف المرتبات — {company.get('name', 'الشركة')}</h1>
<div class="meta">
  الفترة: {run.get('period_start', '')} إلى {run.get('period_end', '')} |
  صُدِّر: {gen_at} |
  الحالة: {run.get('status', '')}
</div>
<table>
  <thead>
    <tr>
      <th>#</th><th>الاسم</th><th>رقم الموظف</th><th>الإدارة</th>
      <th>أيام العمل</th><th>الأساسي</th><th>أجر إضافي</th>
      <th>الإجمالي</th><th>الخصومات</th><th>الصافي</th>
    </tr>
  </thead>
  <tbody>{rows}</tbody>
  <tfoot>
    <tr>
      <td colspan="7">الإجمالي ({len(items)} موظف)</td>
      <td>{total_gross:,.2f}</td>
      <td>{total_ded:,.2f}</td>
      <td>{total_net:,.2f}</td>
    </tr>
  </tfoot>
</table>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────
# Auto-start (Windows Registry)
# ─────────────────────────────────────────────────────────────

def _set_windows_autostart(enabled: bool):
    if sys.platform != 'win32':
        return
    try:
        import winreg
        run_key = r'Software\Microsoft\Windows\CurrentVersion\Run'
        app_name = APP_TITLE
        if getattr(sys, 'frozen', False):
            cmd = f'"{sys.executable}" --hidden'
        else:
            cmd = f'"{sys.executable}" "{Path(__file__).resolve()}" --hidden'
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, run_key, 0, winreg.KEY_SET_VALUE) as key:
            if enabled:
                winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, cmd)
            else:
                try:
                    winreg.DeleteValue(key, app_name)
                except FileNotFoundError:
                    pass
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────
# System Tray
# ─────────────────────────────────────────────────────────────

def _create_tray():
    global TRAY_ICON
    if not pystray or not Image:
        return

    try:
        icon_path = WEB_DIR / 'assets' / 'icon.png'
        if icon_path.exists():
            img = Image.open(icon_path).resize((64, 64), Image.Resampling.LANCZOS)
        else:
            img = _default_icon()
    except Exception:
        img = _default_icon()

    def show():
        if MAIN_WINDOW:
            MAIN_WINDOW.show()
            MAIN_WINDOW.restore()

    def quit_app():
        global IS_QUITTING
        IS_QUITTING = True
        if TRAY_ICON:
            try:
                TRAY_ICON.stop()
            except Exception:
                pass
        if MAIN_WINDOW:
            MAIN_WINDOW.destroy()

    menu = pystray.Menu(
        pystray.MenuItem(APP_TITLE, None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem('فتح التطبيق', lambda: show()),
        pystray.MenuItem('إغلاق', lambda: quit_app()),
    )
    TRAY_ICON = pystray.Icon('kwader-desktop', img, APP_TITLE, menu)
    TRAY_ICON.run_detached()


def _default_icon():
    try:
        from PIL import ImageDraw
        img = Image.new('RGBA', (64, 64), (99, 102, 241, 255))
        d = ImageDraw.Draw(img)
        d.rectangle([16, 16, 48, 48], fill=(255, 255, 255, 200))
        return img
    except Exception:
        return Image.new('RGB', (64, 64), 'blue')


# ─────────────────────────────────────────────────────────────
# Window Events
# ─────────────────────────────────────────────────────────────

def on_loaded(*_):
    WINDOW_READY.set()
    flush_pending()


def on_closing(*_):
    if IS_QUITTING:
        return True
    if MAIN_WINDOW:
        MAIN_WINDOW.hide()
    return False


# ─────────────────────────────────────────────────────────────
# Notification Callbacks → push to JS
# ─────────────────────────────────────────────────────────────

def _on_notification(count: int):
    send_event('new_notifications', {'count': count})


def _on_ad(ad: dict):
    send_event('new_ad', ad)


def _on_update(update_info: dict):
    send_event('app_update_available', update_info)


def _on_sync_log(message: str, level: str = 'info'):
    payload = json.dumps({'message': message, 'type': level}, ensure_ascii=False)
    post_js(f"if (window.onDeviceLog) window.onDeviceLog({payload})")


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

def main():
    set_windows_app_id()

    # تهيئة قاعدة البيانات
    from core import db
    db.init_db(DB_FILE)

    # تهيئة محرك المزامنة
    from core import sync_engine
    sync_engine.set_log_callback(_on_sync_log)

    # تهيئة نظام الإشعارات
    from core import notifications as notif
    notif.init(SUPABASE, _on_notification, _on_ad, _on_update)
    notif.start()

    # بدء auto-sync للأجهزة النشطة
    def _start_auto_syncs():
        time.sleep(5)  # انتظر حتى تكتمل التهيئة
        devices = db.get_devices()
        for device in devices:
            if device.get('is_active'):
                try:
                    sync_engine.start_device_sync(
                        device['id'],
                        on_complete=lambda r: send_event('sync_complete', r)
                    )
                except Exception:
                    pass

    threading.Thread(target=_start_auto_syncs, daemon=True).start()

    # إنشاء النافذة الرئيسية
    global MAIN_WINDOW
    start_hidden = '--hidden' in sys.argv

    MAIN_WINDOW = webview.create_window(
        APP_TITLE,
        url=str((WEB_DIR / 'index.html').resolve()),
        width=1200,
        height=800,
        min_size=(900, 650),
        hidden=start_hidden,
        easy_drag=False,
        js_api=Api(),
    )
    MAIN_WINDOW.events.loaded += on_loaded
    MAIN_WINDOW.events.closing += on_closing

    _create_tray()

    webview.start(
        gui='edgechromium',
        debug=False,
        private_mode=True,
    )


if __name__ == '__main__':
    main()
