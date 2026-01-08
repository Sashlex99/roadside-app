// Enhanced Driver Lock Functions with Phase 4 Recovery
// Wraps existing driver lock operations with circuit breaker protection

import { circuitBreakers, executeWithCircuitBreaker } from '../../utils/circuitBreakerInstances';
import { withTimeout, isTimeoutError, LockAcquisitionError } from '../../utils/timeoutUtils';
import { createCompensationContext } from '../../utils/compensationActions';
import { 
  lockDriver as originalLockDriver, 
  unlockDriver as originalUnlockDriver,
  isDriverLocked as originalIsDriverLocked,
  forceUnlockDriver as originalForceUnlockDriver,
  cleanupExpiredDriverLocks as originalCleanupExpiredDriverLocks
} from './driverLocks';
import { LockResult } from '../../types/firestore';

/**
 * Enhanced driver lock with circuit breaker protection
 * @param driverId - ID of the driver to lock
 * @param orderId - ID of the order
 * @param timeoutMinutes - Lock timeout in minutes
 * @param bidId - Optional bid ID
 * @returns Promise<LockResult>
 */
export const lockDriverWithRecovery = async (
  driverId: string, 
  orderId: string, 
  timeoutMinutes: number = 5,
  bidId?: string
): Promise<LockResult> => {
  console.log(`🔒 Starting enhanced driver lock: driver=${driverId}, order=${orderId}, timeout=${timeoutMinutes}min`);
  
  const compensationContext = createCompensationContext('lockDriverWithRecovery');
  let lockAcquired = false;

  try {
    // Execute with circuit breaker protection
    const result = await executeWithCircuitBreaker('driver-locks', async () => {
      return await withTimeout(
        originalLockDriver(driverId, orderId, timeoutMinutes, bidId),
        10000, // 10 second timeout for lock acquisition
        `Driver lock acquisition timeout for ${driverId}`,
        'driver-lock-acquisition'
      );
    });

    lockAcquired = true;
    
    // Add compensation action for automatic unlock if something goes wrong later
    compensationContext.addDriverUnlock(driverId, orderId);
    
    console.log(`✅ Enhanced driver lock acquired: ${driverId} for order ${orderId}`);
    
    return result;

  } catch (error) {
    console.error(`❌ Enhanced driver lock failed: ${error instanceof Error ? error.message : error}`);
    
    // Determine error type for better handling
    const errorType = isTimeoutError(error) ? 'timeout' :
                     error instanceof LockAcquisitionError ? 'lock_acquisition' :
                     error instanceof Error && error.message.includes('Circuit breaker') ? 'circuit_breaker' :
                     error instanceof Error && error.message.includes('locked') ? 'already_locked' :
                     'unknown';
    
    console.log(`🔍 Lock error type: ${errorType}`);
    
    // For certain error types, we might want to retry or take specific actions
    if (errorType === 'already_locked') {
      // This is a business logic error, not a system failure
      console.log(`⚠️ Driver ${driverId} is already locked - this is expected behavior`);
    } else if (errorType === 'circuit_breaker') {
      console.log(`🚫 Circuit breaker protecting against further lock attempts`);
    }
    
    // Execute any compensation actions if needed
    if (lockAcquired && compensationContext.getActions().length > 0) {
      try {
        const compensationResult = await compensationContext.executeAll(error as Error);
        
        if (compensationResult.success) {
          console.log(`✅ Lock compensation completed successfully`);
        } else {
          console.error(`⚠️ Lock compensation partial failure`);
        }
        
      } catch (compensationError) {
        console.error(`💥 Lock compensation failed:`, compensationError);
      }
    }
    
    throw error;
  }
};

/**
 * Enhanced driver unlock with circuit breaker protection
 * @param driverId - ID of the driver to unlock
 * @param orderId - ID of the order
 * @returns Promise<void>
 */
