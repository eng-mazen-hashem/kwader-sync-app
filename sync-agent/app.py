import base64
import ctypes
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
except Exception:
    ZK = None

try:
    from hikvision_connector import HikvisionConnector
    HIKVISION_AVAILABLE = True
except Exception:
    HikvisionConnector = None
    HIKVISION_AVAILABLE = False

try:
    import pystray
    from PIL import Image
except Exception:
    pystray = None
    Image = None

APP_TITLE = 'KWADER Sync'
APP_ID = 'sync-agent'
WINDOWS_APP_ID = 'com.kwader.sync.agent'
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
SUPABASE_KEY = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_ANON_KEY') or base64.b64decode(ENCODED_KEY).decode('utf-8')
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

class WhatsappNodeManager:
    def __init__(self):
        self.process = None
        self.monitor_thread = None
        self._stop_monitor = threading.Event()

    def start(self):
        if self.process and self.process.poll() is None:
            return
        
        self._stop_monitor.clear()
        self._start_process()
        
        if not self.monitor_thread or not self.monitor_thread.is_alive():
            self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self.monitor_thread.start()

    def _start_process(self):
        if self.process and self.process.poll() is None:
            return
        
        exe_path = resource_path('bin', 'whatsapp-node.exe')
        if not exe_path.exists():
            log_to_ui('WhatsApp node executable not found. Skipping.', 'warning')
            return
            
        try:
            env = os.environ.copy()
            env['DATA_DIR'] = str(DATA_DIR)
            env['SUPABASE_URL'] = SUPABASE_URL
            
            creationflags = 0
            if os.name == 'nt':
                creationflags = subprocess.CREATE_NO_WINDOW
                
            log_path = DATA_DIR / 'whatsapp-node.log'
            self.log_file = open(log_path, 'a')
            
            self.process = subprocess.Popen(
                [str(exe_path)],
                env=env,
                creationflags=creationflags,
                stdout=self.log_file,
                stderr=subprocess.STDOUT,
                cwd=str(DATA_DIR)
            )
            log_to_ui('WhatsApp node started silently.', 'info')
        except Exception as exc:
            log_to_ui('Failed to start WhatsApp node: {0}'.format(exc), 'error')

    def _monitor_loop(self):
        while not IS_QUITTING and not self._stop_monitor.is_set():
            time.sleep(5)
            if self.process and self.process.poll() is not None:
                log_to_ui('WhatsApp node crashed. Restarting...', 'warning')
                self._start_process()

    def stop(self):
        self._stop_monitor.set()
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=3)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            self.process = None
            if hasattr(self, 'log_file') and self.log_file:
                try: self.log_file.close()
                except: pass
            log_to_ui('WhatsApp node stopped.', 'info')

WA_NODE_MANAGER = WhatsappNodeManager()

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


def set_windows_app_id():
    if sys.platform != 'win32':
        return
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(WINDOWS_APP_ID)
    except Exception:
        pass

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

def as_bool(value):
    if isinstance(value, str):
        return value.strip().lower() in ('1', 'true', 'yes', 'on')
    return bool(value)

def now_local_string():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

def parse_iso(value):
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            return value.astimezone().replace(tzinfo=None)
        return value.replace(tzinfo=None)
    if not value:
        return datetime.min
    if isinstance(value, str):
        cleaned = value.replace('Z', '+00:00')
        try:
            parsed = datetime.fromisoformat(cleaned)
            if parsed.tzinfo is not None:
                return parsed.astimezone().replace(tzinfo=None)
            return parsed
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
    payload = json.dumps({'message': message, 'type': msg_type}, ensure_ascii=True)
    post_js("if (window.onPythonLog) window.onPythonLog(" + payload + ");")

def notify_sync_state():
    post_js("if (window.onSyncStateChanged) window.onSyncStateChanged(" + json.dumps(IS_SYNCING) + ");")

def notify_sync_completed(time_str):
    post_js("if (window.onSyncCompleted) window.onSyncCompleted(" + json.dumps(time_str) + ");")

