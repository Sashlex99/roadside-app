// Order Operations Module
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
import { safeOnSnapshot, safeFirestoreCall } from '../../utils/safeFirestore';
import { geohashForLocation } from 'geofire-common';
import { unlockDriver } from './driverLocks';
import {
  Order,
  OrderStatus,
  DriverLocation
} from '../../types/firestore';

// ✅ STATE MACHINE: Valid order status transitions
// Prevents invalid state changes like completed → pending
const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['searching', 'cancelled', 'expired'],
  searching: ['bidding', 'cancelled', 'expired'],
  bidding: ['payment_pending', 'cancelled', 'expired'],
  payment_pending: ['accepted', 'bidding', 'cancelled'],  // bidding = payment failed, can retry
  accepted: ['in_progress', 'completed', 'cancelled'],  // completed allowed directly (no separate "start job" step)
  in_progress: ['completed', 'cancelled'],
  completed: [],   // Terminal state - no transitions allowed
  cancelled: [],   // Terminal state - no transitions allowed
  expired: [],     // Terminal state - no transitions allowed
};

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  ORDERS: 'orders',
  BIDS: 'bids', // top-level collection (NOT a subcollection)
  NOTIFICATIONS: 'notifications',
  DRIVER_LOCATIONS: 'driverLocations',
  ANALYTICS: 'orderAnalytics'
} as const;

/**
 * Създава нова заявка за помощ с REST API fallback
 * 
 * РЕШЕНИЕ ЗА FIREBASE SDK BUG:
 * 1. Първо опитваме Firebase SDK (бърз и директен)
 * 2. При висящ Promise, използваме Firestore REST API
 * 3. REST API е 100% reliable за create operations
 */
export const createOrder = async (
  orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'expiresAt'>, 
  options?: { signal?: AbortSignal }
): Promise<string> => {
  console.log('🚀 [FIRESTORE] Starting order creation with REST API fallback...');
  
  // Check if operation was aborted before starting
  if (options?.signal?.aborted) {
    throw new Error('Operation was aborted');
  }
  
  try {
    // Try Firebase SDK first (fastest path)
    return await createOrderWithFirebaseBugWorkaround(orderData, options);
  } catch (error) {
    // Check if operation was aborted during SDK attempt
    if (options?.signal?.aborted) {
      throw new Error('Operation was aborted');
    }
    
    console.log('❌ [FIRESTORE] Firebase SDK failed, falling back to REST API...');
    
    // Import REST API service
    const { createOrderViaREST } = await import('../firestoreREST');
    
    try {
      const orderId = await createOrderViaREST(orderData);
      console.log('✅ [FIRESTORE] Order created successfully via REST API fallback:', orderId);
      return orderId;
    } catch (restError) {
      console.error('❌ [FIRESTORE] Both Firebase SDK and REST API failed:', restError);
      throw new Error('Не можахме да създадем заявката. Моля опитайте отново или се свържете с поддръжката.');
    }
  }
};

/**
 * Workaround за Firebase SDK bug където addDoc създава документа но не върща Promise
 * ✅ ENHANCED: Real-time detection на създадени заявки
 */
