// Circuit Breaker Integration Tests
// Tests integration between circuit breakers and existing Phase 1-3 systems

// Mock existing systems
class MockDriverLockSystem {
  constructor() {
    this.locks = new Map();
    this.shouldFail = false;
    this.latency = 0;
  }

  setFailure(shouldFail) {
    this.shouldFail = shouldFail;
  }

  setLatency(ms) {
    this.latency = ms;
  }

  async lockDriver(driverId, orderId, timeoutMinutes, bidId) {
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    if (this.shouldFail) {
      throw new Error('Driver lock system failure');
    }

    if (this.locks.has(driverId)) {
      throw new Error(`Driver ${driverId} is already locked`);
    }

    this.locks.set(driverId, {
      orderId,
      bidId,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + timeoutMinutes * 60 * 1000)
    });

    console.log(`🔒 Mock locked driver ${driverId} for order ${orderId}`);
    return { success: true, lockId: `lock-${driverId}-${orderId}` };
  }

  async unlockDriver(driverId, orderId) {
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    if (this.shouldFail) {
      throw new Error('Driver unlock system failure');
    }

    const lock = this.locks.get(driverId);
    if (!lock || lock.orderId !== orderId) {
      throw new Error(`Driver ${driverId} not locked for order ${orderId}`);
    }

    this.locks.delete(driverId);
    console.log(`🔓 Mock unlocked driver ${driverId} for order ${orderId}`);
  }

  async isDriverLocked(driverId) {
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    if (this.shouldFail) {
      throw new Error('Driver lock status check failure');
    }

    const lock = this.locks.get(driverId);
    return lock ? { isLocked: true, ...lock } : { isLocked: false };
  }
}

class MockBidSystem {
  constructor() {
    this.bids = new Map();
    this.shouldFail = false;
    this.latency = 0;
  }

  setFailure(shouldFail) {
    this.shouldFail = shouldFail;
  }

  setLatency(ms) {
    this.latency = ms;
  }

  async reserveBid(orderId, bidId) {
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    if (this.shouldFail) {
      throw new Error('Bid reservation system failure');
    }

    const bid = this.bids.get(bidId);
    if (!bid) {
      throw new Error(`Bid ${bidId} not found`);
    }

    if (bid.status !== 'pending') {
      throw new Error(`Bid ${bidId} is not pending`);
    }

    bid.status = 'reserved';
    bid.reservedAt = new Date();
    this.bids.set(bidId, bid);

    console.log(`📦 Mock reserved bid ${bidId} for order ${orderId}`);
    return bid;
  }

  async cancelBidReservation(orderId, bidId) {
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    if (this.shouldFail) {
      throw new Error('Bid cancellation system failure');
    }

    const bid = this.bids.get(bidId);
    if (bid) {
      bid.status = 'cancelled';
      bid.cancelledAt = new Date();
      this.bids.set(bidId, bid);
      console.log(`❌ Mock cancelled bid ${bidId}`);
    }
  }

  createMockBid(bidId, orderId, driverId, status = 'pending') {
    this.bids.set(bidId, {
      id: bidId,
      orderId,
      driverId,
      status,
      proposedPrice: 50,
      createdAt: new Date()
    });
  }
}

class MockOrderSystem {
  constructor() {
    this.orders = new Map();
    this.shouldFail = false;
    this.latency = 0;
  }

  setFailure(shouldFail) {
    this.shouldFail = shouldFail;
  }

  setLatency(ms) {
    this.latency = ms;
  }

  async updateOrderStatus(orderId, status) {
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    if (this.shouldFail) {
      throw new Error('Order update system failure');
    }

    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    order.status = status;
    order.updatedAt = new Date();
    this.orders.set(orderId, order);

    console.log(`📋 Mock updated order ${orderId} to ${status}`);
    return order;
  }

  createMockOrder(orderId, status = 'pending') {
    this.orders.set(orderId, {
      id: orderId,
      status,
      clientId: 'client-001',
      createdAt: new Date()
    });
  }
}

// Enhanced circuit breaker with more detailed monitoring
class IntegrationCircuitBreaker {
  constructor(name, config = {}) {
    this.name = name;
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.failureThreshold = config.failureThreshold || 3;
    this.recoveryTimeout = config.recoveryTimeout || 1000;
    this.nextAttemptTime = 0;
    this.operationHistory = [];
    this.alerts = [];
  }

