@echo off
setlocal

cd /d "%~dp0"
call npm run dev:stop

echo.
echo Apex Lifespan dev server stop command finished.
pause