export const createOrderWithFirebaseBugWorkaround = async (
  orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'expiresAt'>,
  options?: { signal?: AbortSignal }
): Promise<string> => {
  console.log('🔧 [FIRESTORE] Using Firebase bug workaround with real-time detection...');
  
  // Check if operation was aborted
  if (options?.signal?.aborted) {
    throw new Error('Operation was aborted');
  }

  // ✅ NEW: Set up real-time order detection BEFORE attempting creation
  let orderDetectedPromise: Promise<string> | null = null;
  let unsubscribeOrderDetection: any = null;
  
  try {
    // ✅ NEW: Start listening for new orders from this client
    console.log('👂 [FIRESTORE] Setting up real-time order detection...');
    
    orderDetectedPromise = new Promise<string>((resolve, reject) => {
      const orderCreationTime = Date.now();
      let detectedOrderId: string | null = null;
      
      // Set up timeout for detection (60 seconds)
      const detectionTimeout = setTimeout(() => {
        if (unsubscribeOrderDetection) {
          unsubscribeOrderDetection();
        }
        if (!detectedOrderId) {
          reject(new Error('No order detected via real-time listener within timeout'));
        }
      }, 60000);
      
      // Subscribe to client orders with enhanced detection
      unsubscribeOrderDetection = subscribeToClientOrders(orderData.clientId, (orders) => {
        // Check if operation was aborted
        if (options?.signal?.aborted) {
          clearTimeout(detectionTimeout);
          if (unsubscribeOrderDetection) {
            unsubscribeOrderDetection();
          }
          reject(new Error('Operation was aborted'));
          return;
        }
        
        // Look for orders created after we started the operation
        for (const order of orders) {
          if (!order.createdAt) continue;
          
          const orderCreatedTime = order.createdAt.getTime();
          
          // Must be created after we started (within 5 seconds grace period)
          if (orderCreatedTime < orderCreationTime - 5000) continue;
          
          // Enhanced matching: location and description
          const locationMatch = Math.abs(order.location.latitude - orderData.location.latitude) < 0.001 &&
                                Math.abs(order.location.longitude - orderData.location.longitude) < 0.001;
          
          const descriptionMatch = order.description.trim() === orderData.description.trim();
          
          if (locationMatch && descriptionMatch) {
            console.log('✅ [FIRESTORE] Real-time detection found matching order!', order.id);
            detectedOrderId = order.id;
            clearTimeout(detectionTimeout);
            if (unsubscribeOrderDetection) {
              unsubscribeOrderDetection();
            }
            resolve(order.id);
            return;
          }
        }
      });
    });

    // Try normal creation first
    try {
      const orderId = await createOrderWithRetry(orderData, 2, options); // Reduce retries to 2
      
      // If normal creation succeeds, cleanup and return
      if (unsubscribeOrderDetection) {
        unsubscribeOrderDetection();
      }
      return orderId;
      
    } catch (sdkError) {
      // Check if operation was aborted during retry
      if (options?.signal?.aborted) {
        if (unsubscribeOrderDetection) {
          unsubscribeOrderDetection();
        }
        throw new Error('Operation was aborted');
      }
      
      console.log('❌ [FIRESTORE] SDK creation failed, waiting for real-time detection...');
      
      // Wait for real-time detection to find the order
      try {
        const detectedOrderId = await orderDetectedPromise;
        console.log('✅ [FIRESTORE] Order found via real-time detection despite SDK failure!', detectedOrderId);
        return detectedOrderId;
        
      } catch (detectionError) {
        console.error('❌ [FIRESTORE] Real-time detection also failed:', detectionError);
        throw new Error('Unable to create order with both SDK and real-time detection');
      }
    }
    
  } finally {
    // Always cleanup the subscription
    if (unsubscribeOrderDetection) {
      unsubscribeOrderDetection();
    }
  }
};

/**
 * ✅ ENHANCED: Търси скорошни заявки от клиент за duplicate detection
 */
export const findRecentOrdersByClient = async (clientId: string, minutes: number = 2): Promise<Order[]> => {
  console.log('🔍 [FIRESTORE] Searching for recent orders by client:', clientId);
  
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
  
  try {
    const ordersRef = collection(db, COLLECTIONS.ORDERS);
    const q = query(
      ordersRef,
      where('clientId', '==', clientId),
      where('createdAt', '>=', cutoffTime),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const orders: Order[] = [];
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      orders.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate(),
      } as Order);
    });
    
    console.log(`✅ [FIRESTORE] Found ${orders.length} recent orders for client ${clientId}`);
    return orders;
    
  } catch (error) {
    console.error('❌ [FIRESTORE] Error finding recent orders:', error);
    return [];
  }
};