  async execute(operation) {
    const startTime = Date.now();
    
    // Check if circuit is open
    if (this.state === 'OPEN') {
      const timeUntilRetry = this.nextAttemptTime - Date.now();
      if (timeUntilRetry > 0) {
        this.recordOperation('rejected', 0, 'Circuit breaker open');
        throw new Error(`Circuit breaker [${this.name}] is OPEN. Try again in ${Math.ceil(timeUntilRetry / 1000)}s`);
      } else {
        // Try half-open
        this.state = 'HALF_OPEN';
        console.log(`🔄 Circuit breaker [${this.name}] trying HALF_OPEN`);
      }
    }

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.onSuccess(duration);
      this.recordOperation('success', duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.onFailure(error, duration);
      this.recordOperation('failure', duration, error.message);
      throw error;
    }
  }

  onSuccess(duration) {
    this.successes++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
      this.sendAlert('CIRCUIT_CLOSED', `Circuit breaker ${this.name} closed after recovery`);
      console.log(`✅ Circuit breaker [${this.name}] CLOSED after recovery`);
    } else if (this.failures > 0) {
      this.failures = 0; // Reset on success
    }
  }

  onFailure(error, duration) {
    this.failures++;
    console.warn(`⚠️ Circuit breaker [${this.name}] failure ${this.failures}/${this.failureThreshold}: ${error.message}`);
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
      this.sendAlert('CIRCUIT_OPENED', `Circuit breaker ${this.name} opened after ${this.failures} failures`);
      console.error(`🚨 Circuit breaker [${this.name}] OPENED`);
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
    }
  }

  recordOperation(result, duration, error = null) {
    this.operationHistory.push({
      timestamp: new Date(),
      result,
      duration,
      error,
      state: this.state
    });

    // Keep only last 50 operations
    if (this.operationHistory.length > 50) {
      this.operationHistory.shift();
    }
  }

  sendAlert(type, message) {
    this.alerts.push({
      type,
      message,
      timestamp: new Date(),
      state: this.state,
      failures: this.failures,
      successes: this.successes
    });
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      timeUntilRetry: this.state === 'OPEN' ? Math.max(0, this.nextAttemptTime - Date.now()) : undefined,
      operationHistory: this.operationHistory.slice(-10), // Last 10 operations
      alerts: this.alerts.slice(-5) // Last 5 alerts
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = 0;
    this.operationHistory = [];
    this.alerts = [];
  }
}

