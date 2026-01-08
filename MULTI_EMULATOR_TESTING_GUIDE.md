# Multi-Emulator Testing Guide

## 🎯 Purpose
Test the Phase 1 Smart Conflict Resolution feature using multiple Android emulators on your PC, simulating multiple clients and drivers.

## 📋 Prerequisites
- Windows PC with at least 8GB RAM (16GB recommended)
- Android Studio installed
- Android SDK installed
- Your React Native project ready

## 🚀 Quick Setup

### Step 1: Create Emulators
Run the setup script:
```bash
./setup-emulators.bat
```

**Or manually create in Android Studio:**
1. Open Android Studio → Tools → AVD Manager
2. Create these emulators:
   - **Client-1**: Pixel 6, API 33
   - **Client-2**: Pixel 7, API 33  
   - **Driver-1**: Pixel 6a, API 33
   - **Driver-2**: Pixel 7a, API 33

### Step 2: Start All Emulators
Run the start script:
```bash
./start-emulators.bat
```

**Or manually start each:**
```bash
emulator -avd Client-1
emulator -avd Client-2
emulator -avd Driver-1
emulator -avd Driver-2
```

### Step 3: Install App on All Emulators
1. Wait for all emulators to fully boot
2. Start Expo development server:
   ```bash
   npx expo start
   ```
3. In Expo dev tools, press 'a' to install on all Android devices
4. Or click each emulator in the dev tools to install individually

## 🧪 Testing Scenarios with Multiple Emulators

### Test 1: Same-Order Multiple Bids
**Devices needed**: 1 Client + 1 Driver

1. **Client-1**: Create service request
2. **Driver-1**: Create 3 different bids for the same order
3. **Client-1**: See all 3 bids, accept one
4. **Driver-1**: Should receive notification only for accepted bid

### Test 2: Cross-Order Conflict Resolution
**Devices needed**: 2 Clients + 1 Driver

1. **Client-1**: Create Order A
2. **Client-2**: Create Order B
3. **Driver-1**: Create bid for Order A
4. **Driver-1**: Create bid for Order B
5. **Client-1**: Accept bid for Order A
6. **Client-2**: Should no longer see Driver-1's bid for Order B

### Test 3: Multi-Driver Competition
**Devices needed**: 1 Client + 2 Drivers

1. **Client-1**: Create service request
2. **Driver-1**: Create bid ($50, 30 min)
3. **Driver-2**: Create bid ($60, 25 min)
4. **Client-1**: Should see both bids, accept Driver-2's bid
5. **Driver-2**: Should receive notification
6. **Driver-1**: Should not receive notification

### Test 4: Complex Mixed Scenario
**Devices needed**: 3 Clients + 2 Drivers

1. **Client-1**: Create Order A
2. **Client-2**: Create Order B  
3. **Client-3**: Create Order C
4. **Driver-1**: Create 2 bids for Order A, 1 bid for Order B
5. **Driver-2**: Create 1 bid for Order A, 1 bid for Order C
6. **Client-1**: Accept Driver-1's bid for Order A
7. **Verify**: 
   - Driver-1 works on Order A only
   - Driver-2's bid for Order A is cancelled
   - Driver-2's bid for Order C remains active

## 🔧 Performance Testing

### Load Testing Setup
1. Start all 4 emulators
2. Create 3 simultaneous orders (Client-1, Client-2, Client-3)
3. Have both drivers create multiple bids quickly
4. Test concurrent bid acceptance

### Memory Monitoring
```bash
# Monitor emulator performance
adb shell dumpsys meminfo com.your.app.package
```

## 📱 Emulator Management Tips

### Starting Emulators Efficiently
```bash
# Start with more RAM (if needed)
emulator -avd Client-1 -memory 2048

# Start in separate windows
start "Client-1" emulator -avd Client-1
start "Driver-1" emulator -avd Driver-1
```

### Checking Running Emulators
```bash
adb devices
```

### Stopping All Emulators
```bash
adb devices | grep emulator | cut -f1 | while read line; do adb -s $line emu kill; done
```

### Cleaning Up
```bash
# Stop all emulators
taskkill /f /im emulator.exe

# Clear app data on specific emulator
adb -s emulator-5554 shell pm clear com.your.app.package
```

## 🐛 Troubleshooting

### Common Issues

**Issue**: Emulator is slow
**Solution**: 
- Increase RAM allocation: `-memory 2048`
- Enable Hardware Acceleration in BIOS
- Close unnecessary programs

**Issue**: "HAXM is not installed"
**Solution**: Install Intel HAXM from Android SDK Manager

**Issue**: App crashes on emulator
**Solution**: 
- Check if emulator has Google Play Services
- Use API 33 or latest
- Clear app data and reinstall

**Issue**: Multiple emulators won't start
**Solution**: 
- Increase system RAM
- Start emulators one by one with delays
- Check available disk space

### Performance Optimization
```bash
# Start emulator with performance settings
emulator -avd Client-1 -gpu host -memory 2048 -cores 2
```

## 📊 Testing Checklist

### Before Testing
- [ ] All emulators created and configured
- [ ] Expo development server running
- [ ] App installed on all required emulators
- [ ] Firebase connection working
- [ ] Payment system configured

### During Testing
- [ ] Monitor system performance
- [ ] Check for memory leaks
- [ ] Verify real-time updates across devices
- [ ] Test edge cases and error scenarios

### After Testing
- [ ] Clean up test data
- [ ] Stop all emulators
- [ ] Document any issues found
- [ ] Update test results

## 📋 Test Results Template

```
## Multi-Emulator Testing Results

**Date**: [DATE]
**Tester**: [NAME]
**PC Specs**: [RAM/CPU/OS]
**Emulators Used**: [Number and types]

### Test Results
- [ ] Same-Order Multiple Bids - PASSED/FAILED
- [ ] Cross-Order Conflict Resolution - PASSED/FAILED  
- [ ] Multi-Driver Competition - PASSED/FAILED
- [ ] Complex Mixed Scenario - PASSED/FAILED

### Performance
- [ ] All emulators ran smoothly
- [ ] No memory issues
- [ ] Real-time updates working
- [ ] No crashes or freezes

### Issues Found
1. [Issue description]
2. [Issue description]

### Recommendations
- [Any suggestions for improvements]
```

## 🎯 Success Criteria

✅ **Functional Success**:
- All test scenarios work correctly
- Real-time updates across all emulators
- No race conditions or conflicts
- Proper notification handling

✅ **Performance Success**:
- All emulators run smoothly
- App responsive on all devices
- No memory leaks or crashes
- Quick conflict resolution

✅ **Quality Success**:
- Clean test data after testing
- Consistent behavior across emulators
- Good user experience on all devices

Your multi-emulator testing setup is ready! 🚀 