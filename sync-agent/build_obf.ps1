$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv = Join-Path $root '.venv'
$py = Join-Path $venv 'Scripts\python.exe'
$pyinstaller = Join-Path $venv 'Scripts\pyinstaller.exe'
$pyarmor = Join-Path $venv 'Scripts\pyarmor.exe'

if (-not (Test-Path $venv)) {
    python -m venv $venv
}

& $py -m pip install -r "$root\requirements.txt" pyinstaller pyarmor

# Clean and Prepare
if (Test-Path "$root\build\obf") { Remove-Item -Recurse -Force "$root\build\obf" }
New-Item -Path "$root\build\obf" -ItemType Directory -Force

# Remove BOM to keep PyArmor happy (Mandatory for PyArmor 9)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = Get-Content -Raw "$root\app.py"
[System.IO.File]::WriteAllText("$root\app.py", $content, $utf8NoBom)

# Obfuscate
Write-Host "Obfuscating..."
& $pyarmor gen -O "$root\build\obf" "$root\app.py" "$root\hikvision_connector.py"
if (-not (Test-Path "$root\build\obf\app.py")) {
    Write-Error "Obfuscation failed: build\obf\app.py not found!"
    exit 1
}

# Copy Web Assets
Copy-Item -Recurse -Force "$root\web" "$root\build\obf\web"

# Build (onedir)
Push-Location "$root\build\obf"
& $pyinstaller --noconsole --onedir --name "KWADER Sync" `
    --icon "$root\installer\icon.ico" `
    --version-file "$root\version_info.txt" `
    --add-data "$root\web;web" `
    --collect-all webview --collect-all platformdirs --collect-all supabase --collect-all realtime --collect-all postgrest --collect-all storage3 --collect-all supabase_auth --collect-all supabase_functions --collect-all pystray --collect-all PIL --collect-all zk --collect-all pyzk --collect-all pythonnet --collect-all clr_loader --collect-all requests --collect-all urllib3 `
    --hidden-import platformdirs --hidden-import json --hidden-import webview --hidden-import pyarmor_runtime_000000 --hidden-import requests --hidden-import urllib3 --hidden-import hikvision_connector -y app.py
Pop-Location

# Copy obfuscated build to root dist folder for installer compatibility
if (Test-Path "$root\dist") { Remove-Item -Recurse -Force "$root\dist" }
New-Item -Path "$root\dist" -ItemType Directory -Force
Copy-Item -Recurse -Force "$root\build\obf\dist\KWADER Sync" "$root\dist\KWADER Sync"
Write-Host "Obfuscated build copied to: $root\dist\KWADER Sync"

# Compile installer using NSIS
$makensis = "C:\Program Files (x86)\NSIS\makensis.exe"
if (Test-Path $makensis) {
    Write-Host "Compiling installer using NSIS..."
    Push-Location "$root\installer"
    & $makensis kwader_sync.nsi
    Pop-Location
    Write-Host "Installer compiled successfully!"
} else {
    Write-Warning "NSIS (makensis.exe) not found at $makensis. Skipping installer compilation."
}

Write-Host "Build ready at: $root\build\obf\dist\KWADER Sync"
