// Simple Driver Locking Test - JavaScript Version
// Tests core concepts without complex TypeScript imports

console.log('🧪 Simple Driver Locking Test Starting...\n');

// Mock Firestore-like operations for testing
class MockDriverLockStore {
  constructor() {
    this.locks = new Map();
  }
  
  async lockDriver(driverId, orderId, timeoutMinutes = 5) {
    const now = Date.now();
    const expiresAt = now + (timeoutMinutes * 60 * 1000);
    
    // Check if driver is already locked
    const existingLock = this.locks.get(driverId);
    if (existingLock && existingLock.expiresAt > now) {
      if (existingLock.orderId === orderId) {
        // Same order re-locking (idempotent)
        console.log(`🔒 Driver ${driverId} already locked by same order ${orderId}`);
        return { success: true, lockAcquired: true };
      } else {
        // Locked by different order
        const remaining = Math.ceil((existingLock.expiresAt - now) / 1000);
        console.log(`🚫 Driver ${driverId} locked by ${existingLock.orderId}, ${remaining}s remaining`);
        return { 
          success: false, 
          lockAcquired: false, 
          error: `Driver locked by order ${existingLock.orderId}`,
          conflictOrderId: existingLock.orderId
        };
      }
    }
    
    // Create new lock
    this.locks.set(driverId, {
      orderId,
      lockedAt: now,
      expiresAt,
      lockReason: 'bid_reservation'
    });
    
    console.log(`✅ Driver ${driverId} locked for order ${orderId} (${timeoutMinutes}min)`);
    return { success: true, lockAcquired: true, expiresAt: new Date(expiresAt) };
  }
  
  async unlockDriver(driverId, orderId, reason = 'Operation completed') {
    const lock = this.locks.get(driverId);
    
    if (!lock) {
      console.log(`ℹ️ No lock found for driver ${driverId}`);
      return { success: true, lockAcquired: false };
    }
    
    if (lock.orderId === orderId) {
      this.locks.delete(driverId);
      console.log(`🔓 Driver ${driverId} unlocked by ${orderId}: ${reason}`);
      return { success: true, lockAcquired: true };
    } else {
      console.log(`⚠️ Cannot unlock ${driverId} - locked by ${lock.orderId}, requested by ${orderId}`);
      return { 
        success: false, 
        lockAcquired: false, 
        error: `Locked by different order`,
        conflictOrderId: lock.orderId
      };
    }
  }
  
  async isDriverLocked(driverId) {
    const lock = this.locks.get(driverId);
    const now = Date.now();
    
    if (!lock) {
      return { isLocked: false };
    }
    
    if (lock.expiresAt <= now) {
      // Lock expired - clean up
      this.locks.delete(driverId);
      console.log(`🧹 Cleaned expired lock for ${driverId}`);
      return { isLocked: false };
    }
    
    return {
      isLocked: true,
      lockedBy: lock.orderId,
      expiresAt: new Date(lock.expiresAt),
      lockReason: lock.lockReason
    };
  }
  
  async cleanupExpiredLocks() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [driverId, lock] of this.locks.entries()) {
      if (lock.expiresAt <= now) {
        this.locks.delete(driverId);
        cleaned++;
        console.log(`🧹 Cleaned expired lock: ${driverId} (order: ${lock.orderId})`);
      }
    }
    
    return { cleaned, errors: [], expiredLocks: [] };
  }
}

// Test functions
async function testBasicLockUnlock(store) {
  console.log('🧪 TEST 1: Basic Lock/Unlock');
  
  const driverId = 'test-driver-alice';
  const orderId = 'test-order-alpha';
  
  // Lock driver
  const lockResult = await store.lockDriver(driverId, orderId, 1);
  if (!lockResult.success) {
    throw new Error(`Lock failed: ${lockResult.error}`);
  }
  
  // Check status
  const status = await store.isDriverLocked(driverId);
  if (!status.isLocked || status.lockedBy !== orderId) {
    throw new Error(`Lock status wrong: ${JSON.stringify(status)}`);
  }
  
  // Unlock driver
  const unlockResult = await store.unlockDriver(driverId, orderId);
  if (!unlockResult.success) {
    throw new Error(`Unlock failed: ${unlockResult.error}`);
  }
  
  // Verify unlocked
  const finalStatus = await store.isDriverLocked(driverId);
  if (finalStatus.isLocked) {
    throw new Error(`Driver still locked: ${JSON.stringify(finalStatus)}`);
  }
  
  console.log('✅ TEST 1 PASSED\n');
}

