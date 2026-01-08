@echo off
echo Starting multiple Android emulators...
echo.

REM Find Android SDK path
set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
if not exist "%ANDROID_SDK_ROOT%" (
    set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
)
if not exist "%ANDROID_SDK_ROOT%" (
    echo Error: Android SDK not found!
    echo Please install Android Studio and SDK first.
    echo Expected location: %LOCALAPPDATA%\Android\Sdk
    pause
    exit /b 1
)

set "EMULATOR=%ANDROID_SDK_ROOT%\emulator\emulator.exe"
if not exist "%EMULATOR%" (
    echo Error: emulator.exe not found!
    echo Expected location: %ANDROID_SDK_ROOT%\emulator\emulator.exe
    pause
    exit /b 1
)

echo Found Android SDK at: %ANDROID_SDK_ROOT%
echo Using emulator at: %EMULATOR%
echo.

echo Starting Client-1 emulator...
start "Client-1" "%EMULATOR%" -avd Client-1

echo Waiting 5 seconds...
timeout /t 5 /nobreak >nul

echo Starting Client-2 emulator...
start "Client-2" "%EMULATOR%" -avd Client-2

echo Waiting 5 seconds...
timeout /t 5 /nobreak >nul

echo Starting Driver-1 emulator...
start "Driver-1" "%EMULATOR%" -avd Driver-1

echo Waiting 5 seconds...
timeout /t 5 /nobreak >nul

echo Starting Driver-2 emulator...
start "Driver-2" "%EMULATOR%" -avd Driver-2

echo.
echo ✅ All emulators are starting...
echo.
echo Wait for emulators to fully boot, then run:
echo   npx expo start
echo.
echo In the Expo dev tools, you can select each emulator to install the app
echo.
echo To stop all emulators:
echo   taskkill /f /im emulator.exe
echo.
pause 