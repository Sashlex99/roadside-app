const admin = require('firebase-admin');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { initializeApp } = require('firebase/app');

// Initialize Firebase Admin (for server-side operations)
const serviceAccount = require('./roadside-assistance-app-aa0e8-firebase-adminsdk-ixqzj-b8b8b8b8b8.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'roadside-assistance-app-aa0e8'
});

// Initialize Firebase Client (for calling functions)
const firebaseConfig = {
  projectId: 'roadside-assistance-app-aa0e8',
  // Add other config if needed
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

async function testPaymentLink() {
  try {
    console.log('🧪 Testing Payment Link Creation...');
    
    // Test data
    const testData = {
      orderId: 'test-order-123',
      amount: 15.75, // 15% of 105 лв
      driverName: 'Иван Петров'
    };
    
    console.log('📤 Calling createPaymentLink with data:', testData);
    
    // Call the function
    const createPaymentLink = httpsCallable(functions, 'createPaymentLink');
    const result = await createPaymentLink(testData);
    
    console.log('✅ Payment Link created successfully!');
    console.log('📋 Result:', result.data);
    console.log('🔗 Payment URL:', result.data.paymentUrl);
    
    // Test opening the URL (you can copy-paste this in browser)
    console.log('\n🌐 Copy this URL to test payment:');
    console.log(result.data.paymentUrl);
    
  } catch (error) {
    console.error('❌ Error testing payment link:', error);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.message) {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testPaymentLink().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
}); 