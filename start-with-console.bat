@echo off
echo Starting RD-Plan with debug logging...
echo.

set LOGFILE=%APPDATA%\RD-Plan\rd-plan-debug.log
echo Debug Log will be written to:
echo %LOGFILE%
echo.
echo Please check this file if the application does not start.
echo.

set ELECTRON_ENABLE_LOGGING=true

REM Suche in verschiedenen Ordnern nach der exe
if exist "release\RD-Plan*.exe" (
    for %%f in ("release\RD-Plan*.exe") do (
        echo Found in release: %%f
        echo Starting...
        "%%f"
        goto :end
    )
)

if exist "RD-Plan*.exe" (
    for %%f in ("RD-Plan*.exe") do (
        echo Found in root: %%f
        echo Starting...
        "%%f"
        goto :end
    )
)

echo ERROR: No RD-Plan executable found!
echo Please make sure you have built the application using 'npm run dist'.
pause
exit /b

:end
echo.
echo Application closed.
echo Check the log file for details: %LOGFILE%
pause
