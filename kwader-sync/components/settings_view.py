"""
SettingsView — settings tab.
"""
import flet as ft


class SettingsView(ft.Column):
    def __init__(self, page, settings, on_save, on_verify_license, on_gen_historical):
        super().__init__(
            expand=True,
            scroll=ft.ScrollMode.AUTO,
            spacing=0,
        )
        self._page = page          # ← NOT self.page (ft.Column owns that property)
        self.settings = settings
        self._on_save = on_save
        self._on_verify = on_verify_license
        self._on_gen = on_gen_historical
        self._build()

    # ── Build ──────────────────────────────────────────────────────────────
    def _build(self):
        field_style = dict(
            border_radius=10,
            filled=True,
            fill_color=ft.Colors.WHITE,
            border_color=ft.Colors.GREY_300,
            focused_border_color=ft.Colors.INDIGO_400,
            label_style=ft.TextStyle(color=ft.Colors.GREY_600, size=13),
            text_size=14,
        )

        # ── Device ────────────────────────────────────────────────────────
        self.zk_ip = ft.TextField(
            label="IP جهاز البصمة",
            value=self.settings.get("zkIp", ""),
            hint_text="مثال: 192.168.1.201",
            prefix_icon=ft.Icons.DEVICES_ROUNDED,
            expand=True,
            **field_style,
        )
        self.zk_port = ft.TextField(
            label="المنفذ",
            value=str(self.settings.get("zkPort", 4370)),
            hint_text="4370",
            prefix_icon=ft.Icons.SETTINGS_ETHERNET_ROUNDED,
            width=140,
            **field_style,
        )

        # ── Supabase ──────────────────────────────────────────────────────
        self.supabase_url = ft.TextField(
            label="Supabase Project URL",
            value=self.settings.get("supabaseUrl", ""),
            hint_text="https://xxxx.supabase.co",
            prefix_icon=ft.Icons.CLOUD_ROUNDED,
            **field_style,
        )
        self.supabase_key = ft.TextField(
            label="Supabase Anon Key",
            value=self.settings.get("supabaseKey", ""),
            hint_text="eyJhbGci...",
            prefix_icon=ft.Icons.VPN_KEY_ROUNDED,
            password=True,
            can_reveal_password=True,
            **field_style,
        )

        # ── License ───────────────────────────────────────────────────────
        self.license_key_field = ft.TextField(
            label="مفتاح الترخيص",
            value=self.settings.get("licenseKey", ""),
            hint_text="XXXX-XXXX-XXXX-XXXX",
            prefix_icon=ft.Icons.VERIFIED_ROUNDED,
            expand=True,
            **field_style,
        )

        verify_btn = ft.ElevatedButton(
            "✔ تحقق",
            on_click=self._on_verify,
            style=ft.ButtonStyle(
                bgcolor=ft.Colors.INDIGO_500,
                color=ft.Colors.WHITE,
                shape=ft.RoundedRectangleBorder(radius=10),
                padding=ft.padding.symmetric(horizontal=20, vertical=17),
                elevation=1,
            ),
        )

        # ── Options ───────────────────────────────────────────────────────
        self.sync_interval = ft.Dropdown(
            label="فترة المزامنة التلقائية",
            value=str(self.settings.get("syncInterval", 5)),
            options=[
                ft.dropdown.Option("1", "كل دقيقة"),
                ft.dropdown.Option("5", "كل 5 دقائق"),
                ft.dropdown.Option("10", "كل 10 دقائق"),
                ft.dropdown.Option("15", "كل 15 دقيقة"),
                ft.dropdown.Option("30", "كل 30 دقيقة"),
                ft.dropdown.Option("60", "كل ساعة"),
            ],
            border_radius=10,
            filled=True,
            fill_color=ft.Colors.WHITE,
            border_color=ft.Colors.GREY_300,
            focused_border_color=ft.Colors.INDIGO_400,
            label_style=ft.TextStyle(color=ft.Colors.GREY_600, size=13),
            text_size=14,
        )

        self.auto_start = ft.Switch(
            label="تشغيل تلقائي مع بدء Windows",
            value=self.settings.get("autoStart", False),
            active_color=ft.Colors.INDIGO_500,
        )
        self.demo_mode = ft.Switch(
            label="وضع تجريبي — بيانات وهمية بدون جهاز حقيقي",
            value=self.settings.get("demoMode", False),
            active_color=ft.Colors.PURPLE_500,
        )

        # ── Actions ───────────────────────────────────────────────────────
        save_btn = ft.ElevatedButton(
            "💾  حفظ الإعدادات",
            on_click=self._on_save,
            expand=True,
            style=ft.ButtonStyle(
                bgcolor=ft.Colors.GREEN_600,
                color=ft.Colors.WHITE,
                shape=ft.RoundedRectangleBorder(radius=10),
                padding=ft.padding.symmetric(vertical=15),
                elevation=2,
            ),
        )
        hist_btn = ft.ElevatedButton(
            "📅  بيانات تاريخية (30 يوم)",
            on_click=self._on_gen,
            expand=True,
            style=ft.ButtonStyle(
                bgcolor=ft.Colors.ORANGE_600,
                color=ft.Colors.WHITE,
                shape=ft.RoundedRectangleBorder(radius=10),
                padding=ft.padding.symmetric(vertical=15),
                elevation=2,
            ),
        )

        self.controls = [
            ft.Container(
                content=ft.Column(
                    [
                        # Device Section
                        self._section("🖥️  جهاز البصمة (ZKTeco)"),
                        ft.Row([self.zk_ip, self.zk_port], spacing=10),

                        # Supabase Section
                        self._section("☁️  Supabase — قاعدة البيانات السحابية"),
                        self.supabase_url,
                        self.supabase_key,

                        # License Section
                        self._section("🔑  الترخيص"),
                        ft.Row([self.license_key_field, verify_btn], spacing=10),

                        # Options Section
                        self._section("⚙️  الخيارات العامة"),
                        self.sync_interval,
                        ft.Container(height=4),
                        self.auto_start,
                        self.demo_mode,

                        # Bottom actions
                        ft.Container(height=8),
                        ft.Divider(color=ft.Colors.GREY_200),
                        ft.Container(height=4),
                        ft.Row([save_btn, hist_btn], spacing=12),
                        ft.Container(height=16),
                    ],
                    spacing=10,
                ),
                padding=ft.padding.all(20),
            )
        ]

    # ── Helper ─────────────────────────────────────────────────────────────
    def _section(self, title: str):
        return ft.Container(
            content=ft.Text(title, size=13, weight=ft.FontWeight.W_700, color=ft.Colors.INDIGO_700),
            border=ft.border.only(
                bottom=ft.border.BorderSide(2, ft.Colors.INDIGO_100)
            ),
            padding=ft.padding.only(top=8, bottom=6),
        )

    # ── Public API ─────────────────────────────────────────────────────────
    def get_form_data(self) -> dict:
        return {
            "zkIp":          self.zk_ip.value.strip(),
            "zkPort":        int(self.zk_port.value or 4370),
            "supabaseUrl":   self.supabase_url.value.strip(),
            "supabaseKey":   self.supabase_key.value.strip(),
            "licenseKey":    self.license_key_field.value.strip(),
            "syncInterval":  int(self.sync_interval.value or 5),
            "autoStart":     self.auto_start.value,
            "demoMode":      self.demo_mode.value,
        }
