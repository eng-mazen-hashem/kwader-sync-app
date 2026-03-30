import flet as ft
import os
import sys
import threading
from datetime import datetime

# ── Make sure local packages are importable when frozen ──────────────────────
if getattr(sys, "frozen", False):
    base = sys._MEIPASS
    sys.path.insert(0, base)

from dotenv import load_dotenv
from services.settings_service import SettingsService
from services.supabase_service import SupabaseService
from services.sync_manager import SyncManager
from components.dashboard_view import DashboardView
from components.settings_view import SettingsView
from utils.auto_start import set_auto_start


class KwaderSyncApp:
    def __init__(self, page: ft.Page):
        load_dotenv()
        self.page = page
        self.page.title = "KWADER Sync Agent"
        self.page.window.width = 780
        self.page.window.height = 660
        self.page.window.min_width = 620
        self.page.window.min_height = 560
        self.page.rtl = True
        self.page.theme_mode = ft.ThemeMode.LIGHT
        self.page.bgcolor = ft.Colors.GREY_50

        # ── Theme (Indigo/Emerald) ─────────────────────────────────────────
        # NOTE: No Google Fonts URL → works offline inside EXE
        self.page.theme = ft.Theme(
            color_scheme_seed=ft.Colors.INDIGO,
            visual_density=ft.VisualDensity.COMPACT,
        )

        # ── Services ──────────────────────────────────────────────────────
        self.settings = SettingsService()
        self.supabase = SupabaseService()
        self.sync_manager = SyncManager(
            self.settings, self.supabase, self.on_log
        )

        # ── Views ──────────────────────────────────────────────────────────
        self.dashboard = DashboardView(
            self.page,
            self.sync_manager,
            self.on_toggle_sync,
            self.on_force_sync,
        )
        self.settings_view = SettingsView(
            self.page,
            self.settings,
            self.on_save_settings,
            self.on_verify_license,
            self.on_gen_historical,
        )

        self.tabs = ft.Tabs(
            selected_index=0,
            animation_duration=250,
            indicator_color=ft.Colors.INDIGO_500,
            label_color=ft.Colors.INDIGO_600,
            unselected_label_color=ft.Colors.GREY_500,
            tabs=[
                ft.Tab(
                    text="الرئيسية",
                    icon=ft.Icons.HOME_ROUNDED,
                    content=self.dashboard,
                ),
                ft.Tab(
                    text="الإعدادات",
                    icon=ft.Icons.SETTINGS_ROUNDED,
                    content=self.settings_view,
                ),
            ],
            expand=True,
        )

        # ── Window events ──────────────────────────────────────────────────
        try:
            self.page.window.prevent_close = True
        except Exception:
            self.page.window_prevent_close = True   # fallback older API
        self.page.on_window_event = self.on_window_event

        self._build_ui()
        self.update_ui_status()

        if self.settings.get("autoStart", False):
            self.page.run_task(self._delayed_start)

    # ── Auto-start ─────────────────────────────────────────────────────────
    async def _delayed_start(self):
        import asyncio
        await asyncio.sleep(2)
        self.sync_manager.start()
        self.update_ui_status()

    # ── UI Build ───────────────────────────────────────────────────────────
    def _build_ui(self):
        self.status_badge = self._make_badge()

        header = ft.Container(
            content=ft.Row(
                [
                    # Logo placeholder (circle with initials)
                    ft.Container(
                        content=ft.Text(
                            "KS",
                            color=ft.Colors.WHITE,
                            size=16,
                            weight=ft.FontWeight.BOLD,
                        ),
                        width=46,
                        height=46,
                        bgcolor=ft.Colors.INDIGO_600,
                        border_radius=12,
                        alignment=ft.Alignment(0, 0),
                    ),
                    ft.Column(
                        [
                            ft.Text(
                                "KWADER Sync",
                                size=20,
                                weight=ft.FontWeight.W_800,
                                color=ft.Colors.GREY_900,
                            ),
                            ft.Text(
                                "ربط أجهزة البصمة بالسحابة",
                                size=12,
                                color=ft.Colors.GREY_500,
                            ),
                        ],
                        spacing=0,
                    ),
                    ft.Container(expand=True),
                    self.status_badge,
                ],
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=12,
            ),
            padding=ft.padding.symmetric(horizontal=20, vertical=12),
            bgcolor=ft.Colors.WHITE,
            border=ft.border.only(
                bottom=ft.border.BorderSide(1, ft.Colors.GREY_200)
            ),
            shadow=ft.BoxShadow(
                blur_radius=8,
                color=ft.Colors.with_opacity(0.06, ft.Colors.BLACK),
                offset=ft.Offset(0, 2),
            ),
        )

        self.page.add(header, self.tabs)

    def _make_badge(self):
        is_syncing = self.sync_manager.is_syncing
        is_demo = self.settings.get("demoMode", False)

        if is_syncing:
            label = "🧪 تجريبي" if is_demo else "● نشط"
            bg = ft.Colors.PURPLE_500 if is_demo else ft.Colors.GREEN_500
        else:
            label = "○ متوقف"
            bg = ft.Colors.GREY_400

        return ft.Container(
            content=ft.Text(
                label,
                color=ft.Colors.WHITE,
                size=12,
                weight=ft.FontWeight.W_600,
            ),
            bgcolor=bg,
            padding=ft.padding.symmetric(horizontal=14, vertical=6),
            border_radius=20,
        )

    # ── Callbacks ──────────────────────────────────────────────────────────
    def on_log(self, message, log_type="info"):
        self.dashboard.add_log(message, log_type)

    def on_toggle_sync(self, e):
        if self.sync_manager.is_syncing:
            self.sync_manager.stop()
        else:
            self.sync_manager.start()
        self.update_ui_status()

    def on_force_sync(self, e):
        self.dashboard.force_sync_btn.disabled = True
        self.dashboard.force_sync_btn.content.value = "⏳ جاري..."
        self.page.update()

        res_time = self.sync_manager.perform_sync()

        self.dashboard.force_sync_btn.disabled = False
        self.dashboard.force_sync_btn.content.value = "🔄 مزامنة الآن"
        if res_time:
            self.dashboard.update_status(
                self.sync_manager.is_syncing,
                self.settings.get("demoMode", False),
                res_time,
            )
        self.page.update()

    def on_save_settings(self, e):
        data = self.settings_view.get_form_data()
        prev_auto = self.settings.get("autoStart", False)
        self.settings.set_multi(data)
        self.on_log("✅ تم حفظ الإعدادات بنجاح.", "success")
        if data["autoStart"] != prev_auto:
            ok = set_auto_start(data["autoStart"])
            verb = "تفعيل" if data["autoStart"] else "إلغاء"
            if ok:
                self.on_log(f"✅ تم {verb} التشغيل التلقائي.", "success")
            else:
                self.on_log("❌ فشل تحديث التشغيل التلقائي.", "error")
        self.update_ui_status()

    def on_verify_license(self, e):
        key = self.settings_view.license_key_field.value.strip()
        if not key:
            self.on_log("⚠️ أدخل مفتاح الترخيص أولاً", "warning")
            return
        self.on_log("🔍 جاري التحقق من الترخيص...", "info")
        res = self.supabase.check_subscription(key)
        if res and res.get("active"):
            self.on_log(f"✅ ترخيص صالح — {res.get('company_name')}", "success")
        else:
            self.on_log(f"❌ {res.get('message', 'مفتاح غير صالح')}", "error")

    def on_gen_historical(self, e):
        self.on_log("⏳ جاري توليد البيانات التاريخية...", "info")
        threading.Thread(
            target=self.sync_manager.generate_historical, daemon=True
        ).start()

    # ── Status refresh ──────────────────────────────────────────────────────
    def update_ui_status(self):
        is_syncing = self.sync_manager.is_syncing
        is_demo = self.settings.get("demoMode", False)
        last_sync = self.settings.get("lastSyncTime", "لم تتم المزامنة بعد")

        self.dashboard.update_status(is_syncing, is_demo, last_sync)

        # Replace badge in header row (index 3)
        new_badge = self._make_badge()
        self.page.controls[0].content.controls[3] = new_badge
        self.page.update()

    # ── Window minimize-to-tray ─────────────────────────────────────────────
    def on_window_event(self, e):
        if e.data == "close":
            try:
                self.page.window.visible = False
            except Exception:
                self.page.window_visible = False
            self.page.update()


# ── Entry point ────────────────────────────────────────────────────────────
def main(page: ft.Page):
    KwaderSyncApp(page)


if __name__ == "__main__":
    ft.run(main, assets_dir="assets")
