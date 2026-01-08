# 🔍 Comprehensive Debugging Guide

## Rapid Diagnostics Checklist

### 🚨 **Emergency Debug Commands**

```bash
# 1. Quick log export (most important)
# Open browser console and run:
window.logger?.exportLogs()

# 2. Check critical logs only
window.logger?.getLogs().filter(l => l.level === 'ERROR')

# 3. Auth state diagnostics  
console.log('Auth State:', {
  user: window.authContext?.user,
  token: !!window.authContext?.token,
  fbUser: window.firebase?.auth()?.currentUser
})
```

## 🔥 **Top 5 Most Likely Failures**

### 1. **Authentication Sync Issues** (85% of problems)
**Symptoms:**
- "Permission denied" в Firestore
- "No authenticated user" warnings  
- Infinite loading на orders/bids

**Debug Steps:**
```typescript
// Check auth sync
logger.getLogs('AUTH')

// Manual auth check
const { auth } = await import('./src/config/firebase');
console.log('Firebase Auth:', auth.currentUser);
console.log('App User:', useAuth().user);
```

**Common Fix:**
```typescript
// Force re-login if out of sync
await logout();
await login(email, password);
```

### 2. **Order Creation Hanging** (10% of problems)  
**Symptoms:**
- Order modal stuck on "Изпраща заявка..."
- No response after 30+ seconds
- Firebase SDK timeout errors

**Debug Steps:**
```typescript
// Check order creation logs
logger.getLogs().filter(l => l.message.includes('ORDER_CREATE'))

// Check Firebase networking
logger.getLogs().filter(l => l.category === 'FIRESTORE')
```

**Common Fix:**
```bash
# Reset Firebase connection
npm run emulators # Use dev rules
# OR restart app completely
```

### 3. **Payment Flow Broken** (3% of problems)
**Symptoms:**  
- Payment modal doesn't close
- Deep links not working
- Order stuck in "payment_pending"

**Debug Steps:**
```typescript
// Check payment logs
logger.getLogs('PAYMENT')

// Check deep link logs  
logger.getLogs().filter(l => l.message.includes('deep link'))
```

### 4. **Real-time Updates Not Working** (1.5% of problems)
**Symptoms:**
- Bids not appearing
- Order status not updating
- Driver count shows 0

**Debug Steps:**
```typescript
// Check Firestore listeners
logger.getLogs('FIRESTORE').filter(l => l.message.includes('subscrib'))

// Check permission errors
logger.getLogs().filter(l => l.message.includes('permission'))
```

### 5. **Network/Offline Issues** (0.5% of problems)
**Symptoms:**
- "Network error" messages
- Operations failing intermittently

**Debug Steps:**
```typescript
// Check network logs
logger.getLogs('NETWORK')

// Manual connectivity test
import { checkNetworkConnectivity } from './src/utils/networkUtils';
checkNetworkConnectivity().then(console.log);
```

## 🛠️ **Debug Tools Integration**

### Browser Console Commands
```javascript
// Enable debug mode
window.debugMode = true;
window.logger?.setLogLevel('DEBUG');

// Quick auth fix
window.forceAuthRefresh = async () => {
  const auth = await import('./src/config/firebase');
  if (auth.auth.currentUser) {
    const token = await auth.auth.currentUser.getIdToken(true);
    console.log('Refreshed token:', !!token);
  }
};

// Monitor Firestore operations
window.monitorFirestore = () => {
  setInterval(() => {
    const logs = window.logger?.getLogs('FIRESTORE') || [];
    const recent = logs.filter(l => 
      Date.now() - new Date(l.timestamp).getTime() < 10000
    );
    if (recent.length > 0) console.log('Recent Firestore:', recent);
  }, 5000);
};
```

### React Native Flipper Integration
```typescript
// Add to App.tsx for Flipper logging
if (__DEV__) {
  import('flipper').then(flipper => {
    flipper.logger.logLevel = 'debug';
  });
}
```

## 📱 **Device-Specific Debugging** 

### iOS Issues
```bash
# Check iOS logs
npx react-native log-ios

# Common iOS fixes
cd ios && pod install
npx react-native run-ios --reset-cache
```

### Android Issues  
```bash
# Check Android logs
npx react-native log-android

# Check Firebase setup
adb logcat | grep -i firebase

# Common Android fixes
cd android && ./gradlew clean
npx react-native run-android --reset-cache
```

## 🔍 **Production Debugging**

### Remote Log Collection
```typescript
// Add to critical error handling
if (!__DEV__) {
  // Send logs to external service
  const criticalLogs = logger.getLogs().filter(l => l.level === 'ERROR');
  
  // Example: Send to your logging service
  fetch('/api/logs', {
    method: 'POST',
    body: JSON.stringify({ logs: criticalLogs }),
  });
}
```

### User Report Template
```
🐛 **Bug Report Template**

**What happened?**
(User description)

**Debug Info:**
- Device: [iOS/Android]
- App Version: [from package.json]
- User ID: [from auth]
- Timestamp: [when issue occurred]

**Auto-collected logs:**
```
window.logger?.exportLogs()
```

**Firebase State:**
```
console.log({
  authUser: firebase.auth().currentUser?.uid,
  appUser: authContext.user?.uid,
  hasToken: !!authContext.token
})
```
```

## 🎯 **Performance Monitoring**

### Memory Leak Detection
```typescript
// Add to component lifecycle
useEffect(() => {
  const timer = logger.startTimer('component-lifecycle');
  return () => {
    timer.end();
    // Log if component took too long to unmount
  };
}, []);
```

### Firestore Operation Monitoring
```typescript
// Wrap expensive operations
const monitorExpensiveOp = async (name: string, operation: () => Promise<any>) => {
  const timer = logger.startTimer(name);
  try {
    const result = await operation();
    timer.end();
    return result;
  } catch (error) {
    timer.end();
    logger.criticalError('PERF', `${name} failed`, error);
    throw error;
  }
};
```

## 🚀 **Quick Fixes Reference**

| Symptom | Quick Fix |
|---------|-----------|
| Permission denied | `await refreshAuth()` |
| Order hanging | Switch to dev rules + restart |
| Payment stuck | Check deep link handlers |
| No bids showing | Check real-time listener setup |
| App crash | Check unhandled promise rejections |
| Slow performance | Check memory usage + clear cache |

## 📞 **Escalation Procedures**

### When to Escalate to Senior Dev:
1. Auth issues persist after refresh attempts
2. Firebase SDK bugs affecting multiple users  
3. Payment flow completely broken
4. Performance degradation > 50%
5. Data consistency issues

### Information to Collect:
1. Exported logs from `logger.exportLogs()`
2. User reproduction steps
3. Device/platform information
4. Firebase project console screenshots
5. Network conditions during issue 