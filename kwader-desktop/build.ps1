# KWADER Desktop Pro — Build Script
# يُشغِّل هذا الملف لبناء التطبيق كـ EXE واحد

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host '══════════════════════════════════════' -ForegroundColor Cyan
Write-Host '  KWADER Desktop Pro — Build' -ForegroundColor Cyan
Write-Host '══════════════════════════════════════' -ForegroundColor Cyan

# 1. Check Python environment
Write-Host ''
Write-Host '[1/5] Checking Python...' -ForegroundColor Yellow
$pythonCmd = if (Test-Path '..\sync-agent\.venv\Scripts\python.exe') {
    '..\sync-agent\.venv\Scripts\python.exe'
} elseif (Test-Path '.venv\Scripts\python.exe') {
    '.venv\Scripts\python.exe'
} else {
    'python'
}
Write-Host ('Using: ' + $pythonCmd)

# 2. Install dependencies
Write-Host ''
Write-Host '[2/5] Installing dependencies...' -ForegroundColor Yellow
& $pythonCmd -m pip install -r requirements.txt --quiet
& $pythonCmd -m pip install pyinstaller --quiet

# 3. Copy icon from sync-agent if not exists
if (-not (Test-Path 'installer\icon.ico')) {
    New-Item -ItemType Directory -Force -Path 'installer' | Out-Null
    if (Test-Path '..\sync-agent\installer\icon.ico') {
        Copy-Item '..\sync-agent\installer\icon.ico' 'installer\icon.ico'
        Write-Host 'Icon copied from sync-agent' -ForegroundColor Green
    } else {
        Write-Host 'WARNING: No icon found at installer\icon.ico' -ForegroundColor Yellow
    }
}

# Ensure assets folder exists
New-Item -ItemType Directory -Force -Path 'web\assets' | Out-Null

# Copy logo.png as icon.png to web\assets
if (Test-Path '..\attendpay-app\public\logo.png') {
    Copy-Item '..\attendpay-app\public\logo.png' 'web\assets\icon.png' -Force
    Write-Host 'Logo copied to web\assets\icon.png' -ForegroundColor Green
}

# Copy hikvision_connector from sync-agent
if (-not (Test-Path 'hikvision_connector.py')) {
    if (Test-Path '..\sync-agent\hikvision_connector.py') {
        Copy-Item '..\sync-agent\hikvision_connector.py' '.'
        Write-Host 'hikvision_connector.py copied' -ForegroundColor Green
    }
}

# 4. Run PyInstaller
Write-Host ''
Write-Host '[3/5] Building with PyInstaller...' -ForegroundColor Yellow
Remove-Item -Recurse -Force 'build', 'dist' -ErrorAction SilentlyContinue
& $pythonCmd -m PyInstaller 'KWADER Desktop.spec' --clean

# 5. Build Installer with Inno Setup
Write-Host ''
Write-Host '[4/5] Checking for Inno Setup compiler (ISCC.exe)...' -ForegroundColor Yellow
$isccPath = ''
$possiblePaths = @(
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe',
    "$env:LocalAppData\Programs\Inno Setup 6\ISCC.exe"
)
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $isccPath = $path
        break
    }
}

if ($isccPath) {
    Write-Host ('Found ISCC at: ' + $isccPath) -ForegroundColor Green
    Write-Host 'Building installer...' -ForegroundColor Yellow
    & $isccPath 'installer\setup.iss'
    Write-Host ''
    Write-Host '[5/5] Build complete!' -ForegroundColor Green
    $setupPath = 'installer\Output\KWADER_Desktop_Setup.exe'
    if (Test-Path $setupPath) {
        $size = [math]::Round((Get-Item $setupPath).Length / 1MB, 1)
        Write-Host ('  Installer: ' + $setupPath + ' - ' + $size + ' MB') -ForegroundColor Green
    } else {
        Write-Host '  WARNING: Installer EXE not found at expected path' -ForegroundColor Yellow
    }
} else {
    Write-Host 'WARNING: Inno Setup (ISCC.exe) not found. Skipping installer build.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '[5/5] Build complete (application only)!' -ForegroundColor Green
    $exePath = 'dist\KWADER Desktop\KWADER Desktop.exe'
    if (Test-Path $exePath) {
        $size = [math]::Round((Get-Item $exePath).Length / 1MB, 1)
        Write-Host ('  Output: ' + $exePath + ' - ' + $size + ' MB') -ForegroundColor Green
        Write-Host ('  To run: .\' + $exePath) -ForegroundColor Cyan
    } else {
        Write-Host '  WARNING: EXE not found at expected path' -ForegroundColor Yellow
    }
}
