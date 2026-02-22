/**
 * Bid Operations Cloud Functions
 *
 * Server-side bid reservation, confirmation, and cancellation.
 * This approach:
 * - Eliminates client-side timeout issues
 * - Provides proper transaction handling
 * - Ensures atomic operations
 * - Is more secure (server validates everything)
 * - Scales better (no client-side race conditions)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ============================================================
// TYPES
// ============================================================

interface ReserveBidRequest {
  orderId: string;
  bidId: string;
}

interface ReserveBidResponse {
  success: boolean;
  reservationId: string;
  driverId: string;
  bidAmount: number;
  expiresAt: string;
}

interface ConfirmBidRequest {
  orderId: string;
  bidId: string;
  paymentIntentId?: string;
  paymentLinkId?: string;
}

interface ConfirmBidResponse {
  success: boolean;
  orderId: string;
  acceptedDriverId: string;
}

interface CancelReservationRequest {
  orderId: string;
  bidId: string;
  reason?: string;
}

interface CancelReservationResponse {
  success: boolean;
  message: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Acquires a driver lock using Firestore transaction
 * Returns true if lock acquired, false if driver already locked
 */
async function acquireDriverLock(
  transaction: admin.firestore.Transaction,
  driverId: string,
  orderId: string,
  bidId: string,
  lockDurationMinutes: number = 10
): Promise<boolean> {
  const lockRef = db.collection('driverLocks').doc(driverId);
  const lockDoc = await transaction.get(lockRef);
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + lockDurationMinutes * 60 * 1000)
  );

  if (lockDoc.exists) {
    const lockData = lockDoc.data();
    // Check if existing lock is expired
    if (lockData?.expiresAt && lockData.expiresAt.toDate() > now.toDate()) {
      // Lock is still valid and held by another order
      if (lockData.orderId !== orderId) {
        console.log(`🔒 Driver ${driverId} is locked by order ${lockData.orderId}`);
        return false;
      }
      // Same order already has the lock - extend it
      console.log(`🔄 Extending existing lock for driver ${driverId}`);
    }
  }

  // Acquire or extend lock
  transaction.set(lockRef, {
    driverId,
    orderId,
    bidId,
    lockedAt: now,
    expiresAt,
    lockReason: 'bid_reservation'
  });

  console.log(`🔒 Lock acquired for driver ${driverId} (expires: ${expiresAt.toDate().toISOString()})`);
  return true;
}

/**
 * Releases a driver lock
 */
async function releaseDriverLock(
  transaction: admin.firestore.Transaction,
  driverId: string,
  orderId: string
): Promise<void> {
  const lockRef = db.collection('driverLocks').doc(driverId);
  const lockDoc = await transaction.get(lockRef);

  if (lockDoc.exists) {
    const lockData = lockDoc.data();
    // Only release if this order owns the lock
    if (lockData?.orderId === orderId) {
      transaction.delete(lockRef);
      console.log(`🔓 Lock released for driver ${driverId}`);
    } else {
      console.log(`⚠️ Cannot release lock - owned by different order ${lockData?.orderId}`);
    }
  }
}

/**
 * Resolves driver conflicts - cancels bids from this driver on other orders
 */
async function resolveDriverConflicts(
  transaction: admin.firestore.Transaction,
  driverId: string,
  acceptedOrderId: string,
  acceptedBidId: string
): Promise<number> {
  // Find other pending/reserved bids from this driver
  const otherBidsQuery = db.collection('bids')
    .where('driverId', '==', driverId)
    .where('status', 'in', ['pending', 'reserved']);

  const otherBidsSnap = await transaction.get(otherBidsQuery);
  let cancelledCount = 0;

  otherBidsSnap.forEach((doc) => {
    const bidData = doc.data();
    // Only cancel bids for OTHER orders (not the accepted one)
    if (bidData.orderId !== acceptedOrderId && doc.id !== acceptedBidId) {
      transaction.update(doc.ref, {
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelReason: 'Driver accepted another order'
      });
      cancelledCount++;
      console.log(`🔄 Cancelled conflicting bid ${doc.id} for order ${bidData.orderId}`);
    }
  });

  return cancelledCount;
}

// ============================================================
// CLOUD FUNCTIONS
// ============================================================

/**
 * Reserve a bid for payment
 *
 * This function:
 * 1. Validates the bid and order
 * 2. Acquires a driver lock
 * 3. Marks the bid as reserved
 * 4. Updates the order status
 *
 * All in a single atomic transaction with server-side timeout.
 */
