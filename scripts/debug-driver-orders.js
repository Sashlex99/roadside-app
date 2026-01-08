// Debug script to check and clean up driver orders
// This will help identify why there are 6 orders showing when only 1 should be active

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } = require('firebase/firestore');

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

async function debugDriverOrders() {
  log('🔍 DEBUG: Checking driver orders in database...', 'bright');
  
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
    
    log(`📊 Found ${orders.length} orders with status 'pending', 'searching', or 'bidding'`, 'cyan');
    
    const now = new Date();
    const expiredOrders = [];
    const activeOrders = [];
    const oldOrders = [];
    
    // Analyze each order
    for (const order of orders) {
      log(`\n📋 Order ${order.id}:`, 'bright');
      log(`  Status: ${order.status}`, 'yellow');
      log(`  Created: ${order.createdAt?.toLocaleString() || 'Unknown'}`, 'blue');
      log(`  Updated: ${order.updatedAt?.toLocaleString() || 'Unknown'}`, 'blue');
      log(`  Expires: ${order.expiresAt?.toLocaleString() || 'No expiration'}`, 'blue');
      log(`  Client: ${order.clientInfo?.name || 'Unknown'} (${order.clientId})`, 'blue');
      log(`  Description: ${order.description || 'No description'}`, 'blue');
      
      // Check if order is expired
      if (order.expiresAt && order.expiresAt < now) {
        log(`  ❌ EXPIRED! (${Math.round((now - order.expiresAt) / 1000 / 60)} minutes ago)`, 'red');
        expiredOrders.push(order);
      }
      // Check if order is very old (more than 24 hours)
      else if (order.createdAt && (now - order.createdAt) > 24 * 60 * 60 * 1000) {
        log(`  ⚠️  OLD ORDER (${Math.round((now - order.createdAt) / 1000 / 60 / 60)} hours ago)`, 'yellow');
        oldOrders.push(order);
      }
      // Check if order hasn't been updated for a long time
      else if (order.updatedAt && (now - order.updatedAt) > 2 * 60 * 60 * 1000) {
        log(`  ⚠️  STALE ORDER (not updated for ${Math.round((now - order.updatedAt) / 1000 / 60)} minutes)`, 'yellow');
        oldOrders.push(order);
      }
      else {
        log(`  ✅ ACTIVE ORDER`, 'green');
        activeOrders.push(order);
      }
    }
    
    log(`\n📊 SUMMARY:`, 'bright');
    log(`  Total orders: ${orders.length}`, 'cyan');
    log(`  Active orders: ${activeOrders.length}`, 'green');
    log(`  Expired orders: ${expiredOrders.length}`, 'red');
    log(`  Old/Stale orders: ${oldOrders.length}`, 'yellow');
    
    // Ask user if they want to clean up expired orders
    if (expiredOrders.length > 0) {
      log(`\n🧹 CLEANUP RECOMMENDATION:`, 'bright');
      log(`Found ${expiredOrders.length} expired orders that should be cleaned up.`, 'yellow');
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('Do you want to clean up expired orders? (y/n): ', resolve);
      });
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        log('\n🧹 Cleaning up expired orders...', 'bright');
        
        for (const order of expiredOrders) {
          try {
            const docRef = doc(db, 'orders', order.id);
            await updateDoc(docRef, {
              status: 'expired',
              updatedAt: serverTimestamp()
            });
            log(`  ✅ Order ${order.id} marked as expired`, 'green');
          } catch (error) {
            log(`  ❌ Failed to update order ${order.id}: ${error.message}`, 'red');
          }
        }
        
        log(`\n✅ Cleanup complete! ${expiredOrders.length} orders marked as expired.`, 'green');
      }
      
      rl.close();
    }
    
    // Ask user if they want to clean up old/stale orders
    if (oldOrders.length > 0) {
      log(`\n⚠️  OLD/STALE ORDERS FOUND:`, 'bright');
      log(`Found ${oldOrders.length} old or stale orders that might need attention.`, 'yellow');
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('Do you want to mark old/stale orders as expired? (y/n): ', resolve);
      });
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        log('\n🧹 Cleaning up old/stale orders...', 'bright');
        
        for (const order of oldOrders) {
          try {
            const docRef = doc(db, 'orders', order.id);
            await updateDoc(docRef, {
              status: 'expired',
              updatedAt: serverTimestamp()
            });
            log(`  ✅ Order ${order.id} marked as expired`, 'green');
          } catch (error) {
            log(`  ❌ Failed to update order ${order.id}: ${error.message}`, 'red');
          }
        }
        
        log(`\n✅ Cleanup complete! ${oldOrders.length} old orders marked as expired.`, 'green');
      }
      
      rl.close();
    }
    
    if (activeOrders.length > 0) {
      log(`\n✅ ACTIVE ORDERS:`, 'bright');
      for (const order of activeOrders) {
        log(`  📋 ${order.id} - ${order.description} (${order.status})`, 'green');
      }
    }
    
  } catch (error) {
    log(`❌ Error debugging driver orders: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run the debug script
debugDriverOrders().then(() => {
  log('\n🎉 Debug complete!', 'bright');
  process.exit(0);
}).catch((error) => {
  log(`❌ Script failed: ${error.message}`, 'red');
  process.exit(1);
}); 