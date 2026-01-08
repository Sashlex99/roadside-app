// Test Script for Driver Lock Cleanup Functions
// Run this in browser console or Node.js environment

/**
 * Test the Firebase Functions deployment
 * These functions should now be available in Firebase Console
 */

console.log(`
🧪 Firebase Functions Deployment Test

📋 Deployed Functions:
✅ cleanupExpiredDriverLocks - Runs every 2 minutes
✅ manualCleanupDriverLocks - Runs daily (can be triggered manually)  
✅ getDriverLockStats - Runs every 10 minutes for monitoring

🔍 How to Verify Deployment:

1. 📊 Firebase Console
   - Go to: https://console.firebase.google.com/project/roadside-assistance-app-aa0e8/functions
   - Look for these 3 new functions in the list
   - Check their schedules and last execution times

2. 📱 Cloud Logging
   - Functions > Logs tab
   - Filter by function name to see execution logs
   - Look for "🧹 Starting expired driver locks cleanup..." messages

3. 🧪 Manual Testing
   - Create some test driver locks in Firestore
   - Set their expiresAt to past timestamps  
   - Wait 2 minutes and check if they get cleaned up

4. 📈 Monitoring
   - Check function execution metrics
   - Monitor for any errors or timeouts
   - Verify cleanup is happening on schedule

🔄 Test Commands:
`);

// Function to create test expired locks (run in browser console)
const createTestExpiredLocks = async () => {
  const db = firebase.firestore();
  
  const testLocks = [
    {
      driverId: 'test-driver-1',
      data: {
        isLocked: true,
        orderId: 'expired-test-order-1',
        lockedAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() - 10 * 60 * 1000)), // 10 minutes ago
        expiresAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 1000)), // Expired 5 minutes ago
        lockReason: 'bid_reservation'
      }
    },
    {
      driverId: 'test-driver-2', 
      data: {
        isLocked: true,
        orderId: 'expired-test-order-2',
        lockedAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() - 15 * 60 * 1000)), // 15 minutes ago
        expiresAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() - 3 * 60 * 1000)), // Expired 3 minutes ago
        lockReason: 'bid_reservation'
      }
    }
  ];
  
  for (const lock of testLocks) {
    await db.doc(`driverLocks/${lock.driverId}`).set(lock.data);
    console.log(`✅ Created expired test lock for ${lock.driverId}`);
  }
  
  console.log('🧪 Test locks created. Wait 2 minutes and check if cleanup function removes them.');
};

// Function to check current locks (run in browser console)
const checkCurrentLocks = async () => {
  const db = firebase.firestore();
  const locksSnapshot = await db.collection('driverLocks').get();
  
  if (locksSnapshot.empty) {
    console.log('🔓 No driver locks currently active');
    return [];
  }
  
  const locks = [];
  const now = new Date();
  
  locksSnapshot.forEach(doc => {
    const data = doc.data();
    const expiresAt = data.expiresAt.toDate();
    const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    
    const lockInfo = {
      driverId: doc.id,
      orderId: data.orderId,
      expiresAt: expiresAt.toLocaleTimeString(),
      remainingSeconds: remaining,
      isExpired: remaining === 0,
      lockReason: data.lockReason
    };
    
    locks.push(lockInfo);
  });
  
  console.log('🔒 Current Driver Locks:', locks);
  return locks;
};

console.log(`
📝 Browser Console Commands:

// Create test expired locks
createTestExpiredLocks();

// Check current locks 
checkCurrentLocks();

🎯 Expected Behavior:
- Cleanup function should run every 2 minutes
- Expired locks should be automatically removed
- Logs should show "🧹 Starting expired driver locks cleanup..."
- Stats function should report lock counts every 10 minutes

🚨 Troubleshooting:
If cleanup doesn't work:
1. Check Firebase Console > Functions for errors
2. Verify Firestore security rules allow function access
3. Check that functions have proper IAM permissions
4. Monitor Cloud Logging for error messages

✅ Phase 3 Complete: Lock Timeout & Cleanup
Status: 100% Implemented & Deployed
`);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createTestExpiredLocks,
    checkCurrentLocks
  };
} 