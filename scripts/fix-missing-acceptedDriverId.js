/**
 * Fix Script: Missing AcceptedDriverId Field
 * 
 * This script fixes orders that have status 'accepted' but are missing the acceptedDriverId field,
 * which prevents drivers from getting proper notifications.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'roadside-assistance-bf'
  });
}

const db = admin.firestore();

async function fixMissingAcceptedDriverId() {
  console.log('🔧 Starting fix for missing acceptedDriverId fields...');
  
  const stats = {
    totalAcceptedOrders: 0,
    missingAcceptedDriverId: 0,
    fixedOrders: 0,
    errors: 0
  };
  
  try {
    // Find all accepted orders
    const acceptedOrdersQuery = db.collection('orders')
      .where('status', '==', 'accepted')
      .orderBy('createdAt', 'desc')
      .limit(50);
    
    const acceptedOrdersSnapshot = await acceptedOrdersQuery.get();
    stats.totalAcceptedOrders = acceptedOrdersSnapshot.size;
    
    console.log(`\n📋 Found ${stats.totalAcceptedOrders} accepted orders to check`);
    
    for (const orderDoc of acceptedOrdersSnapshot.docs) {
      const orderData = orderDoc.data();
      const orderId = orderDoc.id;
      
      console.log(`\n🔍 Checking order ${orderId}:`);
      console.log(`  Status: ${orderData.status}`);
      console.log(`  AcceptedDriverId: ${orderData.acceptedDriverId || 'undefined'}`);
      console.log(`  AcceptedBidId: ${orderData.acceptedBidId || 'undefined'}`);
      
      // Check if this order is missing acceptedDriverId
      if (!orderData.acceptedDriverId) {
        stats.missingAcceptedDriverId++;
        console.log(`  ❌ ISSUE: Order is accepted but missing acceptedDriverId!`);
        
        try {
          // Method 1: Try to get from reservedDriverId
          if (orderData.reservedDriverId) {
            console.log(`  🔧 Method 1: Using reservedDriverId: ${orderData.reservedDriverId}`);
            
            await orderDoc.ref.update({
              acceptedDriverId: orderData.reservedDriverId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            stats.fixedOrders++;
            console.log(`  ✅ Fixed using reservedDriverId`);
            continue;
          }
          
          // Method 2: Try to find from accepted bid
          if (orderData.acceptedBidId) {
            console.log(`  🔧 Method 2: Looking up accepted bid: ${orderData.acceptedBidId}`);
            
            const bidDoc = await db.collection('bids').doc(orderData.acceptedBidId).get();
            
            if (bidDoc.exists()) {
              const bidData = bidDoc.data();
              console.log(`  💡 Found accepted bid with driverId: ${bidData.driverId}`);
              
              await orderDoc.ref.update({
                acceptedDriverId: bidData.driverId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              
              stats.fixedOrders++;
              console.log(`  ✅ Fixed using accepted bid`);
              continue;
            }
          }
          
          // Method 3: Search all bids for this order
          console.log(`  🔧 Method 3: Searching all bids for order ${orderId}`);
          
          const bidsQuery = db.collection('bids')
            .where('orderId', '==', orderId)
            .where('status', '==', 'accepted');
          
          const bidsSnapshot = await bidsQuery.get();
          
          if (bidsSnapshot.size > 0) {
            const acceptedBid = bidsSnapshot.docs[0].data();
            console.log(`  💡 Found accepted bid via search: ${acceptedBid.driverId}`);
            
            await orderDoc.ref.update({
              acceptedDriverId: acceptedBid.driverId,
              acceptedBidId: bidsSnapshot.docs[0].id,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            stats.fixedOrders++;
            console.log(`  ✅ Fixed using bid search`);
            continue;
          }
          
          console.log(`  ⚠️ Could not find accepted bid for order ${orderId}`);
          stats.errors++;
          
        } catch (fixError) {
          console.error(`  ❌ Error fixing order ${orderId}:`, fixError.message);
          stats.errors++;
        }
      } else {
        console.log(`  ✅ Order has acceptedDriverId: ${orderData.acceptedDriverId}`);
      }
    }
    
    console.log('\n📊 Fix Results:');
    console.log(`Total accepted orders: ${stats.totalAcceptedOrders}`);
    console.log(`Missing acceptedDriverId: ${stats.missingAcceptedDriverId}`);
    console.log(`Fixed orders: ${stats.fixedOrders}`);
    console.log(`Errors: ${stats.errors}`);
    
    if (stats.fixedOrders > 0) {
      console.log(`\n✅ Fixed ${stats.fixedOrders} orders with missing acceptedDriverId`);
    }
    
    if (stats.errors > 0) {
      console.log(`\n⚠️ ${stats.errors} orders could not be fixed - manual intervention required`);
    }
    
  } catch (error) {
    console.error('❌ Error in fix script:', error);
  }
}

async function verifyFixes() {
  console.log('\n🔍 Verifying fixes...');
  
  try {
    // Check if any accepted orders still have missing acceptedDriverId
    const problemOrdersQuery = db.collection('orders')
      .where('status', '==', 'accepted')
      .orderBy('createdAt', 'desc')
      .limit(20);
    
    const problemOrdersSnapshot = await problemOrdersQuery.get();
    
    let stillBroken = 0;
    
    for (const orderDoc of problemOrdersSnapshot.docs) {
      const orderData = orderDoc.data();
      
      if (!orderData.acceptedDriverId) {
        stillBroken++;
        console.log(`❌ Order ${orderDoc.id} still missing acceptedDriverId`);
      }
    }
    
    if (stillBroken === 0) {
      console.log('✅ All accepted orders now have acceptedDriverId field');
    } else {
      console.log(`⚠️ ${stillBroken} orders still need manual fixing`);
    }
    
  } catch (error) {
    console.error('❌ Error verifying fixes:', error);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'fix':
        await fixMissingAcceptedDriverId();
        break;
        
      case 'verify':
        await verifyFixes();
        break;
        
      case 'all':
        await fixMissingAcceptedDriverId();
        await verifyFixes();
        break;
        
      default:
        console.log('Usage:');
        console.log('  fix     - Fix orders with missing acceptedDriverId');
        console.log('  verify  - Verify all accepted orders have acceptedDriverId');
        console.log('  all     - Fix and then verify');
    }
  } catch (error) {
    console.error('❌ Script error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixMissingAcceptedDriverId, verifyFixes }; 