def set_auto_start(enabled):
    set_setting('autoStart', bool(enabled))
    if sys.platform != 'win32':
        return
    try:
        import winreg
    except Exception:
        return
    run_key = r'Software\Microsoft\Windows\CurrentVersion\Run'
    app_name = APP_TITLE
    if getattr(sys, 'frozen', False):
        cmd = '"{0}" --hidden'.format(sys.executable)
    else:
        script = Path(__file__).resolve()
        cmd = '"{0}" "{1}" --hidden'.format(sys.executable, script)
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
    log_to_ui('Auto sync started (every {0} minutes).'.format(get_setting('syncInterval', 5)), 'success')
    update_tray_menu()
    notify_sync_state()


def stop_sync():
    global IS_SYNCING
    if not IS_SYNCING:
        return

    IS_SYNCING = False
    SYNC_STOP_EVENT.set()
    log_to_ui('Sync stopped.', 'warning')
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

    if not settings.get('licenseKey'):
        log_to_ui('Error: license key is required.', 'error')
        return

    if not settings.get('deviceIp'):
        log_to_ui('Error: device IP is required.', 'error')
        return

    device_type = str(settings.get('deviceType', 'zkteco')).lower()
    log_to_ui('----------------------------------------', 'info')
    brand = 'Hikvision' if device_type == 'hikvision' else 'ZKTeco'
    log_to_ui('Starting sync cycle ({0})...'.format(brand), 'info')

    try:
        log_to_ui('Validating license...', 'info')
        resp = SUPABASE.rpc('check_subscription', {'p_license_key': settings['licenseKey']}).execute()
        if getattr(resp, 'error', None):
            raise Exception(resp.error.message)

        data = getattr(resp, 'data', None)
        if data and data.get('active'):
            log_to_ui('License verified: {0}'.format(data.get('company_name', 'Company')), 'success')
            if data.get('force_full_sync'):
                log_to_ui('Force full sync command detected from dashboard. Resetting watermark...', 'warning')
                last_sync_key = 'lastSyncIso_{0}'.format(settings['licenseKey'])
                set_setting(last_sync_key, '2000-01-01T00:00:00.000Z')
                # Reload settings to ensure subsequent sync logic uses the reset watermark
                settings = load_settings()
        else:
            log_to_ui('License is not active: {0}'.format(data.get('message') if data else 'Unknown reason'), 'error')
            return
    except Exception as exc:
        log_to_ui('License check failed: {0}'.format(exc), 'error')
        return

    if device_type == 'hikvision':
        _sync_hikvision_mode(settings)
    else:
        _sync_zkteco_mode(settings)


def _sync_zkteco_mode(settings):
    if ZK is None:
        log_to_ui('pyzk is not installed. Run: pip install pyzk', 'error')
        return

    conn = None
    try:
        ip = settings.get('deviceIp')
        port = int(settings.get('devicePort') or 4370)
        sn = settings.get('deviceSn') or ip

        log_to_ui('Connecting to ZKTeco {0}:{1}...'.format(ip, port), 'info')
        zk = ZK(ip, port=port, timeout=10)
        conn = zk.connect()
        conn.disable_device()
        log_to_ui('Connected to ZKTeco.', 'success')

        log_to_ui('Reading attendance logs...', 'info')
        attendances = conn.get_attendance() or []
        if not attendances:
            log_to_ui('No attendance logs on device.', 'info')
            send_telemetry(settings, ping_ok=True)
            return

        license_key = settings.get('licenseKey')
        last_sync_key = 'lastSyncIso_{0}'.format(license_key)
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
                uid = (
                    getattr(att, 'user_id', None)
                    or getattr(att, 'device_user_id', None)
                    or getattr(att, 'pin', None)
                    or getattr(att, 'uid', None)
                )
                new_logs.append({'pin': str(uid), 'time': ts.isoformat(), 'status': '0'})
                if ts > latest_date:
                    latest_date = ts

        log_to_ui('{0} new records found.'.format(len(new_logs)), 'info')
        if new_logs:
            total = _sync_batches(license_key, sn, new_logs)
            log_to_ui('Synced {0} ZKTeco records successfully.'.format(total), 'success')
            now = now_local_string()
            set_setting(last_sync_key, latest_date.isoformat())
            set_setting('lastSyncTime', now)
            notify_sync_completed(now)
        else:
            send_telemetry(settings, ping_ok=True)
    except Exception as exc:
        log_to_ui('ZKTeco sync error: {0}'.format(exc), 'error')
        send_telemetry(settings, ping_ok=False, error_msg=str(exc))
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
        log_to_ui('Device connection closed.', 'info')


