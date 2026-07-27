@echo off
setlocal
cd /d "%~dp0"
set APEX_DEV_PORT=3001
echo Starting Apex Lifespan at http://localhost:3001/
call npm run dev:open
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Dev server exited with code %EXIT_CODE%.
  pause
)
endlocal
exit /b %EXIT_CODE%