export const reserveBid = onCall<ReserveBidRequest>(
  {
    region: 'europe-west3',
    timeoutSeconds: 30, // Server-side timeout
    memory: '256MiB',
  },
  async (request): Promise<ReserveBidResponse> => {
    const startTime = Date.now();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 [SERVER] reserveBid Cloud Function - INVOKED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Request Data: ${JSON.stringify(request.data)}`);
    console.log(`👤 Auth UID: ${request.auth?.uid || 'NOT AUTHENTICATED'}`);
    console.log(`⏰ Server Time: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Verify authentication
    if (!request.auth) {
      console.log('❌ [SERVER] Authentication failed - no auth context');
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { orderId, bidId } = request.data;

    // Validate input
    if (!orderId || !bidId) {
      console.log('❌ [SERVER] Validation failed - missing orderId or bidId');
      throw new HttpsError('invalid-argument', 'Missing orderId or bidId');
    }

    console.log(`📋 [SERVER] Processing: orderId=${orderId}, bidId=${bidId}`);

    try {
      const result = await db.runTransaction(async (transaction) => {
        // Step 1: Get and validate bid
        console.log('📋 [SERVER] Step 1/5: Validating bid...');
        const bidRef = db.collection('bids').doc(bidId);
        const bidDoc = await transaction.get(bidRef);

        if (!bidDoc.exists) {
          console.log('❌ [SERVER] Bid not found:', bidId);
          throw new HttpsError('not-found', `Bid ${bidId} not found`);
        }

        const bidData = bidDoc.data()!;
        console.log(`✅ [SERVER] Bid found: status=${bidData.status}, driverId=${bidData.driverId}`);

        // Bids are created with 'active' status and can be reserved
        // Also allow 'pending' for backwards compatibility
        if (bidData.status !== 'active' && bidData.status !== 'pending') {
          console.log(`❌ [SERVER] Bid status invalid: ${bidData.status} (expected: active or pending)`);
          throw new HttpsError('failed-precondition', `Bid cannot be reserved (status: ${bidData.status})`);
        }

        if (bidData.orderId !== orderId) {
          console.log(`❌ [SERVER] Bid/Order mismatch: bid.orderId=${bidData.orderId}, requested=${orderId}`);
          throw new HttpsError('invalid-argument', `Bid does not belong to this order`);
        }

        const driverId = bidData.driverId;
        const bidAmount = bidData.amount || bidData.price || 0;
        console.log(`✅ [SERVER] Step 1 complete: driverId=${driverId}, amount=${bidAmount}`);

        // Step 2: Get and validate order
        console.log('📋 [SERVER] Step 2/5: Validating order...');
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await transaction.get(orderRef);

        if (!orderDoc.exists) {
          console.log('❌ [SERVER] Order not found:', orderId);
          throw new HttpsError('not-found', `Order ${orderId} not found`);
        }

        const orderData = orderDoc.data()!;
        console.log(`✅ [SERVER] Order found: status=${orderData.status}, clientId=${orderData.clientId}`);

        // Verify caller is the order owner
        if (orderData.clientId !== request.auth!.uid) {
          console.log(`❌ [SERVER] Permission denied: clientId=${orderData.clientId}, authUid=${request.auth!.uid}`);
          throw new HttpsError('permission-denied', 'You are not the owner of this order');
        }

        // Check order is in valid state
        if (!['pending', 'bidding'].includes(orderData.status)) {
          console.log(`❌ [SERVER] Order status invalid: ${orderData.status} (expected: pending/bidding)`);
          throw new HttpsError('failed-precondition', `Order is not in valid state (status: ${orderData.status})`);
        }
        console.log(`✅ [SERVER] Step 2 complete: order validated`);

        // Step 3: Acquire driver lock
        console.log('📋 [SERVER] Step 3/5: Acquiring driver lock...');
        console.log(`   🔒 Attempting to lock driver: ${driverId}`);
        const lockAcquired = await acquireDriverLock(transaction, driverId, orderId, bidId);

        if (!lockAcquired) {
          console.log(`❌ [SERVER] Failed to acquire driver lock for: ${driverId}`);
          throw new HttpsError('failed-precondition', 'Driver is currently locked by another order. Please try again.');
        }
        console.log(`✅ [SERVER] Step 3 complete: driver ${driverId} locked`);

        // Step 4: Reserve the bid
        console.log('📋 [SERVER] Step 4/5: Reserving bid...');
        const reservationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        transaction.update(bidRef, {
          status: 'reserved',
          reservedAt: admin.firestore.FieldValue.serverTimestamp(),
          reservedBy: request.auth!.uid,
          reservationExpiry: admin.firestore.Timestamp.fromDate(reservationExpiry)
        });
        console.log(`✅ [SERVER] Step 4 complete: bid marked as reserved`);

        // Step 5: Update order status
        console.log('📋 [SERVER] Step 5/5: Updating order status...');
        transaction.update(orderRef, {
          status: 'payment_pending',
          reservedBidId: bidId,
          reservedDriverId: driverId,
          reservationTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ [SERVER] Step 5 complete: order status updated to payment_pending`);

        const duration = Date.now() - startTime;
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ [SERVER] reserveBid - TRANSACTION COMPLETE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`📋 Order: ${orderId}`);
        console.log(`📋 Bid: ${bidId}`);
        console.log(`👤 Driver: ${driverId}`);
        console.log(`💰 Amount: ${bidAmount}`);
        console.log(`⏰ Expires: ${reservationExpiry.toISOString()}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return {
          success: true,
          reservationId: `${orderId}_${bidId}_${Date.now()}`,
          driverId,
          bidAmount,
          expiresAt: reservationExpiry.toISOString()
        };
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('❌ [SERVER] reserveBid - FAILED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`🔴 Error Type: ${error instanceof HttpsError ? 'HttpsError' : 'Unknown'}`);
      console.log(`🔴 Error Message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Bid reservation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Confirm a bid after successful payment
 *
 * This function:
 * 1. Validates the reserved bid
 * 2. Confirms the bid as accepted
 * 3. Updates the order with accepted driver
 * 4. Resolves driver conflicts (cancels other bids)
 * 5. Releases the driver lock
 */
export const confirmBid = onCall<ConfirmBidRequest>(
  {
    region: 'europe-west3',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request): Promise<ConfirmBidResponse> => {
    const startTime = Date.now();
    console.log('🎯 [confirmBid] Starting bid confirmation:', JSON.stringify(request.data));

    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { orderId, bidId, paymentIntentId, paymentLinkId } = request.data;

    if (!orderId || !bidId) {
      throw new HttpsError('invalid-argument', 'Missing orderId or bidId');
    }

    try {
      const result = await db.runTransaction(async (transaction) => {
        // Step 1: Get and validate bid
        console.log('📋 Step 1: Validating reserved bid...');
        const bidRef = db.collection('bids').doc(bidId);
        const bidDoc = await transaction.get(bidRef);

        if (!bidDoc.exists) {
          throw new HttpsError('not-found', `Bid ${bidId} not found`);
        }

        const bidData = bidDoc.data()!;

        if (bidData.status !== 'reserved') {
          throw new HttpsError('failed-precondition', `Bid is not reserved (status: ${bidData.status})`);
        }

        const driverId = bidData.driverId;

        // Step 2: Validate order
        console.log('📋 Step 2: Validating order...');
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await transaction.get(orderRef);

        if (!orderDoc.exists) {
          throw new HttpsError('not-found', `Order ${orderId} not found`);
        }

        const orderData = orderDoc.data()!;

        if (orderData.clientId !== request.auth!.uid) {
          throw new HttpsError('permission-denied', 'You are not the owner of this order');
        }

        if (orderData.status !== 'payment_pending') {
          throw new HttpsError('failed-precondition', `Order is not in payment_pending state (status: ${orderData.status})`);
        }

        // Step 3: Confirm the bid
        console.log('📋 Step 3: Confirming bid...');
        transaction.update(bidRef, {
          status: 'accepted',
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentIntentId: paymentIntentId || null,
          paymentLinkId: paymentLinkId || null,
          reservationExpiry: null
        });

        // Step 4: Update order
        console.log('📋 Step 4: Updating order...');
        transaction.update(orderRef, {
          status: 'accepted',
          acceptedBidId: bidId,
          acceptedDriverId: driverId,
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentIntentId: paymentIntentId || null,
          paymentLinkId: paymentLinkId || null
        });

        // Step 5: Resolve driver conflicts
        console.log('📋 Step 5: Resolving driver conflicts...');
        const cancelledCount = await resolveDriverConflicts(transaction, driverId, orderId, bidId);
        console.log(`🔄 Cancelled ${cancelledCount} conflicting bids`);

        // Step 6: Release driver lock
        console.log('📋 Step 6: Releasing driver lock...');
        await releaseDriverLock(transaction, driverId, orderId);

        console.log(`✅ Bid ${bidId} confirmed successfully in ${Date.now() - startTime}ms`);

        return {
          success: true,
          orderId,
          acceptedDriverId: driverId
        };
      });

      return result;

    } catch (error) {
      console.error('❌ [confirmBid] Failed:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Bid confirmation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Cancel a bid reservation
 *
 * This function:
 * 1. Validates the reserved bid
 * 2. Reverts bid status to pending (or cancelled)
 * 3. Reverts order status
 * 4. Releases the driver lock
 */
export const cancelBidReservation = onCall<CancelReservationRequest>(
  {
    region: 'europe-west3',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request): Promise<CancelReservationResponse> => {
    const startTime = Date.now();
    console.log('❌ [cancelBidReservation] Starting cancellation:', JSON.stringify(request.data));

    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { orderId, bidId, reason } = request.data;

    if (!orderId || !bidId) {
      throw new HttpsError('invalid-argument', 'Missing orderId or bidId');
    }

    try {
      await db.runTransaction(async (transaction) => {
        // Step 1: Get bid
        const bidRef = db.collection('bids').doc(bidId);
        const bidDoc = await transaction.get(bidRef);

        if (!bidDoc.exists) {
          throw new HttpsError('not-found', `Bid ${bidId} not found`);
        }

        const bidData = bidDoc.data()!;
        const driverId = bidData.driverId;

        // Only allow cancellation of reserved bids
        if (bidData.status !== 'reserved') {
          console.log(`⚠️ Bid ${bidId} is not reserved (status: ${bidData.status}), skipping`);
          return;
        }

        // Step 2: Get order
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await transaction.get(orderRef);

        if (orderDoc.exists) {
          const orderData = orderDoc.data()!;

          // Verify caller is the order owner
          if (orderData.clientId !== request.auth!.uid) {
            throw new HttpsError('permission-denied', 'You are not the owner of this order');
          }

          // Only revert if this bid is the reserved one
          if (orderData.reservedBidId === bidId) {
            transaction.update(orderRef, {
              status: 'pending',
              reservedBidId: null,
              reservedDriverId: null,
              reservationTimestamp: null
            });
            console.log(`📋 Order ${orderId} reverted to pending`);
          }
        }

        // Step 3: Revert bid to pending (so driver can bid again)
        transaction.update(bidRef, {
          status: 'pending',
          reservedAt: null,
          reservedBy: null,
          reservationExpiry: null,
          lastCancellationReason: reason || 'User cancelled',
          lastCancelledAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`📋 Bid ${bidId} reverted to pending`);

        // Step 4: Release driver lock
        await releaseDriverLock(transaction, driverId, orderId);
      });

      console.log(`✅ Bid reservation cancelled successfully in ${Date.now() - startTime}ms`);

      return {
        success: true,
        message: 'Reservation cancelled successfully'
      };

    } catch (error) {
      console.error('❌ [cancelBidReservation] Failed:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Restore bids for a driver after order cancellation
 * Called when an order is cancelled and we want to restore the driver's bids
 */
export const restoreDriverBids = onCall<{ driverId: string; orderId: string }>(
  {
    region: 'europe-west3',
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    console.log('🔄 [restoreDriverBids] Restoring bids:', JSON.stringify(request.data));

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { driverId, orderId } = request.data;

    if (!driverId || !orderId) {
      throw new HttpsError('invalid-argument', 'Missing driverId or orderId');
    }

    try {
      // Find cancelled bids from this driver that were cancelled due to conflict
      const bidsQuery = db.collection('bids')
        .where('driverId', '==', driverId)
        .where('status', '==', 'cancelled')
        .where('cancelReason', '==', 'Driver accepted another order');

      const bidsSnap = await bidsQuery.get();
      let restoredCount = 0;

      const batch = db.batch();

      bidsSnap.forEach((doc) => {
        // Check if the order for this bid is still active
        batch.update(doc.ref, {
          status: 'pending',
          restoredAt: admin.firestore.FieldValue.serverTimestamp(),
          restoredReason: `Order ${orderId} was cancelled`
        });
        restoredCount++;
      });

      if (restoredCount > 0) {
        await batch.commit();
        console.log(`✅ Restored ${restoredCount} bids for driver ${driverId}`);
      }

      return {
        success: true,
        restoredCount
      };

    } catch (error) {
      console.error('❌ [restoreDriverBids] Failed:', error);
      throw new HttpsError('internal', `Failed to restore bids: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

console.log('🔧 Bid operations Cloud Functions initialized');
