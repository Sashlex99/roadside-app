// Simple Payment Links Test - без firebase-admin
const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getAuth, signInAnonymously } = require('firebase/auth');

// Firebase config
const firebaseConfig = {
  apiKey: "process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac'",
  authDomain: "roadside-assistance-app-aa0e8.firebaseapp.com",
  projectId: "roadside-assistance-app-aa0e8",
  storageBucket: "roadside-assistance-app-aa0e8.appspot.com",
  messagingSenderId: "98397269310",
  appId: "1:98397269310:android:c965f2361fd25ff328906f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const auth = getAuth(app);

async function testPaymentLink() {
  try {
    console.log('🧪 Testing Payment Link Creation...');
    
    // Sign in anonymously (за да имаме auth context)
    console.log('🔐 Signing in anonymously...');
    await signInAnonymously(auth);
    console.log('✅ Signed in successfully');
    
    // Test data
    const testData = {
      orderId: 'test-order-' + Date.now(),
      amount: 15.75, // 15% of 105 лв
      driverName: 'Иван Петров (Тест)'
    };
    
    console.log('📤 Calling createPaymentLink with data:', testData);
    
    // Call the function
    const createPaymentLink = httpsCallable(functions, 'createPaymentLink');
    const result = await createPaymentLink(testData);
    
    console.log('✅ Payment Link created successfully!');
    console.log('📋 Result:', result.data);
    
    if (result.data.paymentUrl) {
      console.log('\n🌐 Copy this URL to test payment:');
      console.log('🔗', result.data.paymentUrl);
      console.log('\n💳 Use test card: 4242 4242 4242 4242');
      console.log('📅 Expiry: 12/25, CVC: 123');
    }
    
  } catch (error) {
    console.error('❌ Error testing payment link:', error);
    
    if (error.code === 'unauthenticated') {
      console.error('🚫 Authentication required - the function needs a real user');
      console.error('💡 Try testing through the mobile app instead');
    } else if (error.code === 'permission-denied') {
      console.error('🚫 Permission denied - need to create a real order first');
      console.error('💡 Try testing through the mobile app with a real order');
    } else {
      console.error('Error details:', {
        code: error.code,
        message: error.message
      });
    }
  }
}

// Run the test
console.log('🚀 Starting Payment Links Test...');
testPaymentLink().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
}); 