@echo off
taskkill /F /IM "KWADER Sync.exe" /T >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "C:\Program Files (x86)\KWADER Sync\KWADER Sync.exe"
