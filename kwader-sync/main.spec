# -*- mode: python ; coding: utf-8 -*-
"""
main.spec  ─  PyInstaller spec for KWADER Sync Agent
─────────────────────────────────────────────────────
Key points:
  • Uses flet.app_module_name + flet's own hooks so Flutter assets are bundled.
  • onefile mode for a single distributable EXE.
  • console=False → no black terminal window.
  • All hidden imports listed explicitly (httpx, supabase sub-packages, etc.)
  • OpenSSL DLLs are collected automatically via collect_dynamic_libs.
"""

import sys
import os
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs

# ── Collect Flet's bundled Flutter web assets ────────────────────────────────
try:
    import flet
    flet_dir = os.path.dirname(flet.__file__)
    flet_datas = collect_data_files("flet", includes=["**/*"])
    flet_bins  = collect_dynamic_libs("flet")
except Exception:
    flet_datas = []
    flet_bins  = []

# ── Collect OpenSSL DLLs from Python environment ─────────────────────────────
try:
    import glob
    _py_dir = os.path.dirname(sys.executable)
    _ssl_search = [
        _py_dir,
        os.path.join(_py_dir, "DLLs"),
        os.path.join(_py_dir, "Library", "bin"),
    ]
    _ssl_bins = []
    for _p in _ssl_search:
        if os.path.isdir(_p):
            for _pat in ("libcrypto-*.dll", "libssl-*.dll"):
                for _f in glob.glob(os.path.join(_p, _pat)):
                    _ssl_bins.append((_f, "."))
    _ssl_bins = list(set(_ssl_bins))
except Exception:
    _ssl_bins = []

a = Analysis(
    ["main.py"],
    pathex=["."],
    binaries=flet_bins + _ssl_bins,
    datas=[
        ("assets", "assets"),
        *flet_datas,
    ],
    hiddenimports=[
        # ── Flet internals ────────────────────────────────────────────────
        "flet",
        "flet.core",
        "flet_core",
        "flet_runtime",
        # ── Network / async ───────────────────────────────────────────────
        "websockets",
        "websockets.legacy",
        "websockets.legacy.client",
        "asyncio",
        "ssl",
        # ── Supabase stack ────────────────────────────────────────────────
        "supabase",
        "supabase._sync",
        "supabase._async",
        "postgrest",
        "postgrest._sync",
        "postgrest._async",
        "gotrue",
        "gotrue._sync",
        "gotrue._async",
        "storage3",
        "storage3._sync",
        "storage3._async",
        "realtime",
        "httpx",
        "httpx._transports",
        "httpcore",
        # ── ZKTeco ────────────────────────────────────────────────────────
        "zk",
        "zk.zkconst",
        "zk.base",
        # ── Misc ─────────────────────────────────────────────────────────
        "dotenv",
        "python_dotenv",
        # ── Project modules ───────────────────────────────────────────────
        "services.settings_service",
        "services.supabase_service",
        "services.sync_manager",
        "components.dashboard_view",
        "components.settings_view",
        "utils.auto_start",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "pandas"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="KwaderSync",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=["vcruntime140.dll", "python3*.dll"],
    runtime_tmpdir=None,
    console=False,          # ← no black CMD window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="assets/icon.ico",
)
