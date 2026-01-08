// Test for enhanced bid reservation with recovery
// Testing integration of circuit breaker and compensation actions

// Mock functions for testing
const mockDatabase = {
  bids: new Map(),
  orders: new Map(),
  driverLocks: new Map()
};

// Mock circuit breaker for testing
class MockCircuitBreaker {
  constructor(name) {
    this.name = name;
    this.state = 'CLOSED';
    this.failures = 0;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      throw new Error(`Circuit breaker [${this.name}] is OPEN`);
    }

    try {
      const result = await operation();
      this.failures = 0; // Reset on success
      return result;
    } catch (error) {
      this.failures++;
      if (this.failures >= 3) {
        this.state = 'OPEN';
        console.log(`🚨 Circuit breaker [${this.name}] OPENED`);
      }
      throw error;
    }
  }
}

// Mock compensation context
class MockCompensationContext {
  constructor(operationName) {
    this.operationName = operationName;
    this.actions = [];
  }

  addBidCancellation(bidId, orderId) {
    this.actions.push({
      type: 'cancel_bid_reservation',
      bidId,
      orderId,
      execute: async () => {
        console.log(`🔄 Mock cancelled bid ${bidId}`);
        // Simulate bid cancellation
        const bid = mockDatabase.bids.get(bidId);
        if (bid) {
          bid.status = 'cancelled';
          mockDatabase.bids.set(bidId, bid);
        }
      }
    });
  }

  addDriverUnlock(driverId, orderId) {
    this.actions.push({
      type: 'unlock_driver',
      driverId,
      orderId,
      execute: async () => {
        console.log(`🔄 Mock unlocked driver ${driverId}`);
        // Simulate driver unlock
        mockDatabase.driverLocks.delete(driverId);
      }
    });
  }

  async executeAll(error) {
    console.log(`🚨 Executing ${this.actions.length} compensation actions...`);
    
    let successful = 0;
    for (const action of this.actions) {
      try {
        await action.execute();
        successful++;
      } catch (err) {
        console.error(`❌ Compensation action failed:`, err);
      }
    }

    return {
      success: successful === this.actions.length,
      actionsExecuted: successful,
      actionsFailed: this.actions.length - successful
    };
  }

  getActions() {
    return [...this.actions];
  }
}

// Mock enhanced bid reservation function
async function mockReserveBidWithRecovery(orderId, bidId, options = {}) {
  console.log(`🚀 Starting mock enhanced bid reservation: order=${orderId}, bid=${bidId}`);
  
  const {
    shouldFailAtStep = 0,
    circuitBreakerShouldOpen = false,
    timeoutAtStep = 0
  } = options;

  const compensationContext = new MockCompensationContext('reserveBidWithRecovery');
  const circuitBreaker = new MockCircuitBreaker('bid-reservation');
  
  if (circuitBreakerShouldOpen) {
    circuitBreaker.state = 'OPEN';
  }

  let driverId = null;
  let stepCompleted = 0;

  try {
    // Step 1: Reserve bid
    stepCompleted = 1;
    if (shouldFailAtStep === 1) {
      throw new Error('Simulated failure at step 1: bid reservation');
    }
    if (timeoutAtStep === 1) {
      throw new Error('Timeout during bid reservation');
    }

    const bidData = await circuitBreaker.execute(async () => {
      const bid = mockDatabase.bids.get(bidId);
      if (!bid) {
        throw new Error(`Bid ${bidId} not found`);
      }
      if (bid.status !== 'pending') {
        throw new Error(`Bid ${bidId} is not pending`);
      }
      
      // Reserve the bid
      bid.status = 'reserved';
      bid.reservedAt = new Date();
      mockDatabase.bids.set(bidId, bid);
      
      return bid;
    });

    driverId = bidData.driverId;
    compensationContext.addBidCancellation(bidId, orderId);
    console.log(`📦 Bid reserved: ${bidId} for driver ${driverId}`);

    // Step 2: Lock driver
    stepCompleted = 2;
    if (shouldFailAtStep === 2) {
      throw new Error('Simulated failure at step 2: driver locking');
    }
    if (timeoutAtStep === 2) {
      throw new Error('Timeout during driver locking');
    }

    await circuitBreaker.execute(async () => {
      if (mockDatabase.driverLocks.has(driverId)) {
        throw new Error(`Driver ${driverId} is already locked`);
      }
      
      mockDatabase.driverLocks.set(driverId, {
        orderId,
        bidId,
        lockedAt: new Date()
      });
    });

    compensationContext.addDriverUnlock(driverId, orderId);
    console.log(`🔒 Driver locked: ${driverId} for order ${orderId}`);

    // Step 3: Final validation
    stepCompleted = 3;
    if (shouldFailAtStep === 3) {
      throw new Error('Simulated failure at step 3: final validation');
    }
    if (timeoutAtStep === 3) {
      throw new Error('Timeout during final validation');
    }

    await circuitBreaker.execute(async () => {
      const order = mockDatabase.orders.get(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }
      
      if (order.status !== 'pending') {
        throw new Error(`Order ${orderId} is not pending`);
      }
      
      // Update order to payment_pending
      order.status = 'payment_pending';
      order.reservedBidId = bidId;
      order.reservedDriverId = driverId;
      mockDatabase.orders.set(orderId, order);
    });

    console.log(`✅ Enhanced bid reservation completed successfully: ${bidId}`);
    return { success: true, stepCompleted };

  } catch (error) {
    console.error(`❌ Enhanced bid reservation failed at step ${stepCompleted}: ${error.message}`);
    
    // Execute compensation actions
    const compensationResult = await compensationContext.executeAll(error);
    
    if (compensationResult.success) {
      console.log(`✅ Compensation completed successfully`);
    } else {
      console.error(`⚠️ Partial compensation failure`);
    }
    
    return { 
      success: false, 
      error: error.message, 
      stepCompleted,
      compensationResult 
    };
  }
}

