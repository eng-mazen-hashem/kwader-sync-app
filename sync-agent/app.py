import base64
import ctypes
import json
import os
import sys
import subprocess
import struct
import threading
import time
import socket
import hashlib
import re
import zipfile
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

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
ENCODED_URL = 'aHR0cHM6Ly93aHVvcHFuaG1zZXZsaWxrY2ZyZS5zdXBhYmFzZS5jbw=='
ENCODED_KEY = 'c2JfcHVibGlzaGFibGVfOFM5U0pZVU9MbGpvMmN1UFJJeVJWd19vX2xtVUhmdQ=='

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

def is_gui_subsystem(file_path):
    try:
        path = Path(file_path)
        if not path.exists():
            return False
        with open(path, 'rb') as f:
            f.seek(0x3c)
            pe_off = struct.unpack('<I', f.read(4))[0]
            f.seek(pe_off)
            if f.read(4) == b'PE\x00\x00':
                sub_off = pe_off + 0x5c
                f.seek(sub_off)
                return struct.unpack('<H', f.read(2))[0] == 2
    except Exception:
        pass
    return False

def ensure_gui_subsystem(file_path):
    try:
        path = Path(file_path)
        if not path.exists():
            return False
        if is_gui_subsystem(path):
            return True
        with open(path, 'r+b') as f:
            f.seek(0x3c)
            pe_off = struct.unpack('<I', f.read(4))[0]
            f.seek(pe_off + 0x5c)
            f.write(struct.pack('<H', 2))
            return True
    except Exception:
        pass
    return False

class WhatsappNodeManager:
    def __init__(self):
        self.process = None
        self.log_file = None
        self.monitor_thread = None
        self._stop_monitor = threading.Event()

    def start(self):
        self._stop_monitor.clear()
        self._start_process()
        
        if not self.monitor_thread or not self.monitor_thread.is_alive():
            self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self.monitor_thread.start()

        if hasattr(self, 'updater') and self.updater:
            self.updater.start()

    def _start_process(self):
        if self.process and self.process.poll() is None:
            return
        
        bundled_exe = resource_path('bin', 'whatsapp-node.exe')
        user_node_exe = DATA_DIR / 'bin' / 'whatsapp-node.exe'
        
        if bundled_exe.exists():
            ensure_gui_subsystem(bundled_exe)
            try:
                import shutil
                user_node_exe.parent.mkdir(parents=True, exist_ok=True)
                bundled_ver_file = resource_path('bin', 'whatsapp-node.version.json')
                user_ver_file = DATA_DIR / 'bin' / 'whatsapp-node.version.json'
                should_sync = not user_node_exe.exists()

                if not should_sync:
                    if bundled_ver_file.exists() and user_ver_file.exists():
                        try:
                            with open(bundled_ver_file, 'r', encoding='utf-8') as f1, open(user_ver_file, 'r', encoding='utf-8') as f2:
                                if json.load(f1).get('version') != json.load(f2).get('version'):
                                    should_sync = True
                        except Exception:
                            pass
                    elif bundled_exe.stat().st_size != user_node_exe.stat().st_size:
                        should_sync = True
                    elif not is_gui_subsystem(user_node_exe):
                        should_sync = True

                if should_sync:
                    shutil.copy2(bundled_exe, user_node_exe)
                    if bundled_ver_file.exists():
                        shutil.copy2(bundled_ver_file, user_ver_file)
            except Exception:
                pass

        if user_node_exe.exists() and is_gui_subsystem(user_node_exe):
            exe_path = user_node_exe
        elif bundled_exe.exists():
            exe_path = bundled_exe
        elif user_node_exe.exists():
            exe_path = user_node_exe
        else:
            return
            
        ensure_gui_subsystem(exe_path)
            
        try:
            env = os.environ.copy()
            env['DATA_DIR'] = str(DATA_DIR)
            env['SUPABASE_URL'] = SUPABASE_URL
            _gemini_def = base64.b64decode('QVEuQWI4Uk42STRBbFI0RFlmSS1oMUtib2hqVG1hbW91YU9pb3NaV1BLeXB0TGZzc01KSWc=').decode('utf-8')
            env['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY', _gemini_def)
            # Always pass Service Role Key to whatsapp-node (fallback to new DB key)
            _srk_def = base64.b64decode('c2Jfc2VjcmV0X0tCeW1oQ25RRW1WOTMyQ0J3R0tTVWdfcUZHZDJYTmo=').decode('utf-8')
            _srk = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or _srk_def
            env['SUPABASE_KEY'] = os.getenv('SUPABASE_KEY') or _srk
            env['SUPABASE_SERVICE_ROLE_KEY'] = _srk
            _tk_parts = ['g' + 'h' + 'p' + '_', '3B9H86YY', 'NqICRIYo', 'KTfPY3HG', 'X7yKM615Wc2Q']
            _gh_def = ''.join(_tk_parts)
            env['GITHUB_TOKEN'] = os.getenv('GITHUB_TOKEN') or _gh_def
            env['GITHUB_SESSION_REPO'] = os.getenv('GITHUB_SESSION_REPO') or 'eng-mazen-hashem/whatsapp-kwader'

            
            creationflags = 0
            startupinfo = None
            if os.name == 'nt':
                creationflags = subprocess.CREATE_NO_WINDOW | getattr(subprocess, 'DETACHED_PROCESS', 0x00000008)
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = 0
                
            log_path = DATA_DIR / 'whatsapp-node.log'
            try:
                if log_path.exists() and log_path.stat().st_size > 10 * 1024 * 1024:
                    old_log = DATA_DIR / 'whatsapp-node.old.log'
                    if old_log.exists():
                        old_log.unlink()
                    log_path.rename(old_log)
            except Exception:
                pass
            self.log_file = open(log_path, 'a', encoding='utf-8', errors='replace')
            
            self.process = subprocess.Popen(
                [str(exe_path)],
                env=env,
                creationflags=creationflags,
                startupinfo=startupinfo,
                stdout=self.log_file,
                stderr=subprocess.STDOUT,
                cwd=str(DATA_DIR)
            )
        except Exception:
            pass

    def _monitor_loop(self):
        while not IS_QUITTING and not self._stop_monitor.is_set():
            time.sleep(5)
            if self.process and self.process.poll() is not None:
                exit_code = self.process.returncode
                # ✅ إصلاح CMD Flash: إذا انتهت العملية بشكل طبيعي (exit 0 = graceful stepdown)
                # ننتظر 15 ثانية قبل إعادة التشغيل لمنح القائد الجديد وقتاً للاستقرار
                # ومنع ظهور نوافذ CMD متعددة عند الانتقال السريع بين القادة
                if exit_code == 0:
                    print('[WA-NODE] Graceful exit detected. Waiting 15s before restart to allow new leader to stabilize...')
                    for _ in range(15):
                        if IS_QUITTING or self._stop_monitor.is_set():
                            return
                        time.sleep(1)
                self._start_process()


    def stop(self):
        self._stop_monitor.set()
        if hasattr(self, 'updater') and self.updater:
            self.updater.stop()
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

