/**
 * Smart Conflict Resolution - Local Test
 * Tests the logic without requiring Firebase credentials
 */

// Mock data structures
const mockBids = [];
const mockOrders = [];

// Mock Firebase serverTimestamp
const serverTimestamp = () => new Date();

// Test data
const testData = {
  orderId: 'test-order-123',
  crossOrderId: 'test-cross-order-456',
  driverId: 'test-driver-789',
  clientId: 'test-client-001',
  bidIds: []
};

// Mock Firebase operations
const mockFirebase = {
  collection: (name) => ({
    doc: (id) => ({
      set: (data) => {
        if (name === 'orders') {
          mockOrders.push({ id, ...data });
        } else if (name === 'bids') {
          mockBids.push({ id, ...data });
        }
        return Promise.resolve();
      },
      update: (data) => {
        if (name === 'orders') {
          const index = mockOrders.findIndex(o => o.id === id);
          if (index >= 0) {
            mockOrders[index] = { ...mockOrders[index], ...data };
          }
        } else if (name === 'bids') {
          const index = mockBids.findIndex(b => b.id === id);
          if (index >= 0) {
            mockBids[index] = { ...mockBids[index], ...data };
          }
        }
        return Promise.resolve();
      },
      get: () => ({
        exists: () => true,
        data: () => {
          if (name === 'orders') {
            return mockOrders.find(o => o.id === id);
          } else if (name === 'bids') {
            return mockBids.find(b => b.id === id);
          }
        }
      })
    }),
    where: (field, operator, value) => ({
      get: () => {
        let filtered = [];
        if (name === 'bids') {
          filtered = mockBids.filter(bid => {
            if (operator === '==') {
              return bid[field] === value;
            } else if (operator === 'in') {
              return value.includes(bid[field]);
            }
            return false;
          });
        }
        return Promise.resolve({
          size: filtered.length,
          forEach: (callback) => {
            filtered.forEach(item => callback({
              id: item.id,
              data: () => item,
              ref: {
                update: (data) => {
                  const index = mockBids.findIndex(b => b.id === item.id);
                  if (index >= 0) {
                    mockBids[index] = { ...mockBids[index], ...data };
                  }
                }
              }
            }));
          }
        });
      }
    })
  }),
  batch: () => ({
    update: (ref, data) => {
      // Mock batch update
      if (ref.update) {
        ref.update(data);
      }
    },
    commit: () => Promise.resolve()
  })
};

function createTestData() {
  console.log('🔧 Creating test data...');
  
  // Create test order
  const orderData = {
    id: testData.orderId,
    clientId: testData.clientId,
    status: 'bidding',
    serviceType: 'towing',
    location: {
      address: 'Test Address',
      coordinates: { lat: 42.6977, lng: 23.3219 }
    },
    description: 'Test order for smart conflict resolution',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
  };
  
  mockOrders.push(orderData);
  
  // Create cross order
  const crossOrderData = {
    id: testData.crossOrderId,
    clientId: 'test-client-cross-001',
    status: 'bidding',
    serviceType: 'repair',
    location: {
      address: 'Cross Order Address',
      coordinates: { lat: 42.7, lng: 23.4 }
    },
    description: 'Cross order for testing conflicts',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
  };
  
  mockOrders.push(crossOrderData);
  
  // Create multiple bids from same driver for same order
  for (let i = 1; i <= 3; i++) {
    const bidId = `test-bid-${testData.orderId}-${i}`;
    testData.bidIds.push(bidId);
    
    const bidData = {
      id: bidId,
      orderId: testData.orderId,
      driverId: testData.driverId,
      amount: 50 + i * 10,
      estimatedDuration: 30 + i * 5,
      status: 'active',
      description: `Test bid ${i} from same driver`,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
    };
    
    mockBids.push(bidData);
  }
  
  // Create cross-order bid
  const crossBidId = `test-cross-bid-${Date.now()}`;
  testData.bidIds.push(crossBidId);
  
  const crossBidData = {
    id: crossBidId,
    orderId: testData.crossOrderId,
    driverId: testData.driverId,
    amount: 80,
    estimatedDuration: 45,
    status: 'active',
    description: 'Cross order bid from same driver',
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
  };
  
  mockBids.push(crossBidData);
  
  console.log('✅ Test data created');
  console.log(`- Orders: ${mockOrders.length}`);
  console.log(`- Bids: ${mockBids.length}`);
}

