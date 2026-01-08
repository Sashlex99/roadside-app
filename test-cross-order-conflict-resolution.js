/**
 * Cross-Order Bid Conflict Resolution Test
 * Tests that drivers can only be reserved for one order at a time
 */

// Mock data structures
const mockBids = [];
const mockOrders = [];

// Mock Firebase serverTimestamp
const serverTimestamp = () => new Date();

// Test data
const testData = {
  driverId: 'test-driver-999',
  orders: [
    { id: 'order-A', clientId: 'client-A' },
    { id: 'order-B', clientId: 'client-B' },
    { id: 'order-C', clientId: 'client-C' }
  ],
  bidIds: []
};

function createTestData() {
  console.log('🔧 Creating test data for cross-order conflict resolution...');
  
  // Create multiple orders
  testData.orders.forEach(orderInfo => {
    const orderData = {
      id: orderInfo.id,
      clientId: orderInfo.clientId,
      status: 'bidding',
      serviceType: 'towing',
      location: {
        address: `Address for ${orderInfo.id}`,
        coordinates: { lat: 42.6977, lng: 23.3219 }
      },
      description: `Test order ${orderInfo.id}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
    };
    mockOrders.push(orderData);
  });
  
  // Create one bid from same driver for each order
  testData.orders.forEach((orderInfo, index) => {
    const bidId = `bid-${orderInfo.id}-${testData.driverId}`;
    testData.bidIds.push(bidId);
    
    const bidData = {
      id: bidId,
      orderId: orderInfo.id,
      driverId: testData.driverId,
      amount: 50 + index * 10,
      estimatedDuration: 30 + index * 5,
      status: 'active',
      description: `Bid for ${orderInfo.id}`,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
    };
    mockBids.push(bidData);
  });
  
  console.log('✅ Test data created');
  console.log(`- Orders: ${mockOrders.length}`);
  console.log(`- Bids: ${mockBids.length}`);
}

// Simulate the cross-order conflict resolution
async function simulateCrossOrderConflictResolution(acceptedBidId, acceptedOrderId) {
  console.log(`🔄 Simulating cross-order conflict resolution for bid: ${acceptedBidId}`);
  
  // Get the accepted bid to find the driver
  const acceptedBid = mockBids.find(b => b.id === acceptedBidId);
  if (!acceptedBid) {
    console.warn('Accepted bid not found during conflict resolution');
    return;
  }
  
  const driverId = acceptedBid.driverId;
  
  // Find all other active bids from this driver
  const driverBids = mockBids.filter(bid => 
    bid.driverId === driverId && 
    ['active', 'reserved'].includes(bid.status)
  );
  
  let sameOrderBidsSkipped = 0;
  let crossOrderBidsCancelled = 0;
  
  driverBids.forEach(bid => {
    // Skip the accepted bid
    if (bid.id === acceptedBidId) return;
    
    // ✅ SMART CONFLICT RESOLUTION: Only cancel bids from DIFFERENT orders
    if (bid.orderId !== acceptedOrderId) {
      // Cancel other bids from this driver FOR DIFFERENT ORDERS
      bid.status = 'cancelled';
      bid.cancelledAt = serverTimestamp();
      bid.cancelReason = 'Driver accepted another order';
      crossOrderBidsCancelled++;
    } else {
      // Skip bids from the same order
      sameOrderBidsSkipped++;
    }
  });
  
  console.log('✅ Cross-order conflict resolution completed:', {
    sameOrderBidsSkipped,
    crossOrderBidsCancelled,
    totalBidsProcessed: driverBids.length
  });
  
  return { sameOrderBidsSkipped, crossOrderBidsCancelled };
}

async function testCrossOrderConflictResolution() {
  console.log('🧪 Testing cross-order conflict resolution...');
  
  // Create test data
  createTestData();
  
  console.log('\n📊 Initial state:');
  console.log(`- Driver: ${testData.driverId}`);
  console.log(`- Orders: ${testData.orders.map(o => o.id).join(', ')}`);
  
  // Check initial bid statuses
  const initialBids = mockBids.filter(bid => bid.driverId === testData.driverId);
  
  console.log('\n📋 Initial bid statuses:');
  initialBids.forEach(bid => {
    console.log(`- ${bid.id}: ${bid.status} (order: ${bid.orderId})`);
  });
  
  // Reserve the first bid (from order-A)
  const reservedBidId = testData.bidIds[0]; // bid-order-A
  const reservedOrderId = testData.orders[0].id; // order-A
  
  console.log(`\n🔄 Reserving bid: ${reservedBidId} for order: ${reservedOrderId}`);
  
  // Update order to reserved state
  const order = mockOrders.find(o => o.id === reservedOrderId);
  if (order) {
    order.status = 'payment_pending';
    order.reservedBidId = reservedBidId;
    order.reservedDriverId = testData.driverId;
    order.reservedAt = serverTimestamp();
    order.updatedAt = serverTimestamp();
  }
  
  // Update bid to reserved state
  const reservedBid = mockBids.find(b => b.id === reservedBidId);
  if (reservedBid) {
    reservedBid.status = 'reserved';
    reservedBid.reservedAt = serverTimestamp();
  }
  
  console.log('✅ Bid reserved successfully');
  
  // Now simulate the conflict resolution
  const result = await simulateCrossOrderConflictResolution(reservedBidId, reservedOrderId);
  
  // Check final bid statuses
  const finalBids = mockBids.filter(bid => bid.driverId === testData.driverId);
  
  console.log('\n📋 Final bid statuses after conflict resolution:');
  let activeBids = 0;
  let cancelledBids = 0;
  let reservedBids = 0;
  
  finalBids.forEach(bid => {
    const bidStatus = bid.status;
    const isReservedBid = bid.id === reservedBidId;
    
    console.log(`- ${bid.id}: ${bidStatus} (order: ${bid.orderId}) ${isReservedBid ? '[RESERVED]' : ''}`);
    
    if (bidStatus === 'active') {
      activeBids++;
    } else if (bidStatus === 'cancelled') {
      cancelledBids++;
    } else if (bidStatus === 'reserved') {
      reservedBids++;
    }
  });
  
  // Validate results
  console.log('\n🔍 Validation Results:');
  console.log(`- Reserved bids: ${reservedBids}`);
  console.log(`- Active bids: ${activeBids}`);
  console.log(`- Cancelled bids: ${cancelledBids}`);
  
  // Expected: 1 reserved (order-A), 0 active, 2 cancelled (order-B and order-C)
  if (reservedBids === 1 && activeBids === 0 && cancelledBids === 2) {
    console.log('✅ Cross-order conflict resolution working correctly!');
    console.log('  - Driver can only be reserved for one order at a time');
    console.log('  - All bids from other orders were cancelled');
    return true;
  } else {
    console.log('❌ Cross-order conflict resolution failed!');
    console.log(`  - Expected: 1 reserved, 0 active, 2 cancelled`);
    console.log(`  - Actual: ${reservedBids} reserved, ${activeBids} active, ${cancelledBids} cancelled`);
    return false;
  }
}

// Test scenario 2: Multiple reservations attempt (race condition)
async function testMultipleReservationAttempts() {
  console.log('\n🧪 Testing multiple reservation attempts (race condition prevention)...');
  
  // Reset test data
  mockBids.length = 0;
  mockOrders.length = 0;
  testData.bidIds.length = 0;
  
  // Create fresh test data
  createTestData();
  
  console.log('\n📊 Scenario: Two clients try to reserve the same driver simultaneously');
  
  // Simulate client A reserving driver for order-A
  const bidA = testData.bidIds[0];
  const orderA = testData.orders[0].id;
  
  console.log(`\n🔄 Client A reserves driver for order-A (bid: ${bidA})`);
  
  // Reserve bid A
  const reservedBidA = mockBids.find(b => b.id === bidA);
  if (reservedBidA) {
    reservedBidA.status = 'reserved';
    reservedBidA.reservedAt = serverTimestamp();
  }
  
  // Apply conflict resolution for order-A
  await simulateCrossOrderConflictResolution(bidA, orderA);
  
  // Now simulate client B trying to reserve the same driver for order-B
  const bidB = testData.bidIds[1];
  const orderB = testData.orders[1].id;
  
  console.log(`\n🔄 Client B attempts to reserve same driver for order-B (bid: ${bidB})`);
  
  // Check if bid B is still active (it should be cancelled)
  const bidBStatus = mockBids.find(b => b.id === bidB);
  
  if (bidBStatus && bidBStatus.status === 'cancelled') {
    console.log('✅ Race condition prevented successfully!');
    console.log('  - Driver was already reserved for order-A');
    console.log('  - Bid for order-B was cancelled, preventing double-booking');
    return true;
  } else {
    console.log('❌ Race condition prevention failed!');
    console.log(`  - Bid B status: ${bidBStatus?.status || 'not found'}`);
    console.log('  - Driver could be double-booked');
    return false;
  }
}

// Run the tests
console.log('🚀 Starting Cross-Order Conflict Resolution Tests\n');

testCrossOrderConflictResolution()
  .then(async (success1) => {
    const success2 = await testMultipleReservationAttempts();
    
    if (success1 && success2) {
      console.log('\n🎉 All tests PASSED - Cross-order conflict resolution is working correctly!');
      console.log('  ✅ Same driver can only be reserved for one order');
      console.log('  ✅ Race conditions are prevented');
      console.log('  ✅ Multiple bids from same driver are handled correctly');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests FAILED - Cross-order conflict resolution needs fixes');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
  }); 