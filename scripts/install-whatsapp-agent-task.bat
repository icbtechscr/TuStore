@echo off
setlocal
REM Instala el worker persistente del Agente ICB al iniciar sesion en Windows.

set "TASK_NAME=ICB WhatsApp Agent"
set "LAUNCHER=%~dp0whatsapp-agent-hidden.vbs"

echo.
echo Instalando "%TASK_NAME%" para iniciar con Windows...
schtasks /Create /TN "%TASK_NAME%" /TR "wscript.exe \"%LAUNCHER%\"" /SC ONLOGON /F
if errorlevel 1 (
  echo No se pudo crear una tarea separada sin permisos de administrador.
  echo El agente tambien puede iniciarse desde la tarea existente "ICB Sync CPI".
  pause
  exit /b 1
)

echo Iniciando el worker ahora...
schtasks /Run /TN "%TASK_NAME%"
echo.
echo Listo. Abre Admin ^> Agente para activar la conexion y escanear el QR.
echo Log: scripts\whatsapp-agent.log
pause
