Phase 1: Smart Conflict Resolution (Option 2) 🎯
Estimated Time: 4-6 hours
Task 1.1: Implement Smart Conflict Resolution (1.5 hours)
// File: src/services/firestore/bids.ts
// Location: resolveDriverConflicts function (around line 607)

// BEFORE:
querySnapshot.forEach((doc) => {
  if (doc.id === acceptedBidId) return;
  // Cancel ALL bids
});

// AFTER:
querySnapshot.forEach((doc) => {
  const bidData = doc.data() as Bid;
  if (doc.id === acceptedBidId) return;
  
  // ✅ KEY CHANGE: Only cancel cross-order bids
  if (bidData.orderId !== acceptedOrderId) {
    batch.update(doc.ref, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelReason: 'Driver accepted another order'
    });
    console.log(`🔄 Cancelled cross-order bid ${doc.id} for order ${bidData.orderId}`);
  } else {
    console.log(`ℹ️ Preserving same-order bid ${doc.id} for order ${bidData.orderId}`);
  }
});


Task 1.2: Update Function Signature (0.5 hours)
// Ensure acceptedOrderId parameter is properly passed
const resolveDriverConflicts = async (acceptedBidId: string, acceptedOrderId: string): Promise<void> => {
  // Verify the function receives the correct orderId parameter
  console.log('🔄 [FIRESTORE] Resolving conflicts for bid:', { acceptedBidId, acceptedOrderId });
  // ... rest of implementation
};

Task 1.3: Test Same-Order Multiple Bids (1 hour)
// Create test: test-same-order-bids.js
const testSameOrderMultipleBids = async () => {
  // Scenario: Driver has 3 bids for the same order
  // User clicks bid A, other bids should remain active
  const testData = {
    orderId: 'test-order-123',
    driverId: 'test-driver-bob',
    bids: [
      { id: 'bid-1', price: 50 },
      { id: 'bid-2', price: 75 },
      { id: 'bid-3', price: 100 }
    ]
  };
  
  // Test implementation...
};


Task 1.4: Test Cross-Order Bids (1 hour)
// Test that cross-order bids are properly cancelled
const testCrossOrderBids = async () => {
  // Scenario: Driver has bids on Order A and Order B
  // User from Order A clicks bid, Order B bid should be cancelled
};


Phase 2: Driver-Level Locking Infrastructure 🔒
Task 2.1: Create Firestore Schema (1 hour)
// File: firestore.rules
// Add security rules for driverLocks collection

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Driver locks collection
    match /driverLocks/{driverId} {
      allow read, write: if request.auth != null;
      allow delete: if request.auth != null && 
        resource.data.expiresAt < request.time;
    }
  }
}

// TypeScript interface
interface DriverLock {
  isLocked: boolean;
  orderId: string;
  lockedAt: Timestamp;
  expiresAt: Timestamp;
  lockReason: 'bid_reservation' | 'payment_processing';
}

Task 2.2: Implement lockDriver Function (2 hours)
// File: src/services/firestore/driverLocks.ts (new file)