def _sync_hikvision_mode(settings):
    if not HIKVISION_AVAILABLE:
        log_to_ui('hikvision_connector.py is missing.', 'error')
        return

    hik = None
    try:
        ip = settings.get('deviceIp')
        port = int(settings.get('hikPort') or settings.get('devicePort') or 80)
        username = settings.get('hikUsername') or 'admin'
        password = settings.get('hikPassword') or ''
        use_https = as_bool(settings.get('hikHttps', False))
        sn = settings.get('deviceSn') or ip

        log_to_ui('Connecting to Hikvision {0}:{1} ({2})...'.format(ip, port, 'HTTPS' if use_https else 'HTTP'), 'info')

        hik = HikvisionConnector(
            ip=ip,
            port=port,
            username=username,
            password=password,
            use_https=use_https,
        )

        info = hik.test_connection()
        model = info.get('model') or 'Unknown model'
        sn = info.get('serial_number') or sn
        log_to_ui('Connected to Hikvision: {0} | S/N: {1}'.format(model, sn), 'success')

        license_key = settings.get('licenseKey')
        last_sync_key = 'lastSyncIso_{0}'.format(license_key)
        last_date = parse_iso(get_setting(last_sync_key, '2000-01-01T00:00:00.000Z'))

        log_to_ui('Fetching logs since {0}...'.format(last_date.strftime('%Y-%m-%d %H:%M')), 'info')
        new_logs = hik.get_attendance_logs(since=last_date)

        log_to_ui('{0} new Hikvision records found.'.format(len(new_logs)), 'info')
        if new_logs:
            latest_date = max(parse_iso(l['time']) for l in new_logs)
            total = _sync_batches(license_key, sn, new_logs)
            log_to_ui('Synced {0} Hikvision records successfully.'.format(total), 'success')
            now = now_local_string()
            set_setting(last_sync_key, latest_date.isoformat())
            set_setting('lastSyncTime', now)
            notify_sync_completed(now)
        else:
            send_telemetry(settings, ping_ok=True)

    except (ConnectionError, TimeoutError, PermissionError, RuntimeError) as exc:
        log_to_ui('Hikvision error: {0}'.format(exc), 'error')
        send_telemetry(settings, ping_ok=False, error_msg=str(exc))
    except Exception as exc:
        log_to_ui('Unexpected Hikvision error: {0}'.format(exc), 'error')
        send_telemetry(settings, ping_ok=False, error_msg=str(exc))
    finally:
        if hik:
            hik.disconnect()
        log_to_ui('Hikvision connection closed.', 'info')


def _sync_batches(license_key, device_sn, logs):
    total_inserted = 0
    batch_size = 500
    for i in range(0, len(logs), batch_size):
        batch = logs[i:i + batch_size]
        log_to_ui('Uploading batch ({0} records)...'.format(len(batch)), 'info')
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


def send_telemetry(settings, ping_ok=True, error_msg=None):
    try:
        if ping_ok:
            log_to_ui('Sending heartbeat...', 'info')
        else:
            log_to_ui('Reporting connection failure...', 'warning')

        # Fallback to sync_attendance if telemetry fails (backward compatibility)
        try:
            SUPABASE.rpc('update_sync_telemetry', {
                'p_license_key': settings['licenseKey'],
                'p_device_sn': settings.get('deviceSn'),
                'p_ping_status': ping_ok,
                'p_service_version': '1.1.2',
                'p_error_msg': error_msg
            }).execute()
        except Exception:
            # If the new RPC is not yet created on the backend, at least try old heartbeat
            if ping_ok:
                SUPABASE.rpc('sync_attendance', {
                    'p_license_key': settings['licenseKey'],
                    'p_device_sn': settings.get('deviceSn'),
                    'p_logs': []
                }).execute()

        now = now_local_string()
        set_setting('lastSyncTime', now)
        notify_sync_completed(now)
        if ping_ok:
            log_to_ui('Heartbeat sent successfully.', 'success')
    except Exception as exc:
        log_to_ui('Telemetry update failed: {0}'.format(exc), 'error')