export const unlockDriverWithRecovery = async (
  driverId: string, 
  orderId: string
): Promise<void> => {
  console.log(`🔓 Starting enhanced driver unlock: driver=${driverId}, order=${orderId}`);

  try {
    // Execute with circuit breaker protection
    await executeWithCircuitBreaker('driver-locks', async () => {
      return await withTimeout(
        originalUnlockDriver(driverId, orderId),
        5000, // 5 second timeout for unlock
        `Driver unlock timeout for ${driverId}`,
        'driver-unlock'
      );
    });

    console.log(`✅ Enhanced driver unlock completed: ${driverId}`);

  } catch (error) {
    console.error(`❌ Enhanced driver unlock failed: ${error instanceof Error ? error.message : error}`);
    
    // Unlock failures are generally less critical than lock failures
    // Log the error but don't necessarily fail the whole operation
    const errorType = isTimeoutError(error) ? 'timeout' :
                     error instanceof Error && error.message.includes('Circuit breaker') ? 'circuit_breaker' :
                     error instanceof Error && error.message.includes('not found') ? 'not_locked' :
                     'unknown';
    
    if (errorType === 'not_locked') {
      console.log(`ℹ️ Driver ${driverId} was not locked - this may be expected`);
      // Don't throw error for "not locked" cases as this might be normal
      return;
    }
    
    throw error;
  }
};

/**
 * Enhanced driver lock status check with circuit breaker protection
 * @param driverId - ID of the driver to check
 * @returns Promise with lock status
 */
export const isDriverLockedWithRecovery = async (driverId: string) => {
  console.log(`🔍 Checking enhanced driver lock status: ${driverId}`);

  try {
    // Execute with circuit breaker protection
    const result = await executeWithCircuitBreaker('database-queries', async () => {
      return await withTimeout(
        originalIsDriverLocked(driverId),
        3000, // 3 second timeout for status check
        `Driver lock status check timeout for ${driverId}`,
        'driver-lock-status'
      );
    });

    console.log(`✅ Enhanced driver lock status retrieved: ${driverId}`, result);
    return result;

  } catch (error) {
    console.error(`❌ Enhanced driver lock status check failed: ${error instanceof Error ? error.message : error}`);
    
    // For status checks, we might want to return a default state in some cases
    const errorType = isTimeoutError(error) ? 'timeout' :
                     error instanceof Error && error.message.includes('Circuit breaker') ? 'circuit_breaker' :
                     'unknown';
    
    if (errorType === 'circuit_breaker') {
      console.log(`🚫 Circuit breaker is protecting - assuming driver might be locked`);
      // Return a conservative assumption when circuit breaker is open
      return { isLocked: true, lockReason: 'circuit_breaker_protection' };
    }
    
    throw error;
  }
};

/**
 * Enhanced force unlock with circuit breaker protection (admin function)
 * @param driverId - ID of the driver to force unlock
 * @param reason - Reason for force unlock
 * @returns Promise<void>
 */
export const forceUnlockDriverWithRecovery = async (
  driverId: string, 
  reason: string = 'Manual intervention'
): Promise<void> => {
  console.log(`🚨 Starting enhanced force driver unlock: driver=${driverId}, reason=${reason}`);

  try {
    // Execute with circuit breaker protection
    await executeWithCircuitBreaker('driver-locks', async () => {
      return await withTimeout(
        originalForceUnlockDriver(driverId, reason),
        8000, // 8 second timeout for force unlock
        `Force driver unlock timeout for ${driverId}`,
        'force-driver-unlock'
      );
    });

    console.log(`✅ Enhanced force driver unlock completed: ${driverId}`);

  } catch (error) {
    console.error(`❌ Enhanced force driver unlock failed: ${error instanceof Error ? error.message : error}`);
    
    // Force unlock is an admin operation, so failures should be reported
    throw error;
  }
};

/**
 * Enhanced cleanup with circuit breaker protection
 * @returns Promise with cleanup result
 */
