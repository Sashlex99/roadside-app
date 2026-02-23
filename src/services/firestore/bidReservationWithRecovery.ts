// Enhanced Bid Reservation with Phase 4 Database Failure Recovery
// Integrates circuit breaker, compensation actions, and timeout protection
//
// ✅ ENHANCED: Uses cancellable timeouts with proper rollback handling
// When operations timeout, any writes that complete after timeout are rolled back

import { doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { circuitBreakers, executeWithCircuitBreaker } from '../../utils/circuitBreakerInstances';
import { createCompensationContext } from '../../utils/compensationActions';
import {
  withTimeout,
  withCancellableTimeout,
  withFirestoreTimeout,
  isTimeoutError,
  isLockAcquisitionError,
  OperationState
} from '../../utils/timeoutUtils';
import { lockDriver, unlockDriver } from './driverLocks';

/**
 * Enhanced bid reservation with comprehensive failure recovery
 * @param orderId - ID of the order
 * @param bidId - ID of the bid to reserve
 * @returns Promise<void>
 */
export const reserveBidWithRecovery = async (orderId: string, bidId: string): Promise<void> => {
  console.log(`🚀 Starting enhanced bid reservation: order=${orderId}, bid=${bidId}`);
  
  // Create compensation context to track rollback actions
  const compensationContext = createCompensationContext('reserveBidWithRecovery');
  
  let driverId: string | null = null;
  let bidReserved = false;
  let driverLocked = false;
  
  try {
    // Step 1: Reserve bid with circuit breaker protection
    // ✅ ENHANCED: Uses cancellable timeout with rollback
    const bidData = await executeWithCircuitBreaker('bid-reservation', async () => {
      return await withCancellableTimeout(
        async (token: OperationState) => {
          return await runTransaction(db, async (transaction) => {
            // Check cancellation before proceeding
            if (token.isCancelled) {
              throw new Error('Operation cancelled before transaction start');
            }

            // Get bid data
            const bidRef = doc(db, 'bids', bidId);
            const bidSnap = await transaction.get(bidRef);

            if (!bidSnap.exists()) {
              throw new Error(`Bid ${bidId} not found`);
            }

            const bid = bidSnap.data();

            if (bid.status !== 'pending') {
              throw new Error(`Bid ${bidId} is not pending (status: ${bid.status})`);
            }

            if (bid.orderId !== orderId) {
              throw new Error(`Bid ${bidId} does not belong to order ${orderId}`);
            }

            // Check cancellation again before writing
            if (token.isCancelled) {
              throw new Error('Operation cancelled before write');
            }

            // Reserve the bid
            transaction.update(bidRef, {
              status: 'reserved',
              reservedAt: serverTimestamp(),
              reservationExpiry: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
            });

            console.log(`✅ Bid ${bidId} reserved in transaction`);
            return bid;
          });
        },
        {
          timeoutMs: 15000, // 15 second timeout for reservation
          operationName: 'bid-reservation-transaction',
          // ✅ ROLLBACK: If transaction completes after timeout, revert bid status
          onRollback: async (result, token) => {
            console.log(`🔄 Rolling back bid reservation (completed after timeout)`);
            try {
              const bidRef = doc(db, 'bids', bidId);
              await updateDoc(bidRef, {
                status: 'pending',
                reservedAt: null,
                reservationExpiry: null,
                rollbackReason: 'Timeout rollback',
                rollbackAt: serverTimestamp()
              });
              console.log(`✅ Bid ${bidId} rolled back to pending`);
            } catch (rollbackError) {
              console.error(`❌ Failed to rollback bid ${bidId}:`, rollbackError);
            }
          }
        }
      );
    });
    
    driverId = bidData.driverId;
    bidReserved = true;
    
    // Add compensation action for bid cancellation
    compensationContext.addBidCancellation(bidId, orderId);
    
    console.log(`📦 Bid reserved: ${bidId} for driver ${driverId}`);

    // Step 2: Lock driver with circuit breaker protection
    // ✅ ENHANCED: Uses cancellable timeout with rollback
    if (!driverId) {
      throw new Error('Driver ID is required for locking');
    }

    await executeWithCircuitBreaker('driver-locks', async () => {
      return await withCancellableTimeout(
        async (token: OperationState) => {
          if (token.isCancelled) {
            throw new Error('Lock operation cancelled before start');
          }
          return await lockDriver(driverId!, orderId, 10, bidId); // 10 minute lock
        },
        {
          timeoutMs: 10000, // 10 second timeout
          operationName: 'driver-lock-acquisition',
          // ✅ ROLLBACK: If lock acquired after timeout, release it
          onRollback: async (result, token) => {
            console.log(`🔄 Rolling back driver lock (acquired after timeout)`);
            try {
              await unlockDriver(driverId!, orderId);
              console.log(`✅ Driver ${driverId} lock rolled back`);
            } catch (rollbackError) {
              console.error(`❌ Failed to rollback driver lock:`, rollbackError);
            }
          }
        }
      );
    });
    
    driverLocked = true;
    
    // Add compensation action for driver unlock
    compensationContext.addDriverUnlock(driverId, orderId);
    
    console.log(`🔒 Driver locked: ${driverId} for order ${orderId}`);

    // Step 3: Conflict resolution is handled within the existing bid system
    console.log(`🔄 Driver conflicts will be resolved by existing system for bid ${bidId}`);

    // Step 3: Final validation with circuit breaker protection
    // ✅ ENHANCED: Uses cancellable timeout with rollback
    await executeWithCircuitBreaker('database-queries', async () => {
      return await withCancellableTimeout(
        async (token: OperationState) => {
          return await runTransaction(db, async (transaction) => {
            if (token.isCancelled) {
              throw new Error('Validation cancelled before start');
            }

            // Verify order is still in correct state
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);

            if (!orderSnap.exists()) {
              throw new Error(`Order ${orderId} not found during validation`);
            }

            const orderData = orderSnap.data();

            if (orderData.status !== 'pending' && orderData.status !== 'payment_pending') {
              throw new Error(`Order ${orderId} is no longer in valid state: ${orderData.status}`);
            }

            if (token.isCancelled) {
              throw new Error('Validation cancelled before update');
            }

            // Update order to payment_pending if it was pending
            if (orderData.status === 'pending') {
              transaction.update(orderRef, {
                status: 'payment_pending',
                reservedBidId: bidId,
                reservedDriverId: driverId,
                reservationTimestamp: serverTimestamp()
              });

              console.log(`📋 Order ${orderId} moved to payment_pending`);
            }
          });
        },
        {
          timeoutMs: 8000, // 8 second timeout
          operationName: 'validation-transaction',
          // ✅ ROLLBACK: If order updated after timeout, revert
          onRollback: async (result, token) => {
            console.log(`🔄 Rolling back order status update (completed after timeout)`);
            try {
              const orderRef = doc(db, 'orders', orderId);
              await updateDoc(orderRef, {
                status: 'pending',
                reservedBidId: null,
                reservedDriverId: null,
                reservationTimestamp: null,
                rollbackReason: 'Timeout rollback',
                rollbackAt: serverTimestamp()
              });
              console.log(`✅ Order ${orderId} rolled back to pending`);
            } catch (rollbackError) {
              console.error(`❌ Failed to rollback order ${orderId}:`, rollbackError);
            }
          }
        }
      );
    });

    console.log(`✅ Enhanced bid reservation completed successfully: ${bidId}`);

  } catch (error) {
    console.error(`❌ Enhanced bid reservation failed: ${error instanceof Error ? error.message : error}`);
    
    // Determine error type for better handling
    const errorType = isTimeoutError(error) ? 'timeout' :
                     isLockAcquisitionError(error) ? 'lock_acquisition' :
                     error instanceof Error && error.message.includes('Circuit breaker') ? 'circuit_breaker' :
                     'unknown';
    
    console.log(`🔍 Error type: ${errorType}`);
    
    // Execute compensation actions
    try {
      console.log(`🚨 Executing compensation actions for failed bid reservation...`);
      const compensationResult = await compensationContext.executeAll(error as Error);
      
      if (compensationResult.success) {
        console.log(`✅ Compensation completed successfully (${compensationResult.actionsExecuted} actions)`);
      } else {
        console.error(`⚠️ Partial compensation failure: ${compensationResult.actionsFailed}/${compensationResult.actionsExecuted + compensationResult.actionsFailed} actions failed`);
      }
      
    } catch (compensationError) {
      console.error(`💥 Compensation execution failed:`, compensationError);
      // In a real scenario, this would trigger alerts for manual intervention
    }
    
    // Re-throw the original error
    throw error;
  }
};

