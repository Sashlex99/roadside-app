/**
 * Debug script to examine driver notification issues
 * Checks order state and identifies missing acceptedDriverId
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'roadside-assistance-bf'
  });
}

const db = admin.firestore();

async function debugDriverNotification() {
  console.log('🔍 Starting driver notification debug...');
  
  try {
    // Find recent orders with 'accepted' status
    const ordersRef = db.collection('orders');
    const acceptedOrdersQuery = ordersRef
      .where('status', '==', 'accepted')
      .orderBy('createdAt', 'desc')
      .limit(10);
    
    const acceptedOrdersSnapshot = await acceptedOrdersQuery.get();
    
    console.log(`\n📋 Found ${acceptedOrdersSnapshot.size} recent accepted orders:`);
    
    for (const orderDoc of acceptedOrdersSnapshot.docs) {
      const orderData = orderDoc.data();
      const orderId = orderDoc.id;
      
      console.log(`\n🔸 Order ${orderId}:`);
      console.log(`  Status: ${orderData.status}`);
      console.log(`  AcceptedDriverId: ${orderData.acceptedDriverId || 'undefined'}`);
      console.log(`  AcceptedBidId: ${orderData.acceptedBidId || 'undefined'}`);
      console.log(`  ReservedDriverId: ${orderData.reservedDriverId || 'undefined'}`);
      console.log(`  ReservedBidId: ${orderData.reservedBidId || 'undefined'}`);
      console.log(`  PaymentStatus: ${orderData.paymentStatus || 'undefined'}`);
      console.log(`  Created: ${orderData.createdAt?.toDate()}`);
      console.log(`  Updated: ${orderData.updatedAt?.toDate()}`);
      console.log(`  AcceptedAt: ${orderData.acceptedAt?.toDate() || 'undefined'}`);
      
      // Check if this order has an acceptedDriverId issue
      if (!orderData.acceptedDriverId && orderData.status === 'accepted') {
        console.log(`  ❌ ISSUE: Order is accepted but acceptedDriverId is missing!`);
        
        // Check if we have a reservedDriverId
        if (orderData.reservedDriverId) {
          console.log(`  💡 Found reservedDriverId: ${orderData.reservedDriverId}`);
          console.log(`  🔧 This order needs manual fix - setting acceptedDriverId`);
          
          // Fix the order
          await orderDoc.ref.update({
            acceptedDriverId: orderData.reservedDriverId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          console.log(`  ✅ Fixed acceptedDriverId for order ${orderId}`);
        } else {
          console.log(`  ⚠️ No reservedDriverId found - checking bids...`);
          
          // Check bids collection
          const bidsRef = db.collection('bids');
          const bidsQuery = bidsRef
            .where('orderId', '==', orderId)
            .where('status', '==', 'accepted');
          
          const bidsSnapshot = await bidsQuery.get();
          
          if (bidsSnapshot.size > 0) {
            const acceptedBid = bidsSnapshot.docs[0].data();
            console.log(`  💡 Found accepted bid with driverId: ${acceptedBid.driverId}`);
            
            // Fix the order
            await orderDoc.ref.update({
              acceptedDriverId: acceptedBid.driverId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`  ✅ Fixed acceptedDriverId from bid for order ${orderId}`);
          } else {
            console.log(`  ❌ No accepted bid found for order ${orderId}`);
          }
        }
      }
      
      // Check bids for this order
      const bidsRef = db.collection('bids');
      const bidsQuery = bidsRef
        .where('orderId', '==', orderId)
        .orderBy('createdAt', 'desc');
      
      const bidsSnapshot = await bidsQuery.get();
      
      console.log(`  📊 Bids (${bidsSnapshot.size}):`);
      bidsSnapshot.docs.forEach((bidDoc) => {
        const bidData = bidDoc.data();
        console.log(`    - ${bidDoc.id}: ${bidData.status} by ${bidData.driverId} (${bidData.proposedPrice}лв)`);
      });
    }
    
    // Check payment_pending orders too
    console.log('\n🔄 Checking payment_pending orders...');
    const pendingOrdersQuery = ordersRef
      .where('status', '==', 'payment_pending')
      .orderBy('createdAt', 'desc')
      .limit(5);
    
    const pendingOrdersSnapshot = await pendingOrdersQuery.get();
    
    console.log(`\n📋 Found ${pendingOrdersSnapshot.size} payment_pending orders:`);
    
    for (const orderDoc of pendingOrdersSnapshot.docs) {
      const orderData = orderDoc.data();
      const orderId = orderDoc.id;
      
      console.log(`\n🔸 Order ${orderId}:`);
      console.log(`  Status: ${orderData.status}`);
      console.log(`  ReservedDriverId: ${orderData.reservedDriverId || 'undefined'}`);
      console.log(`  ReservedBidId: ${orderData.reservedBidId || 'undefined'}`);
      console.log(`  Created: ${orderData.createdAt?.toDate()}`);
      console.log(`  Updated: ${orderData.updatedAt?.toDate()}`);
      console.log(`  ReservedAt: ${orderData.reservedAt?.toDate() || 'undefined'}`);
      
      // Check if reservation is properly set
      if (!orderData.reservedDriverId) {
        console.log(`  ❌ ISSUE: Payment pending but no reservedDriverId!`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

// Run debug if this file is executed directly
if (require.main === module) {
  debugDriverNotification()
    .then(() => {
      console.log('\n✅ Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugDriverNotification }; 