export const cleanupExpiredDriverLocksWithRecovery = async () => {
  console.log(`🧹 Starting enhanced driver lock cleanup`);

  try {
    // Execute with circuit breaker protection
    const result = await executeWithCircuitBreaker('order-cleanup', async () => {
      return await withTimeout(
        originalCleanupExpiredDriverLocks(),
        30000, // 30 second timeout for cleanup
        'Driver lock cleanup timeout',
        'driver-lock-cleanup'
      );
    });

    console.log(`✅ Enhanced driver lock cleanup completed:`, result);
    return result;

  } catch (error) {
    console.error(`❌ Enhanced driver lock cleanup failed: ${error instanceof Error ? error.message : error}`);
    
    // Cleanup failures are not critical for ongoing operations
    const errorType = isTimeoutError(error) ? 'timeout' :
                     error instanceof Error && error.message.includes('Circuit breaker') ? 'circuit_breaker' :
                     'unknown';
    
    if (errorType === 'circuit_breaker') {
      console.log(`🚫 Circuit breaker protecting cleanup - will retry later`);
    }
    
    throw error;
  }
};

/**
 * Batch lock multiple drivers with recovery
 * @param lockRequests - Array of lock requests
 * @returns Promise with batch results
 */
export const batchLockDriversWithRecovery = async (
  lockRequests: Array<{
    driverId: string;
    orderId: string;
    timeoutMinutes?: number;
    bidId?: string;
  }>
): Promise<Array<{
  driverId: string;
  success: boolean;
  result?: LockResult;
  error?: string;
}>> => {
  console.log(`🔒 Starting enhanced batch driver lock: ${lockRequests.length} drivers`);
  
  const results = [];
  const compensationContext = createCompensationContext('batchLockDriversWithRecovery');
  
  for (const request of lockRequests) {
    try {
      const result = await lockDriverWithRecovery(
        request.driverId,
        request.orderId,
        request.timeoutMinutes,
        request.bidId
      );
      
      results.push({
        driverId: request.driverId,
        success: true,
        result
      });
      
      // Add compensation for successful locks
      compensationContext.addDriverUnlock(request.driverId, request.orderId);
      
    } catch (error) {
      console.error(`❌ Batch lock failed for driver ${request.driverId}:`, error);
      
      results.push({
        driverId: request.driverId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // If this is a critical failure, consider stopping the batch
      if (error instanceof Error && error.message.includes('Circuit breaker')) {
        console.log(`🚫 Circuit breaker open - stopping batch lock operation`);
        break;
      }
    }
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  console.log(`📊 Batch lock completed: ${successful} successful, ${failed} failed`);
  
  return results;
};

/**
 * Health check for driver lock system
 * @returns System health information
 */
export const getDriverLockSystemHealth = async () => {
  console.log(`🔍 Checking driver lock system health`);
  
  try {
    const driverLockCB = circuitBreakers.driverLocks;
    const health = driverLockCB.getHealth();
    const stats = driverLockCB.getStats();
    
    return {
      healthy: health.healthy,
      circuitBreakerStatus: health.status,
      failures: stats.failures,
      successes: stats.successes,
      lastFailure: health.lastFailure,
      uptime: health.metadata?.uptime,
      errorRate: health.metadata?.errorRate
    };
    
  } catch (error) {
    console.error(`❌ Failed to get driver lock system health:`, error);
    return {
      healthy: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Emergency reset of driver lock circuit breaker
 * @param reason - Reason for reset
 */
export const resetDriverLockCircuitBreaker = (reason: string = 'Manual reset') => {
  console.log(`🔄 Resetting driver lock circuit breaker: ${reason}`);
  circuitBreakers.driverLocks.reset();
  console.log(`✅ Driver lock circuit breaker reset completed`);
};

// Export the original functions for backward compatibility
export {
  originalLockDriver as lockDriver,
  originalUnlockDriver as unlockDriver,
  originalIsDriverLocked as isDriverLocked,
  originalForceUnlockDriver as forceUnlockDriver,
  originalCleanupExpiredDriverLocks as cleanupExpiredDriverLocks
};

console.log('🔄 Enhanced driver lock functions with recovery initialized'); 