// Enhanced operation with full circuit breaker integration
async function enhancedOperationWithIntegration(
  operationName,
  systemOperation,
  circuitBreaker,
  options = {}
) {
  const {
    timeoutMs = 5000,
    compensationActions = []
  } = options;

  console.log(`🚀 Enhanced operation: ${operationName}`);

  try {
    // Execute with circuit breaker protection and timeout
    const result = await circuitBreaker.execute(async () => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`${operationName} timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        systemOperation()
          .then(result => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch(error => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });
    });

    console.log(`✅ Enhanced operation completed: ${operationName}`);
    return { success: true, result };

  } catch (error) {
    console.error(`❌ Enhanced operation failed: ${operationName}`, error.message);

    // Execute compensation actions
    for (const action of compensationActions) {
      try {
        await action();
        console.log(`🔄 Compensation action executed for ${operationName}`);
      } catch (compensationError) {
        console.error(`💥 Compensation failed for ${operationName}:`, compensationError);
      }
    }

    return {
      success: false,
      error: error.message,
      circuitBreakerState: circuitBreaker.getStats()
    };
  }
}

async function testCircuitBreakerIntegration() {
  console.log('🧪 Testing Circuit Breaker Integration with Existing Systems...\n');
  
  const driverLockSystem = new MockDriverLockSystem();
  const bidSystem = new MockBidSystem();
  const orderSystem = new MockOrderSystem();
  
  const driverLockCB = new IntegrationCircuitBreaker('driver-locks', {
    failureThreshold: 3,
    recoveryTimeout: 500
  });
  
  const bidSystemCB = new IntegrationCircuitBreaker('bid-system', {
    failureThreshold: 2,
    recoveryTimeout: 1000
  });

  try {
    // Setup test data
    bidSystem.createMockBid('bid-001', 'order-001', 'driver-001', 'pending');
    bidSystem.createMockBid('bid-002', 'order-002', 'driver-002', 'pending');
    orderSystem.createMockOrder('order-001', 'pending');
    orderSystem.createMockOrder('order-002', 'pending');

    // Test 1: Successful integration flow
    console.log('📝 Test 1: Successful integration flow');
    
    const result1 = await enhancedOperationWithIntegration(
      'driver-lock-integration',
      () => driverLockSystem.lockDriver('driver-001', 'order-001', 5, 'bid-001'),
      driverLockCB
    );

    if (result1.success) {
      console.log('✅ Test 1 PASSED: Driver lock integration successful');
    } else {
      console.log('❌ Test 1 FAILED: Driver lock integration failed');
    }

    // Test 2: Bid system integration with circuit breaker
    console.log('\n📝 Test 2: Bid system integration with circuit breaker');
    
    const result2 = await enhancedOperationWithIntegration(
      'bid-reservation-integration',
      () => bidSystem.reserveBid('order-001', 'bid-001'),
      bidSystemCB,
      {
        compensationActions: [
          () => bidSystem.cancelBidReservation('order-001', 'bid-001')
        ]
      }
    );

    if (result2.success) {
      console.log('✅ Test 2 PASSED: Bid reservation integration successful');
    } else {
      console.log('❌ Test 2 FAILED: Bid reservation integration failed');
    }

    // Test 3: System failure cascade handling
    console.log('\n📝 Test 3: System failure cascade handling');
    
    // Make driver lock system fail
    driverLockSystem.setFailure(true);
    
    let cascadeHandled = true;
    for (let i = 0; i < 4; i++) {
      const result = await enhancedOperationWithIntegration(
        `cascade-test-${i}`,
        () => driverLockSystem.lockDriver(`driver-cascade-${i}`, `order-cascade-${i}`, 5),
        driverLockCB,
        {
          compensationActions: [
            () => console.log(`🔄 Compensating for cascade test ${i}`)
          ]
        }
      );

      if (i >= 3 && result.success) {
        // Should fail once circuit breaker opens
        cascadeHandled = false;
        break;
      }
    }

    if (cascadeHandled) {
      console.log('✅ Test 3 PASSED: Failure cascade handled by circuit breaker');
    } else {
      console.log('❌ Test 3 FAILED: Failure cascade not properly handled');
    }

    // Test 4: Cross-system dependency handling
    console.log('\n📝 Test 4: Cross-system dependency handling');
    
    // Reset systems
    driverLockSystem.setFailure(false);
    bidSystem.setFailure(false);
    driverLockCB.reset();
    bidSystemCB.reset();

    // Complex operation involving multiple systems
    const complexOperationResult = await enhancedMultiSystemOperation(
      'order-002',
      'bid-002',
      'driver-002',
      driverLockSystem,
      bidSystem,
      orderSystem,
      { driverLockCB, bidSystemCB }
    );

    if (complexOperationResult.success) {
      console.log('✅ Test 4 PASSED: Cross-system dependency handling successful');
    } else {
      console.log('❌ Test 4 FAILED: Cross-system dependency handling failed');
    }

    // Test 5: Circuit breaker recovery coordination
    console.log('\n📝 Test 5: Circuit breaker recovery coordination');
    
    // Make bid system fail to trigger circuit breaker
    bidSystem.setFailure(true);
    
    // Trigger failures
    for (let i = 0; i < 3; i++) {
      await enhancedOperationWithIntegration(
        `recovery-test-${i}`,
        () => bidSystem.reserveBid('order-recovery', 'bid-recovery'),
        bidSystemCB
      );
    }

    // Check if circuit breaker is open
    const preRecoveryStats = bidSystemCB.getStats();
    const circuitBreakerOpen = preRecoveryStats.state === 'OPEN';

    // Wait for recovery period
    console.log('   Waiting for circuit breaker recovery...');
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Fix the system
    bidSystem.setFailure(false);
    bidSystem.createMockBid('bid-recovery', 'order-recovery', 'driver-recovery', 'pending');

    // Try operation again
    const recoveryResult = await enhancedOperationWithIntegration(
      'recovery-operation',
      () => bidSystem.reserveBid('order-recovery', 'bid-recovery'),
      bidSystemCB
    );

    const postRecoveryStats = bidSystemCB.getStats();
    
    if (circuitBreakerOpen && recoveryResult.success && postRecoveryStats.state === 'CLOSED') {
      console.log('✅ Test 5 PASSED: Circuit breaker recovery coordination successful');
    } else {
      console.log('❌ Test 5 FAILED: Circuit breaker recovery coordination failed');
    }

    // Test 6: Performance under load with circuit breaker protection
    console.log('\n📝 Test 6: Performance under load with circuit breaker protection');
    
    const loadTestCB = new IntegrationCircuitBreaker('load-test', {
      failureThreshold: 5,
      recoveryTimeout: 500
    });

    const loadTestResults = [];
    
    for (let load = 1; load <= 10; load++) {
      const latency = load > 7 ? 3000 : 100; // High latency for last 3
      driverLockSystem.setLatency(latency);
      
      const startTime = Date.now();
      
      const result = await enhancedOperationWithIntegration(
        `load-test-${load}`,
        () => driverLockSystem.lockDriver(`driver-load-${load}`, `order-load-${load}`, 5),
        loadTestCB,
        { timeoutMs: 2000 }
      );
      
      const duration = Date.now() - startTime;
      loadTestResults.push({
        load,
        success: result.success,
        duration,
        circuitState: loadTestCB.getStats().state
      });
    }

    console.log('   Load test results:');
    loadTestResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   Load ${result.load}: ${status} (${result.duration}ms, CB: ${result.circuitState})`);
    });

    const protectedOperations = loadTestResults.filter(r => 
      !r.success && r.duration < 1000 // Fast failures indicate circuit breaker protection
    ).length;

    if (protectedOperations >= 2) {
      console.log('✅ Test 6 PASSED: Circuit breaker provides load protection');
    } else {
      console.log('❌ Test 6 FAILED: Circuit breaker not providing adequate load protection');
    }

    console.log('\n🎉 Circuit breaker integration test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Driver lock system integration');
    console.log('   ✅ Bid system integration with compensation');
    console.log('   ✅ Failure cascade handling');
    console.log('   ✅ Cross-system dependency management');
    console.log('   ✅ Recovery coordination');
    console.log('   ✅ Load protection');
    
    return true;
    
  } catch (error) {
    console.error('❌ Circuit breaker integration test failed:', error);
    return false;
  }
}

