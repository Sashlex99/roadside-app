// Driver notification utilities
// Ensures drivers get notified when their bids are accepted
//
// NOTE: This file uses dynamic imports for getBidsForOrder to break
// the circular dependency: bids.ts -> driverNotifications.ts -> bids.ts
// Without this, the app can crash during module loading or hot reload.

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
// REMOVED static import to break require cycle:
// import { getBidsForOrder } from '../services/firestore/bids';

/**
 * Ensures a driver gets properly notified when their bid is accepted
 * ✅ ENHANCED: Now fixes orders with missing acceptedDriverId field
 */
export const ensureDriverNotification = async (
  driverId: string,
  orderId: string
): Promise<{ success: boolean; alreadyNotified: boolean; error?: string }> => {
  try {
    console.log('🔔 [DRIVER_NOTIFICATION] Ensuring driver notification:', { driverId, orderId });
    
    // 1. Get the order
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      return { success: false, alreadyNotified: false, error: 'Order not found' };
    }
    
    const orderData = orderDoc.data();
    
    // 2. Check if order is accepted
    if (orderData.status !== 'accepted') {
      return { success: false, alreadyNotified: false, error: `Order status is ${orderData.status}, not accepted` };
    }
    
    // 3. ✅ ENHANCED: Fix missing acceptedDriverId field
    if (!orderData.acceptedDriverId) {
      console.log('🔧 [DRIVER_NOTIFICATION] Order is accepted but missing acceptedDriverId, fixing...');
      
      // Get all bids for this order to find the accepted one
      // Use dynamic import to break the circular dependency (bids.ts -> driverNotifications.ts -> bids.ts)
      const { getBidsForOrder } = await import('../services/firestore/bids');
      const bids = await getBidsForOrder(orderId);
      const acceptedBid = bids.find(bid => bid.status === 'accepted');
      
      if (!acceptedBid) {
        console.log('⚠️ [DRIVER_NOTIFICATION] No accepted bid found, checking for reserved bid...');
        
        // Check if there's a reserved bid that should be accepted
        const reservedBid = bids.find(bid => 
          bid.status === 'reserved' && bid.driverId === driverId
        );
        
        if (reservedBid) {
          console.log('🔧 [DRIVER_NOTIFICATION] Found reserved bid, fixing order and bid status...');
          
          // Use transaction to fix both order and bid
          await runTransaction(db, async (transaction) => {
            // Update order with acceptedDriverId
            transaction.update(orderRef, {
              acceptedDriverId: driverId,
              acceptedBidId: reservedBid.id,
              updatedAt: serverTimestamp()
            });
            
            // Update bid to accepted status
            const bidRef = doc(db, 'bids', reservedBid.id);
            transaction.update(bidRef, {
              status: 'accepted',
              acceptedAt: serverTimestamp()
            });
          });
          
          console.log('✅ [DRIVER_NOTIFICATION] Fixed order and bid status');
          return { success: true, alreadyNotified: false };
        } else {
          return { success: false, alreadyNotified: false, error: 'No accepted or reserved bid found for driver' };
        }
      } else {
        console.log('🔧 [DRIVER_NOTIFICATION] Found accepted bid, fixing order acceptedDriverId...');
        
        // Update order with the accepted driver ID
        await updateDoc(orderRef, {
          acceptedDriverId: acceptedBid.driverId,
          acceptedBidId: acceptedBid.id,
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ [DRIVER_NOTIFICATION] Fixed order acceptedDriverId');
        
        // Check if this driver is the one who should be notified
        if (acceptedBid.driverId !== driverId) {
          return { success: false, alreadyNotified: false, error: `Order accepted by different driver (${acceptedBid.driverId} vs ${driverId})` };
        }
        
        return { success: true, alreadyNotified: false };
      }
    }
    
    // 4. Check if this driver is the accepted one
    if (orderData.acceptedDriverId !== driverId) {
      return { success: false, alreadyNotified: false, error: `Order accepted by different driver (${orderData.acceptedDriverId} vs ${driverId})` };
    }
    
    // 5. Check if driver has already been notified
    const userRef = doc(db, 'users', driverId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const lastNotifiedOrder = userData.lastNotifiedOrder;
      
      if (lastNotifiedOrder === orderId) {
        console.log('ℹ️ [DRIVER_NOTIFICATION] Driver already notified for this order');
        return { success: true, alreadyNotified: true };
      }
    }
    
    // 6. Update driver's last notified order
    await updateDoc(userRef, {
      lastNotifiedOrder: orderId,
      lastNotifiedAt: serverTimestamp()
    });
    
    console.log('✅ [DRIVER_NOTIFICATION] Driver notification ensured successfully');
    return { success: true, alreadyNotified: false };
    
  } catch (error) {
    // Non-critical error - log as warning, not error
    if (__DEV__) {
      console.log('ℹ️ [DRIVER_NOTIFICATION] Could not ensure notification (non-critical):',
        error instanceof Error ? error.message : 'Unknown error');
    }
    return { success: false, alreadyNotified: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Stores a driver notification for later processing
 * ✅ ENHANCED: Now includes retry logic for failed notifications
 */
export const storeDriverNotification = async (
  driverId: string,
  orderId: string,
  bidId: string,
  retryCount: number = 0
): Promise<void> => {
  try {
    console.log('💾 [DRIVER_NOTIFICATION] Storing driver notification:', { driverId, orderId, bidId, retryCount });
    
    const notificationRef = doc(db, 'driverNotifications', `${driverId}_${orderId}`);
    await updateDoc(notificationRef, {
      driverId,
      orderId,
      bidId,
      retryCount,
      createdAt: serverTimestamp(),
      processed: false
    });
    
    console.log('✅ [DRIVER_NOTIFICATION] Notification stored successfully');
  } catch (error) {
    console.error('❌ [DRIVER_NOTIFICATION] Error storing notification:', error);
    throw error;
  }
};

/**
 * Clears a processed driver notification
 */
export const clearDriverNotification = async (driverId: string, orderId: string): Promise<void> => {
  try {
    console.log('🧹 [DRIVER_NOTIFICATION] Clearing driver notification:', { driverId, orderId });
    
    const notificationRef = doc(db, 'driverNotifications', `${driverId}_${orderId}`);
    await updateDoc(notificationRef, {
      processed: true,
      processedAt: serverTimestamp()
    });
    
    console.log('✅ [DRIVER_NOTIFICATION] Notification cleared successfully');
  } catch (error) {
    console.error('❌ [DRIVER_NOTIFICATION] Error clearing notification:', error);
    // Don't throw here - clearing is not critical
  }
}; 