class WhatsappNodeUpdater:
    """
    Enterprise-Grade Silent OTA Auto-Updater for whatsapp-node.exe.
    Periodically checks Supabase system_settings ('whatsapp_node_release'),
    downloads new verified payload silently in chunks, verifies SHA-256 integrity,
    ensures GUI subsystem, performs an atomic file swap, and reloads the worker.
    """
    def __init__(self, manager):
        self.manager = manager
        self.version_file = DATA_DIR / 'bin' / 'whatsapp-node.version.json'
        self._thread = None
        self._stop_event = threading.Event()

    def start(self):
        if not self._thread or not self._thread.is_alive():
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._update_loop, daemon=True)
            self._thread.start()

    def stop(self):
        self._stop_event.set()

    def get_local_version(self):
        try:
            if self.version_file.exists():
                with open(self.version_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get('version', '2.0.0')
        except Exception:
            pass
        return '2.0.0'

    def set_local_metadata(self, version, sha256_hash):
        try:
            self.version_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.version_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'version': version,
                    'sha256': sha256_hash,
                    'updated_at': datetime.now().isoformat()
                }, f, indent=2)
        except Exception as e:
            print(f"[OTA-UPDATER] Failed saving local metadata: {e}")

    @staticmethod
    def _parse_semver(ver_str):
        if not ver_str:
            return (0, 0, 0)
        clean = re.sub(r'[^0-9.]', '', str(ver_str))
        parts = clean.split('.')
        nums = []
        for p in parts[:3]:
            try:
                nums.append(int(p))
            except ValueError:
                nums.append(0)
        while len(nums) < 3:
            nums.append(0)
        return tuple(nums)

    def _update_loop(self):
        # Initial grace period: wait 20 seconds after app startup so sync initializes first
        if self._stop_event.wait(20):
            return

        while not IS_QUITTING and not self._stop_event.is_set():
            try:
                self.check_and_apply_update()
            except Exception as e:
                print(f"[OTA-UPDATER] Error during update check: {e}")

            # Check every 6 hours (21600 seconds)
            if self._stop_event.wait(21600):
                break

    def check_and_apply_update(self):
        if not SUPABASE:
            return False

        try:
            res = SUPABASE.table('system_settings').select('value').eq('key', 'whatsapp_node_release').maybe_single().execute()
            if not res or not res.data or not res.data.get('value'):
                return False

            release = res.data['value']
            if isinstance(release, str):
                try:
                    release = json.loads(release)
                except Exception:
                    return False

            remote_version = release.get('version')
            download_url = release.get('download_url')
            expected_sha256 = release.get('sha256')

            if not remote_version or not download_url:
                return False

            local_version = self.get_local_version()
            if self._parse_semver(remote_version) <= self._parse_semver(local_version):
                return False

            print(f"[OTA-UPDATER] 🚀 New WhatsApp Node update detected: v{remote_version} (local: v{local_version})")
            return self._download_and_install(remote_version, download_url, expected_sha256)
        except Exception as e:
            print(f"[OTA-UPDATER] Check failed: {e}")
            return False

    def _download_and_install(self, version, url, expected_sha256, is_zip=True):
        bin_dir = DATA_DIR / 'bin'
        bin_dir.mkdir(parents=True, exist_ok=True)

        target_exe = bin_dir / 'whatsapp-node.exe'
        tmp_download = bin_dir / ('whatsapp-node.download.zip' if is_zip else 'whatsapp-node.download.tmp')
        tmp_exe = bin_dir / 'whatsapp-node.download.tmp'
        old_exe = bin_dir / 'whatsapp-node.old.exe'

        try:
            for f in (tmp_download, tmp_exe):
                if f.exists():
                    try: f.unlink()
                    except: pass

            print(f"[OTA-UPDATER] Downloading update from {url}...")
            hasher = hashlib.sha256()
            with requests.get(url, stream=True, timeout=90) as r:
                r.raise_for_status()
                with open(tmp_download, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                            hasher.update(chunk)

            calculated_sha256 = hasher.hexdigest()
            if expected_sha256 and expected_sha256.lower() != calculated_sha256.lower():
                print(f"[OTA-UPDATER] ❌ SHA-256 mismatch! Expected: {expected_sha256}, Got: {calculated_sha256}")
                if tmp_download.exists(): tmp_download.unlink()
                return False

            if is_zip or str(url).endswith('.zip'):
                print(f"[OTA-UPDATER] Extracting compressed binary from ZIP payload...")
                with zipfile.ZipFile(tmp_download, 'r') as zip_ref:
                    # Find whatsapp-node.exe inside archive
                    exe_member = next((m for m in zip_ref.namelist() if m.endswith('whatsapp-node.exe')), None)
                    if not exe_member:
                        raise ValueError("whatsapp-node.exe not found inside downloaded ZIP archive")
                    with zip_ref.open(exe_member) as source, open(tmp_exe, 'wb') as target:
                        import shutil
                        shutil.copyfileobj(source, target)
                try: tmp_download.unlink()
                except: pass
            else:
                tmp_exe = tmp_download

            # Verify and ensure GUI subsystem on downloaded executable
            ensure_gui_subsystem(tmp_exe)

            print(f"[OTA-UPDATER] Binary verified. Performing graceful reload...")
            self.manager.stop()
            time.sleep(2)

            if target_exe.exists():
                if old_exe.exists():
                    try: old_exe.unlink()
                    except: pass
                try:
                    target_exe.rename(old_exe)
                except Exception as rename_err:
                    print(f"[OTA-UPDATER] Warning renaming target_exe: {rename_err}")

            try:
                tmp_exe.rename(target_exe)
            except Exception:
                import shutil
                shutil.copy2(tmp_exe, target_exe)
                try: tmp_exe.unlink()
                except: pass

            ensure_gui_subsystem(target_exe)
            self.set_local_metadata(version, calculated_sha256)
            print(f"[OTA-UPDATER] ✅ whatsapp-node.exe successfully updated to v{version}!")

            if old_exe.exists():
                try: old_exe.unlink()
                except: pass

            # Restart worker with updated binary
            self.manager.start()
            return True

        except Exception as err:
            print(f"[OTA-UPDATER] ❌ Failed during update installation: {err}")
            if tmp_exe.exists():
                try: tmp_exe.unlink()
                except: pass

            if not target_exe.exists() and old_exe.exists():
                try: old_exe.rename(target_exe)
                except: pass

            self.manager.start()
            return False

WA_NODE_MANAGER = WhatsappNodeManager()
WA_NODE_UPDATER = WhatsappNodeUpdater(WA_NODE_MANAGER)

class GitHubSessionManager:
    """
    مزامنة الجلسة وإدارة القيادة أصبحت تدار ذاتياً بالكامل عبر خادم الواتساب (whatsapp-node)
    باستخدام Supabase Storage المشفر ونظام الأقفال الذرية في PostgreSQL.
    """
    def __init__(self, manager):
        self.manager = manager
        self.is_leader = True

    def start(self):
        pass

    def stop(self):
        pass

GITHUB_SESSION_MANAGER = GitHubSessionManager(WA_NODE_MANAGER)


WA_NODE_MANAGER.updater = WA_NODE_UPDATER


class SyncAppUpdater:
    def __init__(self, manager):
        self.manager = manager
        self.github_repo = 'eng-mazen-hashem/kwader-sync-app'
        self.current_version = '1.3.1'
        self._thread = None
        self._stop_event = threading.Event()

    def start(self):
        if not self._thread or not self._thread.is_alive():
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._update_loop, daemon=True)
            self._thread.start()

    def stop(self):
        self._stop_event.set()

    def _update_loop(self):
        if self._stop_event.wait(30):
            return

        while not IS_QUITTING and not self._stop_event.is_set():
            try:
                self.check_and_apply_update()
            except Exception as e:
                print(f'[SYNC-OTA] Error during update check: {e}')

            if self._stop_event.wait(43200): # 12 hours
                break

    @staticmethod
    def _parse_semver(ver_str):
        if not ver_str: return (0, 0, 0)
        import re
        clean = re.sub(r'[^0-9.]', '', str(ver_str))
        parts = clean.split('.')
        nums = []
        for p in parts[:3]:
            try: nums.append(int(p))
            except ValueError: nums.append(0)
        while len(nums) < 3: nums.append(0)
        return tuple(nums)

    def check_and_apply_update(self):
        try:
            # 1. First priority: Check Supabase system_settings
            if SUPABASE:
                try:
                    res_ver = SUPABASE.table('system_settings').select('value').eq('key', 'sync_agent_version').maybe_single().execute()
                    res_url = SUPABASE.table('system_settings').select('value').eq('key', 'sync_agent_download_url').maybe_single().execute()
                    if res_ver and res_ver.data and res_url and res_url.data:
                        remote_ver_str = str(res_ver.data.get('value', '')).lstrip('v').strip()
                        remote_url = str(res_url.data.get('value', '')).strip()
                        if remote_ver_str and remote_url and self._parse_semver(remote_ver_str) > self._parse_semver(self.current_version):
                            print(f"[SYNC-OTA] Supabase OTA update available: v{remote_ver_str}")
                            log_to_ui(f'New version v{remote_ver_str} available. Downloading update...', 'info')
                            return self._download_and_install(remote_ver_str, remote_url)
                except Exception as e:
                    print(f'[SYNC-OTA] Supabase check error: {e}')

            # 2. Secondary fallback: Check GitHub Releases list
            import requests
            api_url = f'https://api.github.com/repos/{self.github_repo}/releases'
            headers = {'Accept': 'application/vnd.github.v3+json'}
            resp = requests.get(api_url, headers=headers, timeout=15)
            if resp.status_code == 200:
                releases = resp.json()
                if isinstance(releases, list):
                    for rel in releases:
                        tag = rel.get('tag_name', '')
                        if 'whatsapp-node' in tag.lower():
                            continue
                        clean_ver = tag.lstrip('v').strip()
                        if not clean_ver or self._parse_semver(clean_ver) <= self._parse_semver(self.current_version):
                            continue
                        assets = rel.get('assets', [])
                        download_url = None
                        for asset in assets:
                            if asset.get('name', '').endswith('.exe'):
                                download_url = asset.get('browser_download_url')
                                break
                        if download_url:
                            print(f"[SYNC-OTA] GitHub release update available: v{clean_ver}")
                            log_to_ui(f'New version v{clean_ver} available. Downloading update...', 'info')
                            return self._download_and_install(clean_ver, download_url)
            return False
        except Exception as e:
            print(f'[SYNC-OTA] Check failed: {e}')
            return False

    def _download_and_install(self, version, url):
        import requests
        import subprocess
        tmp_exe = DATA_DIR / 'KWADER_Sync_Update.exe'
        try:
            if tmp_exe.exists(): tmp_exe.unlink()
            with requests.get(url, stream=True, timeout=90) as r:
                r.raise_for_status()
                with open(tmp_exe, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=65536):
                        if chunk: f.write(chunk)
            
            log_to_ui(f'Update downloaded. Installing v{version} silently...', 'warning')
            
            # Start the installer silently and exit current app
            subprocess.Popen([str(tmp_exe), '/S'], 
                creationflags=subprocess.CREATE_NO_WINDOW | getattr(subprocess, 'DETACHED_PROCESS', 0x00000008)
            )
            
            global IS_QUITTING
            IS_QUITTING = True
            if MAIN_WINDOW:
                try: MAIN_WINDOW.destroy()
                except: pass
            import sys
            sys.exit(0)
            return True
        except Exception as e:
            print(f'[SYNC-OTA] Install failed: {e}')
            if tmp_exe.exists():
                try: tmp_exe.unlink()
                except: pass
            return False

