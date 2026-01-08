# ✅ Emulator Setup Solution

## The Issue
The original `setup-emulators.bat` failed because `avdmanager` is not in your system PATH. This is normal and expected!

## 🚀 Solution Options

### Option 1: Use Fixed Scripts (Recommended)
I've created fixed versions that find the Android SDK automatically:

```bash
# Create emulators
./setup-emulators-fixed.bat

# Start emulators
./start-emulators-fixed.bat
```

### Option 2: Manual Setup via Android Studio (Easiest)
1. Open **Android Studio**
2. Go to **Tools → AVD Manager**
3. Click **Create Virtual Device** for each emulator:

   | Name | Device | API Level |
   |------|--------|-----------|
   | Client-1 | Pixel 6 | API 33 |
   | Client-2 | Pixel 7 | API 33 |
   | Driver-1 | Pixel 6a | API 33 |
   | Driver-2 | Pixel 7a | API 33 |

4. Click the ▶️ button to start each emulator when needed

### Option 3: Fix PATH Environment Variable
1. Open **System Properties** → **Environment Variables**
2. Add to PATH: `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin`
3. Add to PATH: `%LOCALAPPDATA%\Android\Sdk\emulator`
4. Restart Command Prompt and try original script

## 🎯 Quick Start (Recommended)

### Step 1: Create Emulators
```bash
# Use the fixed script
./setup-emulators-fixed.bat
```

**OR** use Android Studio GUI (Tools → AVD Manager → Create Virtual Device)

### Step 2: Start Emulators
```bash
# Use the fixed script
./start-emulators-fixed.bat
```

**OR** start from Android Studio AVD Manager

### Step 3: Install Your App
```bash
# Start Expo development server
npx expo start

# Press 'a' to install on all Android devices
```

## 🔧 Troubleshooting

### If Fixed Script Still Fails
**Error**: "Android SDK not found"
**Solution**: 
1. Install Android Studio first
2. Make sure SDK is installed at `%LOCALAPPDATA%\Android\Sdk`

**Error**: "avdmanager not found"
**Solution**: 
1. Open Android Studio
2. Go to **Tools → SDK Manager → SDK Tools**
3. Install **Android SDK Command-line Tools**

**Error**: "System image not found"
**Solution**: 
1. Open Android Studio
2. Go to **Tools → SDK Manager → SDK Platforms**
3. Install **Android 13.0 (API 33)**

### Alternative: Use What You Have
If you have Android Studio installed, the GUI method is actually easier:
1. **Tools → AVD Manager**
2. **Create Virtual Device** 
3. Choose device and API level
4. Click **Finish**
5. Start with ▶️ button

## ✅ Testing Ready
Once you have emulators running, follow the **MULTI_EMULATOR_TESTING_GUIDE.md** for comprehensive testing!

## 📋 Quick Verification
Check if emulators are running:
```bash
# List running emulators
adb devices
```

Expected output:
```
List of devices attached
emulator-5554   device
emulator-5556   device
emulator-5558   device
emulator-5560   device
```

The original scripts were a good idea, but the PATH issue is very common. The fixed versions or Android Studio GUI will work perfectly! 🚀 