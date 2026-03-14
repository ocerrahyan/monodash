@echo off
:: ============================================================
::  CarEngine Watchdog — Install as Windows Scheduled Task
::  RIGHT-CLICK → "Run as administrator"
:: ============================================================

echo.
echo === Installing CarEngine Watchdog ===
echo.

:: 1. Register scheduled task (runs at SYSTEM BOOT, before user login)
schtasks /Create /TN "CarEngineWatchdog" ^
    /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File D:\Mono5\scripts\carengine-watchdog.ps1" ^
    /SC ONSTART ^
    /RL HIGHEST ^
    /F

if %errorlevel% neq 0 (
    echo.
    echo FAILED: Could not register scheduled task.
    echo Make sure you right-click and "Run as administrator".
    pause
    exit /b 1
)

:: 2. Also add to user Startup folder (backup — runs at user login)
echo Creating startup shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\CarEngineWatchdog.lnk\"); $s.TargetPath = 'C:\WINDOWS\system32\wscript.exe'; $s.Arguments = '\"D:\Mono5\scripts\carengine-watchdog-launcher.vbs\"'; $s.WorkingDirectory = 'D:\Mono5'; $s.WindowStyle = 7; $s.Save()"

echo.
echo ========================================
echo SUCCESS: CarEngine Watchdog installed!
echo.
echo   - Scheduled Task: CarEngineWatchdog (runs at boot)
echo   - Startup Shortcut: CarEngineWatchdog.lnk (backup at login)
echo   - Logs: D:\Mono5\logs\watchdog-service.log
echo.
echo The watchdog will auto-start on every reboot and
echo keep carengine.ngrok.app alive with auto-recovery.
echo ========================================
echo.
pause