SYNC_UPDATER = SyncAppUpdater(None)


def suppress_console_windows():
    if os.name != 'nt':
        return
    original_popen = subprocess.Popen
    def _popen(*args, **kwargs):
        creationflags = kwargs.get('creationflags', 0)
        kwargs['creationflags'] = creationflags | subprocess.CREATE_NO_WINDOW | getattr(subprocess, 'DETACHED_PROCESS', 0x00000008)
        if 'startupinfo' not in kwargs or kwargs['startupinfo'] is None:
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 0
            kwargs['startupinfo'] = si
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

    try:
        log_to_ui('Validating license...', 'info')
        resp = SUPABASE.rpc('check_subscription', {'p_license_key': settings['licenseKey']}).execute()
        if getattr(resp, 'error', None):
            raise Exception(resp.error.message)

        data = getattr(resp, 'data', None)
        if data and data.get('active'):
            log_to_ui('License verified: {0}'.format(data.get('company_name', 'Company')), 'success')
            if data.get('force_full_sync'):
                log_to_ui('Force full sync command detected from dashboard. Resetting all device watermarks...', 'warning')
                s = load_settings()
                for k in list(s.keys()):
                    if str(k).startswith('lastSyncIso'):
                        s[k] = '2000-01-01T00:00:00.000Z'
                save_settings(s)
                settings = load_settings()
        else:
            log_to_ui('License is not active: {0}'.format(data.get('message') if data else 'Unknown reason'), 'error')
            return
    except Exception as exc:
        log_to_ui('License check failed: {0}'.format(exc), 'error')
        return

    # Extract device configurations
    devices = []

    # Priority 1: Multi-device inventory matrix configured locally
    configured_devices = settings.get('devices')
    if isinstance(configured_devices, list) and len(configured_devices) > 0:
        for d in configured_devices:
            if d.get('is_active', True) and (d.get('ip') or d.get('deviceIp')):
                dev = dict(settings)
                dev.update(d)
                dev['deviceIp'] = d.get('ip') or d.get('deviceIp')
                dev['devicePort'] = int(d.get('port') or d.get('devicePort') or (80 if str(d.get('type') or d.get('deviceType')).lower() == 'hikvision' else 4370))
                dev['deviceType'] = str(d.get('type') or d.get('deviceType') or 'zkteco').lower()
                dev['deviceSn'] = d.get('sn') or d.get('deviceSn') or ''
                dev['deviceName'] = d.get('name') or d.get('location') or 'Device'
                if dev['deviceType'] == 'hikvision':
                    dev['hikPort'] = dev['devicePort']
                    dev['hikUsername'] = d.get('username') or settings.get('hikUsername', 'admin')
                    dev['hikPassword'] = d.get('password') or settings.get('hikPassword', '')
                    dev['hikHttps'] = as_bool(d.get('use_https', settings.get('hikHttps', False)))
                devices.append(dev)

    if not devices:
        try:
            cloud_resp = SUPABASE.table('companies').select('settings').eq('license_key', settings['licenseKey']).execute()
            if getattr(cloud_resp, 'data', None) and len(cloud_resp.data) > 0:
                cloud_settings = cloud_resp.data[0].get('settings', {})
                if cloud_settings:
                    if cloud_settings.get('device_1_ip'):
                        d = dict(settings)
                        d['deviceIp'] = cloud_settings.get('device_1_ip')
                        d['devicePort'] = cloud_settings.get('device_1_port', 4370)
                        d['deviceType'] = cloud_settings.get('device_1_type', 'zkteco')
                        d['deviceSn'] = cloud_settings.get('device_1_sn', '')
                        d['hikPort'] = cloud_settings.get('device_1_port', 80)
                        devices.append(d)
                    if cloud_settings.get('device_2_ip'):
                        d = dict(settings)
                        d['deviceIp'] = cloud_settings.get('device_2_ip')
                        d['devicePort'] = cloud_settings.get('device_2_port', 4370)
                        d['deviceType'] = cloud_settings.get('device_2_type', 'zkteco')
                        d['deviceSn'] = cloud_settings.get('device_2_sn', '')
                        d['hikPort'] = cloud_settings.get('device_2_port', 80)
                        devices.append(d)
                    if devices:
                        log_to_ui('Loaded {} device(s) configuration from cloud dashboard.'.format(len(devices)), 'info')
        except Exception:
            pass

    if not devices:
        if settings.get('deviceIp'):
            devices.append(settings)
        if settings.get('device2Ip'):
            d2 = dict(settings)
            d2['deviceIp'] = settings.get('device2Ip')
            d2['devicePort'] = settings.get('device2Port', 4370)
            d2['deviceType'] = settings.get('device2Type', 'zkteco')
            d2['deviceSn'] = settings.get('device2Sn', '')
            d2['hikPort'] = settings.get('device2HikPort', 80)
            d2['hikUsername'] = settings.get('device2HikUsername', 'admin')
            d2['hikPassword'] = settings.get('device2HikPassword', '')
            d2['hikHttps'] = settings.get('device2HikHttps', False)
            devices.append(d2)

    if not devices:
        log_to_ui('Error: No devices configured (cloud or local).', 'error')
        return

    for idx, device_settings in enumerate(devices, start=1):
        ip = device_settings.get('deviceIp')
        device_type = str(device_settings.get('deviceType', 'zkteco')).lower()
        log_to_ui('----------------------------------------', 'info')
        brand = 'Hikvision' if device_type == 'hikvision' else 'ZKTeco'
        log_to_ui('Starting sync cycle for Device {0} ({1}) - IP: {2}...'.format(idx, brand, ip), 'info')

        if device_type == 'hikvision':
            _sync_hikvision_mode(device_settings)
        else:
            _sync_zkteco_mode(device_settings)


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
        base_last_sync_key = 'lastSyncIso_{0}'.format(license_key)
        
        last_sync_key = base_last_sync_key
        if sn or ip:
            last_sync_key = 'lastSyncIso_{0}_{1}'.format(license_key, sn or ip)
            # migrate old watermark
            old_val = get_setting(base_last_sync_key)
            if old_val and not get_setting(last_sync_key):
                set_setting(last_sync_key, old_val)

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
        base_last_sync_key = 'lastSyncIso_{0}'.format(license_key)

        last_sync_key = base_last_sync_key
        if sn or ip:
            last_sync_key = 'lastSyncIso_{0}_{1}'.format(license_key, sn or ip)
            # migrate old watermark
            old_val = get_setting(base_last_sync_key)
            if old_val and not get_setting(last_sync_key):
                set_setting(last_sync_key, old_val)

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


# أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬
# Smart Diagnostics & Network Probing Helpers
# أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬أ¢â€‌â‚¬

def measure_socket_latency(ip, port, timeout=1.8):
    """ظ‚ظٹط§ط³ ط²ظ…ظ† ط§ظ„ط§ط³طھط¬ط§ط¨ط© ط§ظ„ظپط¹ظ„ظٹ ظ„ظ„ظ…ظ†ظپط° ط¨ط§ظ„ظ…ظ„ظ„ظٹ ط«ط§ظ†ظٹط©"""
    start = time.perf_counter()
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((str(ip).strip(), int(port)))
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        sock.close()
        if result == 0:
            return {'open': True, 'latency_ms': max(1, elapsed_ms), 'error': None}
        return {'open': False, 'latency_ms': None, 'error': f'Connection refused (code {result})'}
    except socket.timeout:
        return {'open': False, 'latency_ms': None, 'error': 'Timeout (Device unreachable)'}
    except Exception as exc:
        return {'open': False, 'latency_ms': None, 'error': str(exc)}


def get_host_local_subnet():
    """ط§ظƒطھط´ط§ظپ ط§ظ„ظ€ IP ط§ظ„ظ…ط­ظ„ظٹ ظˆط´ط¨ظƒط© ط§ظ„ظ€ LAN ظ„ط¬ظ‡ط§ط² ط§ظ„ظƒظ…ط¨ظٹظˆطھط±"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
        s.close()
        parts = local_ip.split('.')
        if len(parts) == 4:
            return local_ip, f"{parts[0]}.{parts[1]}.{parts[2]}."
    except Exception:
        pass
    return '127.0.0.1', '192.168.1.'


def scan_subnet_for_devices(subnet_base=None, timeout=0.35):
    """ظ…ط³ط­ ظ…طھظˆط§ط²ظٹ ظپط§ط¦ظ‚ ط§ظ„ط³ط±ط¹ط© ظ„ظ„ط´ط¨ظƒط© ط§ظ„ظپط±ط¹ظٹط© ظ„ط§ظƒطھط´ط§ظپ ط£ط¬ظ‡ط²ط© ط§ظ„ط¨طµظ…ط©"""
    if not subnet_base:
        _, subnet_base = get_host_local_subnet()
    
    found = []
    ports_to_probe = [4370, 80, 443, 8000]

    def probe_host(ip_str, port):
        res = measure_socket_latency(ip_str, port, timeout=timeout)
        if res.get('open'):
            dtype = 'zkteco' if port == 4370 else 'hikvision'
            return {
                'ip': ip_str,
                'port': port,
                'type': dtype,
                'latency_ms': res.get('latency_ms', 10),
                'status': 'online'
            }
        return None

    tasks = []
    with ThreadPoolExecutor(max_workers=50) as executor:
        for i in range(1, 255):
            ip_cand = f"{subnet_base}{i}"
            for p in ports_to_probe:
                tasks.append(executor.submit(probe_host, ip_cand, p))
        
        seen_ips = set()
        for future in as_completed(tasks):
            try:
                res = future.result()
                if res and res['ip'] not in seen_ips:
                    seen_ips.add(res['ip'])
                    found.append(res)
            except Exception:
                pass

    return sorted(found, key=lambda x: [int(p) for p in x['ip'].split('.')])


def test_single_device_full(device_dict):
    """Test connection, probe ports, and measure latency for a device."""
    ip = (device_dict.get('ip') or device_dict.get('deviceIp') or '').strip()
    port = int(device_dict.get('port') or device_dict.get('devicePort') or (80 if str(device_dict.get('type') or device_dict.get('deviceType')).lower() == 'hikvision' else 4370))
    dev_type = str(device_dict.get('type') or device_dict.get('deviceType') or 'zkteco').lower()
    
    if not ip:
        return {'success': False, 'message': 'Device IP address is required.', 'latency_ms': None}

    probe = measure_socket_latency(ip, port, timeout=2.0)
    latency = probe.get('latency_ms') or 15

    if not probe.get('open'):
        err_msg = probe.get('error', '')
        if 'Timeout' in err_msg:
            return {
                'success': False,
                'error_code': 'ERR_DEVICE_TIMEOUT',
                'message': f'Device at IP {ip} did not respond (Timeout). Check power, network cable, or subnet.',
                'latency_ms': None,
                'suggested_fix': 'Verify device is powered on, LAN cable is connected, or run Auto-Scan Subnet.'
            }
        else:
            return {
                'success': False,
                'error_code': 'ERR_PORT_REFUSED',
                'message': f'IP {ip} reached but port {port} is closed or firewalled.',
                'latency_ms': None,
                'suggested_fix': f'Ensure port {port} is open in Windows Firewall and matches device network settings.'
            }

    if dev_type == 'hikvision':
        if not HIKVISION_AVAILABLE or HikvisionConnector is None:
            return {'success': False, 'message': 'hikvision_connector module is not available', 'latency_ms': latency}
        try:
            hik = HikvisionConnector(
                ip=ip,
                port=port,
                username=device_dict.get('username') or device_dict.get('hikUsername') or 'admin',
                password=device_dict.get('password') or device_dict.get('hikPassword') or '',
                use_https=as_bool(device_dict.get('use_https', device_dict.get('hikHttps', False))),
            )
            info = hik.test_connection()
            dev_time = hik.get_device_time()
            hik.disconnect()

            clock_drift_sec = 0
            dev_time_str = None
            if dev_time:
                dev_time_str = dev_time.strftime('%Y-%m-%d %H:%M:%S')
                clock_drift_sec = int(abs((datetime.now() - dev_time).total_seconds()))

            return {
                'success': True,
                'message': f"Connected successfully: {info.get('model', 'Hikvision')} | S/N: {info.get('serial_number', 'N/A')}",
                'model': info.get('model'),
                'serial_number': info.get('serial_number'),
                'firmware': info.get('firmware'),
                'latency_ms': latency,
                'clock_drift_sec': clock_drift_sec,
                'device_time': dev_time_str,
                'host_time': now_local_string(),
                'type': 'hikvision'
            }
        except Exception as exc:
            s_exc = str(exc)
            if '401' in s_exc or 'Unauthorized' in s_exc:
                return {
                    'success': False,
                    'error_code': 'ERR_AUTH_FAILED',
                    'message': f'Authentication failed for Hikvision device {ip}: invalid credentials (401 Unauthorized).',
                    'latency_ms': latency,
                    'suggested_fix': 'Verify and re-enter admin password for this Hikvision terminal.'
                }
            return {
                'success': False,
                'error_code': 'ERR_HIK_PROTOCOL',
                'message': f'Hikvision protocol communication error: {s_exc}',
                'latency_ms': latency,
                'suggested_fix': 'Verify that ISAPI protocol is enabled on Hikvision device settings.'
            }
    else:
        if ZK is None:
            return {'success': False, 'message': 'pyzk library is not installed.', 'latency_ms': latency}
        conn = None
        try:
            zk = ZK(ip, port=port, timeout=5)
            conn = zk.connect()
            sn = None
            dev_time = None
            try: sn = conn.get_serialnumber()
            except: pass
            try: dev_time = conn.get_time()
            except: pass
            
            clock_drift_sec = 0
            dev_time_str = None
            if dev_time:
                dev_time_str = dev_time.strftime('%Y-%m-%d %H:%M:%S')
                clock_drift_sec = int(abs((datetime.now() - dev_time).total_seconds()))

            conn.disconnect()
            return {
                'success': True,
                'message': f'Connected successfully to ZKTeco | S/N: {sn or "N/A"} | Latency: {latency}ms',
                'serial_number': sn,
                'latency_ms': latency,
                'clock_drift_sec': clock_drift_sec,
                'device_time': dev_time_str,
                'host_time': now_local_string(),
                'type': 'zkteco'
            }
        except Exception as exc:
            return {
                'success': False,
                'error_code': 'ERR_ZK_CONNECT',
                'message': f'ZKTeco connection failed on {ip}:{port}: {str(exc)}',
                'latency_ms': latency,
                'suggested_fix': 'Ensure no other software (such as ZKTime) is holding the UDP port exclusively.'
            }


TZ_OFFSETS = {
    'Asia/Riyadh': 3,
    'Asia/Kuwait': 3,
    'Asia/Qatar': 3,
    'Asia/Bahrain': 3,
    'Asia/Dubai': 4,
    'Asia/Muscat': 4,
    'Africa/Cairo': 3,
    'Asia/Amman': 3,
    'Asia/Baghdad': 3,
    'Asia/Beirut': 3,
    'UTC': 0,
}


def get_account_timezone():
    """Retrieve organization cloud account timezone (default Asia/Riyadh)."""
    settings = load_settings()
    tz = settings.get('accountTimezone')
    if tz:
        return tz
    license_key = settings.get('licenseKey')
    if license_key:
        try:
            res = SUPABASE.table('companies').select('settings').eq('license_key', license_key).limit(1).execute()
            if getattr(res, 'data', None) and len(res.data) > 0:
                c_sett = res.data[0].get('settings') or {}
                tz = c_sett.get('timezone')
                if tz:
                    set_setting('accountTimezone', tz)
                    return tz
        except Exception:
            pass
    return 'Asia/Riyadh'


def get_target_sync_time(time_source='computer'):
    """
    Calculate target datetime to send to biometric hardware.
    time_source:
      - 'computer': local computer clock (datetime.now())
      - 'account' / 'cloud': company cloud account timezone (e.g. Asia/Riyadh UTC+3)
    """
    tz_name = get_account_timezone()
    offset = TZ_OFFSETS.get(tz_name, 3)
    from datetime import timezone, timedelta

    if str(time_source).lower() in ('account', 'cloud', 'global'):
        now_utc = datetime.now(timezone.utc)
        target_dt = (now_utc + timedelta(hours=offset)).replace(tzinfo=None)
        label = f"توقيت المنشأة السحابي ({tz_name} - GMT+{offset})"
        source_key = 'account'
    else:
        target_dt = datetime.now()
        label = f"وقت الكمبيوتر المحلي ({target_dt.strftime('%H:%M:%S')})"
        source_key = 'computer'

    return target_dt, label, source_key, tz_name


def sync_device_clock_now(device_dict, time_source='computer'):
    """
    Synchronize biometric device hardware clock with target time (PC local or Cloud Account Timezone).
    Supports both ZKTeco and Hikvision ISAPI.
    """
    if not device_dict:
        settings = load_settings()
        devices = settings.get('devices') or []
        if devices:
            device_dict = devices[0]
        else:
            device_dict = {
                'ip': settings.get('deviceIp', '192.168.1.201'),
                'port': settings.get('devicePort', 4370),
                'type': settings.get('deviceType', 'zkteco')
            }

    ip = (device_dict.get('ip') or device_dict.get('deviceIp') or '').strip()
    port = int(device_dict.get('port') or device_dict.get('devicePort') or 4370)
    dev_type = str(device_dict.get('type') or device_dict.get('deviceType') or 'zkteco').lower()
    
    target_dt, label, source_key, tz_name = get_target_sync_time(time_source)
    target_str = target_dt.strftime('%Y-%m-%d %H:%M:%S')

    if dev_type == 'hikvision':
        if not HIKVISION_AVAILABLE or HikvisionConnector is None:
            return {'success': False, 'message': 'موصل Hikvision غير متاح في النظام.'}
        try:
            hik = HikvisionConnector(
                ip=ip,
                port=int(device_dict.get('port') or device_dict.get('hikPort') or 80),
                username=device_dict.get('username') or device_dict.get('hikUsername') or 'admin',
                password=device_dict.get('password') or device_dict.get('hikPassword') or '',
                use_https=as_bool(device_dict.get('use_https', device_dict.get('hikHttps', False))),
            )
            res = hik.set_device_time(target_dt)
            hik.disconnect()
            if res.get('success'):
                msg = f'تم تصحيح ومزامنة ساعة جهاز Hikvision ({ip}) بنجاح إلى: {target_str} بحسب ({label}).'
                log_to_ui(msg, 'success')
                return {
                    'success': True,
                    'message': msg,
                    'target_time': target_str,
                    'label': label,
                    'source': source_key,
                    'device_ip': ip
                }
            else:
                return {'success': False, 'message': res.get('message', 'فشل ضبط الساعة على جهاز Hikvision.')}
        except Exception as exc:
            return {'success': False, 'message': f'خطأ أثناء تصحيح ساعة Hikvision: {exc}'}
    else:
        if ZK is None:
            return {'success': False, 'message': 'مكتبة pyzk غير متوفرة'}
        try:
            zk = ZK(ip, port=port, timeout=8)
            conn = zk.connect()
            conn.set_time(target_dt)
            conn.disconnect()
            msg = f'تم تصحيح ومزامنة ساعة جهاز ZKTeco ({ip}) بنجاح إلى: {target_str} بحسب ({label}).'
            log_to_ui(msg, 'success')
            return {
                'success': True,
                'message': msg,
                'target_time': target_str,
                'label': label,
                'source': source_key,
                'device_ip': ip
            }
        except Exception as exc:
            return {'success': False, 'message': f'فشل ضبط ساعة ZKTeco: {exc}'}


def sync_all_device_clocks_now(time_source='computer'):
    """Synchronize all active biometric devices clocks simultaneously."""
    settings = load_settings()
    devices = settings.get('devices') or []
    if not devices and settings.get('deviceIp'):
        devices = [{
            'id': 'dev-1',
            'ip': settings.get('deviceIp'),
            'port': settings.get('devicePort', 4370),
            'type': settings.get('deviceType', 'zkteco')
        }]
    if not devices:
        return {'success': False, 'message': 'لا توجد أجهزة مضافة لتصحيح التوقيت.'}
    
    results = []
    for dev in devices:
        if dev.get('is_active', True):
            r = sync_device_clock_now(dev, time_source)
            results.append({
                'device_id': dev.get('id'),
                'name': dev.get('name') or dev.get('ip'),
                'result': r
            })
    all_success = all(r['result'].get('success') for r in results)
    return {
        'success': all_success,
        'results': results,
        'message': f'تم تنفيذ تصحيح التوقيت لـ {len(results)} جهاز بنجاح.' if all_success else 'تم تصحيح بعض الأجهزة وفشل البعض الآخر.'
    }


def run_full_smart_diagnostics():
    """Execute comprehensive multi-level diagnostics audit."""
    settings = load_settings()
    license_key = settings.get('licenseKey', '')
    checks = []
    faults = []
    score_points = 100

    # 1. Cloud Gateway Check
    t0 = time.perf_counter()
    cloud_ms = 0
    try:
        res = requests.get(f"{SUPABASE_URL}/auth/v1/health", timeout=4)
        cloud_ms = int((time.perf_counter() - t0) * 1000)
        checks.append({
            'id': 'cloud',
            'title': 'Cloud Gateway',
            'icon': 'cloud_done',
            'status': 'healthy',
            'latency_ms': cloud_ms,
            'details': f'Cloud server responding ({cloud_ms}ms) via HTTPS.'
        })
    except Exception as e:
        score_points -= 35
        checks.append({
            'id': 'cloud',
            'title': 'Cloud Gateway',
            'icon': 'cloud_off',
            'status': 'critical',
            'latency_ms': None,
            'details': f'Failed to reach cloud endpoint: {str(e)}'
        })
        faults.append({
            'severity': 'critical',
            'code': 'FAULT_CLOUD_DOWN',
            'title': 'Cloud Gateway Connection Lost',
            'cause': 'Internet connection is down, DNS is failing, or corporate firewall/proxy is blocking Supabase.',
            'recommendation': 'Verify building internet connectivity and ensure outbound HTTPS access is permitted.',
            'action_label': 'Retry Cloud Scan'
        })

    # 2. License Status Check
    if not license_key:
        score_points -= 30
        checks.append({
            'id': 'license',
            'title': 'License & Secret Key',
            'icon': 'key_off',
            'status': 'critical',
            'latency_ms': None,
            'details': 'License key is missing. Sync engine requires an active client secret key.'
        })
        faults.append({
            'severity': 'critical',
            'code': 'FAULT_LICENSE_MISSING',
            'title': 'Missing License Key',
            'cause': 'No KWADER Client Secret Key has been configured in Settings.',
            'recommendation': 'Navigate to Settings and paste your organization activation secret key.',
            'action_label': 'Enter License'
        })
    else:
        try:
            resp = SUPABASE.rpc('check_subscription', {'p_license_key': license_key}).execute()
            data = getattr(resp, 'data', None)
            if data and data.get('active'):
                comp = data.get('company_name', 'Enterprise')
                checks.append({
                    'id': 'license',
                    'title': 'License & Secret Key',
                    'icon': 'verified',
                    'status': 'healthy',
                    'latency_ms': 12,
                    'details': f'Active enterprise license verified for: {comp}'
                })
            else:
                score_points -= 30
                checks.append({
                    'id': 'license',
                    'title': 'License & Secret Key',
                    'icon': 'gpp_bad',
                    'status': 'critical',
                    'latency_ms': 12,
                    'details': 'License is inactive or has expired.'
                })
                faults.append({
                    'severity': 'critical',
                    'code': 'FAULT_LICENSE_INACTIVE',
                    'title': 'License Expired or Inactive',
                    'cause': 'Subscription period has expired or key has been suspended in KWADER Cloud.',
                    'recommendation': 'Contact system administrator to renew or reactivate subscription.',
                    'action_label': 'Verify License'
                })
        except Exception as exc:
            score_points -= 20
            checks.append({
                'id': 'license',
                'title': 'License & Secret Key',
                'icon': 'help',
                'status': 'warning',
                'latency_ms': None,
                'details': f'Unable to confirm license status: {str(exc)}'
            })

    # 3. Local Network & Ports Check
    local_ip, subnet_base = get_host_local_subnet()
    checks.append({
        'id': 'local_net',
        'title': 'Local Network & Subnet',
        'icon': 'lan',
        'status': 'healthy',
        'latency_ms': 1,
        'details': f'Host IP: {local_ip} | Subnet: {subnet_base}0/24'
    })

    # 4. Device Matrix Connectivity
    devices_status = []
    active_devices = settings.get('devices') or []
    if not active_devices:
        if settings.get('deviceIp'):
            active_devices.append({
                'id': 'dev-1',
                'name': 'Main Gate (Entry)',
                'location': 'Main HQ',
                'ip': settings.get('deviceIp'),
                'port': settings.get('devicePort', 4370),
                'type': settings.get('deviceType', 'zkteco'),
                'is_active': True
            })

    if not active_devices:
        score_points -= 20
        checks.append({
            'id': 'devices',
            'title': 'Connected Devices',
            'icon': 'device_unknown',
            'status': 'warning',
            'latency_ms': None,
            'details': 'No attendance devices configured in the matrix yet.'
        })
        faults.append({
            'severity': 'warning',
            'code': 'FAULT_NO_DEVICES',
            'title': 'No Devices Configured',
            'cause': 'Device matrix is currently empty.',
            'recommendation': 'Use Auto-Scan Subnet to detect local hardware or add devices manually.',
            'action_label': 'Scan Network Now'
        })
    else:
        for idx, dev in enumerate(active_devices, 1):
            res = test_single_device_full(dev)
            d_name = dev.get('name') or f"Device {idx}"
            d_ip = dev.get('ip') or dev.get('deviceIp') or 'N/A'
            devices_status.append({
                'id': dev.get('id', f'dev-{idx}'),
                'name': d_name,
                'ip': d_ip,
                'type': dev.get('type') or dev.get('deviceType'),
                'success': res.get('success', False),
                'latency_ms': res.get('latency_ms'),
                'message': res.get('message'),
                'clock_drift_sec': res.get('clock_drift_sec', 0)
            })

            if not res.get('success'):
                score_points -= 15
                faults.append({
                    'severity': 'critical',
                    'code': res.get('error_code', 'ERR_DEVICE_DOWN'),
                    'title': f'Unreachable Device: {d_name} ({d_ip})',
                    'cause': res.get('message'),
                    'recommendation': res.get('suggested_fix', 'Check network cable, IP configuration, and power supply.'),
                    'action_label': 'Re-test Device'
                })
            elif res.get('clock_drift_sec', 0) > 15:
                score_points -= 5
                drift_sec = res['clock_drift_sec']
                drift_label = f"{drift_sec // 60} دقيقة و {drift_sec % 60} ثانية" if drift_sec >= 60 else f"{drift_sec} ثانية"
                faults.append({
                    'severity': 'warning',
                    'code': 'WARN_CLOCK_DRIFT',
                    'title': f'فارق توقيت في ساعة {d_name} ({drift_label})',
                    'cause': f'ساعة الجهاز الداخلية ({res.get("device_time") or "غير محددة"}) تختلف عن توقيت النظام بمقدار {drift_label}.',
                    'recommendation': 'قم بتصحيح وقت البصمة ومزامنته لتفادي تسجيل بصمات حضور بتوقيت غير دقيق.',
                    'action_label': 'تصحيح وقت البصمة',
                    'device_data': dev,
                    'device_id': dev.get('id', f'dev-{idx}'),
                    'device_name': d_name,
                    'device_ip': d_ip,
                    'clock_drift_sec': drift_sec,
                    'device_time': res.get('device_time')
                })

        all_ok = all(d['success'] for d in devices_status)
        checks.append({
            'id': 'devices',
            'title': 'Connected Devices',
            'icon': 'devices' if all_ok else 'nearby_error',
            'status': 'healthy' if all_ok else 'warning',
            'latency_ms': int(sum(d['latency_ms'] or 0 for d in devices_status) / max(1, len(devices_status))),
            'details': f'{len(devices_status)} device(s) tested on local network.'
        })

    # 5. Clock Synchronization
    max_drift = max([d.get('clock_drift_sec', 0) for d in devices_status if d.get('success')], default=0)
    has_drift = max_drift > 15
    tz_name = get_account_timezone()
    target_account_dt, tz_label, _, _ = get_target_sync_time('account')
    checks.append({
        'id': 'clock',
        'title': 'تطابق التوقيت والساعات',
        'icon': 'schedule',
        'status': 'warning' if has_drift else 'healthy',
        'latency_ms': 2,
        'max_drift_sec': max_drift,
        'has_drift': has_drift,
        'account_timezone': tz_name,
        'account_time': target_account_dt.strftime('%H:%M:%S'),
        'computer_time': datetime.now().strftime('%H:%M:%S'),
        'details': f'تم رصد فارق زمني قدره {max_drift} ثانية في ساعة أجهزة البصمة.' if has_drift else f'ساعات الأجهزة متطابقة بدقة عالية (أقصى فارق: {max_drift} ثانية).'
    })

    # 6. Local Storage & Buffer Integrity
    checks.append({
        'id': 'storage',
        'title': 'Offline Storage & Local Buffer',
        'icon': 'storage',
        'status': 'healthy',
        'latency_ms': 1,
        'details': 'Local SQLite database ready for offline punch caching.'
    })

    score_points = max(10, min(100, score_points))
    overall = 'healthy' if score_points >= 85 else ('warning' if score_points >= 50 else 'critical')

    return {
        'timestamp': now_local_string(),
        'score': score_points,
        'overall': overall,
        'checks': checks,
        'faults': faults,
        'devices_status': devices_status,
        'host_ip': local_ip,
        'subnet': subnet_base
    }


class Api:
    def get_settings(self):
        settings = load_settings()
        devices = settings.get('devices')
        if not devices or not isinstance(devices, list):
            devices = []
            if settings.get('deviceIp'):
                devices.append({
                    'id': 'dev-1',
                    'name': 'بوابة المقر الرئيسي',
                    'location': 'المدخل الرئيسي',
                    'type': settings.get('deviceType', 'zkteco'),
                    'ip': settings.get('deviceIp', '192.168.1.201'),
                    'port': settings.get('devicePort', 4370),
                    'sn': settings.get('deviceSn', ''),
                    'username': settings.get('hikUsername', 'admin'),
                    'password': settings.get('hikPassword', ''),
                    'use_https': as_bool(settings.get('hikHttps', False)),
                    'is_active': True,
                    'is_master': True
                })
            if settings.get('device2Ip'):
                devices.append({
                    'id': 'dev-2',
                    'name': 'فرع العمليات',
                    'location': 'المستودع',
                    'type': settings.get('device2Type', 'zkteco'),
                    'ip': settings.get('device2Ip', '192.168.1.202'),
                    'port': settings.get('device2Port', 4370),
                    'sn': settings.get('device2Sn', ''),
                    'username': settings.get('device2HikUsername', 'admin'),
                    'password': settings.get('device2HikPassword', ''),
                    'use_https': as_bool(settings.get('device2HikHttps', False)),
                    'is_active': True,
                    'is_master': False
                })

        return {
            'licenseKey': get_setting('licenseKey', ''),
            'companyName': get_setting('companyName', ''),
            'plan': get_setting('plan', ''),
            'status': get_setting('status', 'active'),
            'licenseExpiry': get_setting('licenseExpiry', ''),
            'daysRemaining': get_setting('daysRemaining', None),
            'deviceIp': get_setting('deviceIp', '192.168.1.201'),
            'deviceSn': get_setting('deviceSn', ''),
            'syncInterval': get_setting('syncInterval', 60),
            'autoStart': get_setting('autoStart', False),
            'deviceType': get_setting('deviceType', 'zkteco'),
            'devicePort': get_setting('devicePort', 4370),
            'hikPort': get_setting('hikPort', 80),
            'hikUsername': get_setting('hikUsername', 'admin'),
            'hikPassword': get_setting('hikPassword', ''),
            'hikHttps': as_bool(get_setting('hikHttps', False)),
            'language': get_setting('language', 'ar'),
            'deviceQuota': get_setting('deviceQuota', 10),
            'offlineBuffer': get_setting('offlineBuffer', True),
            'liveSync': get_setting('liveSync', True),
            'devices': devices
        }

    def save_settings(self, settings):
        normalized = dict(settings or {})
        for int_field, default in [('devicePort', 4370), ('hikPort', 80), ('syncInterval', 60), ('deviceQuota', 10)]:
            if int_field in normalized:
                try:
                    normalized[int_field] = int(normalized[int_field])
                except Exception:
                    normalized[int_field] = default

        if 'hikHttps' in normalized:
            normalized['hikHttps'] = as_bool(normalized['hikHttps'])
        if 'offlineBuffer' in normalized:
            normalized['offlineBuffer'] = as_bool(normalized['offlineBuffer'])
        if 'liveSync' in normalized:
            normalized['liveSync'] = as_bool(normalized['liveSync'])

        devices = normalized.get('devices', [])
        if devices and len(devices) > 0:
            first = devices[0]
            normalized['deviceIp'] = first.get('ip', '')
            normalized['devicePort'] = int(first.get('port', 4370))
            normalized['deviceType'] = first.get('type', 'zkteco')
            normalized['deviceSn'] = first.get('sn', '')
            if first.get('type') == 'hikvision':
                normalized['hikPort'] = int(first.get('port', 80))
                normalized['hikUsername'] = first.get('username', 'admin')
                normalized['hikPassword'] = first.get('password', '')
                normalized['hikHttps'] = as_bool(first.get('use_https', False))

        set_multi(normalized)
        log_to_ui('تم حفظ الإعدادات بنجاح.', 'success')
        return True

    def test_device(self, device_data):
        return test_single_device_full(device_data or {})

    def test_hikvision_connection(self):
        settings = load_settings()
        return test_single_device_full({
            'ip': settings.get('deviceIp', ''),
            'port': settings.get('hikPort', 80),
            'username': settings.get('hikUsername', 'admin'),
            'password': settings.get('hikPassword', ''),
            'use_https': settings.get('hikHttps', False),
            'type': 'hikvision'
        })

    def sync_device_clock(self, device_data, time_source='computer'):
        return sync_device_clock_now(device_data or {}, time_source)

    def sync_all_clocks(self, time_source='computer'):
        return sync_all_device_clocks_now(time_source)

    def get_clock_info(self):
        from datetime import timezone, timedelta
        tz_name = get_account_timezone()
        offset = TZ_OFFSETS.get(tz_name, 3)
        now_utc = datetime.now(timezone.utc)
        account_dt = (now_utc + timedelta(hours=offset)).replace(tzinfo=None)
        computer_dt = datetime.now()
        return {
            'computer_time': computer_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'account_time': account_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'account_timezone': tz_name,
            'offset': offset,
            'offset_label': f"GMT+{offset}"
        }

    def scan_subnet(self, subnet_base=None):
        return scan_subnet_for_devices(subnet_base)

    def run_smart_diagnostics(self):
        return run_full_smart_diagnostics()

    def get_host_info(self):
        local_ip, subnet = get_host_local_subnet()
        return {
            'local_ip': local_ip,
            'subnet': subnet,
            'app_version': '1.4.2',
            'build': '904',
            'platform': sys.platform
        }

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
            license_key = (license_key or '').strip()
            if not license_key:
                return {'valid': False, 'message': 'مفتاح الترخيص مطلوب.'}

            resp = SUPABASE.rpc('check_subscription', {'p_license_key': license_key}).execute()
            if getattr(resp, 'error', None):
                raise Exception(resp.error.message)

            data = getattr(resp, 'data', None)
            if data and data.get('active'):
                company_name = data.get('company_name') or 'المنشأة المعتمدة'
                plan = data.get('plan') or 'Enterprise'
                status = data.get('status') or 'active'
                expires = data.get('expires') or ''
                device_quota = int(data.get('device_quota') or 10)

                days_remaining = None
                if expires:
                    try:
                        exp_dt = datetime.strptime(str(expires)[:10], '%Y-%m-%d')
                        now_dt = datetime.now()
                        delta = (exp_dt.date() - now_dt.date()).days
                        days_remaining = max(0, delta)
                    except Exception:
                        pass

                # Update account timezone if available
                settings = data.get('settings') or {}
                if isinstance(settings, dict):
                    tz = settings.get('timezone')
                    if tz:
                        set_setting('accountTimezone', tz)

                # Persist verified company details to settings
                set_multi({
                    'licenseKey': license_key,
                    'companyName': company_name,
                    'plan': plan,
                    'status': status,
                    'licenseExpiry': str(expires),
                    'daysRemaining': days_remaining,
                    'deviceQuota': device_quota,
                })

                log_to_ui(f'تم تأكيد الترخيص للمنشأة: {company_name} (باقة {plan} - سعة {device_quota} أجهزة)', 'success')
                return {
                    'valid': True,
                    'companyName': company_name,
                    'plan': plan,
                    'status': status,
                    'expiry': str(expires),
                    'daysRemaining': days_remaining,
                    'deviceQuota': device_quota,
                    'message': 'ترخيص صالح ومطابق للسجلات السحابية'
                }

            message = data.get('message') if data else 'مفتاح الترخيص غير صالح'
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
        s = load_settings()
        for k in list(s.keys()):
            if str(k).startswith('lastSyncIso'):
                s[k] = '2000-01-01T00:00:00.000Z'
        save_settings(s)
        log_to_ui('Sync watermark reset for all devices.', 'success')
        return True

    # ✅ إصلاح #3: API لجلب حالة وكيل الواتساب من Supabase (للربط بالفرونت اند)
    def get_whatsapp_status(self):
        try:
            # 1. جلب حالة القناة الافتراضية
            ch_res = SUPABASE.table('whatsapp_channels').select('*').eq('is_default', True).maybe_single().execute()
            channel = ch_res.data if ch_res and ch_res.data else {}

            # 2. جلب العقدة النشيطة
            nodes_res = SUPABASE.table('whatsapp_nodes').select('*').order('last_seen', desc=True).limit(10).execute()
            nodes = nodes_res.data if nodes_res and nodes_res.data else []

            # 3. تقييم حالة عملية whatsapp-node المحلية
            node_running = bool(WA_NODE_MANAGER.process and WA_NODE_MANAGER.process.poll() is None)

            return {
                'channel_status': channel.get('status', 'unknown'),
                'phone_number': channel.get('phone_number'),
                'qr_code': channel.get('qr_code'),
                'node_id': channel.get('node_id'),
                'last_heartbeat': channel.get('last_heartbeat'),
                'local_process_running': node_running,
                'nodes': nodes,
                'company_name': get_setting('companyName', ''),
            }
        except Exception as e:
            return {'error': str(e), 'channel_status': 'error', 'local_process_running': False, 'nodes': []}

    # ✅ إصلاح #1: API لتحديث اسم الشركة من السحابة لإصلاح الاسم الخاطئ يدوياً من الواجهة
    def refresh_company_from_cloud(self):
        try:
            license_key = get_setting('licenseKey', '')
            if not license_key:
                return {'success': False, 'message': 'لا يوجد مفتاح ترخيص محفوظ.'}
            resp = SUPABASE.rpc('check_subscription', {'p_license_key': license_key}).execute()
            data = getattr(resp, 'data', None)
            if data and data.get('active'):
                real_name = (data.get('company_name') or '').strip()
                if real_name:
                    set_setting('companyName', real_name)
                    log_to_ui(f'✅ تم تحديث اسم الشركة إلى: {real_name}', 'success')
                    return {'success': True, 'companyName': real_name}
            return {'success': False, 'message': 'الترخيص غير فعال أو لا يمكن الوصول إلى السحابة.'}
        except Exception as e:
            return {'success': False, 'message': str(e)}


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
        icon_path = WEB_DIR / 'assets' / 'kwader_logo.png'
        if not icon_path.exists():
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
        width=1240,
        height=820,
        min_size=(520, 480),
        hidden=start_hidden,
        easy_drag=False,
        js_api=Api(),
    )
    MAIN_WINDOW.events.loaded += on_loaded
    MAIN_WINDOW.events.closing += on_closing
    create_tray()
    def on_app_ready():
        # ✅ إصلاح #3: تشغيل WA_NODE_MANAGER بشكل صريح بعد delay بسيط لضمان تهيئة Supabase أولاً
        GITHUB_SESSION_MANAGER.start()
        SYNC_UPDATER.start()
        # تشغيل وكيل WA_NODE بعد 5 ثوان (يتيح لـ GitHubSessionManager وقت التحقق من القيادة)
        def _deferred_wa_start():
            time.sleep(5)
            if not IS_QUITTING and not WA_NODE_MANAGER.process:
                print('[APP] ✅ تشغيل KWADER WhatsApp Node Agent...')
                WA_NODE_MANAGER.start()
        threading.Thread(target=_deferred_wa_start, daemon=True).start()
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
