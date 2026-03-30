"""
build_exe.py  ─  Professional build script for KWADER Sync Agent
────────────────────────────────────────────────────────────────
Run with:
    python build_exe.py

What it does
────────────
1.  Verifies Python + required tools are present.
2.  Tries "flet pack" first (recommended for Flet ≥ 0.21).
3.  Falls back to "pyinstaller main.spec" if flet pack is unavailable.
4.  Copies OpenSSL DLLs to dist/ to fix the infamous "Ordinal 380" error.
5.  Copies settings.json placeholder + assets next to the EXE.
6.  Prints a clear summary with the output path.
"""

import os
import sys
import glob
import shutil
import subprocess
import platform


# ── Helpers ────────────────────────────────────────────────────────────────

def banner(text: str):
    line = "─" * 60
    print(f"\n{line}\n  {text}\n{line}")


def run(cmd: list[str], **kwargs) -> bool:
    print("  $", " ".join(cmd))
    result = subprocess.run(cmd, **kwargs)
    return result.returncode == 0


def find_openssl_dlls() -> list[str]:
    """Locate libcrypto / libssl DLLs inside the active Python installation."""
    py_dir = os.path.dirname(sys.executable)
    search = [
        py_dir,
        os.path.join(py_dir, "DLLs"),
        os.path.join(py_dir, "Library", "bin"),
    ]
    found = []
    for path in search:
        if os.path.isdir(path):
            found += glob.glob(os.path.join(path, "libcrypto-*.dll"))
            found += glob.glob(os.path.join(path, "libssl-*.dll"))
    return list(set(found))


def find_dist_dir() -> str | None:
    """Locate the output directory/file after build."""
    # onefile: dist/KwaderSync.exe
    if os.path.isfile(os.path.join("dist", "KwaderSync.exe")):
        return "dist"
    # onedir: dist/KwaderSync/
    d = os.path.join("dist", "KwaderSync")
    if os.path.isdir(d):
        return d
    if os.path.isdir("dist"):
        return "dist"
    return None


# ── Main ───────────────────────────────────────────────────────────────────

def build():
    banner("KWADER Sync Agent — Professional EXE Builder")
    print(f"  Python : {sys.version.split()[0]}")
    print(f"  OS     : {platform.platform()}")

    if platform.system() != "Windows":
        print("\n⚠️  هذا البرنامج مخصص لـ Windows فقط.")
        print("   يمكن إكمال البناء لأغراض الاختبار ولكن الـ EXE لن يعمل على نظام آخر.")

    # ── 1. Clean previous build ────────────────────────────────────────────
    banner("1 / 5  —  تنظيف مخرجات البناء السابقة")
    for folder in ("build", "dist", "__pycache__"):
        if os.path.exists(folder):
            shutil.rmtree(folder)
            print(f"  🗑️  حُذف: {folder}/")

    # ── 2. Check flet version ──────────────────────────────────────────────
    banner("2 / 5  —  التحقق من الأدوات المطلوبة")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "flet", "--version"],
            capture_output=True, text=True
        )
        flet_version = result.stdout.strip() or result.stderr.strip()
        print(f"  ✅ Flet: {flet_version}")
    except Exception:
        print("  ❌ Flet غير مثبت — قم بتشغيل: pip install flet")
        sys.exit(1)

    try:
        subprocess.run(["pyinstaller", "--version"], capture_output=True, check=True)
        print("  ✅ PyInstaller: موجود")
    except Exception:
        print("  ❌ PyInstaller غير مثبت — قم بتشغيل: pip install pyinstaller")
        sys.exit(1)

    # ── 3. Build ───────────────────────────────────────────────────────────
    banner("3 / 5  —  بناء الـ EXE")

    # Try flet pack (preferred — automatically handles Flutter assets)
    flet_pack_ok = run(
        [
            sys.executable, "-m", "flet", "pack",
            "main.py",
            "--name", "KwaderSync",
            "--icon", "assets/icon.ico",
            "--add-data", "assets;assets",
            "--hidden-import", "services.settings_service",
            "--hidden-import", "services.supabase_service",
            "--hidden-import", "services.sync_manager",
            "--hidden-import", "components.dashboard_view",
            "--hidden-import", "components.settings_view",
            "--hidden-import", "utils.auto_start",
            "--hidden-import", "supabase",
            "--hidden-import", "httpx",
            "--hidden-import", "zk",
            "--noconsole",
        ]
    )

    if not flet_pack_ok:
        print("\n  ⚠️  flet pack فشل — سيتم الانتقال إلى PyInstaller مباشرةً...")
        ok = run(["pyinstaller", "--noconfirm", "main.spec"])
        if not ok:
            print("\n❌ البناء فشل. راجع الأخطاء أعلاه.")
            sys.exit(1)

    # ── 4. Fix OpenSSL (Ordinal 380 fix) ──────────────────────────────────
    banner("4 / 5  —  إصلاح مشكلة OpenSSL (Ordinal 380)")
    dist_dir = find_dist_dir()

    if dist_dir:
        dlls = find_openssl_dlls()
        if dlls:
            for dll in dlls:
                dest = os.path.join(dist_dir, os.path.basename(dll))
                shutil.copy2(dll, dest)
                print(f"  ✅ نُسخ: {os.path.basename(dll)}")
        else:
            print("  ℹ️  لم يتم العثور على ملفات OpenSSL (قد تكون مدمجة بالفعل)")
    else:
        print("  ⚠️  لم يتم العثور على مجلد dist/")

    # ── 5. Copy assets & placeholder settings ────────────────────────────
    banner("5 / 5  —  نسخ الملفات المساعدة")

    if dist_dir:
        # Copy assets folder
        if os.path.isdir("assets"):
            dest_assets = os.path.join(dist_dir, "assets")
            if not os.path.isdir(dest_assets):
                shutil.copytree("assets", dest_assets)
                print("  ✅ نُسخ: assets/")

        # Create empty settings.json next to EXE if not exists
        settings_dest = os.path.join(dist_dir, "settings.json")
        if not os.path.exists(settings_dest):
            import json
            with open(settings_dest, "w", encoding="utf-8") as f:
                json.dump({}, f)
            print("  ✅ أُنشئ: settings.json (فارغ)")

    # ── Summary ────────────────────────────────────────────────────────────
    banner("✅  اكتمل البناء بنجاح!")
    abs_dist = os.path.abspath(dist_dir or "dist")
    print(f"  📂 المخرجات: {abs_dist}")
    print(
        "\n  للتوزيع: شارك محتويات المجلد أعلاه كاملاً،\n"
        "  أو شارك ملف KwaderSync.exe فقط إن كان onefile.\n"
    )


if __name__ == "__main__":
    build()
