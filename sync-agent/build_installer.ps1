$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv = Join-Path $root '.venv'
$pyinstaller = Join-Path $venv 'Scripts\pyinstaller.exe'
$makensis = "C:\Program Files (x86)\NSIS\makensis.exe"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building KWADER Sync Agent v1.3.1 Installer" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Python Venv
if (-not (Test-Path $pyinstaller)) {
    Write-Error "PyInstaller not found in .venv! Please run pip install pyinstaller in .venv."
    exit 1
}

# 2. Check NSIS
if (-not (Test-Path $makensis)) {
    Write-Error "NSIS makensis.exe not found at: $makensis"
    exit 1
}

# 3. Ensure app.py UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText("$root\app.py", [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("$root\app.py", $content, $utf8NoBom)
Write-Host "[1/4] Cleaned app.py UTF-8 encoding (No BOM)." -ForegroundColor Green

# Stop running instance if any
cmd /c "taskkill /F /IM \"KWADER Sync.exe\" /T 2>NUL"

# 4. Clean previous dist and build directories
if (Test-Path "$root\dist\KWADER Sync") {
    Write-Host "[2/4] Cleaning previous dist directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "$root\dist\KWADER Sync" -ErrorAction SilentlyContinue
}
if (Test-Path "$root\build\KWADER Sync") {
    Remove-Item -Recurse -Force "$root\build\KWADER Sync" -ErrorAction SilentlyContinue
}

# 4b. Ensure WhatsApp Node is patched to GUI subsystem
if (Test-Path "$root\patch_pe_subsystem.py") {
    Write-Host "Ensuring whatsapp-node.exe GUI subsystem..." -ForegroundColor Yellow
    python "$root\patch_pe_subsystem.py"
}

# 5. Build executable using PyInstaller spec
Write-Host "[3/4] Compiling Python application with PyInstaller..." -ForegroundColor Cyan
Push-Location $root
& $pyinstaller --noconfirm --clean "KWADER Sync.spec"
Pop-Location

if (-not (Test-Path "$root\dist\KWADER Sync\KWADER Sync.exe")) {
    Write-Error "PyInstaller failed! 'dist\KWADER Sync\KWADER Sync.exe' was not created."
    exit 1
}
Write-Host "PyInstaller packaging completed successfully." -ForegroundColor Green

# 6. Compile NSIS Installer
Write-Host "[4/4] Generating Windows installer with NSIS..." -ForegroundColor Cyan
Push-Location "$root\installer"
& $makensis kwader_sync.nsi
Pop-Location

$versionedSetup = "$root\installer\KWADER_Sync_Setup_v1.3.1.exe"
$genericSetup = "$root\installer\KWADER Sync Setup.exe"

if (Test-Path $versionedSetup) {
    Copy-Item -Force $versionedSetup $genericSetup
    $fileItem = Get-Item $versionedSetup
    $sizeMb = [math]::Round($fileItem.Length / 1MB, 2)
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host " SUCCESS: Installer generated successfully!" -ForegroundColor Green
    Write-Host " Versioned File: $versionedSetup ($sizeMb MB)" -ForegroundColor Green
    Write-Host " Generic File:   $genericSetup" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
} else {
    Write-Error "NSIS compilation finished but $versionedSetup was not found!"
    exit 1
}
