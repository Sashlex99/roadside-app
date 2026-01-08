/**
 * Data Maintenance Script - Fix Orphaned Bids
 * 
 * This script demonstrates Firebase Admin SDK's power:
 * - Bypasses security rules
 * - Bulk operations
 * - Server-side data validation
 */

const admin = require('firebase-admin');

// Example: Initialize with service account (for production)
// const serviceAccount = require('./path/to/service-account.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// For local development (uses default credentials)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'roadside-assistance-bf'
  });
}

const db = admin.firestore();

/**
 * Finds and fixes orphaned bids (bids for non-existent orders)
 */
async function fixOrphanedBids(dryRun = true) {
  console.log('🔍 Scanning for orphaned bids...');
  
  const stats = {
    ordersChecked: 0,
    bidsChecked: 0,
    orphanedBids: 0,
    fixedBids: 0
  };
  
  // Get all orders
  const ordersSnapshot = await db.collection('orders').get();
  stats.ordersChecked = ordersSnapshot.size;
  
  const validOrderIds = new Set();
  ordersSnapshot.forEach(doc => validOrderIds.add(doc.id));
  
  // Check each order's bids collection
  for (const orderDoc of ordersSnapshot.docs) {
    const bidsSnapshot = await db.collection('orders')
      .doc(orderDoc.id)
      .collection('bids')
      .get();
    
    stats.bidsChecked += bidsSnapshot.size;
    
    // Process each bid
    for (const bidDoc of bidsSnapshot.docs) {
      const bidData = bidDoc.data();
      
      // Check for data issues
      const issues = [];
      
      if (!bidData.driverId) issues.push('missing driverId');
      if (!bidData.proposedPrice) issues.push('missing proposedPrice');
      if (!bidData.status) issues.push('missing status');
      if (!bidData.createdAt) issues.push('missing createdAt');
      
      if (issues.length > 0) {
        stats.orphanedBids++;
        console.log(`❌ Orphaned bid ${bidDoc.id} in order ${orderDoc.id}: ${issues.join(', ')}`);
        
        if (!dryRun) {
          // Fix the bid
          await bidDoc.ref.update({
            status: bidData.status || 'expired',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            fixedByScript: true
          });
          stats.fixedBids++;
        }
      }
    }
  }
  
  console.log('\n📊 Orphaned Bids Report:');
  console.log(`Orders checked: ${stats.ordersChecked}`);
  console.log(`Bids checked: ${stats.bidsChecked}`);
  console.log(`Orphaned bids found: ${stats.orphanedBids}`);
  
  if (dryRun) {
    console.log('\n🔸 DRY RUN - No changes made');
    console.log('Run with --fix to apply changes');
  } else {
    console.log(`Fixed bids: ${stats.fixedBids}`);
  }
}

/**
 * Bulk update order statuses based on criteria
 */
async function bulkUpdateExpiredOrders() {
  console.log('🔄 Updating expired orders...');
  
  const now = new Date();
  const batch = db.batch();
  let updateCount = 0;
  
  // Find expired orders
  const expiredOrders = await db.collection('orders')
    .where('expiresAt', '<=', now)
    .where('status', 'in', ['pending', 'bidding'])
    .get();
  
  expiredOrders.forEach(doc => {
    batch.update(doc.ref, {
      status: 'expired',
      expiredAt: admin.firestore.FieldValue.serverTimestamp()
    });
    updateCount++;
  });
  
  if (updateCount > 0) {
    await batch.commit();
    console.log(`✅ Updated ${updateCount} expired orders`);
  } else {
    console.log('ℹ️  No expired orders found');
  }
}

/**
 * Generate analytics report
 */
async function generateAnalyticsReport() {
  console.log('📈 Generating analytics report...');
  
  const [ordersSnapshot, driversSnapshot] = await Promise.all([
    db.collection('orders').get(),
    db.collection('users').where('userType', '==', 'driver').get()
  ]);
  
  const orderStats = {
    total: 0,
    pending: 0,
    completed: 0,
    expired: 0,
    totalValue: 0
  };
  
  ordersSnapshot.forEach(doc => {
    const data = doc.data();
    orderStats.total++;
    
    if (data.status === 'pending') orderStats.pending++;
    else if (data.status === 'completed') orderStats.completed++;
    else if (data.status === 'expired') orderStats.expired++;
    
    if (data.finalPrice) orderStats.totalValue += data.finalPrice;
  });
  
  console.log('\n📊 Analytics Report:');
  console.log(`Total Orders: ${orderStats.total}`);
  console.log(`Pending: ${orderStats.pending}`);
  console.log(`Completed: ${orderStats.completed}`);
  console.log(`Expired: ${orderStats.expired}`);
  console.log(`Total Value: $${orderStats.totalValue}`);
  console.log(`Active Drivers: ${driversSnapshot.size}`);
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'fix-bids':
        const isDryRun = !args.includes('--fix');
        await fixOrphanedBids(isDryRun);
        break;
        
      case 'expire-orders':
        await bulkUpdateExpiredOrders();
        break;
        
      case 'analytics':
        await generateAnalyticsReport();
        break;
        
      default:
        console.log('Available commands:');
        console.log('  fix-bids [--fix]  - Find and fix orphaned bids');
        console.log('  expire-orders     - Mark expired orders');
        console.log('  analytics         - Generate report');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixOrphanedBids, bulkUpdateExpiredOrders, generateAnalyticsReport }; 