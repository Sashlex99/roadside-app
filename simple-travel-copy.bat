@echo off
echo 🧳 Simple Travel Copy - No Git Needed!
echo.

set SOURCE=%cd%
set TRAVEL=%cd%-travel
set ZIP=%cd%-travel.zip

echo 📁 Copying project folder...
if exist "%TRAVEL%" rmdir /s /q "%TRAVEL%"
xcopy "%SOURCE%" "%TRAVEL%" /E /H /C /I /Y

echo 🧹 Removing unnecessary files...
if exist "%TRAVEL%\node_modules" rmdir /s /q "%TRAVEL%\node_modules"
if exist "%TRAVEL%\.git" rmdir /s /q "%TRAVEL%\.git"
if exist "%TRAVEL%\.expo" rmdir /s /q "%TRAVEL%\.expo"
if exist "%TRAVEL%\functions\node_modules" rmdir /s /q "%TRAVEL%\functions\node_modules"
del "%TRAVEL%\*.log" 2>nul

echo 📦 Creating ZIP file...
if exist "%ZIP%" del "%ZIP%"
powershell -Command "Compress-Archive -Path '%TRAVEL%' -DestinationPath '%ZIP%'"

echo ✅ DONE! Your travel-ready project:
echo    📦 %ZIP%
echo    📁 %TRAVEL%
echo.
echo 🎯 File size:
dir "%ZIP%" | find ".zip"
echo.
echo 💾 Copy this ZIP file to:
echo    - USB drive
echo    - Google Drive  
echo    - Email yourself
echo.
echo 📱 On laptop:
echo    1. Extract ZIP to C:\dev\roadside-assistance
echo    2. Run: npm install
echo    3. Run: cd functions ^&^& npm install ^&^& cd ..
echo    4. Create .env file
echo    5. Run: npm start
echo.
pause 