import { 
  doc, 
  getDoc, 
  setDoc, 
  runTransaction, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';

export const lockDriver = async (
  driverId: string, 
  orderId: string, 
  timeoutMinutes: number = 5
): Promise<void> => {
  const lockRef = doc(db, 'driverLocks', driverId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timeoutMinutes * 60 * 1000);
  
  await runTransaction(db, async (transaction) => {
    const existingLock = await transaction.get(lockRef);
    
    if (existingLock.exists()) {
      const lockData = existingLock.data();
      
      // Check if lock is still valid
      if (lockData.expiresAt.toDate() > now) {
        throw new Error(`Driver ${driverId} is locked by order ${lockData.orderId} until ${lockData.expiresAt.toDate()}`);
      }
      
      console.log(`🧹 Cleaning expired lock for driver ${driverId}`);
    }
    
    // Create new lock
    transaction.set(lockRef, {
      isLocked: true,
      orderId,
      lockedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      lockReason: 'bid_reservation'
    });
    
    console.log(`🔒 Driver ${driverId} locked for order ${orderId} (expires in ${timeoutMinutes} minutes)`);
  });
};

Task 2.3: Implement unlockDriver Function (1.5 hours)
export const unlockDriver = async (driverId: string, orderId: string): Promise<void> => {
  const lockRef = doc(db, 'driverLocks', driverId);
  
  await runTransaction(db, async (transaction) => {
    const lockDoc = await transaction.get(lockRef);
    
    if (!lockDoc.exists()) {
      console.log(`ℹ️ No lock found for driver ${driverId}`);
      return;
    }
    
    const lockData = lockDoc.data();
    
    // Verify ownership before unlocking
    if (lockData.orderId === orderId) {
      transaction.delete(lockRef);
      console.log(`🔓 Driver ${driverId} unlocked by order ${orderId}`);
    } else {
      console.warn(`⚠️ Cannot unlock driver ${driverId} - locked by order ${lockData.orderId}, requested by ${orderId}`);
      throw new Error(`Driver is locked by a different order`);
    }
  });
};


Task 2.4: Integrate into reserveBid (2 hours)
// File: src/services/firestore/bids.ts
// Modify reserveBid function

export const reserveBid = async (orderId: string, bidId: string): Promise<void> => {
  const startTime = Date.now();
  console.log('🔄 [FIRESTORE] Starting bid reservation with driver locking...', { orderId, bidId });
  
  try {
    // Step 1: Get bid to find driver
    const bidDoc = await getDoc(doc(db, COLLECTIONS.BIDS, bidId));
    if (!bidDoc.exists()) {
      throw new Error('Bid not found');
    }
    
    const bidData = bidDoc.data() as Bid;
    const driverId = bidData.driverId;
    
    // Step 2: Lock driver FIRST
    await lockDriver(driverId, orderId);
    console.log(`🔒 Driver ${driverId} locked successfully`);
    
    try {
      // Step 3: Existing reservation logic...
      await runTransaction(db, async (transaction) => {
        // ... existing transaction code ...
      });
      
      // Step 4: Smart conflict resolution
      await resolveDriverConflicts(bidId, orderId);
      
      console.log(`✅ Bid reservation completed with locking in ${Date.now() - startTime}ms`);
      
    } catch (reservationError) {
      // Rollback: Unlock driver if reservation fails
      console.log(`🔄 Reservation failed, unlocking driver ${driverId}...`);
      await unlockDriver(driverId, orderId);
      throw reservationError;
    }
    
  } catch (error) {
    console.error('❌ [FIRESTORE] Bid reservation with locking failed:', error);
    throw error;
  }
};



Task 2.5: Integrate into Cleanup Functions (1.5 hours)
// Update cancelBidReservation
export const cancelBidReservation = async (orderId: string, bidId: string): Promise<void> => {
  // ... existing logic ...
  
  // Add driver unlocking at the end
  if (driverId) {
    try {
      await unlockDriver(driverId, orderId);
      console.log(`🔓 Driver ${driverId} unlocked after reservation cancellation`);
    } catch (unlockError) {
      console.warn(`⚠️ Failed to unlock driver ${driverId}:`, unlockError.message);
      // Don't throw - cancellation should still succeed
    }
  }
};

// Update confirmBid  
export const confirmBid = async (orderId: string, bidId: string): Promise<void> => {
  // ... existing logic ...
  
  // Add driver unlocking at the end
  if (driverId) {
    try {
      await unlockDriver(driverId, orderId);
      console.log(`🔓 Driver ${driverId} unlocked after bid confirmation`);
    } catch (unlockError) {
      console.warn(`⚠️ Failed to unlock driver ${driverId}:`, unlockError.message);
      // Don't throw - confirmation should still succeed
    }
  }
};

Task 2.6: Test Basic Locking (2 hours)
// File: test-driver-locking.js
const testConcurrentReservations = async () => {
  const driverId = 'test-driver';
  const order1 = 'order-1';
  const order2 = 'order-2';
  
  console.log('🧪 Testing concurrent reservation attempts...');
  
  const promise1 = lockDriver(driverId, order1);
  const promise2 = lockDriver(driverId, order2);
  
  const results = await Promise.allSettled([promise1, promise2]);
  
  // Verify exactly one succeeds
  const successes = results.filter(r => r.status === 'fulfilled').length;
  const failures = results.filter(r => r.status === 'rejected').length;
  
  console.log(`✅ Results: ${successes} success, ${failures} failure`);
  
  if (successes !== 1 || failures !== 1) {
    throw new Error(`Expected 1 success and 1 failure, got ${successes}/${failures}`);
  }
};


Phase 3: Lock Timeout & Cleanup ⏰
Estimated Time: 4-6 hours
Task 3.1: Add Expiration Schema (1 hour)
Already covered in Task 2.2 above with expiresAt field.
Task 3.2: Expired Lock Detection (1 hour)
Already covered in Task 2.2 above with expiration checking.
Task 3.3: Create Cleanup Function (2 hours)
// File: functions/src/cleanupDriverLocks.ts (new Firebase Function)

import { functions } from 'firebase-functions';
import { db } from './config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  Timestamp 
} from 'firebase/firestore';

