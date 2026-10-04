Write-Host "Waiting for pyinstaller to finish..."
while (Get-Process pyinstaller -ErrorAction SilentlyContinue) {
    Start-Sleep 5
}
Write-Host "Padding installer..."
python pad_installer.py
Write-Host "Publishing OTA..."
node publish_sync_release.js
Write-Host "Done!"
