@echo off
echo Setting up multiple Android emulators for testing...
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

set "AVDMANAGER=%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\avdmanager.bat"
if not exist "%AVDMANAGER%" (
    set "AVDMANAGER=%ANDROID_SDK_ROOT%\tools\bin\avdmanager.bat"
)
if not exist "%AVDMANAGER%" (
    echo Error: avdmanager not found!
    echo Please install Android SDK Command Line Tools in Android Studio:
    echo   Tools ^> SDK Manager ^> SDK Tools ^> Android SDK Command-line Tools
    pause
    exit /b 1
)

echo Found Android SDK at: %ANDROID_SDK_ROOT%
echo Using avdmanager at: %AVDMANAGER%
echo.

REM Check if system images are installed
echo Checking available system images...
"%AVDMANAGER%" list target

echo.
echo Creating emulator: Client-1
"%AVDMANAGER%" create avd --name "Client-1" --package "system-images;android-33;google_apis;x86_64" --device "pixel_6" --force

echo Creating emulator: Client-2  
"%AVDMANAGER%" create avd --name "Client-2" --package "system-images;android-33;google_apis;x86_64" --device "pixel_7" --force

echo Creating emulator: Driver-1
"%AVDMANAGER%" create avd --name "Driver-1" --package "system-images;android-33;google_apis;x86_64" --device "pixel_6a" --force

echo Creating emulator: Driver-2
"%AVDMANAGER%" create avd --name "Driver-2" --package "system-images;android-33;google_apis;x86_64" --device "pixel_7a" --force

echo.
echo ✅ Emulators created successfully!
echo.
echo To start emulators:
echo   "%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd Client-1
echo   "%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd Client-2  
echo   "%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd Driver-1
echo   "%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd Driver-2
echo.
echo Or use the start-emulators-fixed.bat script
pause 