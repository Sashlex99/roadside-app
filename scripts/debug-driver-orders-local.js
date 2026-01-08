#!/usr/bin/env node

/**
 * Local Debug Script - Driver Orders
 * Simulates driver order scenarios without requiring Firebase authentication
 */

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Mock data structures
const mockOrders = [
  {
    id: 'order-001',
    clientId: 'client-A',
    status: 'accepted',
    acceptedDriverId: 'driver-123',
    acceptedBidId: 'bid-001',
    serviceType: 'towing',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    acceptedAt: new Date('2024-01-01T10:05:00Z')
  },
  {
    id: 'order-002',
    clientId: 'client-B',
    status: 'completed',
    acceptedDriverId: 'driver-123',
    acceptedBidId: 'bid-002',
    serviceType: 'repair',
    createdAt: new Date('2024-01-01T09:00:00Z'),
    acceptedAt: new Date('2024-01-01T09:05:00Z'),
    completedAt: new Date('2024-01-01T10:30:00Z')
  },
  {
    id: 'order-003',
    clientId: 'client-C',
    status: 'bidding',
    serviceType: 'towing',
    createdAt: new Date('2024-01-01T10:10:00Z')
  },
  {
    id: 'order-004',
    clientId: 'client-D',
    status: 'cancelled',
    serviceType: 'repair',
    createdAt: new Date('2024-01-01T08:00:00Z'),
    cancelledAt: new Date('2024-01-01T08:30:00Z')
  },
  {
    id: 'order-005',
    clientId: 'client-E',
    status: 'expired',
    serviceType: 'towing',
    createdAt: new Date('2024-01-01T06:00:00Z'),
    expiresAt: new Date('2024-01-01T08:00:00Z')
  }
];

const mockBids = [
  {
    id: 'bid-001',
    orderId: 'order-001',
    driverId: 'driver-123',
    status: 'accepted',
    amount: 100,
    createdAt: new Date('2024-01-01T10:02:00Z'),
    acceptedAt: new Date('2024-01-01T10:05:00Z')
  },
  {
    id: 'bid-002',
    orderId: 'order-002',
    driverId: 'driver-123',
    status: 'accepted',
    amount: 150,
    createdAt: new Date('2024-01-01T09:02:00Z'),
    acceptedAt: new Date('2024-01-01T09:05:00Z')
  },
  {
    id: 'bid-003',
    orderId: 'order-003',
    driverId: 'driver-123',
    status: 'active',
    amount: 80,
    createdAt: new Date('2024-01-01T10:12:00Z')
  },
  {
    id: 'bid-004',
    orderId: 'order-003',
    driverId: 'driver-456',
    status: 'active',
    amount: 90,
    createdAt: new Date('2024-01-01T10:13:00Z')
  },
  {
    id: 'bid-005',
    orderId: 'order-001',
    driverId: 'driver-456',
    status: 'cancelled',
    amount: 95,
    createdAt: new Date('2024-01-01T10:03:00Z'),
    cancelledAt: new Date('2024-01-01T10:05:00Z'),
    cancelReason: 'Driver accepted another order'
  }
];

function debugDriverOrders(driverId = 'driver-123') {
  log('\n🔍 DEBUG: Checking driver orders (LOCAL SIMULATION)', 'cyan');
  log('═'.repeat(60), 'blue');
  
  log(`\n📋 Driver ID: ${driverId}`, 'bright');
  
  // Find orders for this driver
  const driverOrders = mockOrders.filter(order => 
    order.acceptedDriverId === driverId
  );
  
  log(`\n📊 Orders Summary:`, 'yellow');
  log(`- Total orders in system: ${mockOrders.length}`);
  log(`- Orders for driver ${driverId}: ${driverOrders.length}`);
  
  if (driverOrders.length === 0) {
    log(`\n✅ No orders found for driver ${driverId}`, 'green');
    return;
  }
  
  log(`\n📋 Driver Orders:`, 'bright');
  driverOrders.forEach((order, index) => {
    const statusColor = order.status === 'accepted' ? 'green' : 
                       order.status === 'completed' ? 'blue' : 'yellow';
    
    log(`\n${index + 1}. Order: ${order.id}`, 'white');
    log(`   Status: ${order.status.toUpperCase()}`, statusColor);
    log(`   Service: ${order.serviceType}`);
    log(`   Client: ${order.clientId}`);
    log(`   Created: ${order.createdAt?.toISOString()}`);
    if (order.acceptedAt) {
      log(`   Accepted: ${order.acceptedAt.toISOString()}`);
    }
    if (order.completedAt) {
      log(`   Completed: ${order.completedAt.toISOString()}`);
    }
  });
  
  // Find bids for this driver
  const driverBids = mockBids.filter(bid => bid.driverId === driverId);
  
  log(`\n🎯 Driver Bids:`, 'bright');
  log(`- Total bids: ${driverBids.length}`);
  
  driverBids.forEach((bid, index) => {
    const statusColor = bid.status === 'accepted' ? 'green' : 
                       bid.status === 'active' ? 'yellow' : 'red';
    
    log(`\n${index + 1}. Bid: ${bid.id}`, 'white');
    log(`   Order: ${bid.orderId}`, 'white');
    log(`   Status: ${bid.status.toUpperCase()}`, statusColor);
    log(`   Amount: $${bid.amount}`);
    log(`   Created: ${bid.createdAt?.toISOString()}`);
    if (bid.acceptedAt) {
      log(`   Accepted: ${bid.acceptedAt.toISOString()}`);
    }
    if (bid.cancelReason) {
      log(`   Cancel Reason: ${bid.cancelReason}`, 'red');
    }
  });
}

