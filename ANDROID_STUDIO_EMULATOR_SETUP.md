# 📱 Android Studio Emulator Setup (GUI Method)

## Why This Method?
The command line scripts failed because `avdmanager` wasn't in your PATH. This GUI method is foolproof and works every time!

## 🎯 Step-by-Step Guide

### Step 1: Open Android Studio
1. Launch **Android Studio**
2. If prompted, choose **"Open an existing project"** or create a new one
3. Once Android Studio is open, go to **Tools → AVD Manager**

### Step 2: Create Emulators
Click **"Create Virtual Device"** for each emulator you want to create:

#### Emulator 1: Client-1
1. Click **"Create Virtual Device"**
2. Choose **"Phone"** → **"Pixel 6"** → **"Next"**
3. Select **"API 33"** (Android 13) → **"Next"**
4. Name: **"Client-1"** → **"Finish"**

#### Emulator 2: Client-2
1. Click **"Create Virtual Device"**
2. Choose **"Phone"** → **"Pixel 7"** → **"Next"**
3. Select **"API 33"** (Android 13) → **"Next"**
4. Name: **"Client-2"** → **"Finish"**

#### Emulator 3: Driver-1
1. Click **"Create Virtual Device"**
2. Choose **"Phone"** → **"Pixel 6a"** → **"Next"**
3. Select **"API 33"** (Android 13) → **"Next"**
4. Name: **"Driver-1"** → **"Finish"**

#### Emulator 4: Driver-2
1. Click **"Create Virtual Device"**
2. Choose **"Phone"** → **"Pixel 7a"** → **"Next"**
3. Select **"API 33"** (Android 13) → **"Next"**
4. Name: **"Driver-2"** → **"Finish"**

### Step 3: Start Emulators
1. In AVD Manager, you'll see your 4 created emulators
2. Click the **▶️ (Play)** button next to each emulator to start it
3. **Start them one by one** (don't start all at once to avoid system overload)

### Step 4: Install Your App
1. Wait for all emulators to fully boot (shows home screen)
2. Open terminal in your project folder
3. Run: `npx expo start`
4. Press **'a'** to install on all Android devices
5. Or use the web interface to select specific emulators

## 🔧 Troubleshooting

### If API 33 is not available:
1. In Android Studio: **Tools → SDK Manager**
2. Go to **SDK Platforms** tab
3. Check **"Android 13.0 (API 33)"**
4. Click **"Apply"** to install

### If system images are missing:
1. In Android Studio: **Tools → SDK Manager**
2. Go to **SDK Platforms** tab
3. Check **"Show Package Details"**
4. Under **Android 13.0 (API 33)**, select:
   - **Google APIs Intel x86_64 Atom System Image**
5. Click **"Apply"** to install

### If emulators are slow:
1. In AVD Manager, click **✏️ (Edit)** next to an emulator
2. Click **"Show Advanced Settings"**
3. Increase **RAM** to 2048 MB or more
4. Increase **VM heap** to 512 MB
5. Click **"Finish"**

## ✅ Verification
Check if emulators are running:
```bash
adb devices
```

Expected output:
```
List of devices attached
emulator-5554   device    (Client-1)
emulator-5556   device    (Client-2)
emulator-5558   device    (Driver-1)
emulator-5560   device    (Driver-2)
```

## 🎯 Ready for Testing!
Once all emulators are running, follow the **MULTI_EMULATOR_TESTING_GUIDE.md** for comprehensive testing of your smart conflict resolution feature!

This GUI method is 100% reliable and doesn't require any command line configuration! 🚀 