Write-Host "Waiting for background builds to complete..."

# Wait for pkg to finish
while (Get-WmiObject Win32_Process -Filter "Name='node.exe' AND CommandLine LIKE '%pkg%'") {
    Start-Sleep 5
}

# Wait for pyinstaller to finish
while (Get-Process pyinstaller -ErrorAction SilentlyContinue) {
    Start-Sleep 5
}

Write-Host "Builds completed. Deploying OTA..."

Set-Location "d:\Zk att project\sync-agent"

# Copy whatsapp-node and patch GUI subsystem
Copy-Item -Path "d:\Zk att project\kwader-whatsapp-decentralized\build\whatsapp-node.exe" -Destination "bin\whatsapp-node.exe" -Force
python patch_pe_subsystem.py "bin\whatsapp-node.exe" 2

# Publish WhatsApp Node OTA (v2.9.5)
node publish_whatsapp_node_ota.js

# Publish Sync Agent Release & OTA (v1.6.1)
node publish_sync_release.js

Write-Host "All OTA deployments finished successfully!"