class Api:
    def get_settings(self):
        return {
            'licenseKey': get_setting('licenseKey', ''),
            'deviceIp': get_setting('deviceIp', '192.168.1.201'),
            'deviceSn': get_setting('deviceSn', ''),
            'syncInterval': get_setting('syncInterval', 5),
            'autoStart': get_setting('autoStart', False),
            'deviceType': get_setting('deviceType', 'zkteco'),
            'devicePort': get_setting('devicePort', 4370),
            'hikPort': get_setting('hikPort', 80),
            'hikUsername': get_setting('hikUsername', 'admin'),
            'hikPassword': get_setting('hikPassword', ''),
            'hikHttps': as_bool(get_setting('hikHttps', False)),
            'language': get_setting('language', 'ar'),
        }

    def save_settings(self, settings):
        normalized = dict(settings or {})
        for int_field, default in [('devicePort', 4370), ('hikPort', 80), ('syncInterval', 5)]:
            if int_field in normalized:
                try:
                    normalized[int_field] = int(normalized[int_field])
                except Exception:
                    normalized[int_field] = default

        if 'hikHttps' in normalized:
            value = normalized['hikHttps']
            if isinstance(value, str):
                normalized['hikHttps'] = as_bool(value)
            else:
                normalized['hikHttps'] = as_bool(value)

        set_multi(normalized)
        log_to_ui('Settings saved successfully.', 'success')
        return True

    def test_hikvision_connection(self):
        if not HIKVISION_AVAILABLE:
            return {'success': False, 'message': 'hikvision_connector.py is missing'}

        settings = load_settings()
        ip = settings.get('deviceIp', '')
        port = int(settings.get('hikPort') or 80)
        username = settings.get('hikUsername') or 'admin'
        password = settings.get('hikPassword') or ''
        use_https = as_bool(settings.get('hikHttps', False))

        if not ip:
            return {'success': False, 'message': 'Device IP is required'}

        try:
            hik = HikvisionConnector(
                ip=ip,
                port=port,
                username=username,
                password=password,
                use_https=use_https,
            )
            info = hik.test_connection()
            hik.disconnect()
            msg = 'Connection successful - {0} | S/N: {1} | FW: {2}'.format(
                info.get('model', '?'),
                info.get('serial_number', '?'),
                info.get('firmware', '?'),
            )
            log_to_ui(msg, 'success')
            return {'success': True, 'message': msg, 'info': info}
        except Exception as exc:
            log_to_ui('Hikvision connection failed: {0}'.format(exc), 'error')
            return {'success': False, 'message': str(exc)}

    def get_status(self):
        return {
            'isSyncing': IS_SYNCING,
            'lastSync': get_setting('lastSyncTime', 'No sync yet'),
        }

    def set_language(self, language):
        language = 'ar' if str(language).lower() == 'ar' else 'en'
        set_setting('language', language)
        return language

    def set_auto_start(self, enabled):
        set_auto_start(enabled)
        log_to_ui('Auto-start enabled.' if enabled else 'Auto-start disabled.', 'success' if enabled else 'info')
        return bool(enabled)

    def get_auto_start(self):
        return get_auto_start()

    def verify_license(self, license_key):
        try:
            resp = SUPABASE.rpc('check_subscription', {'p_license_key': license_key}).execute()
            if getattr(resp, 'error', None):
                raise Exception(resp.error.message)

            data = getattr(resp, 'data', None)
            if data and data.get('active'):
                log_to_ui('Supabase connection verified.', 'success')
                return {'valid': True, 'companyName': data.get('company_name')}

            message = data.get('message') if data else 'Invalid key'
            log_to_ui('License verification failed: {0}'.format(message), 'error')
            return {'valid': False, 'message': message}
        except Exception as exc:
            log_to_ui('Supabase connection failed: {0}'.format(exc), 'error')
            return {'valid': False, 'message': str(exc)}

    def start_sync(self):
        start_sync()
        return IS_SYNCING

    def stop_sync(self):
        stop_sync()
        return IS_SYNCING

    def force_sync(self):
        perform_sync()
        return get_setting('lastSyncTime', 'No sync yet')

    def reset_sync_for_license(self):
        license_key = get_setting('licenseKey')
        if not license_key:
            return False

        last_sync_key = 'lastSyncIso_{0}'.format(license_key)
        set_setting(last_sync_key, '2000-01-01T00:00:00.000Z')
        log_to_ui('Sync watermark reset for this license.', 'success')
        return True