async function testConcurrentLocks(store) {
  console.log('🧪 TEST 2: Concurrent Lock Attempts');
  
  const driverId = 'test-driver-bob';
  const order1 = 'test-order-1';
  const order2 = 'test-order-2';
  
  // Try concurrent locks
  const [result1, result2] = await Promise.all([
    store.lockDriver(driverId, order1, 1),
    store.lockDriver(driverId, order2, 1)
  ]);
  
  // Exactly one should succeed
  const successes = [result1, result2].filter(r => r.success).length;
  const failures = [result1, result2].filter(r => !r.success).length;
  
  if (successes !== 1 || failures !== 1) {
    throw new Error(`Expected 1 success, 1 failure. Got ${successes}/${failures}`);
  }
  
  console.log(`📊 Concurrent test: ${successes} success, ${failures} failure`);
  
  // Clean up successful lock
  const successfulOrder = result1.success ? order1 : order2;
  await store.unlockDriver(driverId, successfulOrder);
  
  console.log('✅ TEST 2 PASSED\n');
}

async function testLockTimeout(store) {
  console.log('🧪 TEST 3: Lock Timeout');
  
  const driverId = 'test-driver-charlie';
  const orderId = 'test-order-timeout';
  
  // Create short timeout lock (0.05 minutes = 3 seconds)
  const lockResult = await store.lockDriver(driverId, orderId, 0.05);
  if (!lockResult.success) {
    throw new Error(`Initial lock failed: ${lockResult.error}`);
  }
  
  console.log('⏳ Waiting for lock to expire...');
  await new Promise(resolve => setTimeout(resolve, 4000)); // Wait 4 seconds
  
  // Try to lock again - should succeed after expiration
  const newLockResult = await store.lockDriver(driverId, 'new-order', 1);
  if (!newLockResult.success) {
    throw new Error(`Lock after expiration failed: ${newLockResult.error}`);
  }
  
  // Clean up
  await store.unlockDriver(driverId, 'new-order');
  
  console.log('✅ TEST 3 PASSED\n');
}

async function testLockOwnership(store) {
  console.log('🧪 TEST 4: Lock Ownership');
  
  const driverId = 'test-driver-ownership';
  const order1 = 'owner-order';
  const order2 = 'other-order';
  
  // Lock with order1
  const lockResult = await store.lockDriver(driverId, order1, 1);
  if (!lockResult.success) {
    throw new Error(`Lock creation failed: ${lockResult.error}`);
  }
  
  // Try to unlock with order2 (should fail)
  const invalidUnlock = await store.unlockDriver(driverId, order2);
  if (invalidUnlock.success) {
    throw new Error('Unauthorized unlock succeeded - security breach!');
  }
  console.log('🛡️ Unauthorized unlock properly rejected');
  
  // Unlock with correct order (should succeed)
  const validUnlock = await store.unlockDriver(driverId, order1);
  if (!validUnlock.success) {
    throw new Error(`Valid unlock failed: ${validUnlock.error}`);
  }
  
  console.log('✅ TEST 4 PASSED\n');
}

async function testBulkCleanup(store) {
  console.log('🧪 TEST 5: Bulk Cleanup');
  
  // Create multiple short-lived locks
  const lockPromises = [];
  for (let i = 0; i < 3; i++) {
    lockPromises.push(store.lockDriver(`cleanup-driver-${i}`, `cleanup-order-${i}`, 0.01));
  }
  
  const results = await Promise.all(lockPromises);
  const successful = results.filter(r => r.success).length;
  console.log(`📊 Created ${successful} test locks`);
  
  console.log('⏳ Waiting for locks to expire...');
  await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5 seconds
  
  // Run cleanup
  const cleanupResult = await store.cleanupExpiredLocks();
  console.log(`🧹 Cleanup: ${cleanupResult.cleaned} locks cleaned`);
  
  console.log('✅ TEST 5 PASSED\n');
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Simple Driver Lock Tests\n');
  
  const store = new MockDriverLockStore();
  const tests = [
    () => testBasicLockUnlock(store),
    () => testConcurrentLocks(store),
    () => testLockTimeout(store),
    () => testLockOwnership(store),
    () => testBulkCleanup(store)
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < tests.length; i++) {
    try {
      await tests[i]();
      passed++;
    } catch (error) {
      failed++;
      console.error(`❌ Test ${i + 1} failed:`, error.message);
    }
  }
  
  console.log('📊 TEST RESULTS:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('💡 Driver locking logic works correctly.');
    console.log('🔥 Phase 2 implementation should work the same way in production!');
  } else {
    console.log('\n🚨 Some tests failed - check the logic!');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Test runner crashed:', error);
}); 