const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { reserveBid } = require('./src/services/firestore/bids');

// Initialize Firebase Admin
let app;
try {
  // Try to use existing app if available
  app = require('firebase-admin').app();
} catch (e) {
  // Initialize new app
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
 * Test script to simulate race condition scenario
 * 
 * Scenario:
 * 1. Create a driver and 2 orders
 * 2. Driver submits bids for both orders
 * 3. 2 clients simultaneously try to accept the driver's bids
 * 4. Only one should succeed, the other should fail gracefully
 */
async function testRaceConditionFix() {
  console.log('🧪 Starting Race Condition Fix Test...');
  
  const testTimestamp = Date.now();
  const driverId = `test-driver-${testTimestamp}`;
  const orderA = `test-order-a-${testTimestamp}`;
  const orderB = `test-order-b-${testTimestamp}`;
  
  try {
    // 1. Create test driver
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
    
    // 2. Create test orders
    console.log('📝 Creating test orders...');
    await db.collection('orders').doc(orderA).set({
      id: orderA,
      clientId: `test-client-a-${testTimestamp}`,
      status: 'bidding',
      description: 'Test order A',
      location: { lat: 42.6977, lng: 23.3219 },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await db.collection('orders').doc(orderB).set({
      id: orderB,
      clientId: `test-client-b-${testTimestamp}`,
      status: 'bidding',
      description: 'Test order B',
      location: { lat: 42.6977, lng: 23.3219 },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 3. Create driver bids for both orders
    console.log('💰 Creating driver bids...');
    const bidA = await db.collection('bids').add({
      orderId: orderA,
      driverId: driverId,
      proposedPrice: 50,
      estimatedArrival: 15,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // ✅ UPDATED: 2 hours
      driverInfo: {
        name: 'Test Driver',
        phone: '+1234567890',
        rating: 4.5
      }
    });
    
    const bidB = await db.collection('bids').add({
      orderId: orderB,
      driverId: driverId,
      proposedPrice: 60,
      estimatedArrival: 20,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // ✅ UPDATED: 2 hours
      driverInfo: {
        name: 'Test Driver',
        phone: '+1234567890',
        rating: 4.5
      }
    });
    
    console.log('✅ Test setup complete. Driver has bids for both orders.');
    console.log('🏁 Testing race condition scenario...');
    
    // 4. Simulate simultaneous bid acceptances
    console.log('⚡ Simulating simultaneous bid reservations...');
    
    const results = await Promise.allSettled([
      reserveBid(orderA, bidA.id),
      reserveBid(orderB, bidB.id)
    ]);
    
    // 5. Analyze results
    console.log('\n📊 Race Condition Test Results:');
    console.log('================================');
    
    let successCount = 0;
    let failureCount = 0;
    
    results.forEach((result, index) => {
      const orderName = index === 0 ? 'Order A' : 'Order B';
      
      if (result.status === 'fulfilled') {
        console.log(`✅ ${orderName}: Reservation SUCCEEDED`);
        successCount++;
      } else {
        console.log(`❌ ${orderName}: Reservation FAILED - ${result.reason.message}`);
        failureCount++;
      }
    });
    
    console.log(`\n📈 Summary: ${successCount} successful, ${failureCount} failed`);
    
    // 6. Verify expected behavior
    if (successCount === 1 && failureCount === 1) {
      console.log('🎉 RACE CONDITION FIX WORKING CORRECTLY!');
      console.log('✅ Only one client successfully reserved the driver');
      console.log('✅ The other client received proper error message');
    } else {
      console.log('❌ RACE CONDITION FIX MAY HAVE ISSUES!');
      console.log(`Expected: 1 success, 1 failure. Got: ${successCount} success, ${failureCount} failure`);
    }
    
    // 7. Check final state
    console.log('\n🔍 Checking final database state...');
    
    const finalBidA = await db.collection('bids').doc(bidA.id).get();
    const finalBidB = await db.collection('bids').doc(bidB.id).get();
    
    console.log(`Bid A final status: ${finalBidA.data()?.status}`);
    console.log(`Bid B final status: ${finalBidB.data()?.status}`);
    
    const reservedCount = [finalBidA.data()?.status, finalBidB.data()?.status]
      .filter(status => status === 'reserved').length;
    
    const cancelledCount = [finalBidA.data()?.status, finalBidB.data()?.status]
      .filter(status => status === 'cancelled').length;
    
    console.log(`Final state: ${reservedCount} reserved, ${cancelledCount} cancelled`);
    
    if (reservedCount === 1 && cancelledCount === 1) {
      console.log('✅ Database state is consistent with race condition fix!');
    } else {
      console.log('❌ Database state shows potential issues!');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    try {
      await db.collection('users').doc(driverId).delete();
      await db.collection('orders').doc(orderA).delete();
      await db.collection('orders').doc(orderB).delete();
      
      // Delete all bids for these orders
      const bidsQuery = await db.collection('bids')
        .where('orderId', 'in', [orderA, orderB])
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

// Run the test
if (require.main === module) {
  testRaceConditionFix()
    .then(() => {
      console.log('\n🏁 Race condition test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testRaceConditionFix }; 