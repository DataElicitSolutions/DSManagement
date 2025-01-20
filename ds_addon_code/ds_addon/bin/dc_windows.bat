@echo off
set local
< con (
    set "SESSION_KEY="
    set /p "SESSION_KEY="
)
cd /D "%~dp0"
for /f "tokens=2 delims==" %%A in ('wmic os get osarchitecture /value') do set ARCH=%%A
if "%ARCH%"=="64-bit" (
    echo %SESSION_KEY%  | .\dc_windows-x64.exe
) else (    
    echo %SESSION_KEY%  | .\dc_windows-intel.exe
) 