export const createOrderWithRetry = async (
  orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'expiresAt'>,
  maxRetries = 3,
  options?: { signal?: AbortSignal }
): Promise<string> => {
  let lastError: any = null;
  let attempt = 0;

  // ✅ FIX: Generate unique creation token to prevent duplicates from Promise.race timeout
  // If timeout fires but addDoc succeeds in background, retry would create duplicate
  // This token lets us detect if a previous attempt actually succeeded
  const creationToken = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const creationStartTime = Date.now();

  console.log(`🔑 [FIRESTORE] Order creation token: ${creationToken}`);

  while (attempt < maxRetries) {
    // Check if operation was aborted
    if (options?.signal?.aborted) {
      throw new Error('Operation was aborted');
    }

    attempt++;
    console.log(`🔄 [FIRESTORE] Order creation attempt ${attempt}/${maxRetries}`);

    // ✅ FIX: Before retry attempts (not first), check if order was already created
    // This catches the case where Promise.race timed out but addDoc actually succeeded
    if (attempt > 1) {
      console.log('🔍 [FIRESTORE] Checking for duplicate before retry...');
      const existingOrder = await findMatchingRecentOrder(
        orderData.clientId,
        orderData.location,
        orderData.description,
        creationStartTime
      );

      if (existingOrder) {
        console.log('✅ [FIRESTORE] Found existing order from previous attempt, avoiding duplicate:', existingOrder.id);
        return existingOrder.id;
      }
      console.log('ℹ️ [FIRESTORE] No duplicate found, proceeding with retry');
    }

    try {
      const ordersRef = collection(db, COLLECTIONS.ORDERS);

      // Transform order data for Firestore
      const firestoreOrderData = {
        ...orderData,
        // ✅ FIX: Include creation token for duplicate detection
        creationToken,
        // Convert JavaScript Date to Firestore Timestamp
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Auto-expire after 2 hours if not accepted
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        // Add location-based geohash for proximity searches
        locationGeohash: geohashForLocation([orderData.location.latitude, orderData.location.longitude])
      };

      // Enhanced timeout for order creation
      const docRef = await Promise.race([
        addDoc(ordersRef, firestoreOrderData),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Order creation timeout')), 10000); // 10 second timeout
        })
      ]) as any;

      // Check if document was actually created
      if (docRef && docRef.id) {
        console.log('✅ [FIRESTORE] Order created successfully:', docRef.id);
        return docRef.id;
      } else {
        throw new Error('Document reference is null or missing ID');
      }

    } catch (error) {
      lastError = error;
      console.error(`❌ [FIRESTORE] Order creation attempt ${attempt} failed:`, error);

      // Check if operation was aborted during attempt
      if (options?.signal?.aborted) {
        throw new Error('Operation was aborted');
      }

      // If this is the last attempt, do one final duplicate check before failing
      if (attempt >= maxRetries) {
        console.log('🔍 [FIRESTORE] Final duplicate check before failing...');
        const existingOrder = await findMatchingRecentOrder(
          orderData.clientId,
          orderData.location,
          orderData.description,
          creationStartTime
        );

        if (existingOrder) {
          console.log('✅ [FIRESTORE] Found existing order on final check:', existingOrder.id);
          return existingOrder.id;
        }

        console.error('❌ [FIRESTORE] All order creation attempts failed');
        throw lastError;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }

  throw lastError;
};

/**
 * ✅ NEW: Find a matching order created after a specific time
 * Used to detect duplicates when Promise.race timeout fires but addDoc actually succeeded
 */
const findMatchingRecentOrder = async (
  clientId: string,
  location: { latitude: number; longitude: number },
  description: string,
  createdAfterTime: number
): Promise<Order | null> => {
  try {
    const recentOrders = await findRecentOrdersByClient(clientId, 2); // Last 2 minutes

    for (const order of recentOrders) {
      if (!order.createdAt) continue;

      const orderCreatedTime = order.createdAt.getTime();

      // Must be created after we started this creation attempt
      if (orderCreatedTime < createdAfterTime - 5000) continue; // 5 second grace period

      // Match by location (within ~100 meters)
      const locationMatch =
        Math.abs(order.location.latitude - location.latitude) < 0.001 &&
        Math.abs(order.location.longitude - location.longitude) < 0.001;

      // Match by description
      const descriptionMatch = order.description.trim() === description.trim();

      if (locationMatch && descriptionMatch) {
        return order;
      }
    }

    return null;
  } catch (error) {
    console.error('❌ [FIRESTORE] Error checking for duplicate order:', error);
    return null; // Don't block on duplicate check failure
  }
};

/**
 * Retrieve order by ID
 */
export const getOrder = async (orderId: string): Promise<Order | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.ORDERS, orderId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
      } as Order;
    } else {
      console.log("No such document!");
      return null;
    }
  } catch (error) {
    console.error("Error getting order:", error);
    return null;
  }
};

