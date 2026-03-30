"""
auto_start.py — register / un-register the EXE in Windows startup.
Works on Windows only; silently returns False on other platforms.
"""
import sys
import os

APP_NAME = "KwaderSyncAgent"

def set_auto_start(enable: bool) -> bool:
    if sys.platform != "win32":
        return False
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0,
            winreg.KEY_SET_VALUE,
        )
        if enable:
            exe = sys.executable          # works in dev mode AND as frozen EXE
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, f'"{exe}"')
        else:
            try:
                winreg.DeleteValue(key, APP_NAME)
            except FileNotFoundError:
                pass
        winreg.CloseKey(key)
        return True
    except Exception as exc:
        print(f"[AutoStart] {exc}")
        return False
