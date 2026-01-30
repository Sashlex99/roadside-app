// Driver Locking Module
// Atomic driver locking to prevent race conditions during bid reservations

import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction, 
  serverTimestamp, 
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DriverLock, LockResult, LockCleanupResult } from '../../types/firestore';

// Constants
const COLLECTIONS = {
  DRIVER_LOCKS: 'driverLocks'
};

const DEFAULT_LOCK_TIMEOUT_MINUTES = 5;
const MAX_LOCK_ATTEMPTS = 3;
const LOCK_RETRY_DELAY_MS = 100;

/**
 * 🔒 Acquire atomic lock on a driver for specific order
 * Uses Firestore transactions to ensure only one order can lock a driver
 */
export const lockDriver = async (
  driverId: string, 
  orderId: string, 
  timeoutMinutes: number = DEFAULT_LOCK_TIMEOUT_MINUTES,
  bidId?: string
): Promise<LockResult> => {
  const startTime = Date.now();
  console.log('🔒 [DRIVER_LOCK] Attempting to lock driver:', { 
    driverId, 
    orderId, 
    timeoutMinutes,
    bidId
  });
  
  let attempt = 0;
  let lastError: Error | null = null;
  
  // Retry logic for handling concurrent lock attempts
  while (attempt < MAX_LOCK_ATTEMPTS) {
    attempt++;
    
    try {
      const lockRef = doc(db, COLLECTIONS.DRIVER_LOCKS, driverId);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + timeoutMinutes * 60 * 1000);
      
      const result = await runTransaction(db, async (transaction) => {
        console.log(`🔒 [DRIVER_LOCK] Transaction attempt ${attempt} for driver ${driverId}`);
        
        // Check if lock already exists
        const existingLockDoc = await transaction.get(lockRef);
        
        if (existingLockDoc.exists()) {
          const lockData = existingLockDoc.data() as DriverLock;
          console.log('🔍 [DRIVER_LOCK] Found existing lock:', {
            driverId,
            lockOrderId: lockData.orderId,
            requestOrderId: orderId,
            expiresAt: lockData.expiresAt
          });
          
          // Convert expiresAt to Date for comparison
          let lockExpiresAt: Date;
          if (lockData.expiresAt && typeof (lockData.expiresAt as any).toDate === 'function') {
            lockExpiresAt = (lockData.expiresAt as Timestamp).toDate();
          } else {
            lockExpiresAt = lockData.expiresAt as Date;
          }
          
          // Check if lock is still valid
          if (lockExpiresAt > now) {
            // Check if it's the same order trying to re-lock (idempotent)
            if (lockData.orderId === orderId) {
              console.log('✅ [DRIVER_LOCK] Same order re-locking - idempotent operation');
              return {
                success: true,
                lockAcquired: true,
                expiresAt: lockExpiresAt,
                duration: Date.now() - startTime
              };
            } else {
              // Lock is held by different order
              const timeRemaining = Math.ceil((lockExpiresAt.getTime() - now.getTime()) / 1000);
              console.log(`🚫 [DRIVER_LOCK] Driver locked by order ${lockData.orderId}, ${timeRemaining}s remaining`);
              
              return {
                success: false,
                lockAcquired: false,
                error: `Driver ${driverId} is locked by order ${lockData.orderId} for ${timeRemaining}s`,
                conflictOrderId: lockData.orderId
              };
            }
          } else {
            // Lock has expired - clean it up
            console.log('🧹 [DRIVER_LOCK] Cleaning expired lock:', {
              driverId,
              expiredOrderId: lockData.orderId,
              expiredAt: lockExpiresAt
            });
          }
        }
        
        // Create new lock (either no lock exists or expired lock was found)
        const lockData: DriverLock = {
          isLocked: true,
          orderId,
          lockedAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(expiresAt),
          lockReason: 'bid_reservation',
          metadata: {
            bidId,
            reservationStartTime: serverTimestamp(),
            debugInfo: `Lock attempt ${attempt}`
          }
        };
        
        transaction.set(lockRef, lockData);
        
        console.log('✅ [DRIVER_LOCK] Lock acquired in transaction:', {
          driverId,
          orderId,
          expiresAt,
          attempt
        });
        
        return {
          success: true,
          lockAcquired: true,
          expiresAt,
          duration: Date.now() - startTime
        };
      });
      
      // If we get here, transaction succeeded
      return result;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ [DRIVER_LOCK] Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      // If this is a transaction conflict, wait and retry
      if (error instanceof Error && error.message.includes('transaction')) {
        if (attempt < MAX_LOCK_ATTEMPTS) {
          const delay = LOCK_RETRY_DELAY_MS * attempt; // Exponential backoff
          console.log(`🔄 [DRIVER_LOCK] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // For other errors, return immediately
      break;
    }
  }
  
  // All attempts failed
  const duration = Date.now() - startTime;
  console.error('❌ [DRIVER_LOCK] Failed to acquire lock after all attempts:', {
    driverId,
    orderId,
    attempts: attempt,
    duration,
    lastError: lastError?.message
  });
  
  return {
    success: false,
    lockAcquired: false,
    error: `Failed to lock driver after ${attempt} attempts: ${lastError?.message}`,
    duration
  };
};

/**
 * 🔓 Release atomic lock on a driver with ownership verification
 */
export const unlockDriver = async (
  driverId: string, 
  orderId: string,
  reason: string = 'Operation completed'
): Promise<LockResult> => {
  const startTime = Date.now();
  console.log('🔓 [DRIVER_LOCK] Attempting to unlock driver:', { driverId, orderId, reason });
  
  try {
    const lockRef = doc(db, COLLECTIONS.DRIVER_LOCKS, driverId);
    
    const result = await runTransaction(db, async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      
      if (!lockDoc.exists()) {
        console.log('ℹ️ [DRIVER_LOCK] No lock found for driver - already unlocked');
        return {
          success: true,
          lockAcquired: false, // Wasn't locked
          duration: Date.now() - startTime
        };
      }
      
      const lockData = lockDoc.data() as DriverLock;
      
      // Verify ownership before unlocking
      if (lockData.orderId === orderId) {
        transaction.delete(lockRef);
        console.log('✅ [DRIVER_LOCK] Driver unlocked successfully:', {
          driverId,
          orderId,
          reason,
          lockDuration: Date.now() - startTime
        });
        
        return {
          success: true,
          lockAcquired: true, // Was locked and now unlocked
          duration: Date.now() - startTime
        };
      } else {
        // Lock is owned by a different order - this is OK, don't unlock it
        // Return success=true because from caller's perspective, this isn't an error
        // The driver might already be working on a new order
        console.log('ℹ️ [DRIVER_LOCK] Lock owned by different order, skipping unlock:', {
          driverId,
          requestOrderId: orderId,
          lockOwnerOrderId: lockData.orderId
        });

        return {
          success: true, // Changed from false - this is idempotent, not an error
          lockAcquired: false,
          error: `Driver is locked by different order ${lockData.orderId}`, // Still include info for logging
          conflictOrderId: lockData.orderId,
          duration: Date.now() - startTime
        };
      }
    });
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ [DRIVER_LOCK] Error unlocking driver:', error);
    
    return {
      success: false,
      lockAcquired: false,
      error: `Failed to unlock driver: ${error instanceof Error ? error.message : String(error)}`,
      duration
    };
  }
};

/**
 * 🔍 Check if driver is currently locked and by which order
 */
export const isDriverLocked = async (driverId: string): Promise<{
  isLocked: boolean;
  lockedBy?: string;
  expiresAt?: Date;
  lockReason?: string;
}> => {
  try {
    const lockRef = doc(db, COLLECTIONS.DRIVER_LOCKS, driverId);
    const lockDoc = await getDoc(lockRef);
    
    if (!lockDoc.exists()) {
      return { isLocked: false };
    }
    
    const lockData = lockDoc.data() as DriverLock;
    
    // Check if lock is still valid
    let expiresAt: Date;
    if (lockData.expiresAt && typeof (lockData.expiresAt as any).toDate === 'function') {
      expiresAt = (lockData.expiresAt as Timestamp).toDate();
    } else {
      expiresAt = lockData.expiresAt as Date;
    }
    
    const now = new Date();
    
    if (expiresAt <= now) {
      // Lock has expired - clean it up
      console.log('🧹 [DRIVER_LOCK] Found expired lock, cleaning up:', {
        driverId,
        expiredOrderId: lockData.orderId
      });
      
      try {
        await deleteDoc(lockRef);
      } catch (cleanupError) {
        console.warn('⚠️ [DRIVER_LOCK] Failed to cleanup expired lock:', cleanupError);
      }
      
      return { isLocked: false };
    }
    
    return {
      isLocked: true,
      lockedBy: lockData.orderId,
      expiresAt,
      lockReason: lockData.lockReason
    };
    
  } catch (error) {
    console.error('❌ [DRIVER_LOCK] Error checking driver lock status:', error);
    return { isLocked: false };
  }
};

/**
 * 🧹 Clean up expired driver locks (for scheduled cleanup)
 */
export const cleanupExpiredDriverLocks = async (): Promise<LockCleanupResult> => {
  console.log('🧹 [DRIVER_LOCK] Starting expired locks cleanup...');
  
  const errors: string[] = [];
  const expiredLocks: string[] = [];
  let cleanedCount = 0;
  
  try {
    const now = new Date();
    const locksQuery = query(
      collection(db, COLLECTIONS.DRIVER_LOCKS),
      where('expiresAt', '<', Timestamp.fromDate(now))
    );
    
    const expiredLocksSnapshot = await getDocs(locksQuery);
    
    if (expiredLocksSnapshot.empty) {
      console.log('✅ [DRIVER_LOCK] No expired locks found');
      return { cleaned: 0, errors: [], expiredLocks: [] };
    }
    
    console.log(`🧹 [DRIVER_LOCK] Found ${expiredLocksSnapshot.size} expired locks`);
    
    const batch = writeBatch(db);
    
    expiredLocksSnapshot.forEach(doc => {
      const lockData = doc.data() as DriverLock;
      console.log(`🧹 [DRIVER_LOCK] Cleaning expired lock: driver=${doc.id}, order=${lockData.orderId}`);
      
      batch.delete(doc.ref);
      expiredLocks.push(`${doc.id}:${lockData.orderId}`);
      cleanedCount++;
    });
    
    await batch.commit();
    console.log(`✅ [DRIVER_LOCK] Cleaned ${cleanedCount} expired locks`);
    
    return { cleaned: cleanedCount, errors, expiredLocks };
    
  } catch (error) {
    const errorMsg = `Cleanup error: ${error instanceof Error ? error.message : String(error)}`;
    console.error('❌ [DRIVER_LOCK] Error during cleanup:', errorMsg);
    errors.push(errorMsg);
    
    return { cleaned: cleanedCount, errors, expiredLocks };
  }
};

/**
 * 🔄 Force unlock driver (emergency use only)
 */
export const forceUnlockDriver = async (
  driverId: string,
  reason: string = 'Emergency unlock'
): Promise<LockResult> => {
  console.warn('🚨 [DRIVER_LOCK] FORCE UNLOCK:', { driverId, reason });
  
  try {
    const lockRef = doc(db, COLLECTIONS.DRIVER_LOCKS, driverId);
    await deleteDoc(lockRef);
    
    console.log('✅ [DRIVER_LOCK] Driver force unlocked:', { driverId, reason });
    
    return {
      success: true,
      lockAcquired: true, // Was locked, now unlocked
    };
    
  } catch (error) {
    console.error('❌ [DRIVER_LOCK] Force unlock failed:', error);
    
    return {
      success: false,
      lockAcquired: false,
      error: `Force unlock failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * 📊 Get lock statistics for monitoring
 */
export const getLockStatistics = async (): Promise<{
  activeLocks: number;
  locksByReason: Record<string, number>;
  oldestLock?: { driverId: string; orderId: string; age: number };
}> => {
  try {
    const locksQuery = query(collection(db, COLLECTIONS.DRIVER_LOCKS));
    const locksSnapshot = await getDocs(locksQuery);
    
    if (locksSnapshot.empty) {
      return { activeLocks: 0, locksByReason: {} };
    }
    
    const locksByReason: Record<string, number> = {};
    let oldestLock: { driverId: string; orderId: string; age: number } | undefined;
    const now = Date.now();
    
    locksSnapshot.forEach(doc => {
      const lockData = doc.data() as DriverLock;
      
      // Count by reason
      locksByReason[lockData.lockReason] = (locksByReason[lockData.lockReason] || 0) + 1;
      
      // Find oldest lock
      let lockedAt: Date;
      if (lockData.lockedAt && typeof (lockData.lockedAt as any).toDate === 'function') {
        lockedAt = (lockData.lockedAt as Timestamp).toDate();
      } else {
        lockedAt = lockData.lockedAt as Date;
      }
      
      const age = now - lockedAt.getTime();
      
      if (!oldestLock || age > oldestLock.age) {
        oldestLock = {
          driverId: doc.id,
          orderId: lockData.orderId,
          age
        };
      }
    });
    
    return {
      activeLocks: locksSnapshot.size,
      locksByReason,
      oldestLock
    };
    
  } catch (error) {
    console.error('❌ [DRIVER_LOCK] Error getting lock statistics:', error);
    return { activeLocks: 0, locksByReason: {} };
  }
}; 