/**
 * Update order status with state machine validation
 * ✅ ENHANCED: Validates transitions to prevent invalid state changes
 */
export const updateOrderStatus = async (orderId: string, status: OrderStatus, additionalData?: Partial<Order>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.ORDERS, orderId);

    // ✅ STATE MACHINE: Validate the transition is allowed
    const currentDoc = await getDoc(docRef);
    if (currentDoc.exists()) {
      const currentStatus = currentDoc.data().status as OrderStatus;
      const allowedTransitions = VALID_ORDER_TRANSITIONS[currentStatus] || [];

      if (!allowedTransitions.includes(status)) {
        const errorMsg = `Invalid order transition: ${currentStatus} → ${status} (allowed: ${allowedTransitions.join(', ') || 'none'})`;

        if (__DEV__) {
          // In development, throw to catch bugs early
          console.error(`❌ [FIRESTORE] ${errorMsg}`);
          throw new Error(errorMsg);
        } else {
          // In production, log warning but allow for backwards compatibility
          // This prevents breaking changes while we monitor for issues
          console.warn(`⚠️ [FIRESTORE] ${errorMsg} - allowing for backwards compatibility`);
        }
      }
    }

    // Build update data
    const updateData: Record<string, any> = {
      status,
      updatedAt: serverTimestamp(),
      ...additionalData
    };

    // Automatically set completedAt when order is completed
    if (status === 'completed') {
      updateData.completedAt = serverTimestamp();
    }

    // Automatically set cancelledAt when order is cancelled
    if (status === 'cancelled') {
      updateData.cancelledAt = serverTimestamp();
    }

    // Safety net: Unlock driver when order is completed
    // This ensures the driver is freed even if payment confirmation didn't unlock them
    if (status === 'completed') {
      try {
        const orderDoc = await getDoc(docRef);
        const orderData = orderDoc.data();
        if (orderData?.acceptedDriverId) {
          const unlockResult = await unlockDriver(orderData.acceptedDriverId, orderId);
          if (unlockResult.success) {
            console.log(`🔓 [FIRESTORE] Driver ${orderData.acceptedDriverId} unlocked on order completion`);
          } else {
            console.log(`ℹ️ [FIRESTORE] Driver unlock on completion: ${unlockResult.error || 'already unlocked'}`);
          }
        }
      } catch (unlockError) {
        console.warn(`⚠️ [FIRESTORE] Unlock on completion failed (may already be unlocked):`, unlockError);
        // Don't throw - order update should still proceed
      }
    }

    await updateDoc(docRef, updateData);
    console.log(`✅ [FIRESTORE] Order ${orderId} status updated to ${status}`);
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
};

/**
 * ✅ NEW: Properly cancel an order with full cleanup
 * This ensures all driver bid statuses are cleaned up when an order is cancelled
 */
export const cancelOrder = async (orderId: string): Promise<void> => {
  console.log('🔄 [FIRESTORE] Starting proper order cancellation...', { orderId });
  
  try {
    await runTransaction(db, async (transaction) => {
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      
      // Get current order state
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists()) {
        throw new Error('Order not found');
      }
      
      const orderData = orderDoc.data() as Order;
      
      // Update order status to cancelled
      transaction.update(orderRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Clear any reservation fields
        reservedBidId: deleteField(),
        reservedDriverId: deleteField(),
        reservedAt: deleteField()
      });
      
      console.log('✅ [FIRESTORE] Order marked as cancelled in transaction');
    });
    
    // Clean up all associated bids
    console.log('🧹 [FIRESTORE] Cleaning up all bids for cancelled order...');
    await cleanupBidsForCancelledOrder(orderId);
    
    console.log('✅ [FIRESTORE] Order cancelled successfully with full cleanup:', { orderId });
    
  } catch (error) {
    console.error('❌ [FIRESTORE] Error cancelling order:', error);
    throw error;
  }
};

/**
 * ✅ FIXED: Clean up all bids associated with a cancelled order
 * Now also releases driver locks for any reserved bids
 */
