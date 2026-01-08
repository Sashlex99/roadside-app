// ✅ CRITICAL FIX: Bid Restoration After Payment Cancellation
// This addresses the issue where bids don't reappear after payment cancellation

import { 
  doc, 
  getDoc, 
  updateDoc, 
  runTransaction,
  serverTimestamp,
  deleteField,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Bid, Order } from '../../types/firestore';
import { COLLECTIONS } from './orders';
import { unlockDriver } from './driverLocks';

/**
 * 🚨 CRITICAL FIX: Enhanced cancelBidReservation with proper restoration
 * This ensures bids properly return to active status and are visible to other clients
 */
export const cancelBidReservationFixed = async (orderId: string, bidId: string): Promise<void> => {
  console.log('🔄 [CRITICAL FIX] Starting enhanced bid reservation cancellation...', { orderId, bidId });
  
  let driverId: string | null = null;
  let bidData: Bid | null = null;
  
  try {
    // STEP 1: Get bid data first
    const bidDoc = await getDoc(doc(db, COLLECTIONS.BIDS, bidId));
    
    if (bidDoc.exists()) {
      bidData = bidDoc.data() as Bid;
      driverId = bidData.driverId;
      console.log('📋 [CRITICAL FIX] Bid found:', {
        bidId,
        driverId,
        currentStatus: bidData.status,
        orderId: bidData.orderId,
        price: bidData.proposedPrice
      });
    } else {
      console.warn('⚠️ [CRITICAL FIX] Bid not found during cancellation:', bidId);
      return;
    }
    
    // STEP 2: Enhanced transaction with detailed logging
    console.log('🔄 [CRITICAL FIX] Starting transaction to revert bid and order...');
    
    await runTransaction(db, async (transaction) => {
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      const bidRef = doc(db, COLLECTIONS.BIDS, bidId);
      
      // Read current states
      const orderDoc = await transaction.get(orderRef);
      const currentBidDoc = await transaction.get(bidRef);
      
      if (!orderDoc.exists()) {
        console.warn('⚠️ [CRITICAL FIX] Order not found during cancellation');
        return;
      }
      
      const orderData = orderDoc.data() as Order;
      console.log('📋 [CRITICAL FIX] Current order state:', {
        orderId,
        status: orderData.status,
        reservedBidId: orderData.reservedBidId,
        isThisBidReserved: orderData.reservedBidId === bidId
      });
      
      // Only proceed if this bid is actually reserved
      if (orderData.reservedBidId === bidId) {
        console.log('✅ [CRITICAL FIX] Confirmed - this bid is reserved, reverting...');
        
        // Revert order back to bidding state
        transaction.update(orderRef, {
          status: 'bidding',
          updatedAt: serverTimestamp(),
          // Clear all reservation fields
          reservedBidId: deleteField(),
          reservedDriverId: deleteField(),
          reservedAt: deleteField()
        });
        
        // CRITICAL: Revert bid back to active state
        if (currentBidDoc.exists()) {
          const currentBidData = currentBidDoc.data() as Bid;
          console.log('🔄 [CRITICAL FIX] Reverting bid from', currentBidData.status, 'to active');
          
          transaction.update(bidRef, {
            status: 'active',
            // Clear reservation timestamp
            reservedAt: deleteField()
          });
        }
        
        console.log('✅ [CRITICAL FIX] Transaction prepared - bid will be restored to active');
      } else {
        console.log('ℹ️ [CRITICAL FIX] Bid is not reserved, no action needed');
      }
    });
    
    console.log('✅ [CRITICAL FIX] Transaction completed successfully');
    
    // STEP 3: Unlock driver (this should happen after transaction succeeds)
    if (driverId) {
      console.log('🔓 [CRITICAL FIX] Unlocking driver after bid cancellation...');
      try {
        const unlockResult = await unlockDriver(driverId, orderId, 'Bid reservation cancelled - critical fix');
        
        if (unlockResult.success) {
          console.log('✅ [CRITICAL FIX] Driver unlocked successfully');
        } else {
          console.warn('⚠️ [CRITICAL FIX] Driver unlock failed (may already be unlocked):', unlockResult.error);
        }
      } catch (unlockError) {
        console.error('❌ [CRITICAL FIX] Error unlocking driver:', unlockError);
        // Don't throw - the main cancellation succeeded
      }
    }
    
    // STEP 4: Verify the fix worked
    console.log('🔍 [CRITICAL FIX] Verifying bid restoration...');
    
    // Wait a moment for Firestore to propagate
    setTimeout(async () => {
      try {
        const verifyBidDoc = await getDoc(doc(db, COLLECTIONS.BIDS, bidId));
        if (verifyBidDoc.exists()) {
          const verifyBidData = verifyBidDoc.data() as Bid;
          console.log('✅ [CRITICAL FIX] Verification result:', {
            bidId,
            status: verifyBidData.status,
            isActive: verifyBidData.status === 'active',
            shouldBeVisibleToOtherClients: verifyBidData.status === 'active'
          });
          
          if (verifyBidData.status === 'active') {
            console.log('🎉 [CRITICAL FIX] SUCCESS! Bid is now active and should be visible to other clients');
          } else {
            console.error('❌ [CRITICAL FIX] FAILED! Bid status is still:', verifyBidData.status);
          }
        }
      } catch (verifyError) {
        console.error('❌ [CRITICAL FIX] Verification failed:', verifyError);
      }
    }, 1000);
    
    console.log('✅ [CRITICAL FIX] Bid reservation cancellation completed successfully');
    
  } catch (error) {
    console.error('❌ [CRITICAL FIX] Enhanced bid cancellation failed:', error);
    throw error;
  }
};

