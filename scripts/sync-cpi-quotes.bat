@echo off
cd /d "%~dp0\.."
node scripts\sync-cpi-quotes.mjs %*
