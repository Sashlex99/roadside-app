const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
let app;
try {
  app = require('firebase-admin').app();
} catch (e) {
  app = initializeApp({
    credential: cert({
      projectId: 'roadside-assistance-app',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore(app);

/**
 * Test script to demonstrate the driver availability fix
 * This simulates the scenario where orphaned "reserved" bids exist
 */
async function testDriverAvailabilityFix() {
  console.log('🔧 Testing Driver Availability Fix...');
  
  const testTimestamp = Date.now();
  const driverId = `test-driver-${testTimestamp}`;
  const cancelledOrderId = `cancelled-order-${testTimestamp}`;
  const newOrderId = `new-order-${testTimestamp}`;
  
  try {
    // 1. Create a test driver
    console.log('👤 Creating test driver...');
    await db.collection('users').doc(driverId).set({
      id: driverId,
      email: `test-driver-${testTimestamp}@example.com`,
      name: 'Test Driver',
      phone: '+1234567890',
      role: 'driver',
      createdAt: new Date(),
      isOnline: true
    });
    
    // 2. Create a cancelled order (simulates the cancelled order scenario)
    console.log('📝 Creating cancelled order...');
    await db.collection('orders').doc(cancelledOrderId).set({
      id: cancelledOrderId,
      clientId: `test-client-${testTimestamp}`,
      status: 'cancelled',
      description: 'Test cancelled order',
      location: { lat: 42.6977, lng: 23.3219 },
      createdAt: new Date(),
      updatedAt: new Date(),
      cancelledAt: new Date()
    });
    
    // 3. Create an orphaned "reserved" bid (this is the bug!)
    console.log('🐛 Creating orphaned reserved bid (simulating the bug)...');
    const orphanedBidRef = await db.collection('bids').add({
      orderId: cancelledOrderId,
      driverId: driverId,
      proposedPrice: 50,
      estimatedArrival: 15,
      status: 'reserved',  // This should have been cleaned up when order was cancelled!
      createdAt: new Date(),
      reservedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      driverInfo: {
        name: 'Test Driver',
        phone: '+1234567890',
        rating: 4.5
      }
    });
    
    // 4. Create a new order where client wants to book the same driver
    console.log('📝 Creating new order...');
    await db.collection('orders').doc(newOrderId).set({
      id: newOrderId,
      clientId: `test-client-new-${testTimestamp}`,
      status: 'bidding',
      description: 'Test new order',
      location: { lat: 42.6977, lng: 23.3219 },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 5. Create a new bid from the same driver for the new order
    console.log('💰 Creating new bid from same driver...');
    const newBidRef = await db.collection('bids').add({
      orderId: newOrderId,
      driverId: driverId,
      proposedPrice: 60,
      estimatedArrival: 20,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      driverInfo: {
        name: 'Test Driver',
        phone: '+1234567890',
        rating: 4.5
      }
    });
    
    console.log('🎯 Setup complete! Driver has:');
    console.log(`  - Orphaned "reserved" bid: ${orphanedBidRef.id} (for cancelled order)`);
    console.log(`  - New "active" bid: ${newBidRef.id} (for new order)`);
    console.log('');
    
    // 6. Test the validateAndFixDriverAvailability function
    console.log('🔍 Testing driver availability validation...');
    
    // Simulate the validation function (would normally be imported from orders.ts)
    const result = await validateDriverAvailability(driverId);
    
    console.log('📊 Validation Results:');
    console.log(`  - Issues found: ${result.foundIssues.length}`);
    console.log(`  - Bids cleaned: ${result.cleanedBids}`);
    console.log(`  - Driver availability fixed: ${result.wasFixed ? 'YES' : 'NO'}`);
    
    if (result.foundIssues.length > 0) {
      console.log('🔍 Issues found:');
      result.foundIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }
    
    // 7. Verify the fix
    console.log('');
    console.log('✅ Verifying fix...');
    
    // Check if orphaned bid was cleaned up
    const cleanedBid = await db.collection('bids').doc(orphanedBidRef.id).get();
    const cleanedBidData = cleanedBid.data();
    
    if (cleanedBidData && cleanedBidData.status === 'cancelled') {
      console.log('✅ SUCCESS: Orphaned bid was properly cleaned up!');
      console.log(`  - Bid status changed from "reserved" to "${cleanedBidData.status}"`);
      console.log(`  - Cleanup reason: ${cleanedBidData.cancelReason}`);
    } else {
      console.log('❌ FAILED: Orphaned bid was not cleaned up');
    }
    
    // Check if new bid is still active
    const newBid = await db.collection('bids').doc(newBidRef.id).get();
    const newBidData = newBid.data();
    
    if (newBidData && newBidData.status === 'active') {
      console.log('✅ SUCCESS: New valid bid remains active!');
    } else {
      console.log('❌ FAILED: New bid was incorrectly affected');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('');
    console.log('🧹 Cleaning up test data...');
    try {
      await db.collection('users').doc(driverId).delete();
      await db.collection('orders').doc(cancelledOrderId).delete();
      await db.collection('orders').doc(newOrderId).delete();
      
      // Delete all test bids
      const bidsQuery = await db.collection('bids')
        .where('driverId', '==', driverId)
        .get();
      
      const batch = db.batch();
      bidsQuery.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      console.log('✅ Test data cleaned up successfully');
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }
  }
}

/**
 * Simplified version of the validateAndFixDriverAvailability function
 * (This would normally be imported from the orders.ts file)
 */
async function validateDriverAvailability(driverId) {
  console.log('🔍 Validating driver availability:', driverId);
  
  const issues = [];
  let cleanedBids = 0;
  let wasFixed = false;
  
  try {
    // Find all reserved bids for this driver
    const reservedBidsQuery = await db.collection('bids')
      .where('driverId', '==', driverId)
      .where('status', '==', 'reserved')
      .get();
    
    if (reservedBidsQuery.empty) {
      console.log('✅ Driver has no reserved bids - availability OK');
      return { wasFixed: false, foundIssues: [], cleanedBids: 0 };
    }
    
    console.log(`🔍 Found ${reservedBidsQuery.size} reserved bids for driver`);
    
    const batch = db.batch();
    
    for (const bidDoc of reservedBidsQuery.docs) {
      const bidData = bidDoc.data();
      const bidId = bidDoc.id;
      const orderId = bidData.orderId;
      
      console.log(`🔍 Checking reserved bid ${bidId} for order ${orderId}`);
      
      // Get the associated order
      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (!orderDoc.exists()) {
        // Order doesn't exist - clean up orphaned bid
        issues.push(`Orphaned bid ${bidId} - order ${orderId} not found`);
        batch.update(bidDoc.ref, {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: 'Associated order not found'
        });
        cleanedBids++;
        wasFixed = true;
        continue;
      }
      
      const orderData = orderDoc.data();
      
      // Check if order is in a state that shouldn't have reserved bids
      if (['cancelled', 'completed', 'expired'].includes(orderData.status)) {
        issues.push(`Stale reserved bid ${bidId} - order ${orderId} status is ${orderData.status}`);
        batch.update(bidDoc.ref, {
          status: 'cancelled',
          cancelledAt: new Date(),
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
          expiredAt: new Date(),
          cancelReason: 'Bid expired (> 2 hours old)'
        });
        cleanedBids++;
        wasFixed = true;
        continue;
      }
      
      // If we get here, the reserved bid seems valid
      console.log(`✅ Reserved bid ${bidId} appears valid for order ${orderId}`);
    }
    
    if (cleanedBids > 0) {
      await batch.commit();
      console.log(`✅ Fixed driver availability - cleaned ${cleanedBids} problematic bids`);
    }
    
    return { wasFixed, foundIssues: issues, cleanedBids };
    
  } catch (error) {
    console.error('❌ Error validating driver availability:', error);
    return { wasFixed: false, foundIssues: [`Error during validation: ${error.message}`], cleanedBids: 0 };
  }
}

// Run the test
if (require.main === module) {
  testDriverAvailabilityFix()
    .then(() => {
      console.log('\n🏁 Driver availability fix test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testDriverAvailabilityFix, validateDriverAvailability }; 