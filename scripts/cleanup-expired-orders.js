// Automatic cleanup script for expired orders
// This will automatically mark expired orders as expired

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where, orderBy, serverTimestamp } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac'",
  authDomain: "roadside-assistance-app-aa0e8.firebaseapp.com",
  projectId: "roadside-assistance-app-aa0e8",
  storageBucket: "roadside-assistance-app-aa0e8.appspot.com",
  messagingSenderId: "98397269310",
  appId: "1:98397269310:web:c965f2361fd25ff328906f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupExpiredOrders() {
  console.log('🧹 Starting automatic cleanup of expired orders...');
  
  try {
    // Get all orders that should be visible to drivers
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('status', 'in', ['pending', 'searching', 'bidding']),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const orders = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
      });
    });
    
    console.log(`📊 Found ${orders.length} orders with active status`);
    
    const now = new Date();
    const expiredOrders = [];
    const staleOrders = [];
    const activeOrders = [];
    
    // Analyze each order
    for (const order of orders) {
      // Check if order is expired
      if (order.expiresAt && order.expiresAt < now) {
        expiredOrders.push(order);
      }
      // Check if order is more than 2 hours old and not updated
      else if (order.createdAt && (now - order.createdAt) > 2 * 60 * 60 * 1000 && 
               order.updatedAt && (now - order.updatedAt) > 2 * 60 * 60 * 1000) {
        staleOrders.push(order);
      }
      else {
        activeOrders.push(order);
      }
    }
    
    console.log(`📊 Analysis complete:`);
    console.log(`  - Active orders: ${activeOrders.length}`);
    console.log(`  - Expired orders: ${expiredOrders.length}`);
    console.log(`  - Stale orders: ${staleOrders.length}`);
    
    // Clean up expired orders
    if (expiredOrders.length > 0) {
      console.log(`\n🧹 Cleaning up ${expiredOrders.length} expired orders...`);
      
      for (const order of expiredOrders) {
        try {
          const docRef = doc(db, 'orders', order.id);
          await updateDoc(docRef, {
            status: 'expired',
            updatedAt: serverTimestamp()
          });
          console.log(`  ✅ Order ${order.id} marked as expired`);
        } catch (error) {
          console.log(`  ❌ Failed to update order ${order.id}: ${error.message}`);
        }
      }
    }
    
    // Clean up stale orders
    if (staleOrders.length > 0) {
      console.log(`\n🧹 Cleaning up ${staleOrders.length} stale orders...`);
      
      for (const order of staleOrders) {
        try {
          const docRef = doc(db, 'orders', order.id);
          await updateDoc(docRef, {
            status: 'expired',
            updatedAt: serverTimestamp()
          });
          console.log(`  ✅ Order ${order.id} marked as expired (was stale)`);
        } catch (error) {
          console.log(`  ❌ Failed to update order ${order.id}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`  - Remaining active orders: ${activeOrders.length}`);
    console.log(`  - Orders cleaned up: ${expiredOrders.length + staleOrders.length}`);
    
    if (activeOrders.length > 0) {
      console.log(`\n📋 Remaining active orders:`);
      for (const order of activeOrders) {
        console.log(`  - ${order.id}: ${order.description} (${order.status})`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error during cleanup: ${error.message}`);
    throw error;
  }
}

// Run the cleanup script
cleanupExpiredOrders().then(() => {
  console.log('\n🎉 Cleanup complete!');
  process.exit(0);
}).catch((error) => {
  console.error(`❌ Script failed: ${error.message}`);
  process.exit(1);
}); 