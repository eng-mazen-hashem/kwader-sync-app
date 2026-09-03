"""
KWADER Desktop Pro — Sync Engine (محرك مزامنة أجهزة البصمة)
يدعم: ZKTeco (pyzk) + Hikvision (ISAPI)
البيانات تُخزَّن محلياً في SQLite أولاً، ثم تُرفع للسحابة اختيارياً.
"""
import threading
import time
import json
from datetime import datetime
from typing import Optional, Callable, Dict, List

from core import db

try:
    from zk import ZK
except Exception:
    ZK = None

try:
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from hikvision_connector import HikvisionConnector
    HIKVISION_AVAILABLE = True
except Exception:
    HikvisionConnector = None
    HIKVISION_AVAILABLE = False


# ─────────────────────────────────────────────────────────────
# State
# ─────────────────────────────────────────────────────────────

_sync_threads: Dict[int, threading.Thread] = {}
_sync_stop_events: Dict[int, threading.Event] = {}
_sync_status: Dict[int, Dict] = {}  # {device_id: {is_syncing, last_sync, last_error}}
_log_callback: Optional[Callable] = None


def set_log_callback(fn: Callable):
    """تسجيل دالة لإرسال الرسائل للواجهة"""
    global _log_callback
    _log_callback = fn


def _log(message: str, level: str = 'info', device_id: int = None):
    prefix = f"[جهاز#{device_id}] " if device_id else ""
    full_msg = f"{prefix}{message}"
    if _log_callback:
        try:
            _log_callback(full_msg, level)
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────
# Auto Sync (per device)
# ─────────────────────────────────────────────────────────────

def start_device_sync(device_id: int, on_complete: Callable = None) -> bool:
    """بدء المزامنة التلقائية لجهاز محدد"""
    if device_id in _sync_threads and _sync_threads[device_id].is_alive():
        return False  # المزامنة تعمل بالفعل

    stop_event = threading.Event()
    _sync_stop_events[device_id] = stop_event
    _sync_status[device_id] = {'is_syncing': True, 'last_sync': None, 'last_error': None}

    device = db.get_device(device_id)
    if not device:
        return False

    interval_min = int(device.get('sync_interval_min', 5) or 5)

    def runner():
        _log(f"بدء المزامنة التلقائية كل {interval_min} دقائق", 'success', device_id)
        while not stop_event.is_set():
            _sync_device_inner(device_id, on_complete)
            for _ in range(max(1, interval_min * 60)):
                if stop_event.is_set():
                    break
                time.sleep(1)
        _log("توقفت المزامنة التلقائية", 'warning', device_id)

    t = threading.Thread(target=runner, daemon=True)
    t.start()
    _sync_threads[device_id] = t
    db.update_device(device_id, {'last_status': 'syncing'})
    return True


def stop_device_sync(device_id: int) -> bool:
    """إيقاف المزامنة التلقائية لجهاز"""
    if device_id in _sync_stop_events:
        _sync_stop_events[device_id].set()
    if device_id in _sync_status:
        _sync_status[device_id]['is_syncing'] = False
    db.update_device(device_id, {'last_status': 'stopped'})
    return True


def sync_device_now(device_id: int, on_complete: Callable = None) -> Dict:
    """مزامنة فورية (لا تنتظر الجدول الزمني)"""
    return _sync_device_inner(device_id, on_complete)


def get_device_status(device_id: int) -> Dict:
    status = _sync_status.get(device_id, {})
    device = db.get_device(device_id) or {}
    return {
        'is_syncing': device_id in _sync_threads and _sync_threads[device_id].is_alive(),
        'last_sync': device.get('last_sync'),
        'last_status': device.get('last_status', 'unknown'),
        'last_error': device.get('last_error'),
    }


def get_all_device_statuses() -> Dict[int, Dict]:
    devices = db.get_devices()
    return {d['id']: get_device_status(d['id']) for d in devices}


# ─────────────────────────────────────────────────────────────
# Core Sync Logic
# ─────────────────────────────────────────────────────────────

def _sync_device_inner(device_id: int, on_complete: Callable = None) -> Dict:
    device = db.get_device(device_id)
    if not device:
        return {'success': False, 'error': 'الجهاز غير موجود'}

    device_type = str(device.get('device_type', 'zkteco')).lower()
    _log('─' * 40, 'info', device_id)
    _log(f"بدء دورة المزامنة ({device.get('name', 'جهاز')})", 'info', device_id)

    try:
        if device_type == 'hikvision':
            result = _sync_hikvision(device)
        else:
            result = _sync_zkteco(device)

        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        if result.get('success'):
            inserted = result.get('inserted', 0)
            processed = db.process_raw_logs()
            _log(f"✓ تمت المزامنة: {inserted} سجل جديد، {processed} سجل مُعالَج", 'success', device_id)
            db.update_device(device_id, {
                'last_sync': now_str,
                'last_status': 'ok',
                'last_error': None,
            })
            if on_complete:
                try:
                    on_complete({'device_id': device_id, 'inserted': inserted, 'time': now_str})
                except Exception:
                    pass
        else:
            err = result.get('error', 'خطأ غير معروف')
            _log(f"✗ فشل المزامنة: {err}", 'error', device_id)
            db.update_device(device_id, {
                'last_status': 'error',
                'last_error': err,
            })

        return result

    except Exception as exc:
        err_msg = str(exc)
        _log(f"✗ استثناء: {err_msg}", 'error', device_id)
        db.update_device(device_id, {'last_status': 'error', 'last_error': err_msg})
        return {'success': False, 'error': err_msg}


