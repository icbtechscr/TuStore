@echo off
REM Respaldo de seguridad de Supabase (datos + usuarios) a la carpeta backups\
cd /d "%~dp0\.."
node scripts\backup-supabase.mjs
echo.
pause
