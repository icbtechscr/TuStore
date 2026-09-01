@echo off
setlocal
REM Sincronizacion automatica completa de CPI (ventas + productos + cotizaciones).
REM Para el Programador de tareas: no hace pause, escribe todo en un log.

cd /d "%~dp0\.."
set "LOG=scripts\sync-cpi-all.log"

>> "%LOG%" echo.
>> "%LOG%" echo ============================================================
>> "%LOG%" echo [%date% %time%] Iniciando sincronizacion completa CPI

>> "%LOG%" echo.
>> "%LOG%" echo --- Worker WhatsApp ---
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0ensure-whatsapp-agent.ps1" >> "%LOG%" 2>&1

>> "%LOG%" echo.
>> "%LOG%" echo --- Ventas CPI ---
node scripts\sync-cpi.mjs >> "%LOG%" 2>&1
set "SALES_EXIT=%ERRORLEVEL%"
>> "%LOG%" echo [Ventas CPI] Codigo de salida: %SALES_EXIT%

>> "%LOG%" echo.
>> "%LOG%" echo --- Productos vendidos CPI ---
node scripts\sync-cpi-products.mjs >> "%LOG%" 2>&1
set "PRODUCTS_EXIT=%ERRORLEVEL%"
>> "%LOG%" echo [Productos vendidos CPI] Codigo de salida: %PRODUCTS_EXIT%

>> "%LOG%" echo.
>> "%LOG%" echo --- Cotizaciones CPI ---
node scripts\sync-cpi-quotes.mjs >> "%LOG%" 2>&1
set "QUOTES_EXIT=%ERRORLEVEL%"
>> "%LOG%" echo [Cotizaciones CPI] Codigo de salida: %QUOTES_EXIT%

>> "%LOG%" echo.
>> "%LOG%" echo --- Inventario CPI ---
node scripts\sync-cpi-inventory.mjs >> "%LOG%" 2>&1
set "INVENTORY_EXIT=%ERRORLEVEL%"
>> "%LOG%" echo [Inventario CPI] Codigo de salida: %INVENTORY_EXIT%

>> "%LOG%" echo [%date% %time%] Fin sincronizacion completa CPI

if not "%SALES_EXIT%"=="0" exit /b %SALES_EXIT%
if not "%PRODUCTS_EXIT%"=="0" exit /b %PRODUCTS_EXIT%
if not "%QUOTES_EXIT%"=="0" exit /b %QUOTES_EXIT%
exit /b %INVENTORY_EXIT%