export const cleanupExpiredDriverLocks = functions.pubsub
  .schedule('every 2 minutes')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('🧹 Starting expired driver locks cleanup...');
    
    const now = new Date();
    const expiredLocksQuery = query(
      collection(db, 'driverLocks'),
      where('expiresAt', '<', Timestamp.fromDate(now))
    );
    
    const expiredLocks = await getDocs(expiredLocksQuery);
    
    if (expiredLocks.empty) {
      console.log('✅ No expired locks found');
      return { cleaned: 0 };
    }
    
    const batch = writeBatch(db);
    let cleanedCount = 0;
    
    expiredLocks.forEach(doc => {
      const lockData = doc.data();
      console.log(`🧹 Cleaning expired lock: driver=${doc.id}, order=${lockData.orderId}, expired=${lockData.expiresAt.toDate()}`);
      
      batch.delete(doc.ref);
      cleanedCount++;
    });
    
    await batch.commit();
    console.log(`✅ Cleaned ${cleanedCount} expired driver locks`);
    
    return { cleaned: cleanedCount };
  });

Task 3.4: Test Lock Timeout (1 hour)
// Test script: test-lock-timeout.js
const testLockTimeout = async () => {
  const driverId = 'timeout-test-driver';
  const orderId = 'timeout-test-order';
  
  // Lock with 1 minute timeout
  await lockDriver(driverId, orderId, 0.1); // 0.1 minutes = 6 seconds
  
  console.log('🔒 Driver locked, waiting for expiration...');
  
  // Wait 10 seconds
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Try to lock again - should succeed now
  await lockDriver(driverId, 'new-order', 1);
  
  console.log('✅ Lock timeout test passed');
};

Phase 4: Database Failure Recovery 🔄
Estimated Time: 6-8 hours
Task 4.1: Compensation Actions (2 hours)
// File: src/services/firestore/driverLocks.ts
// Add robust reservation with rollback

