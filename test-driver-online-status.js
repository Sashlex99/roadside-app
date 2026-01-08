// Test Driver Online Status
// This script allows manual testing of driver online status functionality

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: 'roadside-assistance-bg',
      // Add your Firebase Admin credentials here for testing
    })
  });
}

const db = admin.firestore();

async function setDriverOnline(driverId, isOnline = true) {
  try {
    console.log(`🔄 Setting driver ${driverId} online status to: ${isOnline}`);
    
    await db.collection('users').doc(driverId).update({
      isOnline: isOnline,
      lastSeen: new Date(),
      updatedAt: new Date(),
      userType: 'driver',
      verificationStatus: 'approved'
    });
    
    console.log(`✅ Driver ${driverId} status updated successfully`);
    
    // Verify the update
    const doc = await db.collection('users').doc(driverId).get();
    if (doc.exists) {
      const data = doc.data();
      console.log(`📊 Current status: online=${data.isOnline}, lastSeen=${data.lastSeen?.toDate()}`);
    }
    
  } catch (error) {
    console.error('❌ Error updating driver status:', error);
  }
}

async function createTestDriver() {
  const testDriverId = 'test-driver-' + Date.now();
  
  try {
    console.log(`🧪 Creating test driver: ${testDriverId}`);
    
    await db.collection('users').doc(testDriverId).set({
      uid: testDriverId,
      email: 'testdriver@example.com',
      fullName: 'Test Driver',
      phone: '0888123456',
      userType: 'driver',
      role: 'driver',
      verificationStatus: 'approved',
      isOnline: true,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`✅ Test driver created: ${testDriverId}`);
    return testDriverId;
    
  } catch (error) {
    console.error('❌ Error creating test driver:', error);
    return null;
  }
}

async function checkOnlineDrivers() {
  try {
    console.log('📊 Checking current online drivers...\n');
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const snapshot = await db.collection('users')
      .where('userType', '==', 'driver')
      .where('verificationStatus', '==', 'approved')
      .where('isOnline', '==', true)
      .where('lastSeen', '>', fiveMinutesAgo)
      .get();
    
    console.log(`🟢 Found ${snapshot.size} online drivers:`);
    
    snapshot.forEach((doc) => {
      const driver = doc.data();
      const lastSeenTime = driver.lastSeen?.toDate();
      const minutesAgo = lastSeenTime ? Math.round((Date.now() - lastSeenTime.getTime()) / 60000) : 'Unknown';
      
      console.log(`  • ${driver.fullName} (${doc.id})`);
      console.log(`    📞 ${driver.phone || 'No phone'}`);
      console.log(`    ⏰ Last seen: ${minutesAgo} minutes ago`);
      console.log('');
    });
    
    if (snapshot.size === 0) {
      console.log('❌ No online drivers found');
      console.log('💡 Try running: node test-driver-online-status.js create-test');
    }
    
  } catch (error) {
    console.error('❌ Error checking online drivers:', error);
  }
}

async function cleanupTestDrivers() {
  try {
    console.log('🧹 Cleaning up test drivers...');
    
    const snapshot = await db.collection('users')
      .where('uid', '>=', 'test-driver-')
      .where('uid', '<', 'test-driver-z')
      .get();
    
    const batch = db.batch();
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    if (!snapshot.empty) {
      await batch.commit();
      console.log(`✅ Deleted ${snapshot.size} test drivers`);
    } else {
      console.log('💭 No test drivers to clean up');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up test drivers:', error);
  }
}

// Main function
async function main() {
  const command = process.argv[2];
  
  console.log('🚗 Driver Online Status Tester\n');
  console.log('=' .repeat(50));
  
  switch (command) {
    case 'create-test':
      const driverId = await createTestDriver();
      if (driverId) {
        console.log('\n💡 Now check the client app to see if it shows "1 шофьор онлайн"');
      }
      break;
      
    case 'set-online':
      const targetId = process.argv[3];
      if (!targetId) {
        console.log('❌ Please provide driver ID: node test-driver-online-status.js set-online DRIVER_ID');
        return;
      }
      await setDriverOnline(targetId, true);
      break;
      
    case 'set-offline':
      const offlineId = process.argv[3];
      if (!offlineId) {
        console.log('❌ Please provide driver ID: node test-driver-online-status.js set-offline DRIVER_ID');
        return;
      }
      await setDriverOnline(offlineId, false);
      break;
      
    case 'cleanup':
      await cleanupTestDrivers();
      break;
      
    case 'check':
    default:
      await checkOnlineDrivers();
      break;
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('🎯 Available commands:');
  console.log('  node test-driver-online-status.js check        - Check current online drivers');
  console.log('  node test-driver-online-status.js create-test  - Create a test online driver');
  console.log('  node test-driver-online-status.js set-online ID - Set driver online');
  console.log('  node test-driver-online-status.js set-offline ID - Set driver offline');
  console.log('  node test-driver-online-status.js cleanup      - Remove test drivers');
  
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
} 