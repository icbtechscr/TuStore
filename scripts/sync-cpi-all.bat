@echo off
setlocal
REM Ejecuta manualmente ventas + productos + cotizaciones CPI.

cd /d "%~dp0\.."

echo.
echo === Ventas CPI ===
node scripts\sync-cpi.mjs
set "SALES_EXIT=%ERRORLEVEL%"

echo.
echo === Productos vendidos CPI ===
node scripts\sync-cpi-products.mjs
set "PRODUCTS_EXIT=%ERRORLEVEL%"

echo.
echo === Cotizaciones CPI ===
node scripts\sync-cpi-quotes.mjs
set "QUOTES_EXIT=%ERRORLEVEL%"

echo.
echo === Inventario CPI ===
node scripts\sync-cpi-inventory.mjs
set "INVENTORY_EXIT=%ERRORLEVEL%"

echo.
echo Ventas CPI: codigo %SALES_EXIT%
echo Productos vendidos CPI: codigo %PRODUCTS_EXIT%
echo Cotizaciones CPI: codigo %QUOTES_EXIT%
echo Inventario CPI: codigo %INVENTORY_EXIT%

echo.
pause

if not "%SALES_EXIT%"=="0" exit /b %SALES_EXIT%
if not "%PRODUCTS_EXIT%"=="0" exit /b %PRODUCTS_EXIT%
if not "%QUOTES_EXIT%"=="0" exit /b %QUOTES_EXIT%
exit /b %INVENTORY_EXIT%