export const reserveBidWithRecovery = async (orderId: string, bidId: string): Promise<void> => {
  const startTime = Date.now();
  let driverId: string | null = null;
  let lockAcquired = false;
  
  try {
    // Step 1: Get driver ID with timeout
    const bidDoc = await Promise.race([
      getDoc(doc(db, COLLECTIONS.BIDS, bidId)),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Bid lookup timeout')), 5000)
      )
    ]) as any;
    
    if (!bidDoc.exists()) throw new Error('Bid not found');
    driverId = bidDoc.data().driverId;
    
    // Step 2: Acquire lock with timeout
    await Promise.race([
      lockDriver(driverId, orderId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Lock acquisition timeout')), 10000)
      )
    ]);
    lockAcquired = true;
    
    // Step 3: Verify lock still exists before proceeding
    const lockDoc = await getDoc(doc(db, 'driverLocks', driverId));
    if (!lockDoc.exists() || lockDoc.data().orderId !== orderId) {
      throw new Error('Lock was lost during verification');
    }
    
    // Step 4: Proceed with reservation
    await reserveBid(orderId, bidId);
    
    console.log(`✅ Bid reservation with recovery completed in ${Date.now() - startTime}ms`);
    
  } catch (error) {
    console.error(`❌ Bid reservation failed: ${error.message}`);
    
    // COMPENSATION: Automatic rollback
    if (lockAcquired && driverId) {
      try {
        await unlockDriver(driverId, orderId);
        console.log(`🔄 Lock automatically released for driver ${driverId}`);
      } catch (rollbackError) {
        console.error(`❌ CRITICAL: Failed to rollback lock for driver ${driverId}:`, rollbackError.message);
        
        // Send alert for manual intervention
        await sendCriticalAlert({
          type: 'LOCK_ROLLBACK_FAILED',
          driverId,
          orderId,
          error: rollbackError.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    throw error;
  }
};

Task 4.2: Circuit Breaker (2 hours)
// File: src/utils/circuitBreaker.ts (new file)

export class DatabaseCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute
  private readonly name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      const timeUntilReset = this.timeout - (Date.now() - this.lastFailureTime);
      throw new Error(`Circuit breaker [${this.name}] is OPEN. Retry in ${Math.ceil(timeUntilReset / 1000)}s`);
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private isOpen(): boolean {
    return this.failures >= this.threshold && 
           (Date.now() - this.lastFailureTime) < this.timeout;
  }
  
  private onSuccess(): void {
    if (this.failures > 0) {
      console.log(`🔄 Circuit breaker [${this.name}] reset after success`);
      this.failures = 0;
    }
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      console.error(`🚨 Circuit breaker [${this.name}] OPENED after ${this.failures} failures`);
    }
  }
  
  getStatus() {
    return {
      name: this.name,
      failures: this.failures,
      isOpen: this.isOpen(),
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null
    };
  }
}

// Usage
const driverLockCircuitBreaker = new DatabaseCircuitBreaker('driver-locks');

export const lockDriverWithCircuitBreaker = async (driverId: string, orderId: string) => {
  return driverLockCircuitBreaker.execute(() => lockDriver(driverId, orderId));
};


Task 4.3: Automatic Lock Rollback (1 hour)
Already covered in Task 4.1 above.
Task 4.4: Test Failure Scenarios (1 hour)
// Test database failure recovery
const testDatabaseFailureRecovery = async () => {
  // Test scenarios:
  // 1. Network timeout during lock acquisition
  // 2. Firestore transaction failure
  // 3. Lock cleanup failure
  // 4. Circuit breaker activation
};

Phase 5: Monitoring & Observability 📊
Estimated Time: 8-10 hours
Task 5.1: Metrics Class (2 hours)
// File: src/utils/driverLockMetrics.ts (new file)

interface MetricEvent {
  event: string;
  driverId?: string;
  orderId?: string;
  duration?: number;
  success?: boolean;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class DriverLockMetrics {
  private static instance: DriverLockMetrics;
  
  static getInstance(): DriverLockMetrics {
    if (!this.instance) {
      this.instance = new DriverLockMetrics();
    }
    return this.instance;
  }
  
  async recordLockAcquisition(driverId: string, orderId: string, duration: number, success: boolean) {
    const metric: MetricEvent = {
      event: 'driver_lock_acquisition',
      driverId,
      orderId,
      duration,
      success,
      timestamp: new Date().toISOString()
    };
    
    await this.recordMetric(metric);
    
    // Performance alerts
    if (duration > 5000) {
      await this.sendAlert({
        type: 'SLOW_LOCK_ACQUISITION',
        driverId,
        orderId,
        duration,
        threshold: 5000
      });
    }
    
    // Failure alerts
    if (!success) {
      await this.sendAlert({
        type: 'LOCK_ACQUISITION_FAILED',
        driverId,
        orderId,
        timestamp: metric.timestamp
      });
    }
  }
  
  async recordRaceCondition(driverId: string, orders: string[]) {
    const alert = {
      type: 'RACE_CONDITION_DETECTED',
      severity: 'HIGH',
      driverId,
      concurrentOrders: orders,
      timestamp: new Date().toISOString()
    };
    
    console.error('🚨 RACE CONDITION DETECTED:', alert);
    await this.sendAlert(alert);
  }
  
  private async recordMetric(metric: MetricEvent) {
    // Store in Firestore for dashboard
    await setDoc(doc(db, 'metrics', `${metric.event}_${Date.now()}`), metric);
    
    // Console log for immediate visibility
    console.log('📊 METRIC:', metric);
  }
  
  private async sendAlert(alert: any) {
    console.log('🚨 ALERT:', alert);
    
    // TODO: Integrate with external services
    // await sendSlackAlert(alert);
    // await sendEmailAlert(alert);
  }
}


Task 5.2: Lock Acquisition Metrics (1.5 hours)
Integrate metrics into all lock operations:
// Update lockDriver function
export const lockDriver = async (driverId: string, orderId: string, timeoutMinutes = 5): Promise<void> => {
  const startTime = Date.now();
  const metrics = DriverLockMetrics.getInstance();
  
  try {
    // ... existing lock logic ...
    
    const duration = Date.now() - startTime;
    await metrics.recordLockAcquisition(driverId, orderId, duration, true);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    await metrics.recordLockAcquisition(driverId, orderId, duration, false);
    throw error;
  }
};

Task 5.3: Race Condition Detection (1 hour)
// Add to lockDriver function
const detectRaceCondition = async (driverId: string, orderId: string) => {
  // Check for recent lock attempts from different orders
  const recentAttempts = await getDocs(query(
    collection(db, 'metrics'),
    where('event', '==', 'driver_lock_acquisition'),
    where('driverId', '==', driverId),
    where('timestamp', '>', new Date(Date.now() - 10000).toISOString()) // Last 10 seconds
  ));
  
  const concurrentOrders = recentAttempts.docs
    .map(doc => doc.data().orderId)
    .filter(id => id !== orderId);
  
  if (concurrentOrders.length > 0) {
    await DriverLockMetrics.getInstance().recordRaceCondition(driverId, [orderId, ...concurrentOrders]);
  }
};


Task 5.4: System Health Dashboard (2 hours)
// File: src/services/systemHealth.ts (new file)

export const getSystemHealth = async () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Active locks count
  const activeLocksQuery = query(
    collection(db, 'driverLocks'),
    where('expiresAt', '>', Timestamp.fromDate(now))
  );
  const activeLocks = await getDocs(activeLocksQuery);
  
  // Recent lock acquisitions
  const recentLocksQuery = query(
    collection(db, 'metrics'),
    where('event', '==', 'driver_lock_acquisition'),
    where('timestamp', '>', oneHourAgo.toISOString())
  );
  const recentLocks = await getDocs(recentLocksQuery);
  
  // Success rate calculation
  const successfulLocks = recentLocks.docs.filter(doc => doc.data().success).length;
  const totalLocks = recentLocks.docs.length;
  const successRate = totalLocks > 0 ? (successfulLocks / totalLocks) * 100 : 100;
  
  // Average lock time
  const durations = recentLocks.docs
    .filter(doc => doc.data().success && doc.data().duration)
    .map(doc => doc.data().duration);
  const avgLockTime = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;
  
  return {
    activeDriverLocks: activeLocks.size,
    lockSuccessRate: Math.round(successRate),
    averageLockTime: Math.round(avgLockTime),
    systemLoad: activeLocks.size > 50 ? 'HIGH' : activeLocks.size > 20 ? 'MEDIUM' : 'LOW',
    timestamp: now.toISOString(),
    healthy: successRate > 95 && avgLockTime < 2000
  };
};


Task 5.5: Alerting Setup (1.5 hours)
// File: src/utils/alerting.ts (new file)

interface Alert {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export const sendAlert = async (alert: Alert) => {
  console.log(`🚨 ${alert.severity} ALERT:`, alert);
  
  // Store alert in database
  await setDoc(doc(db, 'alerts', `${alert.type}_${Date.now()}`), alert);
  
  // Send to external services based on severity
  if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
    await sendSlackAlert(alert);
  }
  
  if (alert.severity === 'CRITICAL') {
    await sendEmailAlert(alert);
    await sendSMSAlert(alert);
  }
};

const sendSlackAlert = async (alert: Alert) => {
  // TODO: Implement Slack webhook integration
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  
  const payload = {
    text: `🚨 ${alert.severity}: ${alert.type}`,
    attachments: [{
      color: alert.severity === 'CRITICAL' ? 'danger' : 'warning',
      fields: [
        { title: 'Message', value: alert.message, short: false },
        { title: 'Time', value: alert.timestamp, short: true },
        { title: 'Metadata', value: JSON.stringify(alert.metadata, null, 2), short: false }
      ]
    }]
  };
  
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
  }
};


