# 🖱️ Emulator Touch/Click Fix Guide

## 🎯 Common Causes & Solutions

### Solution 1: Enable Hardware Acceleration (Most Common Fix)

**Step 1: Check BIOS Settings**
1. Restart your PC and enter BIOS/UEFI
2. Look for **"Virtualization"** or **"Intel VT-x"** or **"AMD-V"**
3. **Enable** it if disabled
4. Save and restart

**Step 2: Enable Hyper-V (Windows)**
1. Press `Windows + R`, type `appwiz.cpl`
2. Click **"Turn Windows features on or off"**
3. Check **"Hyper-V"** and **"Windows Hypervisor Platform"**
4. Click **OK** and restart

**Step 3: Update Emulator Settings**
1. In Android Studio: **Tools → AVD Manager**
2. Click **✏️ (Edit)** next to your emulator
3. Click **"Show Advanced Settings"**
4. Set **Graphics** to **"Hardware - GLES 2.0"**
5. **RAM**: 2048 MB or more
6. **VM heap**: 512 MB
7. Click **"Finish"**

### Solution 2: Fix Touch Input

**Method A: Enable Touch Input**
1. **Right-click** on the emulator window
2. Select **"Enable touch input"** or **"Touch mode"**
3. Try clicking again

**Method B: Use Keyboard Shortcut**
- Press **`Ctrl + Shift + P`** to toggle touch input

### Solution 3: Restart Emulator Properly

1. **Close** the emulator completely
2. In Android Studio AVD Manager, click **▼** next to emulator
3. Select **"Cold Boot Now"** (not just "Start")
4. Wait for complete boot (shows home screen)

### Solution 4: Try Different Emulator Settings

**Create a new emulator with these settings:**
1. **Device**: Pixel 6 (not 6a or 7)
2. **API Level**: 30 or 31 (try older if 33 doesn't work)
3. **Target**: Google APIs (not Google Play)
4. **Graphics**: Hardware - GLES 2.0
5. **RAM**: 2048 MB
6. **Storage**: 8 GB

### Solution 5: Windows Compatibility

**If you're on Windows 11:**
1. Right-click emulator shortcut
2. **Properties → Compatibility**
3. Check **"Run in compatibility mode"**
4. Select **"Windows 10"**
5. Click **"Apply"**

**Disable Windows Defender Real-time Protection temporarily:**
1. Windows Settings → Privacy & Security → Windows Security
2. Virus & threat protection → Manage settings
3. Turn off **Real-time protection** (temporarily)
4. Try emulator again

### Solution 6: Alternative Emulator

**If Android Studio emulator still doesn't work, try:**

**BlueStacks** (Recommended for testing):
1. Download from [bluestacks.com](https://www.bluestacks.com)
2. Install and run
3. Install your APK file
4. Much better touch support

**Genymotion**:
1. Download from [genymotion.com](https://www.genymotion.com)
2. Free for personal use
3. Better performance than Android Studio emulator

## 🚀 Quick Fix Commands

```bash
# Stop all emulators
taskkill /f /im emulator.exe

# Start emulator with specific settings
emulator -avd Client-1 -gpu host -memory 2048 -cores 2

# Check if hardware acceleration is working
emulator -accel-check
```

## 🔧 Emergency Solution: Use Physical Devices

If emulators keep failing, use your 2 physical phones + these alternatives:

1. **Use Android Studio's Device Manager** to mirror your phone screen
2. **Use scrcpy** to control your phone from PC:
   ```bash
   # Install scrcpy
   winget install scrcpy
   
   # Mirror phone screen
   scrcpy
   ```

## 🎯 Test If Emulator Works

1. **Boot emulator**
2. **Try clicking Settings app** (gear icon)
3. **Try swiping** up/down/left/right
4. **Try typing** in search bar

If none work → Hardware acceleration issue
If some work → Touch calibration issue

## 📋 Troubleshooting Checklist

- [ ] Hardware acceleration enabled in BIOS
- [ ] Hyper-V enabled in Windows
- [ ] Emulator graphics set to "Hardware - GLES 2.0"
- [ ] Sufficient RAM allocated (2048+ MB)
- [ ] Cold boot performed
- [ ] Touch input enabled
- [ ] Windows compatibility mode tested
- [ ] Alternative emulator tried

## ✅ Success Test

Emulator is working when you can:
- Click apps on home screen
- Swipe between screens
- Type in text fields
- Use navigation buttons

## 🎯 Ready for App Testing

Once emulator responds to touch:
1. **Install your app**: `npx expo start`
2. **Test basic navigation**
3. **Follow the manual testing guide**

The hardware acceleration fix solves 80% of emulator touch issues! 🚀 