const cleanupBidsForCancelledOrder = async (orderId: string): Promise<void> => {
  try {
    console.log('🧹 [FIRESTORE] Cleaning up bids for cancelled order:', orderId);

    // Get all bids for this order
    const bidsRef = collection(db, COLLECTIONS.BIDS);
    const q = query(
      bidsRef,
      where('orderId', '==', orderId),
      where('status', 'in', ['active', 'reserved'])
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('ℹ️ [FIRESTORE] No active/reserved bids found for cancelled order');
      return;
    }

    // ✅ NEW: Collect driver IDs from reserved bids to unlock them
    const driversToUnlock: string[] = [];

    const batch = writeBatch(db);
    let cleanedCount = 0;

    querySnapshot.forEach((doc) => {
      const bidData = doc.data();
      const bidRef = doc.ref;

      // ✅ NEW: If bid was reserved, we need to unlock the driver
      if (bidData.status === 'reserved' && bidData.driverId) {
        driversToUnlock.push(bidData.driverId);
        console.log(`🔓 [FIRESTORE] Will unlock driver ${bidData.driverId} (reserved bid)`);
      }

      batch.update(bidRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelReason: 'Order was cancelled by client'
      });
      cleanedCount++;
    });

    await batch.commit();
    console.log(`✅ [FIRESTORE] Cleaned up ${cleanedCount} bids for cancelled order`);

    // ✅ NEW: Unlock all drivers that had reserved bids
    for (const driverId of driversToUnlock) {
      try {
        await unlockDriver(driverId, orderId);
        console.log(`✅ [FIRESTORE] Unlocked driver ${driverId} after order cancellation`);
      } catch (unlockError) {
        console.warn(`⚠️ [FIRESTORE] Failed to unlock driver ${driverId}:`, unlockError);
        // Don't throw - cleanup should continue
      }
    }

  } catch (error) {
    console.error('❌ [FIRESTORE] Error cleaning up bids for cancelled order:', error);
    // Don't throw here - this is cleanup, main cancellation should still succeed
  }
};

/**
 * ✅ NEW: Health check function to validate and fix driver availability
 */
export const validateAndFixDriverAvailability = async (driverId: string): Promise<{
  wasFixed: boolean;
  foundIssues: string[];
  cleanedBids: number;
}> => {
  console.log('🔍 [FIRESTORE] Validating driver availability:', driverId);
  
  const issues: string[] = [];
  let cleanedBids = 0;
  let wasFixed = false;
  
  try {
    // Find all reserved bids for this driver
    const bidsRef = collection(db, COLLECTIONS.BIDS);
    const q = query(
      bidsRef,
      where('driverId', '==', driverId),
      where('status', '==', 'reserved')
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('✅ [FIRESTORE] Driver has no reserved bids - availability OK');
      return { wasFixed: false, foundIssues: [], cleanedBids: 0 };
    }
    
    console.log(`🔍 [FIRESTORE] Found ${querySnapshot.size} reserved bids for driver`);
    
    const batch = writeBatch(db);
    
    for (const bidDoc of querySnapshot.docs) {
      const bidData = bidDoc.data();
      const bidId = bidDoc.id;
      const orderId = bidData.orderId;
      
      console.log(`🔍 [FIRESTORE] Checking reserved bid ${bidId} for order ${orderId}`);
      
      // Get the associated order
      const orderDoc = await getDoc(doc(db, COLLECTIONS.ORDERS, orderId));
      
      if (!orderDoc.exists()) {
        // Order doesn't exist - clean up orphaned bid
        issues.push(`Orphaned bid ${bidId} - order ${orderId} not found`);
        batch.update(bidDoc.ref, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelReason: 'Associated order not found'
        });
        cleanedBids++;
        wasFixed = true;
        continue;
      }
      
      const orderData = orderDoc.data() as Order;
      
      // Check if order is in a state that shouldn't have reserved bids
      if (['cancelled', 'completed', 'expired'].includes(orderData.status)) {
        issues.push(`Stale reserved bid ${bidId} - order ${orderId} status is ${orderData.status}`);
        batch.update(bidDoc.ref, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelReason: `Order status changed to ${orderData.status}`
        });
        cleanedBids++;
        wasFixed = true;
        continue;
      }
      
      // ✅ UPDATED: Check if bid is older than 2 hours (matches order expiration)
      const bidCreatedAt = bidData.createdAt?.toDate?.() || bidData.createdAt;
      if (bidCreatedAt && (Date.now() - bidCreatedAt.getTime()) > 2 * 60 * 60 * 1000) {
        issues.push(`Expired reserved bid ${bidId} - older than 2 hours`);
        batch.update(bidDoc.ref, {
          status: 'expired',
          expiredAt: serverTimestamp(),
          cancelReason: 'Bid expired (> 2 hours old)'
        });
        cleanedBids++;
        wasFixed = true;
        continue;
      }
      
      // If we get here, the reserved bid seems valid
      console.log(`✅ [FIRESTORE] Reserved bid ${bidId} appears valid for order ${orderId}`);
    }
    
    if (cleanedBids > 0) {
      await batch.commit();
      console.log(`✅ [FIRESTORE] Fixed driver availability - cleaned ${cleanedBids} problematic bids`);
    }
    
    return { wasFixed, foundIssues: issues, cleanedBids };
    
  } catch (error) {
    console.error('❌ [FIRESTORE] Error validating driver availability:', error);
    return { wasFixed: false, foundIssues: [`Error during validation: ${error instanceof Error ? error.message : String(error)}`], cleanedBids: 0 };
  }
};