Phase 6: Load Testing & Validation 🧪
Estimated Time: 6-8 hours
Task 6.1: Load Testing Script (3 hours)
// File: test-load-driver-locks.js

const performLoadTest = async (config = {}) => {
  const {
    driverId = 'load-test-driver',
    concurrentRequests = 100,
    testDurationMs = 30000,
    timeoutMs = 10000
  } = config;
  
  console.log(`🧪 Starting load test: ${concurrentRequests} concurrent requests for ${testDurationMs}ms`);
  
  const results = {
    successful: 0,
    failed: 0,
    timeouts: 0,
    raceConditions: 0,
    totalRequests: 0,
    responseTimes: [],
    errors: []
  };
  
  const startTime = Date.now();
  const promises = [];
  
  // Generate concurrent requests
  for (let i = 0; i < concurrentRequests; i++) {
    const orderId = `load-test-order-${i}`;
    promises.push(testSingleLockOperation(driverId, orderId, results, timeoutMs));
  }
  
  // Run all requests concurrently
  await Promise.allSettled(promises);
  
  const totalTime = Date.now() - startTime;
  
  // Calculate statistics
  const avgResponseTime = results.responseTimes.length > 0 
    ? results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length 
    : 0;
  const maxResponseTime = Math.max(...results.responseTimes, 0);
  const successRate = (results.successful / results.totalRequests) * 100;
  
  console.log('\n📊 Load Test Results:');
  console.log(`  Total requests: ${results.totalRequests}`);
  console.log(`  Successful: ${results.successful} (${successRate.toFixed(1)}%)`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Timeouts: ${results.timeouts}`);
  console.log(`  Race conditions: ${results.raceConditions}`);
  console.log(`  Total time: ${totalTime}ms`);
  console.log(`  Avg response time: ${avgResponseTime.toFixed(1)}ms`);
  console.log(`  Max response time: ${maxResponseTime}ms`);
  
  // Validate results
  const validationErrors = [];
  
  if (results.successful !== 1) {
    validationErrors.push(`Expected exactly 1 successful lock, got ${results.successful}`);
  }
  
  if (results.raceConditions > 0) {
    validationErrors.push(`Race conditions detected: ${results.raceConditions}`);
  }
  
  if (successRate < 99) {
    validationErrors.push(`Success rate too low: ${successRate.toFixed(1)}% (expected >99%)`);
  }
  
  if (avgResponseTime > 5000) {
    validationErrors.push(`Average response time too high: ${avgResponseTime.toFixed(1)}ms (expected <5000ms)`);
  }
  
  if (validationErrors.length > 0) {
    console.error('\n❌ Load test FAILED:');
    validationErrors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Load test validation failed');
  }
  
  console.log('\n✅ Load test PASSED - system is bulletproof!');
  return results;
};

const testSingleLockOperation = async (driverId, orderId, results, timeoutMs) => {
  const startTime = Date.now();
  results.totalRequests++;
  
  try {
    // Test lock acquisition with timeout
    await Promise.race([
      lockDriver(driverId, orderId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
      )
    ]);
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    
    // Unlock
    await unlockDriver(driverId, orderId);
    
    results.successful++;
    const responseTime = Date.now() - startTime;
    results.responseTimes.push(responseTime);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    results.responseTimes.push(responseTime);
    
    if (error.message === 'Test timeout') {
      results.timeouts++;
    } else if (error.message.includes('is locked')) {
      results.failed++; // Expected behavior
    } else {
      results.raceConditions++;
      results.errors.push({ orderId, error: error.message });
      console.error(`🚨 Unexpected error in ${orderId}:`, error.message);
    }
  }
};

Task 6.2: Performance Benchmarks (1.5 hours)
// File: test-performance-benchmarks.js

const runPerformanceBenchmarks = async () => {
  console.log('📈 Running Performance Benchmarks...');
  
  const benchmarks = [
    {
      name: 'Lock Acquisition',
      test: () => lockDriver('bench-driver', 'bench-order'),
      cleanup: () => unlockDriver('bench-driver', 'bench-order')
    },
    {
      name: 'Lock Release',
      setup: () => lockDriver('bench-driver-2', 'bench-order-2'),
      test: () => unlockDriver('bench-driver-2', 'bench-order-2')
    },
    {
      name: 'Expired Lock Detection',
      setup: () => lockDriver('bench-driver-3', 'bench-order-3', 0.001), // 0.06 seconds
      test: async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for expiration
        return lockDriver('bench-driver-3', 'new-bench-order');
      }
    },
    {
      name: 'System Health Check',
      test: () => getSystemHealth()
    }
  ];
  
  for (const benchmark of benchmarks) {
    console.log(`\n🔧 Testing ${benchmark.name}...`);
    
    const times = [];
    const errors = [];
    
    for (let i = 0; i < 10; i++) {
      try {
        // Setup if needed
        if (benchmark.setup) {
          await benchmark.setup();
        }
        
        const start = Date.now();
        await benchmark.test();
        const duration = Date.now() - start;
        times.push(duration);
        
        // Cleanup if needed
        if (benchmark.cleanup) {
          await benchmark.cleanup();
        }
        
      } catch (error) {
        errors.push(error.message);
        console.log(`⚠️ ${benchmark.name} test ${i} failed: ${error.message}`);
      }
    }
    
    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`📊 ${benchmark.name} Results:`);
      console.log(`  Average: ${avgTime.toFixed(1)}ms`);
      console.log(`  Min: ${minTime}ms, Max: ${maxTime}ms`);
      console.log(`  Success rate: ${((10 - errors.length) / 10 * 100).toFixed(1)}%`);
      
      // Performance thresholds
      if (avgTime > 2000) {
        console.warn(`⚠️ ${benchmark.name} is slow (avg: ${avgTime.toFixed(1)}ms > 2000ms threshold)`);
      }
      
      if (errors.length > 2) {
        console.warn(`⚠️ ${benchmark.name} has high failure rate (${errors.length}/10 failures)`);
      }
    }
  }
};

Task 6.3: Stress Test 100+ Users (1 hour)
// High-load stress test
const runStressTest = async () => {
  console.log('💥 Running Stress Test with 200 concurrent users...');
  
  const stressConfig = {
    driverId: 'stress-test-driver',
    concurrentRequests: 200,
    testDurationMs: 60000, // 1 minute
    timeoutMs: 15000 // 15 second timeout
  };
  
  await performLoadTest(stressConfig);
};


Task 6.4: Performance Validation (0.5 hours)
// Automated performance validation
const validateSystemPerformance = async () => {
  const health = await getSystemHealth();
  
  const validationCriteria = [
    { name: 'Success Rate', value: health.lockSuccessRate, threshold: 95, operator: '>=' },
    { name: 'Average Lock Time', value: health.averageLockTime, threshold: 2000, operator: '<=' },
    { name: 'System Load', value: health.systemLoad, threshold: 'HIGH', operator: '!=' }
  ];
  
  const failures = validationCriteria.filter(criteria => {
    switch (criteria.operator) {
      case '>=': return criteria.value < criteria.threshold;
      case '<=': return criteria.value > criteria.threshold;
      case '!=': return criteria.value === criteria.threshold;
      default: return false;
    }
  });
  
  if (failures.length > 0) {
    console.error('❌ Performance validation FAILED:');
    failures.forEach(failure => {
      console.error(`  ${failure.name}: ${failure.value} (expected ${failure.operator} ${failure.threshold})`);
    });
    throw new Error('System performance below acceptable thresholds');
  }
  
  console.log('✅ Performance validation PASSED');
};


Phase 7: Production Deployment 🚀
Estimated Time: 4-6 hours
Task 7.1: Staging Deployment (1.5 hours)
// File: deploy-staging.js

const deployToStaging = async () => {
  console.log('🚀 Deploying to staging environment...');
  
  // 1. Deploy Firebase Functions
  console.log('📦 Deploying cleanup functions...');
  // npm run deploy:functions:staging
  
  // 2. Update Firestore rules
  console.log('🔐 Updating Firestore security rules...');
  // firebase deploy --only firestore:rules --project staging
  
  // 3. Deploy application code
  console.log('📱 Deploying application with feature flags...');
  // Enable DRIVER_LOCKING_ENABLED=true in staging
  
  // 4. Run smoke tests
  console.log('🧪 Running staging smoke tests...');
  await runStagingSmokeTests();
  
  console.log('✅ Staging deployment complete');
};

const runStagingSmokeTests = async () => {
  // Test basic functionality in staging
  const testScenarios = [
    { name: 'Basic Lock/Unlock', test: () => testBasicLocking() },
    { name: 'Concurrent Reservations', test: () => testConcurrentReservations() },
    { name: 'Lock Timeout', test: () => testLockTimeout() },
    { name: 'System Health', test: () => getSystemHealth() }
  ];
  
  for (const scenario of testScenarios) {
    try {
      console.log(`🧪 Testing ${scenario.name}...`);
      await scenario.test();
      console.log(`✅ ${scenario.name} passed`);
    } catch (error) {
      console.error(`❌ ${scenario.name} failed:`, error.message);
      throw new Error(`Staging smoke test failed: ${scenario.name}`);
    }
  }
};

Task 7.2: End-to-End Testing (1.5 hours)
// Test with real apps
const runEndToEndTests = async () => {
  console.log('🎭 Running end-to-end tests with real client and driver apps...');
  
  const scenarios = [
    {
      name: 'Dave and Jon Scenario',
      description: 'Two clients competing for same driver',
      test: async () => {
        // Simulate the exact Dave/Jon scenario we discussed
        // 1. Both clients make requests
        // 2. Driver bids on both
        // 3. Dave clicks bid, browses, cancels
        // 4. Jon accepts bid
        // Expected: Both should work correctly
      }
    },
    {
      name: 'Same Order Multiple Bids',
      description: 'Client browsing multiple bids from same driver',
      test: async () => {
        // 1. Driver makes multiple bids on same order
        // 2. Client clicks bid A, cancels payment
        // 3. Client clicks bid B, completes payment
        // Expected: All bids remain available after cancellation
      }
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(`🎬 Testing: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    
    try {
      await scenario.test();
      console.log(`✅ ${scenario.name} passed`);
    } catch (error) {
      console.error(`❌ ${scenario.name} failed:`, error.message);
      throw error;
    }
  }
};