// Simulate the smart conflict resolution logic
async function simulateSmartConflictResolution(acceptedBidId, acceptedOrderId) {
  console.log(`🔄 Simulating smart conflict resolution for bid: ${acceptedBidId}`);
  
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
  
  console.log('✅ Smart conflict resolution completed:', {
    sameOrderBidsSkipped,
    crossOrderBidsCancelled,
    totalBidsProcessed: driverBids.length
  });
  
  return { sameOrderBidsSkipped, crossOrderBidsCancelled };
}

async function testSmartConflictResolution() {
  console.log('🧪 Testing smart conflict resolution...');
  
  // Create test data
  createTestData();
  
  console.log('\n📊 Initial state:');
  console.log(`- Order: ${testData.orderId}`);
  console.log(`- Cross Order: ${testData.crossOrderId}`);
  console.log(`- Driver: ${testData.driverId}`);
  console.log(`- Same-order bids: ${testData.bidIds.slice(0, 3).join(', ')}`);
  console.log(`- Cross-order bid: ${testData.bidIds[3]}`);
  
  // Check initial bid statuses
  const initialBids = mockBids.filter(bid => bid.driverId === testData.driverId);
  
  console.log('\n📋 Initial bid statuses:');
  initialBids.forEach(bid => {
    console.log(`- ${bid.id}: ${bid.status} (order: ${bid.orderId})`);
  });
  
  // Reserve the first bid
  const reservedBidId = testData.bidIds[0];
  console.log(`\n🔄 Reserving bid: ${reservedBidId}`);
  
  // Update order to reserved state
  const order = mockOrders.find(o => o.id === testData.orderId);
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
  const result = await simulateSmartConflictResolution(reservedBidId, testData.orderId);
  
  // Check final bid statuses
  const finalBids = mockBids.filter(bid => bid.driverId === testData.driverId);
  
  console.log('\n📋 Final bid statuses after conflict resolution:');
  let sameOrderActive = 0;
  let crossOrderCancelled = 0;
  
  finalBids.forEach(bid => {
    const bidStatus = bid.status;
    const isReservedBid = bid.id === reservedBidId;
    const isSameOrder = bid.orderId === testData.orderId;
    
    console.log(`- ${bid.id}: ${bidStatus} (order: ${bid.orderId}) ${isReservedBid ? '[RESERVED]' : ''}`);
    
    if (isSameOrder && !isReservedBid && bidStatus === 'active') {
      sameOrderActive++;
    } else if (!isSameOrder && bidStatus === 'cancelled') {
      crossOrderCancelled++;
    }
  });
  
  // Validate results
  console.log('\n🔍 Validation Results:');
  console.log(`- Same-order bids remaining active: ${sameOrderActive}`);
  console.log(`- Cross-order bids cancelled: ${crossOrderCancelled}`);
  
  if (sameOrderActive === 2 && crossOrderCancelled === 1) {
    console.log('✅ Smart conflict resolution working correctly!');
    console.log('  - Same-order bids were preserved (not cancelled)');
    console.log('  - Cross-order bids were cancelled as expected');
    return true;
  } else {
    console.log('❌ Smart conflict resolution failed!');
    console.log(`  - Expected: 2 same-order active, 1 cross-order cancelled`);
    console.log(`  - Actual: ${sameOrderActive} same-order active, ${crossOrderCancelled} cross-order cancelled`);
    return false;
  }
}

// Run the test
console.log('🚀 Starting Smart Conflict Resolution Test (Local Simulation)\n');
testSmartConflictResolution()
  .then(success => {
    if (success) {
      console.log('\n🎉 Test PASSED - Smart conflict resolution is working correctly!');
      process.exit(0);
    } else {
      console.log('\n❌ Test FAILED - Smart conflict resolution needs fixes');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
  }); 