/**
 * 🔍 DIAGNOSTIC: Check bid visibility for debugging
 */
export const diagnoseBidVisibility = async (orderId: string, clientName: string = 'Unknown'): Promise<void> => {
  console.log(`🔍 [DIAGNOSTIC] Checking bid visibility for ${clientName} on order ${orderId}`);
  
  try {
    // Get all bids for this order
    const bidsQuery = query(
      collection(db, COLLECTIONS.BIDS),
      where('orderId', '==', orderId)
    );
    
    const bidsSnapshot = await getDocs(bidsQuery);
    const allBids = bidsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as (Bid & { id: string })[];
    
    console.log(`📊 [DIAGNOSTIC] Found ${allBids.length} total bids for order ${orderId}`);
    
    // Filter by status
    const activeBids = allBids.filter(bid => bid.status === 'active');
    const reservedBids = allBids.filter(bid => bid.status === 'reserved');
    const rejectedBids = allBids.filter(bid => bid.status === 'rejected');
    const acceptedBids = allBids.filter(bid => bid.status === 'accepted');
    
    console.log(`📋 [DIAGNOSTIC] Bid status breakdown:`);
    console.log(`   Active (visible to ${clientName}): ${activeBids.length}`);
    console.log(`   Reserved (not visible): ${reservedBids.length}`);
    console.log(`   Rejected (not visible): ${rejectedBids.length}`);
    console.log(`   Accepted (not visible): ${acceptedBids.length}`);
    
    // Show details for each bid
    allBids.forEach(bid => {
      console.log(`   Bid ${bid.id}: ${bid.proposedPrice} лв - Status: ${bid.status} - Driver: ${bid.driverId}`);
    });
    
    // Check if any bids should be visible but aren't
    if (activeBids.length === 0 && (reservedBids.length > 0 || rejectedBids.length > 0)) {
      console.warn(`⚠️ [DIAGNOSTIC] ${clientName} has no visible bids but there are ${reservedBids.length + rejectedBids.length} hidden bids`);
      console.warn(`   This might indicate the bid restoration issue!`);
    }
    
  } catch (error) {
    console.error(`❌ [DIAGNOSTIC] Failed to diagnose bid visibility:`, error);
  }
};

/**
 * 🧪 TEST: Simulate the critical issue scenario
 */
export const testBidRestorationScenario = async (): Promise<void> => {
  console.log('🧪 [TEST] Simulating bid restoration scenario...');
  console.log('This would test: N1 reserves bid → N2 loses visibility → N1 cancels → N2 should see bid again');
  console.log('⚠️ This is a simulation - actual testing requires real Firebase data');
  
  // This would need to be tested with actual Firebase operations
  console.log('📞 To test properly:');
  console.log('1. Use the mobile app to create the exact scenario');
  console.log('2. Monitor Firestore console for bid status changes');
  console.log('3. Use diagnoseBidVisibility() to track visibility');
  console.log('4. Replace cancelBidReservation with cancelBidReservationFixed');
}; 