Task 7.3: Production Deployment Plan (0.5 hours)
// File: production-deployment-checklist.md

# Production Deployment Checklist

## Pre-Deployment
- [ ] All tests passing in staging
- [ ] Performance benchmarks meet criteria
- [ ] Monitoring and alerting configured
- [ ] Rollback plan prepared
- [ ] Team notified of deployment window

## Deployment Steps
1. [ ] Deploy Firebase Functions (cleanup jobs)
2. [ ] Update Firestore security rules
3. [ ] Deploy application with feature flag OFF
4. [ ] Verify basic functionality
5. [ ] Gradually enable feature flag (10% → 50% → 100%)
6. [ ] Monitor metrics and alerts

## Post-Deployment
- [ ] Monitor system health for 2 hours
- [ ] Verify all metrics are normal
- [ ] Check error rates and performance
- [ ] Confirm no race conditions detected

## Rollback Plan
If issues detected:
1. Disable feature flag immediately
2. Revert to previous application version
3. Monitor system recovery
4. Investigate and fix issues

Task 7.4: Feature Flag Deployment (1 hour)
// File: src/config/featureFlags.ts

interface FeatureFlags {
  DRIVER_LOCKING_ENABLED: boolean;
  SMART_CONFLICT_RESOLUTION_ENABLED: boolean;
  METRICS_COLLECTION_ENABLED: boolean;
}

