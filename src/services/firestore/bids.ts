// Bid Operations Module
// Split from firestore.ts for better maintainability

import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  deleteField,
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  GeoPoint,
  writeBatch,
  runTransaction,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { safeOnSnapshot } from '../../utils/safeFirestore';
import {
  Bid,
  Order,
  OrderStatus
} from '../../types/firestore';
import { COLLECTIONS } from './orders';
import { ensureDriverNotification } from '../../utils/driverNotifications';

// 🔒 NEW: Import driver locking functions
import { lockDriver, unlockDriver, isDriverLocked } from './driverLocks';

/**
 * Create a new bid for an order
 */
export const createBid = async (bidData: Omit<Bid, 'id' | 'createdAt' | 'expiresAt'>): Promise<string> => {
  try {
    // Add bid to the bids collection
    const bidsRef = collection(db, COLLECTIONS.BIDS);
    const bidDoc = await addDoc(bidsRef, {
      ...bidData,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // ✅ EXTENDED: 2 hours (same as order expiration)
    });
    
    console.log('✅ [FIRESTORE] Bid created:', bidDoc.id);
    return bidDoc.id;
  } catch (error) {
    console.error('❌ [FIRESTORE] Error creating bid:', error);
    throw error;
  }
};

/**
 * Get all bids for a specific order
 */
export const getBidsForOrder = async (orderId: string): Promise<Bid[]> => {
  try {
    const bidsRef = collection(db, COLLECTIONS.BIDS);
    const q = query(
      bidsRef,
      where('orderId', '==', orderId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const bids: Bid[] = [];
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      bids.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
      } as Bid);
    });
    
    return bids;
  } catch (error) {
    console.error('❌ [FIRESTORE] Error getting bids for order:', error);
    return [];
  }
};

/**
 * Reserve a bid (when client accepts it but before payment)
 * ✅ ENHANCED: Now with atomic driver locking to prevent race conditions
 */
