"""
DashboardView — main tab shown to the user.
Inherits from ft.Column so it can be placed directly in a ft.Tab.
"""
import flet as ft
from datetime import datetime


class DashboardView(ft.Column):
    def __init__(self, page, sync_manager, on_toggle, on_force_sync):
        super().__init__(expand=True, spacing=0)
        self._page = page          # ← NOT self.page (ft.Column owns that property)
        self.sync_manager = sync_manager
        self._on_toggle = on_toggle
        self._on_force_sync = on_force_sync
        self._record_count = 0
        self._build()

    # ── Build ──────────────────────────────────────────────────────────────
    def _build(self):
        # ── Stat cards ───────────────────────────────────────────────────
        self._card_status_icon = ft.Icon(
            ft.Icons.CIRCLE_ROUNDED, color=ft.Colors.GREY_400, size=18
        )
        self._card_status_val = ft.Text(
            "متوقف", size=17, weight=ft.FontWeight.W_700, color=ft.Colors.GREY_800
        )

        self._card_sync_val = ft.Text(
            "---", size=17, weight=ft.FontWeight.W_700, color=ft.Colors.GREY_800
        )

        self._card_rec_val = ft.Text(
            "0", size=17, weight=ft.FontWeight.W_700, color=ft.Colors.GREY_800
        )

        card_row = ft.Row(
            [
                self._stat_card(
                    "الحالة",
                    self._card_status_val,
                    ft.Icons.WIFI_ROUNDED,
                    ft.Colors.INDIGO_100,
                    ft.Colors.INDIGO_500,
                ),
                self._stat_card(
                    "آخر مزامنة",
                    self._card_sync_val,
                    ft.Icons.SYNC_ROUNDED,
                    ft.Colors.BLUE_100,
                    ft.Colors.BLUE_500,
                ),
                self._stat_card(
                    "سجلات اليوم",
                    self._card_rec_val,
                    ft.Icons.FINGERPRINT_ROUNDED,
                    ft.Colors.GREEN_100,
                    ft.Colors.GREEN_600,
                ),
            ],
            spacing=12,
        )

        # ── Buttons ───────────────────────────────────────────────────────
        self.toggle_btn = ft.ElevatedButton(
            content=ft.Text(
                "▶  تشغيل المزامنة",
                size=14,
                weight=ft.FontWeight.W_600,
            ),
            style=ft.ButtonStyle(
                bgcolor=ft.Colors.GREEN_600,
                color=ft.Colors.WHITE,
                shape=ft.RoundedRectangleBorder(radius=10),
                elevation=2,
                padding=ft.padding.symmetric(horizontal=24, vertical=15),
            ),
            on_click=self._on_toggle,
            expand=True,
        )

        self.force_sync_btn = ft.ElevatedButton(
            content=ft.Text("🔄  مزامنة الآن", size=14),
            style=ft.ButtonStyle(
                bgcolor=ft.Colors.INDIGO_500,
                color=ft.Colors.WHITE,
                shape=ft.RoundedRectangleBorder(radius=10),
                elevation=2,
                padding=ft.padding.symmetric(horizontal=24, vertical=15),
            ),
            on_click=self._on_force_sync,
            expand=True,
        )

        btn_row = ft.Row([self.toggle_btn, self.force_sync_btn], spacing=12)

        # ── Log area ──────────────────────────────────────────────────────
        self.log_col = ft.Column(
            scroll=ft.ScrollMode.AUTO,
            expand=True,
            spacing=3,
            auto_scroll=True,
        )

        log_box = ft.Container(
            content=self.log_col,
            bgcolor="#0F172A",  # dark slate
            border_radius=12,
            padding=ft.padding.symmetric(horizontal=14, vertical=10),
            expand=True,
            border=ft.border.all(1, ft.Colors.with_opacity(0.15, ft.Colors.WHITE)),
        )

        log_header = ft.Row(
            [
                ft.Row(
                    [
                        ft.Icon(
                            ft.Icons.TERMINAL_ROUNDED,
                            size=16,
                            color=ft.Colors.INDIGO_400,
                        ),
                        ft.Text(
                            "سجل الأحداث",
                            size=13,
                            weight=ft.FontWeight.W_600,
                            color=ft.Colors.GREY_700,
                        ),
                    ],
                    spacing=6,
                ),
                ft.Container(expand=True),
                ft.TextButton(
                    "مسح",
                    on_click=self._clear_log,
                    style=ft.ButtonStyle(
                        color=ft.Colors.RED_400,
                        padding=ft.padding.symmetric(horizontal=10, vertical=4),
                    ),
                ),
            ]
        )

        # ── Assemble ──────────────────────────────────────────────────────
        self.controls = [
            ft.Container(
                content=ft.Column(
                    [
                        card_row,
                        ft.Container(height=4),
                        btn_row,
                        ft.Container(height=4),
                        log_header,
                        log_box,
                    ],
                    spacing=12,
                    expand=True,
                ),
                padding=ft.padding.all(20),
                expand=True,
            )
        ]

    # ── Helpers ────────────────────────────────────────────────────────────
    def _stat_card(self, title, value_widget, icon, bg, icon_color):
        return ft.Container(
            content=ft.Column(
                [
                    ft.Container(
                        content=ft.Icon(icon, color=icon_color, size=20),
                        bgcolor=bg,
                        width=36,
                        height=36,
                        border_radius=8,
                        alignment=ft.Alignment(0, 0),
                    ),
                    ft.Text(title, size=11, color=ft.Colors.GREY_500),
                    value_widget,
                ],
                spacing=4,
                horizontal_alignment=ft.CrossAxisAlignment.START,
            ),
            bgcolor=ft.Colors.WHITE,
            border=ft.border.all(1, ft.Colors.GREY_200),
            border_radius=14,
            padding=ft.padding.symmetric(horizontal=16, vertical=14),
            expand=True,
            shadow=ft.BoxShadow(
                blur_radius=6,
                color=ft.Colors.with_opacity(0.05, ft.Colors.BLACK),
                offset=ft.Offset(0, 2),
            ),
        )

    # ── Public API ─────────────────────────────────────────────────────────
    def add_log(self, message: str, log_type: str = "info"):
        palette = {
            "info":    "#94A3B8",   # slate-400
            "success": "#4ADE80",   # green-400
            "error":   "#F87171",   # red-400
            "warning": "#FB923C",   # orange-400
        }
        color = palette.get(log_type, palette["info"])
        ts = datetime.now().strftime("%H:%M:%S")

        self.log_col.controls.append(
            ft.Row(
                [
                    ft.Text(
                        f"[{ts}]",
                        size=11,
                        color="#475569",
                        selectable=True,
                        font_family="Courier New",
                    ),
                    ft.Text(
                        message,
                        size=12,
                        color=color,
                        selectable=True,
                        expand=True,
                    ),
                ],
                spacing=8,
            )
        )
        # Keep log to last 150 entries
        if len(self.log_col.controls) > 150:
            self.log_col.controls.pop(0)
        try:
            self._page.update()
        except Exception:
            pass

    def _clear_log(self, e):
        self.log_col.controls.clear()
        self._page.update()

    def update_status(self, is_syncing: bool, is_demo: bool, last_sync: str):
        # Toggle button label/color
        if is_syncing:
            self.toggle_btn.content.value = "⏹  إيقاف المزامنة"
            self.toggle_btn.style.bgcolor = ft.Colors.RED_600
        else:
            self.toggle_btn.content.value = "▶  تشغيل المزامنة"
            self.toggle_btn.style.bgcolor = ft.Colors.GREEN_600

        # Status card
        if is_syncing:
            status_text = "🧪 تجريبي" if is_demo else "🟢 نشط"
            self._card_status_icon.color = (
                ft.Colors.PURPLE_400 if is_demo else ft.Colors.GREEN_400
            )
        else:
            status_text = "⚪ متوقف"
            self._card_status_icon.color = ft.Colors.GREY_400

        self._card_status_val.value = status_text
        self._card_sync_val.value = last_sync if last_sync else "---"

        try:
            self._page.update()
        except Exception:
            pass

    def increment_records(self, n: int = 1):
        self._record_count += n
        self._card_rec_val.value = str(self._record_count)
        try:
            self._page.update()
        except Exception:
            pass
