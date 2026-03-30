"""
SettingsService — persists app config to settings.json
sitting next to the executable (or CWD in dev mode).
"""
import json
import os
import sys


def _settings_path() -> str:
    """
    When frozen as EXE, store settings next to the EXE, not in _MEI temp dir.
    In dev mode, store in CWD.
    """
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.getcwd()
    return os.path.join(base, "settings.json")


DEFAULTS = {
    "zkIp":          "",
    "zkPort":        4370,
    "supabaseUrl":   "",
    "supabaseKey":   "",
    "licenseKey":    "",
    "syncInterval":  5,
    "autoStart":     False,
    "demoMode":      False,
    "lastSyncTime":  "لم تتم المزامنة بعد",
    "companyName":   "",
}


class SettingsService:
    def __init__(self):
        self._data: dict = dict(DEFAULTS)
        self._path = _settings_path()
        self._load()

    # ── I/O ────────────────────────────────────────────────────────────────
    def _load(self):
        if os.path.exists(self._path):
            try:
                with open(self._path, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    self._data.update(saved)
            except Exception as exc:
                print(f"[Settings] Load error: {exc}")

    def _save(self):
        try:
            with open(self._path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
        except Exception as exc:
            print(f"[Settings] Save error: {exc}")

    # ── Public API ─────────────────────────────────────────────────────────
    def get(self, key: str, default=None):
        return self._data.get(key, default)

    def set(self, key: str, value):
        self._data[key] = value
        self._save()

    def set_multi(self, data: dict):
        self._data.update(data)
        self._save()

    def get_all(self) -> dict:
        return dict(self._data)
