import os

content = r"""import base64
import json
import os
import sys
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path

import webview
from platformdirs import user_data_dir
from supabase import create_client
from dotenv import load_dotenv

try:
    from zk import ZK
except Exception:  # pragma: no cover
    ZK = None

try:
    import pystray
    from PIL import Image
except Exception:  # pragma: no cover
    pystray = None
    Image = None

from demo_generator import (
    DEMO_EMPLOYEES,
    generate_demo_attendance,
    generate_historical_data,
)

APP_TITLE = 'KWADER Sync'
APP_ID = 'sync-agent'
ORG_NAME = 'KWADER'
ENCODED_URL = 'aHR0cHM6Ly9vbGNydGZlb2JldHZkZG9jYm1ucy5zdXBhYmFzZS5jbw=='
ENCODED_KEY = 'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW05c1kzSjBabVZ2WW1WMGRtUmtiMk5pYlc1eklpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTnpJNE16WXlNVGNzSW1WNGNDSTZNakE0T0RReE1qSXhOMzAuUWdNRFdkUE43VldyNmZObW9VaDFZQngzYlRwYWxOWVFMOTBBdXVIcVY3cw=='


def resource_path(*parts):
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        base = Path(sys._MEIPASS)
    else:
        base = Path(__file__).resolve().parent
    return base.joinpath(*parts)


load_dotenv(resource_path('.env'))

SUPABASE_URL = os.getenv('SUPABASE_URL') or base64.b64decode(ENCODED_URL).decode('utf-8')
SUPABASE_KEY = (
    os.getenv('SUPABASE_KEY')
    or os.getenv('SUPABASE_ANON_KEY')
    or base64.b64decode(ENCODED_KEY).decode('utf-8')
)
SUPABASE = create_client(SUPABASE_URL, SUPABASE_KEY)


def resolve_data_dir():
    appdata = os.getenv('APPDATA')
    if appdata:
        return Path(appdata) / APP_ID
    return Path(user_data_dir(APP_ID, ORG_NAME))


DATA_DIR = resolve_data_dir()
SETTINGS_FILE = DATA_DIR / 'settings.json'

MAIN_WINDOW = None
TRAY_ICON = None
IS_SYNCING = False
SYNC_THREAD = None
SYNC_STOP_EVENT = threading.Event()
SYNC_LOCK = threading.Lock()
IS_QUITTING = False
WINDOW_READY = threading.Event()
PENDING_JS = []
SETTINGS_LOCK = threading.Lock()

WEB_DIR = resource_path('web')


def suppress_console_windows():
    if os.name != 'nt':
        return
    original_popen = subprocess.Popen

    def _popen(*args, **kwargs):
        creationflags = kwargs.get('creationflags', 0)
        kwargs['creationflags'] = creationflags | subprocess.CREATE_NO_WINDOW
        return original_popen(*args, **kwargs)

    subprocess.Popen = _popen


suppress_console_windows()


def init_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_settings():
    with SETTINGS_LOCK:
        try:
            if SETTINGS_FILE.exists():
                return json.loads(SETTINGS_FILE.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {}


def save_settings(data):
    with SETTINGS_LOCK:
        SETTINGS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def get_setting(key, default=None):
    settings = load_settings()
    return settings.get(key, default)


def set_setting(key, value):
    settings = load_settings()
    settings[key] = value
    save_settings(settings)


def set_multi(values):
    settings = load_settings()
    settings.update(values)
    save_settings(settings)


def now_local_string():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def parse_iso(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if not value:
        return datetime.min
    if isinstance(value, str):
        cleaned = value.replace('Z', '')
        try:
            return datetime.fromisoformat(cleaned)
        except Exception:
            return datetime.min
    return datetime.min


def post_js(js):
    if not MAIN_WINDOW:
        PENDING_JS.append(js)
        return
    try:
        MAIN_WINDOW.evaluate_js(js)
    except Exception:
        PENDING_JS.append(js)


def flush_pending_js():
    if not MAIN_WINDOW:
        return
    while PENDING_JS:
        js = PENDING_JS.pop(0)
        try:
            MAIN_WINDOW.evaluate_js(js)
        except Exception:
            PENDING_JS.insert(0, js)
            break


def log_to_ui(message, msg_type='info'):
    payload = json.dumps({'message': message, 'type': msg_type}, ensure_ascii=False)
    post_js(f"if (window.onPythonLog) window.onPythonLog({payload});")


def notify_sync_state():
    post_js(f"if (window.onSyncStateChanged) window.onSyncStateChanged({json.dumps(IS_SYNCING)});")


def notify_demo_mode(enabled):
    post_js(f"if (window.onDemoModeChanged) window.onDemoModeChanged({json.dumps(enabled)});")


def notify_sync_completed(time_str):
    post_js(f"if (window.onSyncCompleted) window.onSyncCompleted({json.dumps(time_str)});")


def set_auto_start(enabled):
    set_setting('autoStart', bool(enabled))

    if sys.platform != 'win32':
        return

    try:
        import winreg
    except Exception:
        return

    run_key = r'Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    app_name = APP_TITLE

    if getattr(sys, 'frozen', False):
        cmd = f'"{sys.executable}" --hidden'
    else:
        script = Path(__file__).resolve()
        cmd = f'"{sys.executable}" "{script}" --hidden'

    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, run_key, 0, winreg.KEY_SET_VALUE) as key:
        if enabled:
            winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, cmd)
        else:
            try:
                winreg.DeleteValue(key, app_name)
            except FileNotFoundError:
                pass


def get_auto_start():
    return bool(get_setting('autoStart', False))


def start_sync():
    global IS_SYNCING, SYNC_THREAD

    if IS_SYNCING:
        return

    IS_SYNCING = True
    SYNC_STOP_EVENT.clear()

    def runner():
        while not SYNC_STOP_EVENT.is_set():
            perform_sync()
            mins = int(get_setting('syncInterval', 5) or 5)
            for _ in range(max(1, mins * 60)):
                if SYNC_STOP_EVENT.is_set():
                    break
                time.sleep(1)

    SYNC_THREAD = threading.Thread(target=runner, daemon=True)
    SYNC_THREAD.start()

    log_to_ui(f'تم تشغيل المزامنة التلقائية (كل {get_setting("syncInterval", 5)} دقيقة).', 'success')
    update_tray_menu()
    notify_sync_state()


def stop_sync():
    global IS_SYNCING

    if not IS_SYNCING:
        return

    IS_SYNCING = False
    SYNC_STOP_EVENT.set()
    log_to_ui('تم إيقاف المزامنة.', 'warning')
    update_tray_menu()
    notify_sync_state()


def perform_sync():
    if not SYNC_LOCK.acquire(blocking=False):
        return
    try:
        _perform_sync_inner()
    finally:
        SYNC_LOCK.release()


def _perform_sync_inner():
    settings = load_settings()
    is_demo_mode = bool(get_setting('demoMode', False))

    if not settings.get('licenseKey'):
        log_to_ui('خطأ: أدخل مفتاح الترخيص أولاً في صفحة الإعدادات.', 'error')
        return

    if not is_demo_mode and (not settings.get('deviceIp') or not settings.get('deviceSn')):
        log_to_ui('خطأ: الإعدادات غير مكتملة. راجع صفحة الإعدادات أو فعّل وضع التجربة.', 'error')
        return

    log_to_ui('----------------------------------------', 'info')
    log_to_ui('بدء دورة المزامنة (وضع التجربة)...' if is_demo_mode else 'بدء دورة المزامنة...', 'info')

    try:
        log_to_ui('جاري التحقق من الترخيص...', 'info')
        resp = SUPABASE.rpc('check_subscription', {'p_license_key': settings['licenseKey']}).execute()
        if getattr(resp, 'error', None):
            raise Exception(resp.error.message)
        data = getattr(resp, 'data', None)
        if data and data.get('active'):
            log_to_ui(f'تم التحقق: الشركة {data.get("company_name")}', 'success')
        else:
            log_to_ui(f'الترخيص غير صالح: {data.get("message") if data else "غير معروف"}', 'error')
            return
    except Exception as exc:
        log_to_ui(f'فشل التحقق: {exc}', 'error')
        return

    if is_demo_mode:
        _sync_demo_mode(settings)
        return

    _sync_device_mode(settings)


def _sync_demo_mode(settings):
    try:
        log_to_ui('توليد بيانات بصمات وهمية...', 'info')
        demo_logs = generate_demo_attendance()
        device_sn = settings.get('deviceSn') or 'DEMO-DEVICE-001'

        if not demo_logs:
            log_to_ui('لا توجد بصمات بعد (ربما الوقت مبكر جدًا أو يوم إجازة).', 'info')
            send_heartbeat(settings)
            return

        license_key = settings.get('licenseKey')
        last_sync_key = f'lastSyncIso_{license_key}'
        last_date = parse_iso(get_setting(last_sync_key, '2000-01-01T00:00:00.000Z'))
        new_logs = [log for log in demo_logs if parse_iso(log['time']) > last_date]

        log_to_ui(f'{len(new_logs)} سجل وهمي جديد (تم تجاهل {len(demo_logs) - len(new_logs)} سجل قديم).', 'info')

        if new_logs:
            total = _sync_batches(settings['licenseKey'], device_sn, new_logs)
            log_to_ui(f'تمت مزامنة {total} سجل وهمي إلى السحابة بنجاح!', 'success')
            latest_date = max(parse_iso(log['time']) for log in new_logs)
            now = now_local_string()
            set_setting(last_sync_key, latest_date.isoformat())
            set_setting('lastSyncTime', now)
            notify_sync_completed(now)
        else:
            send_heartbeat(settings)
            log_to_ui('كل البيانات مُزامنة بالفعل.', 'info')
    except Exception as exc:
        log_to_ui(f'خطأ في وضع التجربة: {exc}', 'error')


def _sync_device_mode(settings):
    if ZK is None:
        log_to_ui('مكتبة ZK غير مثبتة (pyzk). ثبّت المتطلبات أولاً.', 'error')
        return

    zk = None
    conn = None
    try:
        log_to_ui(f'الاتصال بالجهاز {settings.get("deviceIp")}:{settings.get("devicePort")}...', 'info')
        zk = ZK(settings.get('deviceIp'), port=int(settings.get('devicePort') or 4370), timeout=10)
        conn = zk.connect()
        conn.disable_device()
        log_to_ui('تم الاتصال بالجهاز.', 'success')

        log_to_ui('قراءة سجلات الحضور...', 'info')
        attendances = conn.get_attendance() or []

        if not attendances:
            log_to_ui('لا توجد سجلات.', 'info')
            send_heartbeat(settings)
            return

        license_key = settings.get('licenseKey')
        last_sync_key = f'lastSyncIso_{license_key}'
        last_date = parse_iso(get_setting(last_sync_key, '2000-01-01T00:00:00.000Z'))
        new_logs = []
        latest_date = last_date

        for att in attendances:
            ts = getattr(att, 'timestamp', None) or getattr(att, 'record_time', None) or getattr(att, 'time', None)
            if ts is None:
                continue
            if isinstance(ts, str):
                ts = parse_iso(ts)
            if isinstance(ts, datetime):
                ts = ts.replace(tzinfo=None)
            if ts > last_date:
                user_id = (
                    getattr(att, 'user_id', None)
                    or getattr(att, 'device_user_id', None)
                    or getattr(att, 'pin', None)
                    or getattr(att, 'uid', None)
                )
                new_logs.append({'pin': str(user_id), 'time': ts.isoformat(), 'status': '0'})
                if ts > latest_date:
                    latest_date = ts

        log_to_ui(f'{len(new_logs)} سجل جديد.', 'info')

        if new_logs:
            total = _sync_batches(settings['licenseKey'], settings.get('deviceSn'), new_logs)
            log_to_ui(f'تمت مزامنة {total} سجل بنجاح!', 'success')
            now = now_local_string()
            set_setting(last_sync_key, latest_date.isoformat())
            set_setting('lastSyncTime', now)
            notify_sync_completed(now)
        else:
            send_heartbeat(settings)
    except Exception as exc:
        log_to_ui(f'خطأ: {exc}', 'error')
    finally:
        try:
            if conn:
                try:
                    conn.enable_device()
                except Exception:
                    pass
                conn.disconnect()
        except Exception:
            pass
        log_to_ui('تم قطع الاتصال.', 'info')


def _sync_batches(license_key, device_sn, logs):
    total_inserted = 0
    batch_size = 500
    for i in range(0, len(logs), batch_size):
        batch = logs[i:i + batch_size]
        log_to_ui(f'إرسال دفعة ({len(batch)} سجل) إلى السحابة...', 'info')
        resp = SUPABASE.rpc('sync_attendance', {
            'p_license_key': license_key,
            'p_device_sn': device_sn,
            'p_logs': batch
        }).execute()
        if getattr(resp, 'error', None):
            raise Exception(resp.error.message)
        data = getattr(resp, 'data', None)
        if data and data.get('success'):
            total_inserted += data.get('inserted', 0) or 0
    return total_inserted


def send_heartbeat(settings):
    try:
        log_to_ui('إشارة اتصال...', 'info')
        SUPABASE.rpc('sync_attendance', {
            'p_license_key': settings['licenseKey'],
            'p_device_sn': settings.get('deviceSn'),
            'p_logs': []
        }).execute()
        now = now_local_string()
        set_setting('lastSyncTime', now)
        notify_sync_completed(now)
        log_to_ui('تم تحديث حالة الجهاز.', 'success')
    except Exception as exc:
        log_to_ui(f'فشل الإشارة: {exc}', 'error')


class Api:
    def get_settings(self):
        return {
            'licenseKey': get_setting('licenseKey', ''),
            'deviceIp': get_setting('deviceIp', '192.168.1.201'),
            'devicePort': get_setting('devicePort', 4370),
            'deviceSn': get_setting('deviceSn', ''),
            'syncInterval': get_setting('syncInterval', 5),
            'autoStart': get_setting('autoStart', False),
        }

    def save_settings(self, settings):
        normalized = dict(settings or {})
        if 'devicePort' in normalized:
            try:
                normalized['devicePort'] = int(normalized['devicePort'])
            except Exception:
                normalized['devicePort'] = 4370
        if 'syncInterval' in normalized:
            try:
                normalized['syncInterval'] = int(normalized['syncInterval'])
            except Exception:
                normalized['syncInterval'] = 5
        set_multi(normalized)
        log_to_ui('تم حفظ الإعدادات بنجاح.', 'success')
        return True

    def get_status(self):
        return {
            'isSyncing': IS_SYNCING,
            'lastSync': get_setting('lastSyncTime', 'لم تتم المزامنة بعد'),
            'demoMode': get_setting('demoMode', False),
        }

    def set_auto_start(self, enabled):
        set_auto_start(enabled)
        log_to_ui('تم تفعيل التشغيل التلقائي مع بدء تشغيل الحاسوب.' if enabled else 'تم إلغاء التشغيل التلقائي مع الحاسوب.', 'success' if enabled else 'info')
        return bool(enabled)

    def get_auto_start(self):
        return get_auto_start()

    def toggle_demo_mode(self, enabled):
        set_setting('demoMode', bool(enabled))
        if enabled:
            log_to_ui('تم تفعيل وضع التجربة — سيتم توليد بيانات وهمية بدل الاتصال بالجهاز.', 'success')
        else:
            log_to_ui('تم إلغاء وضع التجربة — سيتم الاتصال بجهاز البصمة الحقيقي.', 'info')
        notify_demo_mode(bool(enabled))
        return bool(enabled)

    def get_demo_status(self):
        return {
            'enabled': get_setting('demoMode', False),
            'employeeCount': len(DEMO_EMPLOYEES),
        }

    def generate_historical(self):
        settings = load_settings()
        if not settings.get('licenseKey'):
            log_to_ui('خطأ: أدخل مفتاح الترخيص أولاً!', 'error')
            return False
        log_to_ui('توليد بيانات تاريخية لآخر 7 أيام...', 'info')
        try:
            resp = SUPABASE.rpc('check_subscription', {'p_license_key': settings['licenseKey']}).execute()
            if getattr(resp, 'error', None):
                raise Exception(resp.error.message)
            data = getattr(resp, 'data', None)
            if not data or not data.get('active'):
                log_to_ui('الترخيص غير صالح.', 'error')
                return False

            historical_logs = generate_historical_data(7)
            log_to_ui(f'تم توليد {len(historical_logs)} سجل بصمة لآخر 7 أيام.', 'info')
            device_sn = settings.get('deviceSn') or 'DEMO-DEVICE-001'
            total_inserted = _sync_batches(settings['licenseKey'], device_sn, historical_logs)
            
            # Update key-specific sync date
            license_key = settings.get('licenseKey')
            last_sync_key = f'lastSyncIso_{license_key}'
            set_setting(last_sync_key, '2000-01-01T00:00:00.000Z')
            
            log_to_ui(f'تم رفع {total_inserted} سجل تاريخي بنجاح!', 'success')
            return True
        except Exception as exc:
            log_to_ui(f'خطأ أثناء توليد البيانات التاريخية: {exc}', 'error')
            return False

    def verify_license(self, license_key):
        try:
            resp = SUPABASE.rpc('check_subscription', {'p_license_key': license_key}).execute()
            if getattr(resp, 'error', None):
                raise Exception(resp.error.message)
            data = getattr(resp, 'data', None)
            if data and data.get('active'):
                log_to_ui('تم الاتصال بـ Supabase بنجاح.', 'success')
                return {'valid': True, 'companyName': data.get('company_name')}
            message = data.get('message') if data else 'مفتاح غير صالح'
            log_to_ui(f'تعذر التحقق من الترخيص: {message}', 'error')
            return {'valid': False, 'message': message}
        except Exception as exc:
            log_to_ui(f'فشل الاتصال بـ Supabase: {exc}', 'error')
            return {'valid': False, 'message': str(exc)}

    def start_sync(self):
        start_sync()
        return IS_SYNCING

    def stop_sync(self):
        stop_sync()
        return IS_SYNCING

    def force_sync(self):
        perform_sync()
        return get_setting('lastSyncTime', 'لم تتم المزامنة بعد')

    def reset_sync_for_license(self):
        license_key = get_setting('licenseKey')
        if not license_key:
            return False
        last_sync_key = f'lastSyncIso_{license_key}'
        set_setting(last_sync_key, '2000-01-01T00:00:00.000Z')
        log_to_ui('تمت إعادة ضبط تاريخ المزامنة لهذا العميل. سيتم رفع كافة السجلات من البداية في المزامنة القادمة.', 'success')
        return True


def update_tray_menu():
    if not TRAY_ICON or not pystray:
        return

    status_label = 'مزامنة نشطة' if IS_SYNCING else 'متوقفة'
    toggle_label = 'إيقاف المزامنة' if IS_SYNCING else 'بدء المزامنة'

    TRAY_ICON.menu = pystray.Menu(
        pystray.MenuItem('KWADER Sync', None, enabled=False),
        pystray.MenuItem(status_label, None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem('إظهار النافذة', lambda: show_window()),
        pystray.MenuItem('مزامنة الآن', lambda: run_in_thread(perform_sync)),
        pystray.MenuItem(toggle_label, lambda: toggle_sync_from_tray()),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem('إغلاق البرنامج', lambda: quit_app()),
    )
    TRAY_ICON.update_menu()


def toggle_sync_from_tray():
    if IS_SYNCING:
        stop_sync()
    else:
        start_sync()


def run_in_thread(func):
    threading.Thread(target=func, daemon=True).start()


def show_window():
    if MAIN_WINDOW:
        MAIN_WINDOW.show()
        MAIN_WINDOW.restore()


def hide_window():
    if MAIN_WINDOW:
        MAIN_WINDOW.hide()


def quit_app():
    global IS_QUITTING
    IS_QUITTING = True
    stop_sync()
    if TRAY_ICON:
        try:
            TRAY_ICON.stop()
        except Exception:
            pass
    if MAIN_WINDOW:
        MAIN_WINDOW.destroy()


def on_loaded(*_):
    WINDOW_READY.set()
    flush_pending_js()


def on_closing(*_):
    if IS_QUITTING:
        return True
    hide_window()
    return False


def create_tray():
    global TRAY_ICON
    if not pystray or not Image:
        return

    icon_path = WEB_DIR / 'assets' / 'icon.png'
    image = Image.open(icon_path) if icon_path.exists() else None

    TRAY_ICON = pystray.Icon('kwader-sync', image, APP_TITLE)
    update_tray_menu()
    TRAY_ICON.run_detached()


def main():
    init_data_dir()

    start_hidden = '--hidden' in sys.argv

    global MAIN_WINDOW
    MAIN_WINDOW = webview.create_window(
        APP_TITLE,
        url=str((WEB_DIR / 'index.html').resolve()),
        width=750,
        height=580,
        min_size=(600, 500),
        hidden=start_hidden,
        easy_drag=False,
        js_api=Api(),
    )

    MAIN_WINDOW.events.loaded += on_loaded
    MAIN_WINDOW.events.closing += on_closing

    create_tray()

    def on_app_ready():
        if get_setting('autoStart', False):
            threading.Timer(3, start_sync).start()

    webview.start(gui='edgechromium', debug=False, func=on_app_ready, private_mode=True)


if __name__ == '__main__':
    main()
"""

with open("app.py", "w", encoding="utf-8-sig") as f:
    f.write(content)
