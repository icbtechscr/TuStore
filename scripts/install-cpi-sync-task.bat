@echo off
setlocal
REM Crea o actualiza la tarea de Windows que corre ventas + cotizaciones CPI
REM cada 30 minutos, SIN ventana visible (usa el lanzador oculto .vbs).

set "TASK_NAME=ICB Sync CPI"
set "LAUNCHER=%~dp0sync-cpi-hidden.vbs"

echo.
echo Creando/actualizando la tarea "%TASK_NAME%" (cada 30 min, sin ventana)...
echo Lanzador: "%LAUNCHER%"
echo.

REM wscript ejecuta el .vbs que a su vez corre sync-cpi-all-auto.bat oculto.
schtasks /Create /TN "%TASK_NAME%" /TR "wscript.exe \"%LAUNCHER%\"" /SC MINUTE /MO 30 /F
if errorlevel 1 (
  echo.
  echo No se pudo crear la tarea. Proba ejecutar este archivo como administrador
  echo (clic derecho ^> Ejecutar como administrador).
  echo.
  pause
  exit /b 1
)

echo.
echo Tarea lista. Ejecutando una primera sincronizacion de prueba (en segundo plano)...
schtasks /Run /TN "%TASK_NAME%"

echo.
echo Listo. La sincronizacion corre oculta cada 30 minutos.
echo El log queda en: scripts\sync-cpi-all.log
echo.
pause
