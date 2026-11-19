@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
set "ELECTRON_ENABLE_LOGGING=1"
echo Starting WeRead Desktop...
echo If a window opens, you can minimize this console, do not close it.
echo.
call npm start 1> launch.log 2>&1
echo.
echo Exit code: %ERRORLEVEL%
echo Log saved to launch.log - send it to the assistant if something failed.
pause