/**
 * ✅ NEW: Global cleanup function to fix orphaned reserved bids
 */
export const cleanupOrphanedReservedBids = async (): Promise<{
  cleaned: number;
  errors: string[];
}> => {
  console.log('🧹 [FIRESTORE] Starting global cleanup of orphaned reserved bids...');
  
  const errors: string[] = [];
  let cleanedCount = 0;
  
  try {
    // Find all reserved bids
    const bidsRef = collection(db, COLLECTIONS.BIDS);
    const q = query(
      bidsRef,
      where('status', '==', 'reserved'),
      limit(50) // Process in batches to avoid overwhelming
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('✅ [FIRESTORE] No reserved bids found - nothing to clean');
      return { cleaned: 0, errors: [] };
    }
    
    console.log(`🔍 [FIRESTORE] Found ${querySnapshot.size} reserved bids to validate`);
    
    const batch = writeBatch(db);
    
    for (const bidDoc of querySnapshot.docs) {
      const bidData = bidDoc.data();
      const bidId = bidDoc.id;
      const orderId = bidData.orderId;
      
      try {
        // Check if associated order exists and is valid
        const orderDoc = await getDoc(doc(db, COLLECTIONS.ORDERS, orderId));
        
        let shouldClean = false;
        let reason = '';
        
        if (!orderDoc.exists()) {
          shouldClean = true;
          reason = 'Associated order not found';
        } else {
          const orderData = orderDoc.data() as Order;
          
          if (['cancelled', 'completed', 'expired'].includes(orderData.status)) {
            shouldClean = true;
            reason = `Order status is ${orderData.status}`;
          } else if (orderData.reservedBidId !== bidId) {
            shouldClean = true;
            reason = 'Bid is not the reserved bid for this order';
          }
        }
        
        if (shouldClean) {
          batch.update(bidDoc.ref, {
            status: 'cancelled',
            cancelledAt: serverTimestamp(),
            cancelReason: `Orphaned reservation: ${reason}`
          });
          cleanedCount++;
          console.log(`🧹 [FIRESTORE] Will clean bid ${bidId}: ${reason}`);
        }
        
             } catch (error) {
         const errorMsg = `Error processing bid ${bidId}: ${error instanceof Error ? error.message : String(error)}`;
         console.error(`❌ [FIRESTORE] ${errorMsg}`);
         errors.push(errorMsg);
       }
    }
    
    if (cleanedCount > 0) {
      await batch.commit();
      console.log(`✅ [FIRESTORE] Global cleanup complete - cleaned ${cleanedCount} orphaned bids`);
    } else {
      console.log('✅ [FIRESTORE] Global cleanup complete - no issues found');
    }
    
    return { cleaned: cleanedCount, errors };
    
  } catch (error) {
    const errorMsg = `Global cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`❌ [FIRESTORE] ${errorMsg}`);
    errors.push(errorMsg);
    return { cleaned: cleanedCount, errors };
  }
};

/**
 * Find orders within a specific radius using geohash
 */
export const findOrdersInRadius = async (
  driverLocation: { latitude: number; longitude: number }, 
  radiusKm: number = 10
): Promise<Order[]> => {
  try {
    // For now, fetch all active orders and filter by distance
    // TODO: Implement geohash-based filtering for better performance
    const ordersRef = collection(db, COLLECTIONS.ORDERS);
    const q = query(
      ordersRef,
      where('status', 'in', ['pending', 'searching', 'bidding']),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const orders: Order[] = [];
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      const order: Order = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
      } as Order;
      
      // Calculate distance
      const distance = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        order.location.latitude,
        order.location.longitude
      );
      
      if (distance <= radiusKm) {
        orders.push(order);
      }
    });
    
    // Sort by distance
    orders.sort((a, b) => {
      const distA = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        a.location.latitude,
        a.location.longitude
      );
      const distB = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        b.location.latitude,
        b.location.longitude
      );
      return distA - distB;
    });
    
    return orders;
  } catch (error) {
    console.error("Error finding orders in radius:", error);
    return [];
  }
};

/**
 * Subscribe to client orders with real-time updates
 * ✅ ENHANCED: Better error handling and resilience
 */
export const subscribeToClientOrders = (clientId: string, callback: (orders: Order[]) => void) => {
  console.log(`📡 [FIRESTORE] Setting up client orders subscription for: ${clientId}`);

  // Track subscription state
  let subscriptionActive = true;
  let errorCount = 0;
  const maxErrors = 3;

  const attemptSubscription = (): (() => void) => {
    try {
      const ordersRef = collection(db, COLLECTIONS.ORDERS);
      // Query includes all statuses to detect status transitions (completed/cancelled)
      // We filter old completed orders in JavaScript
      const q = query(
        ordersRef,
        where('clientId', '==', clientId),
        orderBy('createdAt', 'desc'),
        limit(10) // Limit to recent orders
      );

      return safeOnSnapshot(q,
        (querySnapshot) => {
          try {
            // Reset error count on successful callback
            errorCount = 0;

            if (!subscriptionActive) {
              console.log('📡 [FIRESTORE] Subscription deactivated, ignoring update');
              return;
            }

            const now = Date.now();
            const COMPLETED_VISIBILITY_MS = 60000; // Show completed orders for 1 minute (for status transition detection)

            const orders: Order[] = [];
            querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
              try {
                const data = doc.data();
                const order = {
                  id: doc.id,
                  ...data,
                  createdAt: data.createdAt?.toDate(),
                  updatedAt: data.updatedAt?.toDate(),
                  expiresAt: data.expiresAt?.toDate(),
                  completedAt: data.completedAt?.toDate(),
                  cancelledAt: data.cancelledAt?.toDate(),
                } as Order;

                // Include order if:
                // 1. Not completed/cancelled, OR
                // 2. Recently completed/cancelled (within 1 minute) for status transition detection
                if (order.status !== 'completed' && order.status !== 'cancelled') {
                  orders.push(order);
                } else {
                  // Include recently completed/cancelled orders
                  const finishedTime = order.completedAt?.getTime() || order.cancelledAt?.getTime() || order.updatedAt?.getTime() || 0;
                  if (now - finishedTime < COMPLETED_VISIBILITY_MS) {
                    orders.push(order);
                    console.log(`📡 [FIRESTORE] Including recently ${order.status} order for transition detection`);
                  }
                }
              } catch (docError) {
                console.error(`❌ [FIRESTORE] Error processing order document ${doc.id}:`, docError);
              }
            });

            // Sort by creation time (newest first)
            orders.sort((a, b) => {
              if (!a.createdAt || !b.createdAt) return 0;
              return b.createdAt.getTime() - a.createdAt.getTime();
            });

            console.log(`📡 [FIRESTORE] Client orders updated: ${orders.length} orders for ${clientId}`);
            callback(orders);

          } catch (callbackError) {
            console.error('❌ [FIRESTORE] Error in client orders callback:', callbackError);
            errorCount++;

            if (errorCount >= maxErrors) {
              console.error(`❌ [FIRESTORE] Too many callback errors (${errorCount}), stopping subscription`);
              subscriptionActive = false;
              callback([]);
            }
          }
        },
        (error) => {
          console.error("❌ [FIRESTORE] Error in subscribeToClientOrders:", error);
          errorCount++;
          
          if (errorCount >= maxErrors) {
            console.error(`❌ [FIRESTORE] Too many subscription errors (${errorCount}), stopping subscription`);
            subscriptionActive = false;
          }
          
          // Always provide empty array on error to prevent undefined states
          callback([]);
        }
      );
    } catch (error) {
      console.error("❌ [FIRESTORE] Error setting up client orders subscription:", error);
      return () => {}; // Return empty unsubscribe function
    }
  };
  
  const unsubscribe = attemptSubscription();
  
  // Return enhanced unsubscribe function
  return () => {
    console.log(`🧹 [FIRESTORE] Unsubscribing from client orders for: ${clientId}`);
    subscriptionActive = false;
    try {
      unsubscribe();
    } catch (error) {
      console.error('❌ [FIRESTORE] Error during subscription cleanup:', error);
    }
  };
};

/**
 * Get all active orders for drivers
 */
export const getActiveOrders = async (): Promise<Order[]> => {
  try {
    const ordersRef = collection(db, COLLECTIONS.ORDERS);
    const q = query(
      ordersRef,
      where('status', 'in', ['pending', 'searching', 'bidding']),
      orderBy('createdAt', 'desc'),
      limit(50) // Limit to 50 most recent orders
    );
    
    const querySnapshot = await getDocs(q);
    const orders: Order[] = [];
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
      } as Order);
    });
    
    return orders;
  } catch (error) {
    console.error("Error getting active orders:", error);
    return [];
  }
};

/**
 * Get accepted orders for a specific driver
 * ✅ ENHANCED: Added comprehensive debug logging for permission troubleshooting
 */
export const getAcceptedOrdersForDriver = async (driverId: string): Promise<Order[]> => {
  console.log('🔍 [DEBUG] getAcceptedOrdersForDriver called:', { driverId });

  try {
    // DEBUG: Check auth state before query
    const currentUser = auth.currentUser;
    console.log('🔍 [DEBUG] Auth state check:', {
      isAuthenticated: !!currentUser,
      currentUserId: currentUser?.uid || 'NOT_AUTHENTICATED',
      requestedDriverId: driverId,
      isSameUser: currentUser?.uid === driverId,
    });

    if (!currentUser) {
      console.error('❌ [DEBUG] No authenticated user! Cannot query accepted orders.');
      console.error('❌ [DEBUG] This is likely the cause of "Missing or insufficient permissions" error.');
      return [];
    }

    // DEBUG: Log the query parameters
    console.log('🔍 [DEBUG] Building query with:', {
      collection: COLLECTIONS.ORDERS,
      filters: {
        acceptedDriverId: driverId,
        status: 'accepted',
      },
      orderBy: 'createdAt DESC',
      limit: 10,
    });

    const ordersRef = collection(db, COLLECTIONS.ORDERS);
    const q = query(
      ordersRef,
      where('acceptedDriverId', '==', driverId),
      where('status', '==', 'accepted'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    console.log('🔍 [DEBUG] Executing Firestore query...');
    const querySnapshot = await getDocs(q);
    console.log('✅ [DEBUG] Query successful! Found', querySnapshot.size, 'orders');

    const orders: Order[] = [];

    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
      } as Order);
    });

    console.log('✅ [DEBUG] Returning', orders.length, 'accepted orders for driver:', driverId);
    return orders;
  } catch (error: any) {
    console.error('❌ [DEBUG] Error getting accepted orders for driver:', {
      driverId,
      errorCode: error?.code,
      errorMessage: error?.message,
      fullError: error,
    });

    // Provide specific debugging hints based on error type
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.error('❌ [DEBUG] PERMISSION ERROR - Possible causes:');
      console.error('   1. Missing composite index (acceptedDriverId + status + createdAt)');
      console.error('   2. User not authenticated (check auth.currentUser)');
      console.error('   3. Firestore rules not allowing read');
      console.error('   4. User token expired');
      console.error('🔧 [DEBUG] Fix: Deploy firestore.indexes.json with: firebase deploy --only firestore:indexes');
    }

    return [];
  }
};

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to update order status only if it matches current status
async function updateOrderStatusIfMatches(orderId: string, currentStatus: OrderStatus, newStatus: OrderStatus): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.ORDERS, orderId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists() && docSnap.data().status === currentStatus) {
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error updating order status conditionally:", error);
  }
} 