@echo off
echo 🧳 Creating Travel Backup for Roadside Assistance App...
echo.

:: Get current directory
set SOURCE_DIR=%cd%
set BACKUP_DIR=%cd%-backup
set ZIP_FILE=%cd%-working.zip

echo 📁 Source: %SOURCE_DIR%
echo 📁 Backup: %BACKUP_DIR%
echo 📦 ZIP File: %ZIP_FILE%
echo.

:: Create backup directory
if exist "%BACKUP_DIR%" (
    echo 🧹 Cleaning existing backup directory...
    rmdir /s /q "%BACKUP_DIR%"
)

echo 📋 Creating backup directory...
mkdir "%BACKUP_DIR%"

:: Create exclude file for xcopy
echo node_modules\ > backup-exclude.txt
echo .expo\ >> backup-exclude.txt
echo dist\ >> backup-exclude.txt
echo lib\ >> backup-exclude.txt
echo .firebase\ >> backup-exclude.txt
echo .git\ >> backup-exclude.txt
echo *.log >> backup-exclude.txt

echo 📂 Copying files (excluding node_modules, .git, etc.)...
xcopy "%SOURCE_DIR%" "%BACKUP_DIR%" /E /H /C /I /Y /EXCLUDE:backup-exclude.txt

:: Clean up exclude file
del backup-exclude.txt

:: Create ZIP file
echo 📦 Creating ZIP archive...
if exist "%ZIP_FILE%" (
    del "%ZIP_FILE%"
)

powershell -Command "Compress-Archive -Path '%BACKUP_DIR%' -DestinationPath '%ZIP_FILE%' -CompressionLevel Optimal"

if exist "%ZIP_FILE%" (
    echo ✅ SUCCESS! Travel backup created:
    echo    📦 %ZIP_FILE%
    echo.
    echo 📋 Backup Contents:
    dir "%BACKUP_DIR%" /w
    echo.
    echo 💾 File size:
    dir "%ZIP_FILE%" /w
    echo.
    echo 🎯 Next Steps:
    echo    1. Copy %ZIP_FILE% to USB drive
    echo    2. Upload to Google Drive/OneDrive  
    echo    3. Email to yourself as backup
    echo.
    echo 📱 On your laptop:
    echo    1. Extract ZIP to C:\dev\roadside-assistance
    echo    2. Run: npm install
    echo    3. Create .env from env.template
    echo    4. Run: npm start
    echo.
) else (
    echo ❌ ERROR: Failed to create ZIP file
    echo Check if PowerShell is available and try again
)

:: Clean up backup directory (optional)
echo.
set /p CLEANUP="🧹 Delete backup folder? (y/n): "
if /i "%CLEANUP%"=="y" (
    rmdir /s /q "%BACKUP_DIR%"
    echo ✅ Backup folder cleaned up
)

echo.
echo 🌍 Ready for travel! Have a great trip! ✈️
pause 