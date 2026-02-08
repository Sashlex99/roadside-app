import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Scheduled function to clean up expired driver locks
 * Runs every 2 minutes to prevent lock accumulation
 */
export const cleanupExpiredDriverLocks = onSchedule({
  schedule: 'every 2 minutes',
  timeZone: 'UTC',
  memory: '256MiB',
  timeoutSeconds: 60,
  region: 'europe-west3'
}, async () => {
  const startTime = Date.now();
  console.log('🧹 Starting expired driver locks cleanup...');

  try {
    const now = admin.firestore.Timestamp.now();

    // Query for expired locks
    const expiredLocksQuery = db.collection('driverLocks')
      .where('expiresAt', '<', now);

    const expiredLocksSnapshot = await expiredLocksQuery.get();

    if (expiredLocksSnapshot.empty) {
      console.log('✅ No expired locks found');
      return;
    }

    console.log(`🔍 Found ${expiredLocksSnapshot.size} expired locks to clean`);

    // Use batched writes for efficiency
    const batch = db.batch();
    const cleanedLocks: Array<{driverId: string, orderId: string, expiredAt: string}> = [];

    expiredLocksSnapshot.forEach(doc => {
      const lockData = doc.data();
      const driverId = doc.id;

      console.log(`🧹 Cleaning expired lock: driver=${driverId}, order=${lockData.orderId}, expired=${lockData.expiresAt.toDate()}`);

      // Add to batch delete
      batch.delete(doc.ref);

      // Track for logging
      cleanedLocks.push({
        driverId,
        orderId: lockData.orderId,
        expiredAt: lockData.expiresAt.toDate().toISOString()
      });
    });

    // Execute batch delete
    await batch.commit();

    const duration = Date.now() - startTime;

    console.log(`✅ Cleaned ${cleanedLocks.length} expired driver locks in ${duration}ms`, {
      cleanedCount: cleanedLocks.length,
      duration,
      cleanedLocks: cleanedLocks.slice(0, 10) // Log first 10 for debugging
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('❌ Error during driver locks cleanup:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration
    });

    // Re-throw to trigger retry mechanism
    throw new Error(`Driver locks cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

/**
 * Manual cleanup function for testing/debugging
 * Can be called daily for additional cleanup
 */
export const manualCleanupDriverLocks = onSchedule({
  schedule: 'every 24 hours',
  timeZone: 'UTC',
  memory: '256MiB',
  timeoutSeconds: 120,
  region: 'europe-west3'
}, async () => {
  console.log('🔧 Manual driver locks cleanup triggered');

  try {
    // Perform the same cleanup logic as the main function
    const startTime = Date.now();
    const now = admin.firestore.Timestamp.now();

    const expiredLocksQuery = db.collection('driverLocks')
      .where('expiresAt', '<', now);

    const expiredLocksSnapshot = await expiredLocksQuery.get();

    if (expiredLocksSnapshot.empty) {
      console.log('✅ Manual cleanup: No expired locks found');
      return;
    }

    const batch = db.batch();
    const cleanedLocks: string[] = [];

    expiredLocksSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      cleanedLocks.push(doc.id);
    });

    await batch.commit();
    const duration = Date.now() - startTime;

    console.log(`✅ Manual cleanup completed: ${cleanedLocks.length} locks in ${duration}ms`);

  } catch (error) {
    console.error('❌ Manual cleanup failed:', error);
    throw error;
  }
});

/**
 * Get driver locks statistics (for monitoring)
 */
export const getDriverLockStats = onSchedule({
  schedule: 'every 10 minutes',
  timeZone: 'UTC',
  memory: '128MiB',
  timeoutSeconds: 30,
  region: 'europe-west3'
}, async () => {
  try {
    console.log('📊 Collecting driver lock statistics...');

    // Get all current locks
    const allLocksSnapshot = await db.collection('driverLocks').get();

    if (allLocksSnapshot.empty) {
      console.log('📊 No active driver locks');
      return;
    }

    const now = Date.now();
    let oldestLock: {
      driverId: string;
      orderId: string;
      ageMinutes: number;
      lockedAt: string;
    } | null = null;
    let oldestAge = 0;
    const locksByReason: Record<string, number> = {};

    allLocksSnapshot.forEach(doc => {
      const lockData = doc.data();
      const driverId = doc.id;

      // Count by reason
      const reason = lockData.lockReason || 'unknown';
      locksByReason[reason] = (locksByReason[reason] || 0) + 1;

      // Find oldest lock
      const lockedAt = lockData.lockedAt.toDate().getTime();
      const age = now - lockedAt;

      if (age > oldestAge) {
        oldestAge = age;
        oldestLock = {
          driverId,
          orderId: lockData.orderId,
          ageMinutes: Math.round(age / 60000),
          lockedAt: lockData.lockedAt.toDate().toISOString()
        };
      }
    });

    const stats = {
      activeLocks: allLocksSnapshot.size,
      locksByReason,
      oldestLock,
      timestamp: new Date().toISOString()
    };

    console.log('📊 Driver lock statistics:', stats);

    // Alert if too many locks or locks are too old
    if (allLocksSnapshot.size > 50) {
      console.warn('⚠️ High number of active driver locks:', { count: allLocksSnapshot.size });
    }

    if (oldestLock && (oldestLock as any).ageMinutes > 30) {
      console.warn('⚠️ Very old driver lock detected:', oldestLock);
    }

  } catch (error) {
    console.error('❌ Error collecting driver lock statistics:', error);
    throw error;
  }
});
