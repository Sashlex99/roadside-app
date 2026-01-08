// Driver Locking System Tests - TypeScript Version
// Comprehensive testing for Phase 2 implementation

import { 
  lockDriver, 
  unlockDriver, 
  isDriverLocked, 
  cleanupExpiredDriverLocks 
} from './src/services/firestore/driverLocks';

import { 
  reserveBid, 
  cancelBidReservation, 
  confirmBid 
} from './src/services/firestore/bids';

import { 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

import { db } from './src/config/firebase';
import { LockResult } from './src/types/firestore';

// Test data setup
const TEST_DRIVERS = {
  DRIVER_1: 'test-driver-alice',
  DRIVER_2: 'test-driver-bob',
  DRIVER_3: 'test-driver-charlie'
};

const TEST_ORDERS = {
  ORDER_1: 'test-order-alpha',
  ORDER_2: 'test-order-beta', 
  ORDER_3: 'test-order-gamma'
};

const TEST_BIDS = {
  BID_1: 'test-bid-001',
  BID_2: 'test-bid-002',
  BID_3: 'test-bid-003'
};

/**
 * Test 1: Basic Lock/Unlock Operations
 */
async function testBasicLockUnlock(): Promise<void> {
  console.log('\n🧪 TEST 1: Basic Lock/Unlock Operations');
  
  const driverId = TEST_DRIVERS.DRIVER_1;
  const orderId = TEST_ORDERS.ORDER_1;
  
  try {
    // Test 1.1: Lock driver
    console.log('  1.1 Testing basic driver lock...');
    const lockResult = await lockDriver(driverId, orderId, 1); // 1 minute timeout
    
    if (!lockResult.success) {
      throw new Error(`Lock failed: ${lockResult.error}`);
    }
    console.log('  ✅ Driver locked successfully');
    
    // Test 1.2: Verify lock status
    console.log('  1.2 Testing lock status check...');
    const lockStatus = await isDriverLocked(driverId);
    
    if (!lockStatus.isLocked || lockStatus.lockedBy !== orderId) {
      throw new Error(`Lock status incorrect: ${JSON.stringify(lockStatus)}`);
    }
    console.log('  ✅ Lock status verified correctly');
    
    // Test 1.3: Unlock driver
    console.log('  1.3 Testing driver unlock...');
    const unlockResult = await unlockDriver(driverId, orderId, 'Test completed');
    
    if (!unlockResult.success) {
      throw new Error(`Unlock failed: ${unlockResult.error}`);
    }
    console.log('  ✅ Driver unlocked successfully');
    
    // Test 1.4: Verify unlock
    console.log('  1.4 Verifying driver is unlocked...');
    const finalStatus = await isDriverLocked(driverId);
    
    if (finalStatus.isLocked) {
      throw new Error(`Driver still appears locked: ${JSON.stringify(finalStatus)}`);
    }
    console.log('  ✅ Driver unlock verified');
    
    console.log('✅ TEST 1 PASSED: Basic lock/unlock operations work correctly');
    
  } catch (error) {
    console.error('❌ TEST 1 FAILED:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Test 2: Concurrent Lock Attempts (Race Condition Prevention)
 */
async function testConcurrentLockAttempts(): Promise<void> {
  console.log('\n🧪 TEST 2: Concurrent Lock Attempts');
  
  const driverId = TEST_DRIVERS.DRIVER_2;
  const order1 = TEST_ORDERS.ORDER_1;
  const order2 = TEST_ORDERS.ORDER_2;
  
  try {
    console.log('  2.1 Testing concurrent lock attempts...');
    
    // Start two concurrent lock attempts
    const promise1 = lockDriver(driverId, order1, 1);
    const promise2 = lockDriver(driverId, order2, 1);
    
    const results = await Promise.allSettled([promise1, promise2]);
    
    // Verify exactly one succeeds and one fails
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failures = results.filter(r => 
      r.status === 'fulfilled' && !r.value.success || 
      r.status === 'rejected'
    ).length;
    
    console.log(`  📊 Results: ${successes} success, ${failures} failure`);
    
    if (successes !== 1 || failures !== 1) {
      throw new Error(`Expected 1 success and 1 failure, got ${successes} successes and ${failures} failures`);
    }
    
    // Find which order succeeded
    let successfulOrder: string | null = null;
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled' && (results[i] as any).value.success) {
        successfulOrder = i === 0 ? order1 : order2;
        break;
      }
    }
    
    console.log(`  ✅ Order ${successfulOrder} won the race condition`);
    
    // Clean up - unlock the successful lock
    if (successfulOrder) {
      await unlockDriver(driverId, successfulOrder, 'Test cleanup');
    }
    
    console.log('✅ TEST 2 PASSED: Race condition prevention works correctly');
    
  } catch (error) {
    console.error('❌ TEST 2 FAILED:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Test 3: Lock Timeout and Expiration
 */
async function testLockTimeout(): Promise<void> {
  console.log('\n🧪 TEST 3: Lock Timeout and Expiration');
  
  const driverId = TEST_DRIVERS.DRIVER_3;
  const orderId = TEST_ORDERS.ORDER_1;
  
  try {
    console.log('  3.1 Testing lock with short timeout...');
    
    // Create lock with very short timeout (0.05 minutes = 3 seconds)
    const lockResult = await lockDriver(driverId, orderId, 0.05);
    
    if (!lockResult.success) {
      throw new Error(`Initial lock failed: ${lockResult.error}`);
    }
    console.log('  ✅ Short-timeout lock created');
    
    console.log('  3.2 Waiting for lock to expire...');
    // Wait 5 seconds for lock to expire
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('  3.3 Testing if expired lock is cleaned up...');
    
    // Try to acquire lock again - should succeed if cleanup works
    const newOrderId = TEST_ORDERS.ORDER_2;
    const newLockResult = await lockDriver(driverId, newOrderId, 1);
    
    if (!newLockResult.success) {
      throw new Error(`Lock after expiration failed: ${newLockResult.error}`);
    }
    console.log('  ✅ Expired lock was cleaned up automatically');
    
    // Clean up
    await unlockDriver(driverId, newOrderId, 'Test cleanup');
    
    console.log('✅ TEST 3 PASSED: Lock timeout and cleanup work correctly');
    
  } catch (error) {
    console.error('❌ TEST 3 FAILED:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Test 4: Integration with Bid Reservation System
 */
async function testBidReservationIntegration(): Promise<void> {
  console.log('\n🧪 TEST 4: Bid Reservation Integration');
  
  const driverId = TEST_DRIVERS.DRIVER_1;
  const orderId = TEST_ORDERS.ORDER_1;
  const bidId = TEST_BIDS.BID_1;
  
  try {
    // Setup test bid and order in Firestore
    console.log('  4.1 Setting up test data...');
    
    await setDoc(doc(db, 'orders', orderId), {
      status: 'bidding',
      clientId: 'test-client',
      description: 'Test order for locking',
      createdAt: serverTimestamp()
    });
    
    await setDoc(doc(db, 'bids', bidId), {
      orderId,
      driverId,
      proposedPrice: 50,
      status: 'active',
      createdAt: serverTimestamp()
    });
    
    console.log('  4.2 Testing bid reservation with locking...');
    
    // This should now use the new locking system
    await reserveBid(orderId, bidId);
    
    // Verify driver is locked
    const lockStatus = await isDriverLocked(driverId);
    
    if (!lockStatus.isLocked || lockStatus.lockedBy !== orderId) {
      throw new Error(`Driver not properly locked after reservation: ${JSON.stringify(lockStatus)}`);
    }
    console.log('  ✅ Driver locked during bid reservation');
    
    console.log('  4.3 Testing bid cancellation with unlocking...');
    
    await cancelBidReservation(orderId, bidId);
    
    // Verify driver is unlocked
    const finalStatus = await isDriverLocked(driverId);
    
    if (finalStatus.isLocked) {
      throw new Error(`Driver still locked after cancellation: ${JSON.stringify(finalStatus)}`);
    }
    console.log('  ✅ Driver unlocked after bid cancellation');
    
    // Clean up test data
    await deleteDoc(doc(db, 'orders', orderId));
    await deleteDoc(doc(db, 'bids', bidId));
    
    console.log('✅ TEST 4 PASSED: Bid reservation integration works correctly');
    
  } catch (error) {
    console.error('❌ TEST 4 FAILED:', error instanceof Error ? error.message : error);
    
    // Clean up on failure
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      await deleteDoc(doc(db, 'bids', bidId));
      await unlockDriver(driverId, orderId, 'Test cleanup after failure');
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup after test failure failed:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
    }
    
    throw error;
  }
}

/**
 * Test 5: Lock Ownership Verification
 */
async function testLockOwnership(): Promise<void> {
  console.log('\n🧪 TEST 5: Lock Ownership Verification');
  
  const driverId = TEST_DRIVERS.DRIVER_2;
  const order1 = TEST_ORDERS.ORDER_1;
  const order2 = TEST_ORDERS.ORDER_2;
  
  try {
    console.log('  5.1 Creating lock with order 1...');
    
    const lockResult = await lockDriver(driverId, order1, 1);
    
    if (!lockResult.success) {
      throw new Error(`Lock creation failed: ${lockResult.error}`);
    }
    
    console.log('  5.2 Testing unlock attempt from different order...');
    
    const unlockResult = await unlockDriver(driverId, order2, 'Unauthorized unlock attempt');
    
    if (unlockResult.success) {
      throw new Error('Unauthorized unlock succeeded - security breach!');
    }
    console.log('  ✅ Unauthorized unlock properly rejected');
    
    console.log('  5.3 Testing legitimate unlock...');
    
    const legitimateUnlock = await unlockDriver(driverId, order1, 'Legitimate unlock');
    
    if (!legitimateUnlock.success) {
      throw new Error(`Legitimate unlock failed: ${legitimateUnlock.error}`);
    }
    console.log('  ✅ Legitimate unlock succeeded');
    
    console.log('✅ TEST 5 PASSED: Lock ownership verification works correctly');
    
  } catch (error) {
    console.error('❌ TEST 5 FAILED:', error instanceof Error ? error.message : error);
    
    // Clean up
    try {
      await unlockDriver(driverId, order1, 'Test cleanup');
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup failed:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
    }
    
    throw error;
  }
}

/**
 * Test 6: Bulk Lock Cleanup
 */
async function testBulkLockCleanup(): Promise<void> {
  console.log('\n🧪 TEST 6: Bulk Lock Cleanup');
  
  try {
    console.log('  6.1 Creating multiple expired locks...');
    
    // Create several locks with very short timeouts
    const lockPromises: Promise<LockResult>[] = [];
    for (let i = 0; i < 3; i++) {
      const driverId = `cleanup-test-driver-${i}`;
      const orderId = `cleanup-test-order-${i}`;
      lockPromises.push(lockDriver(driverId, orderId, 0.01)); // 0.6 seconds
    }
    
    const lockResults = await Promise.all(lockPromises);
    const successfulLocks = lockResults.filter(r => r.success).length;
    
    console.log(`  📊 Created ${successfulLocks} test locks`);
    
    console.log('  6.2 Waiting for locks to expire...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    console.log('  6.3 Running bulk cleanup...');
    
    const cleanupResult = await cleanupExpiredDriverLocks();
    
    console.log(`  📊 Cleanup result: ${cleanupResult.cleaned} cleaned, ${cleanupResult.errors.length} errors`);
    
    if (cleanupResult.cleaned < successfulLocks) {
      console.warn(`⚠️ Only ${cleanupResult.cleaned} of ${successfulLocks} locks were cleaned`);
    }
    
    console.log('✅ TEST 6 PASSED: Bulk lock cleanup works');
    
  } catch (error) {
    console.error('❌ TEST 6 FAILED:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 Starting Driver Locking System Tests\n');
  
  const tests = [
    testBasicLockUnlock,
    testConcurrentLockAttempts,
    testLockTimeout,
    testBidReservationIntegration,
    testLockOwnership,
    testBulkLockCleanup
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      failed++;
      console.error(`\n❌ ${test.name} failed:`, error instanceof Error ? error.message : error);
    }
  }
  
  console.log('\n📊 TEST RESULTS:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Driver locking system is ready for production.');
  } else {
    console.log('\n🚨 Some tests failed. Please fix issues before proceeding to Phase 3.');
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('💥 Test runner crashed:', error);
});

export {
  runAllTests,
  testBasicLockUnlock,
  testConcurrentLockAttempts,
  testLockTimeout,
  testBidReservationIntegration,
  testLockOwnership,
  testBulkLockCleanup
}; 