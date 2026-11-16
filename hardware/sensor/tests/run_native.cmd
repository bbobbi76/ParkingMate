@echo off
setlocal
where cl >nul 2>nul
if errorlevel 1 (
  echo Open an x64 Native Tools Command Prompt for Visual Studio, then run this script.
  exit /b 1
)
set "TASK_ROOT=%~dp0.."
if not exist "%TASK_ROOT%\runtime\native-tests" mkdir "%TASK_ROOT%\runtime\native-tests"
set "TEMP=%TASK_ROOT%\runtime\native-tests"
set "TMP=%TEMP%"
cl /nologo /std:c11 /W4 /WX /D_CRT_SECURE_NO_WARNINGS "%~dp0native_sensor_test.c" /Fo"%TASK_ROOT%\runtime\native-tests\native_sensor_test.obj" /Fe"%TASK_ROOT%\runtime\native-tests\native_sensor_test.exe"
if errorlevel 1 exit /b 1
"%TASK_ROOT%\runtime\native-tests\native_sensor_test.exe"
