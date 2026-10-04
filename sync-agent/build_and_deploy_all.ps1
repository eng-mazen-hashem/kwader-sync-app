$ErrorActionPreference = 'Stop'

Write-Host "1/5 Building WhatsApp Node (v2.11.1)..."
Set-Location "d:\Zk att project\kwader-whatsapp-decentralized"
npm run build:exe

Write-Host "2/5 Copying WhatsApp Node and Patching GUI Subsystem..."
Set-Location "d:\Zk att project\sync-agent"
Copy-Item -Path "d:\Zk att project\kwader-whatsapp-decentralized\build\whatsapp-node.exe" -Destination "bin\whatsapp-node.exe" -Force
python patch_pe_subsystem.py "bin\whatsapp-node.exe" 2

Write-Host "3/5 Zipping WhatsApp Node..."
Compress-Archive -Path "bin\whatsapp-node.exe" -DestinationPath "bin\whatsapp-node-v2.11.1.zip" -Force

Write-Host "4/5 Building KWADER Sync Agent (v1.6.2)..."
powershell -ExecutionPolicy Bypass -File build_installer.ps1

Write-Host "5/5 Padding Installer and Deploying OTA..."
python pad_installer.py
node publish_whatsapp_node_ota.js
node publish_sync_release.js

Write-Host "🎉 All Done!"
