@echo off
REM Sincronizacion automatica de cotizaciones CPI (para el Programador de tareas).
REM No hace pause: corre y cierra.
cd /d "%~dp0\.."
node scripts\sync-cpi-quotes.mjs >> scripts\sync-cpi-quotes.log 2>&1
