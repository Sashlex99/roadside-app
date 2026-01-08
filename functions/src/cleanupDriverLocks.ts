import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
try {
  initializeApp();
} catch (error) {
  // App might already be initialized
  logger.debug('Firebase Admin already initialized');
}

const db = getFirestore();

/**
 * 🧹 Scheduled function to clean up expired driver locks
 * Runs every 2 minutes to prevent lock accumulation
 */
export const cleanupExpiredDriverLocks = onSchedule({
  schedule: 'every 2 minutes',
  timeZone: 'UTC',
  memory: '256MiB',
  timeoutSeconds: 60,
  region: 'us-central1'
}, async (event) => {
  const startTime = Date.now();
  logger.info('🧹 Starting expired driver locks cleanup...');
  
  try {
    const now = Timestamp.now();
    
    // Query for expired locks
    const expiredLocksQuery = db.collection('driverLocks')
      .where('expiresAt', '<', now);
    
    const expiredLocksSnapshot = await expiredLocksQuery.get();
    
    if (expiredLocksSnapshot.empty) {
      logger.info('✅ No expired locks found');
      return;
    }
    
    logger.info(`🔍 Found ${expiredLocksSnapshot.size} expired locks to clean`);
    
    // Use batched writes for efficiency
    const batch = db.batch();
    const cleanedLocks: Array<{driverId: string, orderId: string, expiredAt: string}> = [];
    
    expiredLocksSnapshot.forEach(doc => {
      const lockData = doc.data();
      const driverId = doc.id;
      
      logger.info(`🧹 Cleaning expired lock: driver=${driverId}, order=${lockData.orderId}, expired=${lockData.expiresAt.toDate()}`);
      
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
    
    logger.info(`✅ Cleaned ${cleanedLocks.length} expired driver locks in ${duration}ms`, {
      cleanedCount: cleanedLocks.length,
      duration,
      cleanedLocks: cleanedLocks.slice(0, 10) // Log first 10 for debugging
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('❌ Error during driver locks cleanup:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration
    });
    
    // Re-throw to trigger retry mechanism
    throw new Error(`Driver locks cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

/**
 * 🔧 Manual cleanup function for testing/debugging
 * Can be called daily for additional cleanup
 */
export const manualCleanupDriverLocks = onSchedule({
  schedule: 'every 24 hours',
  timeZone: 'UTC',
  memory: '256MiB',
  timeoutSeconds: 120,
  region: 'us-central1'
}, async (event) => {
  logger.info('🔧 Manual driver locks cleanup triggered');
  
  try {
    // Perform the same cleanup logic as the main function
    const startTime = Date.now();
    const now = Timestamp.now();
    
    const expiredLocksQuery = db.collection('driverLocks')
      .where('expiresAt', '<', now);
    
    const expiredLocksSnapshot = await expiredLocksQuery.get();
    
    if (expiredLocksSnapshot.empty) {
      logger.info('✅ Manual cleanup: No expired locks found');
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
    
    logger.info(`✅ Manual cleanup completed: ${cleanedLocks.length} locks in ${duration}ms`);
    
  } catch (error) {
    logger.error('❌ Manual cleanup failed:', error);
    throw error;
  }
});

/**
 * 📊 Get driver locks statistics (for monitoring)
 */
export const getDriverLockStats = onSchedule({
  schedule: 'every 10 minutes',
  timeZone: 'UTC',
  memory: '128MiB',
  timeoutSeconds: 30,
  region: 'us-central1'
}, async (event) => {
  try {
    logger.info('📊 Collecting driver lock statistics...');
    
    // Get all current locks
    const allLocksSnapshot = await db.collection('driverLocks').get();
    
    if (allLocksSnapshot.empty) {
      logger.info('📊 No active driver locks');
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
    
    logger.info('📊 Driver lock statistics:', stats);
    
    // Alert if too many locks or locks are too old
    if (allLocksSnapshot.size > 50) {
      logger.warn('⚠️ High number of active driver locks:', { count: allLocksSnapshot.size });
    }
    
    if (oldestLock && (oldestLock as any).ageMinutes > 30) {
      logger.warn('⚠️ Very old driver lock detected:', oldestLock);
    }
    
  } catch (error) {
    logger.error('❌ Error collecting driver lock statistics:', error);
    throw error;
  }
}); 