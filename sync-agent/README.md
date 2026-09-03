# KWADER Sync Agent (Python)

This is a Python port of the Electron sync agent, using the same HTML/CSS UI and logic.

## Run (dev)

```bash
cd "D:\Zk att project\sync-agent\python-app"
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## Configure Supabase

Create `D:\Zk att project\sync-agent\python-app\.env`:

```
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
```

If you want full access from the desktop app, you can use:

```
SUPABASE_KEY=your-service-role-key
```

## Notes
- Uses PyWebview + system tray (pystray) for the desktop shell.
- Uses `pyzk` to read attendance logs from ZKTeco devices.
- Settings are stored in `%APPDATA%\\sync-agent\\settings.json` to match the Electron app.
- Auto-start is implemented via the Windows registry (HKCU Run key).
