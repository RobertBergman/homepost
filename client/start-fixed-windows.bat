@echo off
echo Running HomePost client with SoX fix...
echo This will download SoX if needed and patch the mic module

:: Run the fix-sox-windows.js script
node fix-sox-windows.js

:: Check if the script was successful
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Failed to apply SoX fix! Please check the error messages above.
  echo.
  pause
  exit /b 1
)

:: Start the client
echo.
echo Starting HomePost client...
echo.
node client.js

pause