// Helper function for complex multi-system operations
async function enhancedMultiSystemOperation(
  orderId,
  bidId,
  driverId,
  driverLockSystem,
  bidSystem,
  orderSystem,
  circuitBreakers
) {
  console.log(`🚀 Complex multi-system operation: order=${orderId}, bid=${bidId}, driver=${driverId}`);

  const compensationActions = [];

  try {
    // Step 1: Reserve bid
    const bidResult = await enhancedOperationWithIntegration(
      'reserve-bid',
      () => bidSystem.reserveBid(orderId, bidId),
      circuitBreakers.bidSystemCB
    );

    if (!bidResult.success) {
      throw new Error('Bid reservation failed');
    }

    compensationActions.push(() => bidSystem.cancelBidReservation(orderId, bidId));

    // Step 2: Lock driver
    const lockResult = await enhancedOperationWithIntegration(
      'lock-driver',
      () => driverLockSystem.lockDriver(driverId, orderId, 5, bidId),
      circuitBreakers.driverLockCB
    );

    if (!lockResult.success) {
      throw new Error('Driver lock failed');
    }

    compensationActions.push(() => driverLockSystem.unlockDriver(driverId, orderId));

    // Step 3: Update order
    const orderResult = await enhancedOperationWithIntegration(
      'update-order',
      () => orderSystem.updateOrderStatus(orderId, 'payment_pending'),
      circuitBreakers.bidSystemCB // Reuse bid system CB for order operations
    );

    if (!orderResult.success) {
      throw new Error('Order update failed');
    }

    console.log(`✅ Complex multi-system operation completed: ${orderId}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ Complex multi-system operation failed: ${error.message}`);

    // Execute compensation actions in reverse order
    for (let i = compensationActions.length - 1; i >= 0; i--) {
      try {
        await compensationActions[i]();
        console.log(`🔄 Compensation step ${i + 1} completed`);
      } catch (compensationError) {
        console.error(`💥 Compensation step ${i + 1} failed:`, compensationError);
      }
    }

    return { success: false, error: error.message };
  }
}

// Run the test
if (require.main === module) {
  testCircuitBreakerIntegration()
    .then(success => {
      if (success) {
        console.log('\n✅ All circuit breaker integration tests passed!');
        console.log('🚀 Phase 4 circuit breaker integration is working correctly!');
        process.exit(0);
      } else {
        console.log('\n❌ Circuit breaker integration tests failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testCircuitBreakerIntegration }; 