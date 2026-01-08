/**
 * Race Condition Test - Issue #2 Verification
 * Uses Firebase Admin SDK for reliable testing
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'roadside-assistance-bf'
  });
}

const db = admin.firestore();

/**
 * Simulates the fixed acceptBid function with atomic transactions
 */
async function acceptBidAtomic(orderId, bidId, clientName) {
  console.log(`🔒 [${clientName}] Starting bid acceptance: ${bidId}`);
  
  try {
    await db.runTransaction(async (transaction) => {
      // Read order and validate
      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await transaction.get(orderRef);
      
      if (!orderDoc.exists) {
        throw new Error('Order not found');
      }
      
      const orderData = orderDoc.data();
      
      // Race condition protection
      if (orderData.status !== 'bidding') {
        throw new Error(`Order status is ${orderData.status}, cannot accept`);
      }
      
      if (orderData.acceptedBidId) {
        throw new Error('Order already has accepted bid');
      }
      
      // Read and validate bid
      const bidRef = db.collection('orders').doc(orderId).collection('bids').doc(bidId);
      const bidDoc = await transaction.get(bidRef);
      
      if (!bidDoc.exists) {
        throw new Error('Bid not found');
      }
      
      const bidData = bidDoc.data();
      
      if (bidData.status !== 'active') {
        throw new Error(`Bid status is ${bidData.status}`);
      }
      
      // Atomic updates
      transaction.update(orderRef, {
        status: 'payment_pending',
        acceptedBidId: bidId,
        acceptedDriverId: bidData.driverId,
        finalPrice: bidData.proposedPrice,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      transaction.update(bidRef, {
        status: 'accepted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    console.log(`✅ [${clientName}] SUCCESS - Bid ${bidId} accepted`);
    return { success: true, client: clientName };
    
  } catch (error) {
    console.log(`❌ [${clientName}] FAILED - ${error.message}`);
    return { success: false, client: clientName, error: error.message };
  }
}

/**
 * Creates test data
 */
async function createTestData() {
  const timestamp = Date.now();
  const orderId = `test-order-${timestamp}`;
  
  // Create order
  await db.collection('orders').doc(orderId).set({
    clientId: 'test-client',
    status: 'bidding',
    description: 'Race condition test order',
    location: { latitude: 42.6977, longitude: 23.3219 },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 300000) // 5 minutes
  });
  
  // Create competing bids
  const bid1Id = `bid-driver1-${timestamp}`;
  const bid2Id = `bid-driver2-${timestamp}`;
  const bid3Id = `bid-driver3-${timestamp}`;
  
  await Promise.all([
    db.collection('orders').doc(orderId).collection('bids').doc(bid1Id).set({
      driverId: 'driver-1',
      proposedPrice: 50,
      status: 'active',
      driverInfo: { name: 'Driver 1' },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }),
    
    db.collection('orders').doc(orderId).collection('bids').doc(bid2Id).set({
      driverId: 'driver-2', 
      proposedPrice: 45,
      status: 'active',
      driverInfo: { name: 'Driver 2' },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }),
    
    db.collection('orders').doc(orderId).collection('bids').doc(bid3Id).set({
      driverId: 'driver-3',
      proposedPrice: 55,
      status: 'active', 
      driverInfo: { name: 'Driver 3' },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })
  ]);
  
  console.log(`✅ Test data created: ${orderId}`);
  return { orderId, bids: [bid1Id, bid2Id, bid3Id] };
}

/**
 * Cleanup test data
 */
async function cleanup(orderId) {
  const batch = db.batch();
  
  // Delete bids
  const bidsSnapshot = await db.collection('orders').doc(orderId).collection('bids').get();
  bidsSnapshot.forEach(doc => batch.delete(doc.ref));
  
  // Delete order
  batch.delete(db.collection('orders').doc(orderId));
  
  await batch.commit();
  console.log('🧹 Test data cleaned up');
}

/**
 * Main test - simulates 3 clients trying to accept different bids simultaneously
 */
async function runRaceConditionTest() {
  console.log('🚀 RACE CONDITION TEST - Issue #2\n');
  
  const { orderId, bids } = await createTestData();
  
  console.log('🏁 Simulating 3 clients accepting different bids simultaneously...');
  console.log(`   Client A → Bid ${bids[0]} (Driver 1, $50)`);
  console.log(`   Client B → Bid ${bids[1]} (Driver 2, $45)`);  
  console.log(`   Client C → Bid ${bids[2]} (Driver 3, $55)`);
  console.log('');
  
  const startTime = Date.now();
  
  // Simulate concurrent acceptance attempts
  const results = await Promise.allSettled([
    acceptBidAtomic(orderId, bids[0], 'Client-A'),
    acceptBidAtomic(orderId, bids[1], 'Client-B'), 
    acceptBidAtomic(orderId, bids[2], 'Client-C')
  ]);
  
  const duration = Date.now() - startTime;
  
  console.log('\n📊 RESULTS:');
  console.log(`⏱️  Duration: ${duration}ms`);
  
  const successCount = results.filter(r => 
    r.status === 'fulfilled' && r.value.success
  ).length;
  
  console.log(`✅ Successful: ${successCount}/3`);
  console.log(`❌ Failed: ${3 - successCount}/3\n`);
  
  // Verify final state
  const finalOrder = await db.collection('orders').doc(orderId).get();
  const finalData = finalOrder.data();
  
  console.log('🎯 RACE CONDITION TEST RESULT:');
  
  if (successCount === 1) {
    console.log('✅ PASS: Only one bid accepted (race condition prevented)');
    console.log(`   Winning bid: ${finalData.acceptedBidId}`);
    console.log(`   Final status: ${finalData.status}`);
    console.log(`   Final price: $${finalData.finalPrice}`);
  } else if (successCount === 0) {
    console.log('❌ FAIL: No bids accepted (unexpected)');
  } else {
    console.log('❌ FAIL: Multiple bids accepted (race condition detected!)');
  }
  
  await cleanup(orderId);
  console.log('\n🏁 Test completed!');
}

// Run if called directly
if (require.main === module) {
  runRaceConditionTest().catch(console.error);
}

module.exports = { runRaceConditionTest }; 