/**
 * Enhanced bid confirmation with recovery
 * @param orderId - ID of the order
 * @param bidId - ID of the bid to confirm
 * @returns Promise<void>
 */
export const confirmBidWithRecovery = async (orderId: string, bidId: string): Promise<void> => {
  console.log(`🎯 Starting enhanced bid confirmation: order=${orderId}, bid=${bidId}`);
  
  const compensationContext = createCompensationContext('confirmBidWithRecovery');
  let driverId: string | null = null;

  try {
    // Step 1: Confirm bid with circuit breaker protection
    const result = await executeWithCircuitBreaker('bid-confirmation', async () => {
      return await withTimeout(
        runTransaction(db, async (transaction) => {
          // Get bid data
          const bidRef = doc(db, 'bids', bidId);
          const bidSnap = await transaction.get(bidRef);
          
          if (!bidSnap.exists()) {
            throw new Error(`Bid ${bidId} not found`);
          }
          
          const bid = bidSnap.data();
          
          if (bid.status !== 'reserved') {
            throw new Error(`Bid ${bidId} is not reserved (status: ${bid.status})`);
          }
          
          // Get order data
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await transaction.get(orderRef);
          
          if (!orderSnap.exists()) {
            throw new Error(`Order ${orderId} not found`);
          }
          
          const orderData = orderSnap.data();
          
          if (orderData.status !== 'payment_pending') {
            throw new Error(`Order ${orderId} is not in payment_pending state: ${orderData.status}`);
          }
          
          // Confirm the bid
          transaction.update(bidRef, {
            status: 'accepted',
            acceptedAt: serverTimestamp(),
            reservationExpiry: null
          });
          
          // Update order
          transaction.update(orderRef, {
            status: 'accepted',
            acceptedBidId: bidId,
            acceptedDriverId: bid.driverId,
            acceptedAt: serverTimestamp()
          });
          
          console.log(`✅ Bid ${bidId} confirmed and order ${orderId} accepted`);
          return { driverId: bid.driverId };
        }),
        20000, // 20 second timeout for confirmation
        'Bid confirmation transaction timeout',
        'bid-confirmation-transaction'
      );
    });
    
    driverId = result.driverId;
    
    // Add compensation action to revert order status if needed
    compensationContext.addOrderStatusRevert(orderId, 'payment_pending');

    // Step 2: Unlock driver with circuit breaker protection
    await executeWithCircuitBreaker('driver-locks', async () => {
      return await withTimeout(
        unlockDriver(driverId!, orderId),
        5000, // 5 second timeout
        'Driver unlock timeout',
        'driver-unlock'
      );
    });
    
    console.log(`🔓 Driver ${driverId} unlocked after successful confirmation`);
    console.log(`✅ Enhanced bid confirmation completed successfully: ${bidId}`);

  } catch (error) {
    console.error(`❌ Enhanced bid confirmation failed: ${error instanceof Error ? error.message : error}`);
    
    // Execute compensation if needed
    if (compensationContext.getActions().length > 0) {
      try {
        const compensationResult = await compensationContext.executeAll(error as Error);
        
        if (compensationResult.success) {
          console.log(`✅ Compensation completed successfully`);
        } else {
          console.error(`⚠️ Partial compensation failure`);
        }
        
      } catch (compensationError) {
        console.error(`💥 Compensation execution failed:`, compensationError);
      }
    }
    
    throw error;
  }
};

