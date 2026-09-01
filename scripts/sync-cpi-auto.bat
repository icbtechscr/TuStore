@echo off
REM Sincronizacion automatica de ventas CPI (para el Programador de tareas).
REM No hace pause: corre y cierra.
cd /d "%~dp0\.."
node scripts\sync-cpi.mjs >> scripts\sync-cpi.log 2>&1
