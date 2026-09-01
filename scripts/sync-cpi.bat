@echo off
cd /d "%~dp0\.."
node scripts\sync-cpi.mjs %*
echo.
pause
