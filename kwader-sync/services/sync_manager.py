"""
SyncManager — connects to ZKTeco fingerprint devices and uploads
attendance records to Supabase.  Runs in a background thread.
"""
from __future__ import annotations

import threading
import time
import random
from datetime import datetime, timedelta
from typing import Callable

try:
    from zk import ZK
    _ZK_OK = True
except ImportError:
    _ZK_OK = False


class SyncManager:
    def __init__(self, settings, supabase, log_callback: Callable):
        self.settings = settings
        self.supabase = supabase
        self.log: Callable[[str, str], None] = log_callback
        self.is_syncing = False
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # ── Start / Stop ───────────────────────────────────────────────────────
    def start(self):
        if self.is_syncing:
            return

        is_demo = self.settings.get("demoMode", False)

        if not is_demo:
            url = self.settings.get("supabaseUrl", "").strip()
            key = self.settings.get("supabaseKey", "").strip()
            if not url or not key:
                self.log("❌ أدخل بيانات Supabase في الإعدادات أولاً", "error")
                return
            if not self.supabase.connect(url, key):
                self.log("❌ فشل الاتصال بـ Supabase — تحقق من URL والـ Key", "error")
                return

        self._stop.clear()
        self.is_syncing = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        mode_label = "🧪 تجريبي" if is_demo else "🟢 حقيقي"
        self.log(f"تم بدء المزامنة التلقائية — الوضع: {mode_label}", "success")

    def stop(self):
        if not self.is_syncing:
            return
        self._stop.set()
        self.is_syncing = False
        self.log("⏹️ تم إيقاف المزامنة", "warning")

    # ── Background loop ────────────────────────────────────────────────────
    def _loop(self):
        while not self._stop.is_set():
            self.perform_sync()
            interval_min = int(self.settings.get("syncInterval", 5))
            self._stop.wait(interval_min * 60)

    # ── Single sync ────────────────────────────────────────────────────────
    def perform_sync(self) -> str | None:
        """Perform one sync cycle. Returns HH:MM:SS string or None on error."""
        try:
            if self.settings.get("demoMode", False):
                return self._demo_sync()
            return self._real_sync()
        except Exception as exc:
            self.log(f"❌ خطأ غير متوقع: {exc}", "error")
            return None

    # ── Demo mode ──────────────────────────────────────────────────────────
    def _demo_sync(self) -> str:
        self.log("🧪 وضع تجريبي — توليد سجلات وهمية...", "info")
        time.sleep(0.8)
        n = random.randint(4, 18)
        self.log(f"✅ تمت المزامنة التجريبية — {n} سجل جديد", "success")
        ts = datetime.now().strftime("%H:%M:%S")
        self.settings.set("lastSyncTime", ts)
        return ts

    # ── Real ZK sync ───────────────────────────────────────────────────────
    def _real_sync(self) -> str | None:
        if not _ZK_OK:
            self.log("❌ مكتبة pyzk غير مثبتة (pip install pyzk)", "error")
            return None

        ip   = self.settings.get("zkIp", "").strip()
        port = int(self.settings.get("zkPort", 4370))
        lic  = self.settings.get("licenseKey", "")

        if not ip:
            self.log("❌ لم يُحدَّد IP لجهاز البصمة في الإعدادات", "error")
            return None

        self.log(f"🔌 جاري الاتصال بـ {ip}:{port}…", "info")
        zk   = ZK(ip, port=port, timeout=10, password=0, force_udp=False)
        conn = None
        try:
            conn = zk.connect()
            self.log("✅ تم الاتصال بالجهاز بنجاح", "success")

            attendance = conn.get_attendance()
            if not attendance:
                self.log("ℹ️ لا توجد سجلات جديدة في الجهاز", "info")
                ts = datetime.now().strftime("%H:%M:%S")
                self.settings.set("lastSyncTime", ts)
                return ts

            self.log(f"📥 تم جلب {len(attendance)} سجل من الجهاز", "info")

            records = [
                {
                    "employee_id": str(att.user_id),
                    "punch_time":  att.timestamp.isoformat() if att.timestamp else None,
                    "punch_type":  att.punch,
                    "device_ip":   ip,
                    "license_key": lic,
                    "synced_at":   datetime.now().isoformat(),
                }
                for att in attendance
            ]

            count, err = self.supabase.upsert_attendance(records)
            if err:
                self.log(f"❌ خطأ في الرفع إلى Supabase: {err}", "error")
                return None

            self.log(f"✅ تم رفع {count} سجل إلى Supabase بنجاح", "success")
            ts = datetime.now().strftime("%H:%M:%S")
            self.settings.set("lastSyncTime", ts)
            return ts

        except Exception as exc:
            self.log(f"❌ خطأ في الجهاز: {exc}", "error")
            return None
        finally:
            if conn:
                try:
                    conn.disconnect()
                except Exception:
                    pass

    # ── Historical data ────────────────────────────────────────────────────
    def generate_historical(self):
        if not self.settings.get("demoMode", False):
            self.log("ℹ️ البيانات التاريخية متاحة في الوضع التجريبي فقط", "warning")
            return

        self.log("📅 جاري توليد بيانات تاريخية (30 يوم، 10 موظفين)…", "info")
        employees = [f"EMP{i:03d}" for i in range(1, 11)]
        records: list[dict] = []

        for offset in range(30):
            day = datetime.now() - timedelta(days=offset)
            if day.weekday() >= 5:          # skip Friday + Saturday
                continue
            for emp in employees:
                if random.random() < 0.9:   # 90 % attendance
                    check_in = day.replace(
                        hour=8 + random.randint(0, 1),
                        minute=random.randint(0, 59),
                        second=0,
                        microsecond=0,
                    )
                    check_out = check_in + timedelta(hours=8 + random.randint(0, 2))
                    records += [
                        {
                            "employee_id": emp,
                            "punch_time":  check_in.isoformat(),
                            "punch_type":  0,
                            "device_ip":   "demo",
                            "license_key": self.settings.get("licenseKey", "DEMO"),
                            "synced_at":   datetime.now().isoformat(),
                        },
                        {
                            "employee_id": emp,
                            "punch_time":  check_out.isoformat(),
                            "punch_type":  1,
                            "device_ip":   "demo",
                            "license_key": self.settings.get("licenseKey", "DEMO"),
                            "synced_at":   datetime.now().isoformat(),
                        },
                    ]

        time.sleep(1.5)
        self.log(f"✅ تم توليد {len(records)} سجل تاريخي بنجاح", "success")
