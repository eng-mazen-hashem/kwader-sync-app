"""
KWADER Desktop Pro — Cloud Notifications, Ads & Update Checker
يعمل في الخلفية ويتحقق من الإنترنت كل 5 دقائق.
عند الاتصال: يجلب الإشعارات، الإعلانات، وتحديثات التطبيق.
"""
import threading
import time
import json
import hashlib
from datetime import datetime
from typing import Optional, Callable, Dict

APP_VERSION = "2.0.0"

_check_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()
_on_notification_cb: Optional[Callable] = None
_on_ad_cb: Optional[Callable] = None
_on_update_cb: Optional[Callable] = None
_supabase = None
_is_online = False
_current_ad: Optional[Dict] = None


def init(supabase_client, on_notification: Callable = None,
         on_ad: Callable = None, on_update: Callable = None):
    """تهيئة الوحدة مع عميل Supabase والـ callbacks"""
    global _supabase, _on_notification_cb, _on_ad_cb, _on_update_cb
    _supabase = supabase_client
    _on_notification_cb = on_notification
    _on_ad_cb = on_ad
    _on_update_cb = on_update


def start():
    """بدء thread الفحص الخلفي"""
    global _check_thread
    _stop_event.clear()
    _check_thread = threading.Thread(target=_check_loop, daemon=True)
    _check_thread.start()


def stop():
    """إيقاف thread الفحص"""
    _stop_event.set()


def is_online() -> bool:
    return _is_online


def get_current_ad() -> Optional[Dict]:
    return _current_ad


def force_check():
    """فحص فوري (من زر في الواجهة)"""
    threading.Thread(target=_do_check, daemon=True).start()


# ─────────────────────────────────────────────────────────────
# Background Loop
# ─────────────────────────────────────────────────────────────

def _check_loop():
    """يفحص كل 5 دقائق"""
    # انتظر دقيقة واحدة عند بدء التطبيق قبل أول فحص
    for _ in range(60):
        if _stop_event.is_set():
            return
        time.sleep(1)

    while not _stop_event.is_set():
        _do_check()
        # انتظر 5 دقائق
        for _ in range(300):
            if _stop_event.is_set():
                return
            time.sleep(1)


def _do_check():
    """تنفيذ الفحص الكامل"""
    global _is_online, _current_ad

    if _supabase is None:
        return

    try:
        # فحص الاتصال بشكل سريع
        resp = _supabase.table('system_settings').select('key').limit(1).execute()
        _is_online = True
    except Exception:
        _is_online = False
        return

    if not _is_online:
        return

    try:
        _fetch_notifications()
    except Exception:
        pass

    try:
        _fetch_ad()
    except Exception:
        pass

    try:
        _check_app_version()
    except Exception:
        pass

    try:
        _send_heartbeat()
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────

def _fetch_notifications():
    """جلب الإشعارات من Supabase"""
    from core import db

    resp = _supabase.table('system_settings').select('value').eq('key', 'desktop_notifications').execute()
    data = getattr(resp, 'data', [])
    if not data:
        return

    raw = data[0].get('value') if data else None
    if not raw:
        return

    notifications = raw if isinstance(raw, list) else []
    new_count = 0

    for notif in notifications:
        notif_id = notif.get('id') or _make_id(notif.get('title', '') + notif.get('body', ''))
        title = notif.get('title', 'إشعار')
        body = notif.get('body', '')
        notif_type = notif.get('type', 'info')
        action_url = notif.get('action_url')

        if db.save_notification(notif_id, title, body, notif_type, action_url):
            new_count += 1

    if new_count > 0 and _on_notification_cb:
        try:
            _on_notification_cb(new_count)
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────
# Ads
# ─────────────────────────────────────────────────────────────

def _fetch_ad():
    """جلب الإعلان النشط"""
    global _current_ad

    resp = _supabase.table('system_settings').select('value').eq('key', 'desktop_ads').execute()
    data = getattr(resp, 'data', [])
    if not data:
        return

    raw = data[0].get('value') if data else None
    if not raw:
        _current_ad = None
        return

    ads = raw if isinstance(raw, list) else []
    # عرض أول إعلان نشط فقط
    active_ads = [a for a in ads if a.get('active', True)]
    if active_ads:
        _current_ad = active_ads[0]
        if _on_ad_cb:
            try:
                _on_ad_cb(_current_ad)
            except Exception:
                pass
    else:
        _current_ad = None


# ─────────────────────────────────────────────────────────────
# App Version Check
# ─────────────────────────────────────────────────────────────

def _check_app_version():
    """التحقق من وجود إصدار أحدث"""
    resp = _supabase.table('system_settings').select('value').eq('key', 'desktop_version').execute()
    data = getattr(resp, 'data', [])
    if not data:
        return

    latest = str(data[0].get('value', '') if data else '').strip().strip('"')
    if not latest:
        return

    if _is_newer_version(latest, APP_VERSION):
        # جلب رابط التحميل
        dl_resp = _supabase.table('system_settings').select('value').eq('key', 'desktop_download_url').execute()
        dl_data = getattr(dl_resp, 'data', [])
        download_url = str(dl_data[0].get('value', '') if dl_data else '').strip().strip('"')

        if _on_update_cb:
            try:
                _on_update_cb({
                    'current': APP_VERSION,
                    'latest': latest,
                    'download_url': download_url,
                })
            except Exception:
                pass


def _is_newer_version(latest: str, current: str) -> bool:
    """مقارنة أرقام الإصدار (e.g. "2.1.0" > "2.0.0")"""
    try:
        def parse(v):
            return [int(x) for x in v.strip().split('.')]
        return parse(latest) > parse(current)
    except Exception:
        return False


# ─────────────────────────────────────────────────────────────
# Heartbeat
# ─────────────────────────────────────────────────────────────

def _send_heartbeat():
    """إرسال نبضة للسوبر أدمن (لا تُبطئ التطبيق عند الفشل)"""
    from core import db
    settings = db.get_all_settings()
    license_key = settings.get('licenseKey', '')
    if not license_key:
        return

    try:
        _supabase.rpc('update_sync_telemetry', {
            'p_license_key': license_key,
            'p_device_sn': 'DESKTOP',
            'p_ping_status': True,
            'p_service_version': APP_VERSION,
            'p_error_msg': None,
        }).execute()
    except Exception:
        pass  # heartbeat failure is non-fatal


# ─────────────────────────────────────────────────────────────
# Cloud Upsell
# ─────────────────────────────────────────────────────────────

def get_upsell_banner() -> Optional[Dict]:
    """جلب بيانات بانر الترقية للكلاود"""
    if not _is_online or _supabase is None:
        return None
    try:
        resp = _supabase.table('system_settings').select('value').eq('key', 'cloud_upsell_banner').execute()
        data = getattr(resp, 'data', [])
        if data and data[0].get('value'):
            return data[0]['value']
    except Exception:
        pass
    return None


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _make_id(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()