/**
 * Enhanced bid cancellation with recovery
 * @param orderId - ID of the order
 * @param bidId - ID of the bid to cancel
 * @returns Promise<void>
 */
export const cancelBidReservationWithRecovery = async (orderId: string, bidId: string): Promise<void> => {
  console.log(`❌ Starting enhanced bid cancellation: order=${orderId}, bid=${bidId}`);

  try {
    // Cancel with circuit breaker protection
    await executeWithCircuitBreaker('bid-cancellation', async () => {
      return await withTimeout(
        runTransaction(db, async (transaction) => {
          // Get bid data
          const bidRef = doc(db, 'bids', bidId);
          const bidSnap = await transaction.get(bidRef);
          
          if (!bidSnap.exists()) {
            throw new Error(`Bid ${bidId} not found`);
          }
          
          const bid = bidSnap.data();
          const driverId = bid.driverId;
          
          // Cancel the bid
          transaction.update(bidRef, {
            status: 'cancelled',
            cancelledAt: serverTimestamp(),
            cancelReason: 'Reservation cancelled',
            reservationExpiry: null
          });
          
          // Update order back to pending if it was payment_pending
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await transaction.get(orderRef);
          
          if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            if (orderData.status === 'payment_pending' && orderData.reservedBidId === bidId) {
              transaction.update(orderRef, {
                status: 'pending',
                reservedBidId: null,
                reservedDriverId: null,
                reservationTimestamp: null
              });
              
              console.log(`📋 Order ${orderId} reverted to pending`);
            }
          }
          
          // Unlock driver
          try {
            await unlockDriver(driverId, orderId);
            console.log(`🔓 Driver ${driverId} unlocked during cancellation`);
          } catch (unlockError) {
            console.warn(`⚠️ Could not unlock driver ${driverId}:`, unlockError);
          }
          
          console.log(`❌ Bid ${bidId} cancelled successfully`);
        }),
        10000, // 10 second timeout
        'Bid cancellation timeout',
        'bid-cancellation-transaction'
      );
    });

    console.log(`✅ Enhanced bid cancellation completed: ${bidId}`);

  } catch (error) {
    console.error(`❌ Enhanced bid cancellation failed: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
};

console.log('🔄 Enhanced bid reservation with recovery system initialized'); 