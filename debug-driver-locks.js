// Debug Driver Locks - Run in browser console during testing
// Copy and paste these functions into browser console on any device

// 🔍 Check all current driver locks
async function checkDriverLocks() {
  try {
    const db = firebase.firestore();
    const locksSnapshot = await db.collection('driverLocks').get();
    
    if (locksSnapshot.empty) {
      console.log('🔓 No driver locks currently active');
      return [];
    }
    
    const locks = [];
    const now = new Date();
    
    locksSnapshot.forEach(doc => {
      const data = doc.data();
      const driverId = doc.id;
      const expiresAt = data.expiresAt.toDate();
      const lockedAt = data.lockedAt.toDate();
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      
      const lockInfo = {
        driverId,
        orderId: data.orderId,
        lockedAt: lockedAt.toLocaleTimeString(),
        expiresAt: expiresAt.toLocaleTimeString(),
        remainingSeconds: remaining,
        isExpired: remaining === 0,
        lockReason: data.lockReason
      };
      
      locks.push(lockInfo);
    });
    
    console.log('🔒 Current Driver Locks:', locks);
    return locks;
  } catch (error) {
    console.error('❌ Error checking locks:', error);
  }
}

// 🔍 Check specific driver lock status
async function checkDriverLock(driverId) {
  try {
    const db = firebase.firestore();
    const lockDoc = await db.doc(`driverLocks/${driverId}`).get();
    
    if (!lockDoc.exists()) {
      console.log(`🔓 Driver ${driverId} is NOT locked`);
      return { isLocked: false };
    }
    
    const data = lockDoc.data();
    const now = new Date();
    const expiresAt = data.expiresAt.toDate();
    const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    
    const status = {
      isLocked: remaining > 0,
      driverId,
      lockedBy: data.orderId,
      lockedAt: data.lockedAt.toDate().toLocaleTimeString(),
      expiresAt: expiresAt.toLocaleTimeString(),
      remainingSeconds: remaining,
      lockReason: data.lockReason,
      isExpired: remaining === 0
    };
    
    console.log(`🔒 Driver ${driverId} status:`, status);
    return status;
  } catch (error) {
    console.error('❌ Error checking driver lock:', error);
  }
}

// 🔍 Check bid statuses for a driver
async function checkDriverBids(driverId) {
  try {
    const db = firebase.firestore();
    const bidsSnapshot = await db.collection('bids')
      .where('driverId', '==', driverId)
      .get();
    
    if (bidsSnapshot.empty) {
      console.log(`📝 No bids found for driver ${driverId}`);
      return [];
    }
    
    const bids = [];
    bidsSnapshot.forEach(doc => {
      const data = doc.data();
      bids.push({
        bidId: doc.id,
        orderId: data.orderId,
        status: data.status,
        price: data.proposedPrice,
        createdAt: data.createdAt?.toDate?.()?.toLocaleTimeString() || 'N/A'
      });
    });
    
    console.log(`📝 Bids for driver ${driverId}:`, bids);
    return bids;
  } catch (error) {
    console.error('❌ Error checking bids:', error);
  }
}

// 🔍 Check order status
async function checkOrderStatus(orderId) {
  try {
    const db = firebase.firestore();
    const orderDoc = await db.doc(`orders/${orderId}`).get();
    
    if (!orderDoc.exists()) {
      console.log(`📋 Order ${orderId} not found`);
      return null;
    }
    
    const data = orderDoc.data();
    const status = {
      orderId,
      status: data.status,
      reservedBidId: data.reservedBidId || 'None',
      reservedDriverId: data.reservedDriverId || 'None',
      acceptedDriverId: data.acceptedDriverId || 'None',
      createdAt: data.createdAt?.toDate?.()?.toLocaleTimeString() || 'N/A'
    };
    
    console.log(`📋 Order ${orderId} status:`, status);
    return status;
  } catch (error) {
    console.error('❌ Error checking order:', error);
  }
}

// 🧹 Force unlock driver (EMERGENCY ONLY)
async function forceUnlockDriver(driverId) {
  try {
    const confirmed = confirm(`⚠️ FORCE UNLOCK driver ${driverId}? This should only be used for debugging!`);
    if (!confirmed) return;
    
    const db = firebase.firestore();
    await db.doc(`driverLocks/${driverId}`).delete();
    
    console.log(`🔓 Driver ${driverId} force unlocked`);
    
    // Check status after unlock
    await checkDriverLock(driverId);
  } catch (error) {
    console.error('❌ Error force unlocking:', error);
  }
}

// 🧹 Clean up expired locks manually
async function cleanupExpiredLocks() {
  try {
    const db = firebase.firestore();
    const now = firebase.firestore.Timestamp.now();
    const expiredQuery = db.collection('driverLocks').where('expiresAt', '<', now);
    const expiredLocks = await expiredQuery.get();
    
    if (expiredLocks.empty) {
      console.log('✅ No expired locks to clean up');
      return;
    }
    
    const batch = db.batch();
    let cleanedCount = 0;
    
    expiredLocks.forEach(doc => {
      const data = doc.data();
      console.log(`🧹 Cleaning expired lock: ${doc.id} (order: ${data.orderId})`);
      batch.delete(doc.ref);
      cleanedCount++;
    });
    
    await batch.commit();
    console.log(`✅ Cleaned ${cleanedCount} expired locks`);
  } catch (error) {
    console.error('❌ Error cleaning expired locks:', error);
  }
}

// 📊 Get system overview
async function getSystemOverview() {
  console.log('📊 SYSTEM OVERVIEW');
  console.log('==================');
  
  await checkDriverLocks();
  
  // Check recent orders
  try {
    const db = firebase.firestore();
    const recentOrders = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    console.log('\n📋 Recent Orders:');
    recentOrders.forEach(doc => {
      const data = doc.data();
      console.log(`- ${doc.id}: ${data.status} (${data.createdAt?.toDate?.()?.toLocaleTimeString() || 'N/A'})`);
    });
  } catch (error) {
    console.log('⚠️ Could not fetch recent orders:', error.message);
  }
  
  console.log('\n==================');
  console.log('Available commands:');
  console.log('- checkDriverLocks()');
  console.log('- checkDriverLock("driverId")');
  console.log('- checkDriverBids("driverId")');
  console.log('- checkOrderStatus("orderId")');
  console.log('- forceUnlockDriver("driverId")');
  console.log('- cleanupExpiredLocks()');
}

// 🚀 Auto-run system overview when script loads
console.log('🔧 Driver Lock Debug Tools Loaded!');
console.log('Run getSystemOverview() to see current state');

// Quick access aliases
window.debugLocks = {
  overview: getSystemOverview,
  checkLocks: checkDriverLocks,
  checkDriver: checkDriverLock,
  checkBids: checkDriverBids,
  checkOrder: checkOrderStatus,
  forceUnlock: forceUnlockDriver,
  cleanup: cleanupExpiredLocks
};

console.log('📱 Quick access: debugLocks.overview(), debugLocks.checkDriver("alice"), etc.'); 