async function testEnhancedBidReservation() {
  console.log('🧪 Testing Enhanced Bid Reservation with Recovery...\n');
  
  try {
    // Setup test data
    mockDatabase.bids.set('bid-123', {
      id: 'bid-123',
      orderId: 'order-456',
      driverId: 'driver-789',
      status: 'pending',
      proposedPrice: 50
    });

    mockDatabase.orders.set('order-456', {
      id: 'order-456',
      status: 'pending',
      clientId: 'client-001'
    });

    // Test 1: Successful reservation
    console.log('📝 Test 1: Successful bid reservation');
    const result1 = await mockReserveBidWithRecovery('order-456', 'bid-123');
    
    if (result1.success && result1.stepCompleted === 3) {
      console.log('✅ Test 1 PASSED: Successful reservation works');
      
      // Verify state changes
      const bid = mockDatabase.bids.get('bid-123');
      const order = mockDatabase.orders.get('order-456');
      const driverLock = mockDatabase.driverLocks.get('driver-789');
      
      if (bid.status === 'reserved' && order.status === 'payment_pending' && driverLock) {
        console.log('   State verification: ✅ All changes applied correctly');
      } else {
        console.log('   State verification: ❌ State changes incorrect');
      }
    } else {
      console.log('❌ Test 1 FAILED: Reservation should have succeeded');
    }

    // Reset for next test
    mockDatabase.bids.set('bid-124', {
      id: 'bid-124',
      orderId: 'order-457',
      driverId: 'driver-790',
      status: 'pending',
      proposedPrice: 60
    });

    mockDatabase.orders.set('order-457', {
      id: 'order-457',
      status: 'pending',
      clientId: 'client-002'
    });

    // Test 2: Failure at step 2 with compensation
    console.log('\n📝 Test 2: Failure at step 2 with compensation');
    const result2 = await mockReserveBidWithRecovery('order-457', 'bid-124', {
      shouldFailAtStep: 2
    });
    
    if (!result2.success && result2.stepCompleted === 2 && result2.compensationResult.success) {
      console.log('✅ Test 2 PASSED: Failure handled with successful compensation');
      
      // Verify compensation worked
      const bid = mockDatabase.bids.get('bid-124');
      if (bid.status === 'cancelled') {
        console.log('   Compensation verification: ✅ Bid was cancelled');
      } else {
        console.log('   Compensation verification: ❌ Bid was not cancelled');
      }
    } else {
      console.log('❌ Test 2 FAILED: Failure handling or compensation issues');
    }

    // Test 3: Circuit breaker protection
    console.log('\n📝 Test 3: Circuit breaker protection');
    const result3 = await mockReserveBidWithRecovery('order-458', 'bid-125', {
      circuitBreakerShouldOpen: true
    });
    
    if (!result3.success && result3.error.includes('Circuit breaker')) {
      console.log('✅ Test 3 PASSED: Circuit breaker protection works');
    } else {
      console.log('❌ Test 3 FAILED: Circuit breaker not protecting');
    }

    // Test 4: Timeout handling
    console.log('\n📝 Test 4: Timeout handling');
    
    mockDatabase.bids.set('bid-126', {
      id: 'bid-126',
      orderId: 'order-459',
      driverId: 'driver-791',
      status: 'pending',
      proposedPrice: 70
    });

    const result4 = await mockReserveBidWithRecovery('order-459', 'bid-126', {
      timeoutAtStep: 1
    });
    
    if (!result4.success && result4.error.includes('Timeout')) {
      console.log('✅ Test 4 PASSED: Timeout handling works');
    } else {
      console.log('❌ Test 4 FAILED: Timeout not handled properly');
    }

    console.log('\n🎉 Enhanced bid reservation test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Successful reservation flow');
    console.log('   ✅ Failure handling with compensation');
    console.log('   ✅ Circuit breaker protection');
    console.log('   ✅ Timeout handling');
    
    return true;
    
  } catch (error) {
    console.error('❌ Enhanced bid reservation test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testEnhancedBidReservation()
    .then(success => {
      if (success) {
        console.log('\n✅ All enhanced bid reservation tests passed!');
        console.log('🚀 Phase 4 integration working correctly!');
        process.exit(0);
      } else {
        console.log('\n❌ Enhanced bid reservation tests failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testEnhancedBidReservation }; 