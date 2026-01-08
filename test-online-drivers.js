// Test Online Drivers Functionality
// This script tests the online drivers count functionality

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

async function testOnlineDriversCount() {
  try {
    console.log('🧪 Testing Online Drivers Count...\n');

    // Test 1: Get current online drivers count
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const query = db.collection('users')
      .where('userType', '==', 'driver')
      .where('verificationStatus', '==', 'approved')
      .where('isOnline', '==', true)
      .where('lastSeen', '>', fiveMinutesAgo);

    const snapshot = await query.get();
    console.log(`📊 Current online drivers: ${snapshot.size}`);

    // List online drivers
    if (snapshot.size > 0) {
      console.log('\n👨‍🔧 Online drivers:');
      snapshot.forEach((doc) => {
        const driver = doc.data();
        console.log(`  • ${driver.fullName} (${driver.phone}) - Last seen: ${driver.lastSeen?.toDate()}`);
      });
    } else {
      console.log('❌ No online drivers found');
    }

    // Test 2: Create a mock online driver (for testing)
    console.log('\n🧪 Creating mock online driver...');
    
    const mockDriverRef = db.collection('users').doc('test-driver-123');
    await mockDriverRef.set({
      fullName: 'Test Driver',
      phone: '0888123456',
      userType: 'driver',
      verificationStatus: 'approved',
      isOnline: true,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Mock driver created');

    // Test 3: Check count again
    const newSnapshot = await query.get();
    console.log(`📊 Online drivers after mock: ${newSnapshot.size}`);

    // Test 4: Clean up mock driver
    console.log('\n🧹 Cleaning up mock driver...');
    await mockDriverRef.delete();
    console.log('✅ Mock driver deleted');

    const finalSnapshot = await query.get();
    console.log(`📊 Final online drivers count: ${finalSnapshot.size}`);

    console.log('\n✅ Online drivers test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function simulateDriverActivityChanges() {
  try {
    console.log('\n🎭 Simulating driver activity changes...\n');

    // This simulates what happens in the real app
    const driverActivities = [
      { name: 'Driver 1', online: true },
      { name: 'Driver 2', online: true },
      { name: 'Driver 3', online: false },
      { name: 'Driver 4', online: true },
      { name: 'Driver 5', online: false },
    ];

    for (let i = 0; i < driverActivities.length; i++) {
      const activity = driverActivities[i];
      console.log(`${activity.online ? '🟢' : '🔴'} ${activity.name}: ${activity.online ? 'ONLINE' : 'OFFLINE'}`);
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const onlineCount = driverActivities.filter(a => a.online).length;
    console.log(`\n📊 Total simulated online drivers: ${onlineCount}`);
    console.log('✅ Simulation completed!');

  } catch (error) {
    console.error('❌ Simulation failed:', error);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Online Drivers Tests\n');
  console.log('=' .repeat(50));
  
  await testOnlineDriversCount();
  
  console.log('\n' + '=' .repeat(50));
  
  await simulateDriverActivityChanges();
  
  console.log('\n🎉 All tests completed!');
  process.exit(0);
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testOnlineDriversCount,
  simulateDriverActivityChanges
}; 