export const reserveBid = async (orderId: string, bidId: string): Promise<void> => {
  const startTime = Date.now();
  console.log('🔄 [FIRESTORE] Starting bid reservation with driver locking...', { 
    orderId, 
    bidId, 
    timestamp: new Date().toISOString() 
  });
  
  let driverId: string | null = null;
  let lockAcquired = false;
  
  try {
    // STEP 1: Get bid data to find driver
    const bidDoc = await getDoc(doc(db, COLLECTIONS.BIDS, bidId));
    if (!bidDoc.exists()) {
      throw new Error('Bid not found');
    }
    
    const bidData = bidDoc.data() as Bid;
    driverId = bidData.driverId;
    
    if (bidData.status !== 'active') {
      throw new Error(`Bid is not active (current status: ${bidData.status})`);
    }
    
    console.log('🔍 [FIRESTORE] Bid validation passed, attempting driver lock...', {
      bidId,
      driverId,
      proposedPrice: bidData.proposedPrice
    });
    
    // STEP 2: 🔒 ATOMIC DRIVER LOCKING - Most critical part!
    const lockStartTime = Date.now();
    const lockResult = await lockDriver(driverId, orderId, 5, bidId); // 5-minute timeout
    const lockDuration = Date.now() - lockStartTime;
    
    if (!lockResult.success || !lockResult.lockAcquired) {
      console.log('🚫 [FIRESTORE] Driver lock failed:', {
        driverId,
        orderId,
        error: lockResult.error,
        conflictOrderId: lockResult.conflictOrderId,
        lockDuration
      });
      
      // Check if driver is available but there's a system issue
      if (lockResult.error?.includes('transaction')) {
        throw new Error('System busy - please try again in a moment');
      }
      
      // Driver is locked by another order
      throw new Error(lockResult.error || 'Driver is currently busy with another order');
    }
    
    lockAcquired = true;
    console.log('✅ [FIRESTORE] Driver locked successfully:', {
      driverId,
      orderId,
      lockDuration,
      expiresAt: lockResult.expiresAt
    });
    
    try {
      // STEP 3: Reservation transaction (now that driver is locked)
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
        const bidRef = doc(db, COLLECTIONS.BIDS, bidId);
        
        // Verify order is still valid for reservation
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists()) {
          throw new Error('Order not found');
        }
        
        const orderData = orderDoc.data() as Order;
        
        if (!['pending', 'searching', 'bidding'].includes(orderData.status)) {
          throw new Error(`Order is no longer available (current status: ${orderData.status})`);
        }
        
        // Check if another bid is already reserved
        if (orderData.reservedBidId && orderData.reservedBidId !== bidId) {
          throw new Error('Another bid is already reserved for this order');
        }
        
        // Double-check bid is still active
        const currentBidDoc = await transaction.get(bidRef);
        if (!currentBidDoc.exists()) {
          throw new Error('Bid not found');
        }
        
        const currentBidData = currentBidDoc.data() as Bid;
        if (currentBidData.status !== 'active') {
          throw new Error(`Bid is no longer active (current status: ${currentBidData.status})`);
        }
        
        // Verify this is still the same driver (paranoid check)
        if (currentBidData.driverId !== driverId) {
          throw new Error('Bid driver mismatch - data integrity issue');
        }
        
        console.log('🔄 [FIRESTORE] All transaction checks passed, reserving bid...');
        
        // Update order status and reserve the bid
        transaction.update(orderRef, {
          status: 'payment_pending',
          reservedBidId: bidId,
          reservedDriverId: driverId,
          reservedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        // Update bid status
        transaction.update(bidRef, {
          status: 'reserved',
          reservedAt: serverTimestamp()
        });
      });
      
      const transactionTime = Date.now() - startTime;
      console.log('✅ [FIRESTORE] Bid reservation transaction completed:', {
        orderId,
        bidId,
        driverId,
        duration: transactionTime
      });
      
      // STEP 4: Smart conflict resolution (driver is already locked)
      console.log('🔄 [FIRESTORE] Resolving driver conflicts...');
      const conflictStartTime = Date.now();
      
      try {
        await resolveDriverConflicts(bidId, orderId);
        const conflictTime = Date.now() - conflictStartTime;
        console.log('✅ [FIRESTORE] Driver conflicts resolved:', {
          conflictResolutionDuration: conflictTime,
          totalDuration: Date.now() - startTime
        });
      } catch (conflictError) {
        // Conflict resolution failure should not break the main flow since driver is locked
        console.error('⚠️ [FIRESTORE] Conflict resolution failed (continuing anyway):', conflictError);
      }
      
      const totalDuration = Date.now() - startTime;
      console.log('🎯 [FIRESTORE] Bid reservation completed successfully:', { 
        orderId, 
        bidId, 
        driverId,
        totalDuration,
        lockDuration
      });
      
      // ✅ NOTE: Driver lock is NOT released here - it stays until payment completion or cancellation
      // This prevents other orders from reserving this driver during payment processing
      
    } catch (reservationError) {
      // STEP 5: Critical rollback - unlock driver if reservation fails
      console.error('❌ [FIRESTORE] Reservation failed after lock acquired, rolling back...', {
        error: reservationError instanceof Error ? reservationError.message : reservationError
      });
      
      if (lockAcquired && driverId) {
        try {
          const unlockResult = await unlockDriver(driverId, orderId, 'Reservation rollback');
          if (unlockResult.success) {
            console.log('✅ [FIRESTORE] Driver lock rolled back successfully');
          } else {
            console.error('🚨 [FIRESTORE] CRITICAL: Failed to rollback driver lock:', unlockResult.error);
            // This is a critical error that needs manual intervention
          }
        } catch (unlockError) {
          console.error('🚨 [FIRESTORE] CRITICAL: Exception during lock rollback:', unlockError);
        }
      }
      
      throw reservationError;
    }
    
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('❌ [FIRESTORE] Bid reservation failed:', {
      orderId,
      bidId,
      driverId,
      duration: totalDuration,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
};

/**
 * Confirm a bid (after successful payment) - Enhanced to handle race conditions
 */
export const confirmBid = async (orderId: string, bidId: string): Promise<void> => {
  console.log('🔄 [FIRESTORE] Starting bid confirmation process...', { orderId, bidId });
  
  try {
    // First, get the bid to ensure it exists
    const bidDoc = await getDoc(doc(db, COLLECTIONS.BIDS, bidId));
    if (!bidDoc.exists()) {
      throw new Error('Bid not found');
    }
    
    const bidData = bidDoc.data() as Bid;
    
    // ✅ ENHANCED: Handle race condition - if bid is already accepted, just ensure order consistency
    if (bidData.status === 'accepted') {
      console.log('ℹ️ [FIRESTORE] Bid already confirmed, checking order consistency...');
      
      // Verify the order is also marked as accepted with this driver
      const orderDoc = await getDoc(doc(db, COLLECTIONS.ORDERS, orderId));
      if (orderDoc.exists()) {
        const orderData = orderDoc.data() as Order;
        if (orderData.status === 'accepted' && orderData.acceptedDriverId === bidData.driverId) {
          console.log('✅ [FIRESTORE] Order and bid are already consistent - confirmation complete');
          return;
        }
      }
    }
    
    // Check if bid should be reserved but isn't (race condition)
    if (bidData.status !== 'reserved' && bidData.status !== 'accepted') {
      throw new Error(`Bid is not in correct state for confirmation (current status: ${bidData.status})`);
    }
    
    // ✅ ENHANCED: Use transaction with race condition handling
    await runTransaction(db, async (transaction) => {
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      const bidRef = doc(db, COLLECTIONS.BIDS, bidId);
      
      // Get current order state
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists()) {
        throw new Error('Order not found');
      }
      
      const orderData = orderDoc.data() as Order;
      
      // ✅ ENHANCED: Handle race condition - accept if order is already 'accepted' but needs bid confirmation
      if (orderData.status === 'accepted') {
        console.log('ℹ️ [FIRESTORE] Order already accepted (likely by webhook), ensuring bid is marked accepted...');
        
        // ✅ NEW: Handle case where acceptedDriverId is missing but order was reserved by this driver
        if (!orderData.acceptedDriverId && orderData.reservedDriverId === bidData.driverId) {
          console.log('🔧 [FIRESTORE] Order accepted but missing acceptedDriverId, fixing with reserved driver info...');
          
          // Fix the order by setting the acceptedDriverId
          transaction.update(orderRef, {
            acceptedDriverId: bidData.driverId,
            acceptedBidId: bidId,
            acceptedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          // Mark bid as accepted
          transaction.update(bidRef, {
            status: 'accepted',
            acceptedAt: serverTimestamp()
          });
          
          console.log('✅ [FIRESTORE] Fixed order acceptedDriverId and marked bid as accepted');
          return;
        }
        
        // Check if this driver is the accepted one
        if (orderData.acceptedDriverId === bidData.driverId) {
          // Just update the bid to accepted status
          transaction.update(bidRef, {
            status: 'accepted',
            acceptedAt: serverTimestamp()
          });
          console.log('✅ [FIRESTORE] Bid marked as accepted to match order status');
          return;
        } else {
          throw new Error(`Order is accepted by different driver (${orderData.acceptedDriverId} vs ${bidData.driverId})`);
        }
      }
      
      // Normal flow: order is in payment_pending state
      if (orderData.status !== 'payment_pending') {
        throw new Error(`Order is not in payment_pending state (current status: ${orderData.status})`);
      }
      
      // Check if this is the reserved bid (allow some flexibility for race conditions)
      if (orderData.reservedBidId && orderData.reservedBidId !== bidId) {
        throw new Error('This bid is not the reserved bid for this order');
      }
      
      // Update order status to accepted
      transaction.update(orderRef, {
        status: 'accepted',
        acceptedDriverId: bidData.driverId,
        acceptedBidId: bidId,
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Clear reservation fields
        reservedBidId: deleteField(),
        reservedDriverId: deleteField(),
        reservedAt: deleteField()
      });
      
      // Update bid status to accepted
      transaction.update(bidRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });
    });
    
    const confirmationBidData = bidDoc.data() as Bid;
    const driverId = confirmationBidData.driverId;
    
    console.log('✅ [FIRESTORE] Bid confirmed successfully:', { orderId, bidId, driverId });
    
    // Reject other bids for this order
    await rejectOtherBidsForOrder(orderId, bidId);
    
    // ✅ ENHANCED: Unlock driver after successful bid confirmation 
    console.log('🔓 [FIRESTORE] Unlocking driver after successful bid confirmation...');
    try {
      const unlockResult = await unlockDriver(driverId, orderId, 'Bid confirmed - payment successful');
      
      if (unlockResult.success) {
        console.log('✅ [FIRESTORE] Driver unlocked successfully after confirmation');
      } else {
        console.warn('⚠️ [FIRESTORE] Failed to unlock driver after confirmation:', unlockResult.error);
        // Don't throw - bid confirmation is the primary operation
      }
    } catch (unlockError) {
      console.error('❌ [FIRESTORE] Error unlocking driver after confirmation:', unlockError);
      // Don't throw - this is cleanup that shouldn't break the main flow
    }
    
    // ✅ NOTE: Driver conflicts were already resolved during reserveBid() phase
    console.log('ℹ️ [FIRESTORE] Driver conflicts already resolved during reservation phase');
    
    // ✅ ENHANCED: Always try to ensure driver gets notified after confirmation (using static import to avoid rebundle)
    console.log('🔔 Bid confirmation completed, ensuring driver notification...');
    try {
      const result = await ensureDriverNotification(bidData.driverId, orderId);

      if (result.success) {
        console.log('✅ [FIRESTORE] Driver notification ensured successfully');
      } else {
        console.warn('⚠️ [FIRESTORE] Driver notification failed:', result.error);

        // Try fallback notification
        console.log('🔄 Retrying driver notification...');
        const fallbackResult = await ensureDriverNotification(bidData.driverId, orderId);

        if (!fallbackResult.success) {
          console.warn('⚠️ Fallback driver notification also failed:', fallbackResult.error);
        }
      }
    } catch (notificationError) {
      console.error('❌ [FIRESTORE] Error in driver notification system:', notificationError);
      // Don't throw - notification failure shouldn't break the main flow
    }
    
  } catch (error) {
    console.error('❌ [FIRESTORE] Error confirming bid:', error);
    throw error;
  }
};

/**
 * Cancel bid reservation (if payment fails or is cancelled)
 * ✅ CRITICAL FIX: Enhanced with detailed logging and verification to fix bid restoration issue
 */
export const cancelBidReservation = async (orderId: string, bidId: string): Promise<void> => {
  const startTime = Date.now();
  console.log('🔄 [ATOMIC FIX] Starting bid reservation cancellation...', { orderId, bidId });
  
  try {
    const bidRef = doc(db, COLLECTIONS.BIDS, bidId);
    const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
    let driverId: string | null = null;
    
    // Single atomic transaction to restore bid and order
    await runTransaction(db, async (transaction) => {
      const bidDoc = await transaction.get(bidRef);
      const orderDoc = await transaction.get(orderRef);
      
      if (!bidDoc.exists()) {
        throw new Error('Bid not found');
      }
      
      if (!orderDoc.exists()) {
        throw new Error('Order not found');
      }
      
      const bidData = bidDoc.data() as Bid;
      const orderData = orderDoc.data() as Order;
      driverId = bidData.driverId;
      
      console.log('🔄 [ATOMIC FIX] Current states:', {
        bidStatus: bidData.status,
        orderStatus: orderData.status,
        isThisBidReserved: orderData.reservedBidId === bidId
      });
      
      // Only proceed if this bid is actually reserved
      if (orderData.reservedBidId === bidId) {
        // Restore order to bidding state
        transaction.update(orderRef, {
          status: 'bidding',
          updatedAt: serverTimestamp(),
          reservedBidId: deleteField(),
          reservedDriverId: deleteField(),
          reservedAt: deleteField()
        });
        
        // Restore bid to active state
        transaction.update(bidRef, {
          status: 'active',
          reservedAt: deleteField(),
          reservedBy: deleteField(),
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ [ATOMIC FIX] Bid and order restored to active/bidding states in transaction');
      } else {
        console.log('ℹ️ [ATOMIC FIX] Bid is not reserved, no action needed');
      }
    });
    
    // Phase 2 integration: Unlock driver
    if (driverId) {
      try {
        await unlockDriver(driverId, orderId);
        console.log(`🔓 [ATOMIC FIX] Driver ${driverId} unlocked successfully`);
      } catch (unlockError) {
        console.warn(`⚠️ [ATOMIC FIX] Failed to unlock driver ${driverId}:`, unlockError instanceof Error ? unlockError.message : String(unlockError));
        // Don't throw - bid restoration should still succeed
      }
    }
    
    // ✅ CRITICAL FIX: Restore ALL driver bids across ALL orders
    if (driverId) {
      try {
        console.log(`🔄 [ATOMIC FIX] Restoring all cancelled bids for driver ${driverId} across all orders...`);
        await restoreAllDriverBidsAfterCancellation(driverId);
        console.log(`✅ [ATOMIC FIX] All driver bids restored successfully`);
      } catch (restoreError) {
        console.warn(`⚠️ [ATOMIC FIX] Failed to restore all driver bids:`, restoreError instanceof Error ? restoreError.message : String(restoreError));
        // Don't throw - main cancellation should still succeed
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ [ATOMIC FIX] Bid reservation cancellation completed in ${duration}ms`);
    
  } catch (error) {
    console.error('❌ [ATOMIC FIX] Bid reservation cancellation failed:', error);
    throw error;
  }
};

/**
 * Accept a bid (legacy function for backward compatibility)
 */
export const acceptBid = async (orderId: string, bidId: string): Promise<void> => {
  console.log('🔄 [FIRESTORE] Legacy acceptBid called, using new confirm flow...');
  await confirmBid(orderId, bidId);
};

/**
 * Reject all other bids for an order when one is accepted
 */
const rejectOtherBidsForOrder = async (orderId: string, acceptedBidId: string): Promise<void> => {
  try {
    console.log('🔄 [FIRESTORE] Rejecting other bids for order:', orderId);
    
    // Get all bids for this order
    const bidsRef = collection(db, COLLECTIONS.BIDS);
    const q = query(
      bidsRef,
      where('orderId', '==', orderId),
      where('status', 'in', ['active', 'reserved'])
    );
    
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      if (doc.id !== acceptedBidId) {
        const bidRef = doc.ref;
        batch.update(bidRef, {
          status: 'rejected',
          rejectedAt: serverTimestamp()
        });
      }
    });
    
    await batch.commit();
    console.log('✅ [FIRESTORE] Other bids rejected successfully');
    
  } catch (error) {
    console.error('❌ [FIRESTORE] Error rejecting other bids:', error);
    // Don't throw here - this is cleanup, shouldn't fail the main operation
  }
};

/**
 * ✅ SMART CONFLICT RESOLUTION: Resolve driver conflicts when a bid is accepted
 * Only cancels bids from DIFFERENT orders, allowing multiple bids from same driver on same order
 */
const resolveDriverConflicts = async (acceptedBidId: string, acceptedOrderId: string): Promise<void> => {
  try {
    console.log('🔄 [FIRESTORE] Resolving driver conflicts for bid:', acceptedBidId);
    
    // Get the accepted bid to find the driver
    const acceptedBidDoc = await getDoc(doc(db, COLLECTIONS.BIDS, acceptedBidId));
    if (!acceptedBidDoc.exists()) {
      console.warn('Accepted bid not found during conflict resolution');
      return;
    }
    
    const acceptedBidData = acceptedBidDoc.data() as Bid;
    const driverId = acceptedBidData.driverId;
    
    // Find all other active bids from this driver
    const bidsRef = collection(db, COLLECTIONS.BIDS);
    const q = query(
      bidsRef,
      where('driverId', '==', driverId),
      where('status', 'in', ['active', 'reserved'])
    );
    
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    let sameOrderBidsSkipped = 0;
    let crossOrderBidsCancelled = 0;
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const bidData = doc.data() as Bid;
      
      // Skip the accepted bid
      if (doc.id === acceptedBidId) return;
      
      // ✅ SMART CONFLICT RESOLUTION: Only cancel bids from DIFFERENT orders
      // Allow multiple bids from same driver on same order
      if (bidData.orderId !== acceptedOrderId) {
        // Cancel other bids from this driver FOR DIFFERENT ORDERS
        const bidRef = doc.ref;
        batch.update(bidRef, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelReason: 'Driver accepted another order'
        });
        crossOrderBidsCancelled++;
      } else {
        // Skip bids from the same order (allow multiple bids per driver per order)
        sameOrderBidsSkipped++;
      }
    });
    
    await batch.commit();
    console.log('✅ [FIRESTORE] Smart conflict resolution completed:', {
      sameOrderBidsSkipped,
      crossOrderBidsCancelled,
      totalBidsProcessed: querySnapshot.size
    });
    
  } catch (error) {
    console.error('❌ [FIRESTORE] Error resolving driver conflicts:', error);
    // Don't throw here - this is cleanup, shouldn't fail the main operation
  }
};

/**
 * ✅ CRITICAL FIX: Restore ALL driver bids across ALL orders when payment is cancelled
 * This ensures that when a client cancels payment, all bids from that driver become visible again
 */
const restoreAllDriverBidsAfterCancellation = async (driverId: string): Promise<void> => {
  try {
    console.log('🔄 [ATOMIC FIX] Restoring all cancelled bids for driver across all orders:', { driverId });
    
    // Find ALL cancelled bids from this driver across ALL orders
    const bidsRef = collection(db, COLLECTIONS.BIDS);
    const q = query(
      bidsRef,
      where('driverId', '==', driverId),
      where('status', '==', 'cancelled'),
      where('cancelReason', '==', 'Driver accepted another order') // Only restore conflict-cancelled bids
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('ℹ️ [ATOMIC FIX] No cancelled bids found to restore across all orders');
      return;
    }
    
    console.log(`🔍 [ATOMIC FIX] Found ${querySnapshot.size} cancelled bids to potentially restore`);
    
    const batch = writeBatch(db);
    let restoredCount = 0;
    
    // Process each cancelled bid
    for (const bidDoc of querySnapshot.docs) {
      const bidData = bidDoc.data() as Bid;
      const bidOrderId = bidData.orderId;
      
      // Check if the associated order is still valid for bidding
      try {
        const orderDoc = await getDoc(doc(db, COLLECTIONS.ORDERS, bidOrderId));
        
        if (!orderDoc.exists()) {
          console.log(`⚠️ [ATOMIC FIX] Order ${bidOrderId} not found - skipping bid ${bidDoc.id}`);
          continue;
        }
        
        const orderData = orderDoc.data() as Order;
        
        // Only restore if order is still in bidding state
        if (['pending', 'searching', 'bidding'].includes(orderData.status)) {
          // Check if bid is not too old (within 2 hours)
          let bidCreatedAt: Date | null = null;
          if (bidData.createdAt) {
            try {
              const timestamp = bidData.createdAt as any;
              if (timestamp.toDate && typeof timestamp.toDate === 'function') {
                bidCreatedAt = timestamp.toDate();
              } else if (timestamp.getTime && typeof timestamp.getTime === 'function') {
                bidCreatedAt = timestamp;
              }
            } catch (error) {
              console.warn('⚠️ [ATOMIC FIX] Could not parse bid creation time:', error);
            }
          }
          
          const now = new Date();
          const twoHours = 2 * 60 * 60 * 1000;
          
          if (bidCreatedAt && (now.getTime() - bidCreatedAt.getTime()) < twoHours) {
            console.log(`🔄 [ATOMIC FIX] Restoring bid ${bidDoc.id} (${bidData.proposedPrice} лв) for order ${bidOrderId}`);
            
            // Restore bid to active status
            batch.update(bidDoc.ref, {
              status: 'active',
              // Clear cancellation fields
              cancelledAt: deleteField(),
              cancelReason: deleteField(),
              updatedAt: serverTimestamp()
            });
            
            restoredCount++;
          } else {
            console.log(`⚠️ [ATOMIC FIX] Bid ${bidDoc.id} too old to restore (age: ${bidCreatedAt ? now.getTime() - bidCreatedAt.getTime() : 'unknown'}ms)`);
          }
        } else {
          console.log(`ℹ️ [ATOMIC FIX] Order ${bidOrderId} not suitable for restoration (status: ${orderData.status})`);
        }
      } catch (error) {
        console.error(`❌ [ATOMIC FIX] Error checking order ${bidOrderId}:`, error);
      }
    }
    
    if (restoredCount > 0) {
      await batch.commit();
      console.log(`✅ [ATOMIC FIX] Restored ${restoredCount} driver bids across all orders`);
    } else {
      console.log('ℹ️ [ATOMIC FIX] No bids were suitable for restoration across all orders');
    }
    
  } catch (error) {
    console.error('❌ [ATOMIC FIX] Error restoring driver bids across all orders:', error);
    throw error;
  }
};

/**
 * ✅ FIXED: Restore ALL driver bids for the current order when reservation is cancelled
 */
const restoreDriverBidsAfterCancellation = async (driverId: string, cancelledOrderId: string): Promise<void> => {
  try {
    console.log('🔄 [FIRESTORE] Restoring driver bids after cancellation:', { driverId, cancelledOrderId });
    
    // ✅ NEW APPROACH: Find ALL bids from this driver for the current order that are cancelled
    const bidsRef = collection(db, COLLECTIONS.BIDS);
    const q = query(
      bidsRef,
      where('driverId', '==', driverId),
      where('orderId', '==', cancelledOrderId),
      where('status', '==', 'cancelled')
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('ℹ️ [FIRESTORE] No cancelled bids found to restore for current order');
      return;
    }
    
    // Check if the order is still valid for bidding
    const orderDoc = await getDoc(doc(db, COLLECTIONS.ORDERS, cancelledOrderId));
    
    if (!orderDoc.exists()) {
      console.log(`⚠️ [FIRESTORE] Order ${cancelledOrderId} not found - cannot restore bids`);
      return;
    }
    
    const orderData = orderDoc.data() as Order;
    
    // Only restore if order is still in bidding state
    if (!['pending', 'searching', 'bidding'].includes(orderData.status)) {
      console.log(`ℹ️ [FIRESTORE] Order ${cancelledOrderId} not suitable for restoration (status: ${orderData.status})`);
      return;
    }
    
    const batch = writeBatch(db);
    let restoredCount = 0;
    
    // Restore all cancelled bids for this order
    for (const bidDoc of querySnapshot.docs) {
      const bidData = bidDoc.data() as Bid;
      
      // Check if bid is not too old (within 2 hours)
      let bidCreatedAt: Date | null = null;
      if (bidData.createdAt) {
        try {
          // Handle both Firestore Timestamp and JavaScript Date
          const timestamp = bidData.createdAt as any;
          if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            bidCreatedAt = timestamp.toDate();
          } else if (timestamp.getTime && typeof timestamp.getTime === 'function') {
            bidCreatedAt = timestamp;
          }
        } catch (error) {
          console.warn('⚠️ [FIRESTORE] Could not parse bid creation time:', error);
        }
      }
      
      const now = new Date();
      const twoHours = 2 * 60 * 60 * 1000;
      
      if (bidCreatedAt && (now.getTime() - bidCreatedAt.getTime()) < twoHours) {
        console.log(`🔄 [FIRESTORE] Restoring bid ${bidDoc.id} (${bidData.proposedPrice} лв) for order ${cancelledOrderId}`);
        
        // Restore bid to active status
        batch.update(bidDoc.ref, {
          status: 'active',
          // Clear cancellation fields
          cancelledAt: deleteField(),
          cancelReason: deleteField()
        });
        
        restoredCount++;
      } else {
        console.log(`⚠️ [FIRESTORE] Bid ${bidDoc.id} too old to restore (age: ${bidCreatedAt ? now.getTime() - bidCreatedAt.getTime() : 'unknown'}ms)`);
      }
    }
    
    if (restoredCount > 0) {
      await batch.commit();
      console.log(`✅ [FIRESTORE] Restored ${restoredCount} driver bids for order ${cancelledOrderId}`);
    } else {
      console.log('ℹ️ [FIRESTORE] No bids were suitable for restoration');
    }
    
  } catch (error) {
    console.error('❌ [FIRESTORE] Error restoring driver bids:', error);
    // Don't throw here - this is cleanup, shouldn't fail the main operation
  }
};

/**
 * Subscribe to bids for a specific order
 * ✅ ENHANCED: Better error handling and resilience
 */
export const subscribeToBidsForOrder = (orderId: string, callback: (bids: Bid[]) => void) => {
  if (!auth.currentUser) {
    console.warn('⚠️ [FIRESTORE] Bids subscription skipped - Firebase Auth not ready');
    callback([]);
    return () => {};
  }

  console.log(`📡 [FIRESTORE] Setting up bids subscription for order: ${orderId}`);
  
  // Track subscription state
  let subscriptionActive = true;
  let errorCount = 0;
  const maxErrors = 3;
  
  const attemptSubscription = (): (() => void) => {
    try {
      const bidsRef = collection(db, COLLECTIONS.BIDS);
      const q = query(
        bidsRef,
        where('orderId', '==', orderId),
        orderBy('createdAt', 'desc')
      );
      
      return safeOnSnapshot(q, 
        (querySnapshot) => {
          try {
            // Reset error count on successful callback
            errorCount = 0;
            
            if (!subscriptionActive) {
              console.log('📡 [FIRESTORE] Bids subscription deactivated, ignoring update');
              return;
            }
            
            const bids: Bid[] = [];
            querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
              try {
                const data = doc.data();
                bids.push({
                  id: doc.id,
                  ...data,
                  createdAt: data.createdAt?.toDate(),
                  expiresAt: data.expiresAt?.toDate(),
                } as Bid);
              } catch (docError) {
                console.error(`❌ [FIRESTORE] Error processing bid document ${doc.id}:`, docError);
              }
            });
            
            // Sort by price (lowest first) and then by creation time
            bids.sort((a, b) => {
              if (a.proposedPrice !== b.proposedPrice) {
                return a.proposedPrice - b.proposedPrice;
              }
              if (!a.createdAt || !b.createdAt) return 0;
              return a.createdAt.getTime() - b.createdAt.getTime();
            });
            
            console.log(`📡 [FIRESTORE] Bids updated: ${bids.length} bids for order ${orderId}`);
            callback(bids);
            
          } catch (callbackError) {
            console.error('❌ [FIRESTORE] Error in bids callback:', callbackError);
            errorCount++;
            
            if (errorCount >= maxErrors) {
              console.error(`❌ [FIRESTORE] Too many callback errors (${errorCount}), stopping bids subscription`);
              subscriptionActive = false;
              callback([]);
            }
          }
        },
        (error) => {
          console.error("❌ [FIRESTORE] Error in subscribeToBidsForOrder:", error);
          errorCount++;
          
          if (errorCount >= maxErrors) {
            console.error(`❌ [FIRESTORE] Too many subscription errors (${errorCount}), stopping bids subscription`);
            subscriptionActive = false;
          }
          
          // Always provide empty array on error to prevent undefined states
          callback([]);
        }
      );
    } catch (error) {
      console.error("❌ [FIRESTORE] Error setting up bids subscription:", error);
      return () => {}; // Return empty unsubscribe function
    }
  };
  
  const unsubscribe = attemptSubscription();
  
  // Return enhanced unsubscribe function
  return () => {
    console.log(`🧹 [FIRESTORE] Unsubscribing from bids for order: ${orderId}`);
    subscriptionActive = false;
    try {
      unsubscribe();
    } catch (error) {
      console.error('❌ [FIRESTORE] Error during bids subscription cleanup:', error);
    }
  };
}; 