function analyzeConflicts() {
  log('\n🔍 CONFLICT ANALYSIS', 'cyan');
  log('═'.repeat(60), 'blue');
  
  const drivers = [...new Set(mockBids.map(bid => bid.driverId))];
  
  drivers.forEach(driverId => {
    const driverBids = mockBids.filter(bid => bid.driverId === driverId);
    const activeBids = driverBids.filter(bid => bid.status === 'active');
    const acceptedBids = driverBids.filter(bid => bid.status === 'accepted');
    const cancelledBids = driverBids.filter(bid => bid.status === 'cancelled');
    
    log(`\n👤 Driver: ${driverId}`, 'bright');
    log(`   Active bids: ${activeBids.length}`);
    log(`   Accepted bids: ${acceptedBids.length}`);
    log(`   Cancelled bids: ${cancelledBids.length}`);
    
    // Check for potential conflicts
    const activeOrders = [...new Set(activeBids.map(bid => bid.orderId))];
    const acceptedOrders = [...new Set(acceptedBids.map(bid => bid.orderId))];
    
    if (acceptedBids.length > 1) {
      log(`   ⚠️  POTENTIAL CONFLICT: Multiple accepted bids!`, 'red');
      acceptedBids.forEach(bid => {
        log(`      - ${bid.id} for order ${bid.orderId}`, 'red');
      });
    }
    
    if (acceptedBids.length > 0 && activeBids.length > 0) {
      const conflictBids = activeBids.filter(bid => 
        !acceptedOrders.includes(bid.orderId)
      );
      
      if (conflictBids.length > 0) {
        log(`   ⚠️  CROSS-ORDER CONFLICTS: ${conflictBids.length} active bids while driver has accepted order`, 'yellow');
        conflictBids.forEach(bid => {
          log(`      - ${bid.id} for order ${bid.orderId} should be cancelled`, 'yellow');
        });
      }
    }
    
    if (activeBids.length === 0 && acceptedBids.length === 0) {
      log(`   ✅ No conflicts - driver is available`, 'green');
    } else if (acceptedBids.length === 1 && activeBids.every(bid => acceptedOrders.includes(bid.orderId))) {
      log(`   ✅ No conflicts - all bids are for same order or properly cancelled`, 'green');
    }
  });
}

function simulateSmartConflictResolution() {
  log('\n🔧 SMART CONFLICT RESOLUTION SIMULATION', 'cyan');
  log('═'.repeat(60), 'blue');
  
  // Simulate driver-123 accepting bid-003 for order-003
  const acceptedBidId = 'bid-003';
  const acceptedOrderId = 'order-003';
  const driverId = 'driver-123';
  
  log(`\n📋 Scenario: Driver ${driverId} accepts bid ${acceptedBidId} for order ${acceptedOrderId}`, 'bright');
  
  // Find all driver's bids
  const driverBids = mockBids.filter(bid => bid.driverId === driverId);
  
  log(`\n📊 Before Conflict Resolution:`, 'yellow');
  driverBids.forEach(bid => {
    const statusColor = bid.status === 'accepted' ? 'green' : 
                       bid.status === 'active' ? 'yellow' : 'red';
    log(`   ${bid.id}: ${bid.status.toUpperCase()} (order: ${bid.orderId})`, statusColor);
  });
  
  // Apply smart conflict resolution logic
  let sameOrderBidsSkipped = 0;
  let crossOrderBidsCancelled = 0;
  
  const updatedBids = driverBids.map(bid => {
    if (bid.id === acceptedBidId) {
      return { ...bid, status: 'accepted', acceptedAt: new Date() };
    }
    
    if (bid.orderId !== acceptedOrderId && bid.status === 'active') {
      crossOrderBidsCancelled++;
      return { 
        ...bid, 
        status: 'cancelled', 
        cancelledAt: new Date(),
        cancelReason: 'Driver accepted another order'
      };
    }
    
    if (bid.orderId === acceptedOrderId && bid.status === 'active') {
      sameOrderBidsSkipped++;
    }
    
    return bid;
  });
  
  log(`\n📊 After Smart Conflict Resolution:`, 'yellow');
  updatedBids.forEach(bid => {
    const statusColor = bid.status === 'accepted' ? 'green' : 
                       bid.status === 'active' ? 'yellow' : 'red';
    log(`   ${bid.id}: ${bid.status.toUpperCase()} (order: ${bid.orderId})`, statusColor);
  });
  
  log(`\n📈 Resolution Summary:`, 'bright');
  log(`   Same-order bids skipped: ${sameOrderBidsSkipped}`);
  log(`   Cross-order bids cancelled: ${crossOrderBidsCancelled}`);
  
  if (sameOrderBidsSkipped > 0 && crossOrderBidsCancelled > 0) {
    log(`   ✅ Smart conflict resolution working correctly!`, 'green');
    log(`   - Same-order bids preserved`, 'green');
    log(`   - Cross-order bids cancelled`, 'green');
  }
}

function runDebugSuite() {
  log('🚀 DRIVER ORDERS DEBUG SUITE (LOCAL)', 'bright');
  log('═'.repeat(70), 'blue');
  
  debugDriverOrders('driver-123');
  analyzeConflicts();
  simulateSmartConflictResolution();
  
  log('\n🎉 Debug suite completed successfully!', 'green');
  log('\n💡 This is a local simulation. To debug real Firebase data:', 'yellow');
  log('   1. Set up Firebase authentication', 'yellow');
  log('   2. Run: node scripts/debug-driver-orders.js', 'yellow');
  log('   3. Or use: npm run test:debug', 'yellow');
}

// Run if called directly
if (require.main === module) {
  runDebugSuite();
}

module.exports = {
  debugDriverOrders,
  analyzeConflicts,
  simulateSmartConflictResolution
}; 