def update_tray_menu():
    if not TRAY_ICON or not pystray:
        return

    status_label = 'Sync Active' if IS_SYNCING else 'Stopped'
    toggle_label = 'Stop Sync' if IS_SYNCING else 'Start Sync'

    TRAY_ICON.menu = pystray.Menu(
        pystray.MenuItem('KWADER Sync', None, enabled=False),
        pystray.MenuItem(status_label, None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem('Show Window', lambda: show_window()),
        pystray.MenuItem('Sync Now', lambda: run_in_thread(perform_sync)),
        pystray.MenuItem(toggle_label, lambda: toggle_sync_from_tray()),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem('Exit', lambda: quit_app()),
    )
    TRAY_ICON.update_menu()

def toggle_sync_from_tray():
    if IS_SYNCING: stop_sync()
    else: start_sync()

def run_in_thread(func):
    threading.Thread(target=func, daemon=True).start()

def show_window():
    if MAIN_WINDOW:
        MAIN_WINDOW.show()
        MAIN_WINDOW.restore()

def hide_window():
    if MAIN_WINDOW: MAIN_WINDOW.hide()

def quit_app():
    global IS_QUITTING
    IS_QUITTING = True
    stop_sync()
    WA_NODE_MANAGER.stop()
    if TRAY_ICON:
        try: TRAY_ICON.stop()
        except Exception: pass
    if MAIN_WINDOW: MAIN_WINDOW.destroy()

def on_loaded(*_):
    WINDOW_READY.set()
    flush_pending_js()

def on_closing(*_):
    if IS_QUITTING: return True
    hide_window()
    return False

def create_default_icon_image():
    try:
        from PIL import ImageDraw
        img = Image.new('RGBA', (64, 64), color=(0, 102, 204, 255))
        draw = ImageDraw.Draw(img)
        draw.rectangle([16, 16, 48, 48], fill=(255, 255, 255, 255))
        return img
    except Exception:
        return Image.new('RGB', (64, 64), color='blue')

def create_tray():
    global TRAY_ICON
    if not pystray or not Image: return
    
    image = None
    try:
        icon_path = WEB_DIR / 'assets' / 'icon.png'
        if icon_path.exists():
            image = Image.open(icon_path)
            image = image.resize((64, 64), Image.Resampling.LANCZOS)
        else:
            image = create_default_icon_image()
    except Exception as e:
        print("Failed to load custom tray icon: {0}".format(e))
        image = create_default_icon_image()

    if image is None:
        image = create_default_icon_image()

    try:
        TRAY_ICON = pystray.Icon('kwader-sync', image, APP_TITLE)
        update_tray_menu()
        TRAY_ICON.run_detached()
    except Exception as e:
        print("Failed to start system tray icon: {0}".format(e))

def main():
    set_windows_app_id()
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
        WA_NODE_MANAGER.start()
        if get_setting('autoStart', False):
            threading.Timer(3, start_sync).start()
    webview.start(
        gui='edgechromium',
        debug=False,
        func=on_app_ready,
        private_mode=True,
    )

if __name__ == '__main__':
    main()