# ─────────────────────────────────────────────────────────────
# ZKTeco
# ─────────────────────────────────────────────────────────────

def _sync_zkteco(device: Dict) -> Dict:
    if ZK is None:
        return {'success': False, 'error': 'مكتبة pyzk غير مُثبَّتة. شغّل: pip install pyzk'}

    ip = device.get('ip_address', '')
    port = int(device.get('port') or 4370)
    sn = device.get('serial_number') or ip
    device_id = device['id']

    _log(f"الاتصال بـ ZKTeco {ip}:{port}...", 'info', device_id)
    conn = None
    try:
        zk = ZK(ip, port=port, timeout=10)
        conn = zk.connect()
        conn.disable_device()
        _log('متصل بنجاح بـ ZKTeco', 'success', device_id)

        _log('قراءة سجلات الحضور...', 'info', device_id)
        attendances = conn.get_attendance() or []

        if not attendances:
            _log('لا توجد سجلات على الجهاز', 'info', device_id)
            return {'success': True, 'inserted': 0}

        _log(f'{len(attendances)} سجل كلي على الجهاز', 'info', device_id)
        inserted = 0
        for att in attendances:
            ts = (getattr(att, 'timestamp', None)
                  or getattr(att, 'record_time', None)
                  or getattr(att, 'time', None))
            if ts is None:
                continue
            if isinstance(ts, datetime):
                ts_str = ts.strftime('%Y-%m-%dT%H:%M:%S')
            else:
                ts_str = str(ts)

            pin = str(
                getattr(att, 'user_id', None)
                or getattr(att, 'device_user_id', None)
                or getattr(att, 'pin', None)
                or getattr(att, 'uid', None)
                or ''
            )
            if pin and ts_str:
                if db.insert_raw_log(sn, pin, ts_str, device_id):
                    inserted += 1

        return {'success': True, 'inserted': inserted}

    finally:
        if conn:
            try:
                conn.enable_device()
            except Exception:
                pass
            try:
                conn.disconnect()
            except Exception:
                pass
        _log('أُغلق اتصال ZKTeco', 'info', device_id)


def test_zkteco_connection(ip: str, port: int = 4370) -> Dict:
    """اختبار اتصال ZKTeco"""
    if ZK is None:
        return {'success': False, 'message': 'مكتبة pyzk غير مُثبَّتة'}
    conn = None
    try:
        zk = ZK(ip, port=port, timeout=8)
        conn = zk.connect()
        info = conn.get_device_name() or 'ZKTeco'
        conn.enable_device()
        return {'success': True, 'message': f'متصل: {info}'}
    except Exception as exc:
        return {'success': False, 'message': str(exc)}
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


# ─────────────────────────────────────────────────────────────
# Hikvision
# ─────────────────────────────────────────────────────────────

def _sync_hikvision(device: Dict) -> Dict:
    if not HIKVISION_AVAILABLE:
        return {'success': False, 'error': 'hikvision_connector غير متاح'}

    ip = device.get('ip_address', '')
    port = int(device.get('port') or 80)
    username = device.get('username') or 'admin'
    password = device.get('password') or ''
    use_https = bool(device.get('use_https', False))
    sn = device.get('serial_number') or ip
    device_id = device['id']

    _log(f"الاتصال بـ Hikvision {ip}:{port}...", 'info', device_id)
    hik = None
    try:
        hik = HikvisionConnector(
            ip=ip, port=port, username=username,
            password=password, use_https=use_https,
        )
        info = hik.test_connection()
        sn = info.get('serial_number') or sn
        _log(f"متصل: {info.get('model', '?')} | S/N: {sn}", 'success', device_id)

        last_sync = device.get('last_sync')
        if last_sync:
            try:
                last_dt = datetime.strptime(last_sync[:19], '%Y-%m-%d %H:%M:%S')
            except Exception:
                last_dt = datetime(2000, 1, 1)
        else:
            last_dt = datetime(2000, 1, 1)

        _log(f"جلب السجلات منذ {last_dt.strftime('%Y-%m-%d %H:%M')}...", 'info', device_id)
        logs = hik.get_attendance_logs(since=last_dt)
        _log(f"{len(logs)} سجل جديد", 'info', device_id)

        inserted = 0
        for log_item in logs:
            pin = str(log_item.get('pin', ''))
            ts = log_item.get('time', '')
            if pin and ts:
                if db.insert_raw_log(sn, pin, ts, device_id):
                    inserted += 1

        return {'success': True, 'inserted': inserted}

    finally:
        if hik:
            try:
                hik.disconnect()
            except Exception:
                pass
        _log('أُغلق اتصال Hikvision', 'info', device_id)


def test_hikvision_connection(ip: str, port: int = 80, username: str = 'admin',
                              password: str = '', use_https: bool = False) -> Dict:
    """اختبار اتصال Hikvision"""
    if not HIKVISION_AVAILABLE:
        return {'success': False, 'message': 'hikvision_connector غير متاح'}
    hik = None
    try:
        hik = HikvisionConnector(ip=ip, port=port, username=username,
                                  password=password, use_https=use_https)
        info = hik.test_connection()
        msg = "متصل: {0} | S/N: {1} | FW: {2}".format(
            info.get('model', '?'),
            info.get('serial_number', '?'),
            info.get('firmware', '?'),
        )
        return {'success': True, 'message': msg, 'info': info}
    except Exception as exc:
        return {'success': False, 'message': str(exc)}
    finally:
        if hik:
            try:
                hik.disconnect()
            except Exception:
                pass