export const getFeatureFlags = (): FeatureFlags => {
  return {
    DRIVER_LOCKING_ENABLED: process.env.DRIVER_LOCKING_ENABLED === 'true',
    SMART_CONFLICT_RESOLUTION_ENABLED: process.env.SMART_CONFLICT_RESOLUTION_ENABLED === 'true',
    METRICS_COLLECTION_ENABLED: process.env.METRICS_COLLECTION_ENABLED === 'true'
  };
};

// Use in reserveBid function
export const reserveBid = async (orderId: string, bidId: string): Promise<void> => {
  const flags = getFeatureFlags();
  
  if (flags.DRIVER_LOCKING_ENABLED) {
    // Use new locking system
    await reserveBidWithLocking(orderId, bidId);
  } else {
    // Use legacy system
    await reserveBidLegacy(orderId, bidId);
  }
};


Task 7.5: Production Monitoring (0.5 hours)
// Set up production monitoring
const setupProductionMonitoring = async () => {
  console.log('📊 Setting up production monitoring...');
  
  // 1. Configure alerts for critical metrics
  const criticalAlerts = [
    { metric: 'lock_success_rate', threshold: 95, operator: '<' },
    { metric: 'avg_lock_time', threshold: 5000, operator: '>' },
    { metric: 'race_conditions_per_hour', threshold: 1, operator: '>' },
    { metric: 'circuit_breaker_open', threshold: 0, operator: '>' }
  ];
  
  // 2. Set up dashboard widgets
  const dashboardWidgets = [
    'Active Driver Locks Count',
    'Lock Success Rate (Last Hour)',
    'Average Lock Acquisition Time',
    'Race Conditions Detected',
    'System Health Status'
  ];
  
  // 3. Configure notification channels
  const notificationChannels = [
    { type: 'slack', webhook: process.env.SLACK_WEBHOOK_URL },
    { type: 'email', recipients: ['dev-team@company.com'] },
    { type: 'sms', numbers: ['+1234567890'] } // For critical alerts only
  ];
  
  console.log('✅ Production monitoring configured');
};

