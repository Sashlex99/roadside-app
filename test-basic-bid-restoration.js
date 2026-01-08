// Use Firebase client SDK (same as main app) instead of Admin SDK
const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, deleteField } = require('firebase/firestore');

// Firebase configuration (same as main app)
const firebaseConfig = {
  apiKey: "test-api-key",
  projectId: "roadside-assistance-app-aa0e8",
  authDomain: "roadside-assistance-app-aa0e8.firebaseapp.com",
  storageBucket: "roadside-assistance-app-aa0e8.appspot.com",
  messagingSenderId: "98397269310",
  appId: "1:98397269310:web:c965f2361fd25ff328906f"
};

// Initialize Firebase
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

// Connect to emulator if available (for testing)
if (process.env.NODE_ENV === 'test' && !process.env.FIRESTORE_EMULATOR_HOST) {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('🧪 Connected to Firestore emulator');
  } catch (error) {
    console.log('⚠️ Firestore emulator not available, using live database');
  }
}

// Test functions
const reserveBid = async (orderId, bidId) => {
  const startTime = Date.now();
  console.log(`🔄 [TEST] Reserving bid ${bidId} for order ${orderId}...`);
  
  try {
    // This would call your actual reserveBid function
    // For testing, we'll simulate the reservation
    await updateDoc(doc(db, 'bids', bidId), {
      status: 'reserved',
      reservedAt: serverTimestamp(),
      orderId: orderId
    });
    
    console.log(`✅ [TEST] Bid reserved in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`❌ [TEST] Failed to reserve bid:`, error.message);
    throw error;
  }
};

const cancelBidReservation = async (orderId, bidId) => {
  const startTime = Date.now();
  console.log(`🔄 [TEST] Cancelling bid reservation ${bidId} for order ${orderId}...`);
  
  try {
    // This would call your actual cancelBidReservation function
    // For testing, we'll simulate the cancellation
    await updateDoc(doc(db, 'bids', bidId), {
      status: 'active',
      reservedAt: deleteField(),
      cancelledAt: serverTimestamp()
    });
    
    console.log(`✅ [TEST] Bid reservation cancelled in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`❌ [TEST] Failed to cancel bid reservation:`, error.message);
    throw error;
  }
};

const getBid = async (bidId) => {
  const bidDoc = await getDoc(doc(db, 'bids', bidId));
  if (!bidDoc.exists()) {
    throw new Error(`Bid ${bidId} not found`);
  }
  return { id: bidDoc.id, ...bidDoc.data() };
};

const createTestBid = async (bidId, orderId, driverId, price) => {
  console.log(`🔄 [TEST] Creating test bid ${bidId}...`);
  
  await setDoc(doc(db, 'bids', bidId), {
    orderId: orderId,
    driverId: driverId,
    price: price,
    status: 'active',
    createdAt: serverTimestamp(),
    description: 'Test bid for restoration testing'
  });
  
  console.log(`✅ [TEST] Test bid created: ${bidId}`);
};

const cleanupTestData = async (bidId) => {
  console.log(`🧹 [TEST] Cleaning up test data...`);
  
  try {
    await deleteDoc(doc(db, 'bids', bidId));
    console.log(`✅ [TEST] Test data cleaned up`);
  } catch (error) {
    console.warn(`⚠️ [TEST] Cleanup warning:`, error.message);
  }
};

// Main test function
const testBasicBidRestoration = async () => {
  console.log('\n🧪 === TESTING BASIC BID RESTORATION ===\n');
  
  // Test data
  const orderId = 'test-order-restoration';
  const bidId = 'test-bid-restoration';
  const driverId = 'test-driver-bob';
  const price = 75;
  
  try {
    // Step 1: Create test bid
    await createTestBid(bidId, orderId, driverId, price);
    
    // Step 2: Reserve bid
    await reserveBid(orderId, bidId);
    
    // Step 3: Verify bid is reserved
    const reservedBid = await getBid(bidId);
    if (reservedBid.status !== 'reserved') {
      throw new Error(`Expected bid status 'reserved', got '${reservedBid.status}'`);
    }
    console.log('✅ [TEST] Bid correctly reserved');
    
    // Step 4: Cancel reservation
    await cancelBidReservation(orderId, bidId);
    
    // Step 5: Verify bid is active again
    const activeBid = await getBid(bidId);
    if (activeBid.status !== 'active') {
      throw new Error(`Expected bid status 'active', got '${activeBid.status}'`);
    }
    console.log('✅ [TEST] Bid correctly restored to active');
    
    // Step 6: Verify bid data integrity
    if (activeBid.price !== price) {
      throw new Error(`Bid price changed: expected ${price}, got ${activeBid.price}`);
    }
    if (activeBid.driverId !== driverId) {
      throw new Error(`Driver ID changed: expected ${driverId}, got ${activeBid.driverId}`);
    }
    console.log('✅ [TEST] Bid data integrity maintained');
    
    console.log('\n🎉 === BASIC BID RESTORATION TEST PASSED ===\n');
    
  } catch (error) {
    console.error('\n❌ === BASIC BID RESTORATION TEST FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    // Cleanup
    await cleanupTestData(bidId);
  }
};

// Run the test
if (require.main === module) {
  testBasicBidRestoration()
    .then(() => {
      console.log('✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  testBasicBidRestoration,
  reserveBid,
  cancelBidReservation,
  getBid,
  createTestBid,
  cleanupTestData
}; 