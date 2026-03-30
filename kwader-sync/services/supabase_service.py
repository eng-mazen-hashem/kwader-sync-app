"""
SupabaseService — wraps supabase-py client.
Handles lazy connect so the app starts even without internet.
"""
from __future__ import annotations

try:
    from supabase import create_client, Client
    _SUPABASE_OK = True
except ImportError:
    _SUPABASE_OK = False
    Client = None  # type: ignore


class SupabaseService:
    def __init__(self):
        self._client: "Client | None" = None

    # ── Connection ─────────────────────────────────────────────────────────
    def connect(self, url: str, key: str) -> bool:
        if not _SUPABASE_OK:
            print("[Supabase] supabase-py not installed")
            return False
        if not url or not key:
            return False
        try:
            self._client = create_client(url, key)
            return True
        except Exception as exc:
            print(f"[Supabase] connect error: {exc}")
            self._client = None
            return False

    def is_connected(self) -> bool:
        return self._client is not None

    # ── License check ──────────────────────────────────────────────────────
    def check_subscription(self, license_key: str) -> dict:
        if not self._client:
            return {"active": False, "message": "غير متصل بـ Supabase"}
        try:
            res = (
                self._client.table("licenses")
                .select("*")
                .eq("key", license_key)
                .execute()
            )
            if res.data:
                rec = res.data[0]
                return {
                    "active":       rec.get("active", False),
                    "company_name": rec.get("company_name", ""),
                    "message":      "ترخيص صالح" if rec.get("active") else "الترخيص منتهي",
                }
            return {"active": False, "message": "مفتاح غير موجود"}
        except Exception as exc:
            return {"active": False, "message": str(exc)}

    # ── Upsert helpers ─────────────────────────────────────────────────────
    def upsert_attendance(self, records: list) -> tuple[int, str | None]:
        """Returns (count_uploaded, error_string_or_None)."""
        if not self._client:
            return 0, "غير متصل"
        if not records:
            return 0, None
        try:
            self._client.table("attendance").upsert(records).execute()
            return len(records), None
        except Exception as exc:
            return 0, str(exc)

    def upsert_employees(self, employees: list) -> tuple[int, str | None]:
        if not self._client:
            return 0, "غير متصل"
        if not employees:
            return 0, None
        try:
            self._client.table("employees").upsert(employees).execute()
            return len(employees), None
        except Exception as exc:
            return 0, str(exc)
