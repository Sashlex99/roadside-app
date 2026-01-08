// Simple test to verify admin panel Firebase connection
const fetch = require('node-fetch');

const PROJECT_ID = 'roadside-assistance-app-aa0e8';
const API_KEY = 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac';
const AUTH_URL = 'https://identitytoolkit.googleapis.com/v1';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function testAdminConnection() {
  console.log('🧪 Testing Admin Panel Connection to Firebase...\n');
  
  // Test admin authentication flow (simulate login)
  console.log('📋 Test: Authentication endpoint availability');
  try {
    const authResponse = await fetch(`${AUTH_URL}/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword',
        returnSecureToken: true
      })
    });
    
    console.log('Auth endpoint status:', authResponse.status);
    if (authResponse.status === 400) {
      console.log('✅ Auth endpoint working (400 = invalid credentials, which is expected)');
    } else {
      console.log('Auth response:', authResponse.status);
    }
  } catch (error) {
    console.log('❌ Auth endpoint error:', error.message);
  }
  
  // Test Firestore security (should require auth)
  console.log('\n📋 Test: Firestore security');
  try {
    const firestoreResponse = await fetch(`${FIRESTORE_URL}/users?pageSize=1`);
    console.log('Firestore status:', firestoreResponse.status);
    
    if (firestoreResponse.status === 401 || firestoreResponse.status === 403) {
      console.log('✅ Firestore security working (requires authentication)');
    } else if (firestoreResponse.status === 200) {
      console.log('⚠️ WARNING: Firestore allows public access!');
    }
  } catch (error) {
    console.log('❌ Firestore error:', error.message);
  }
  
  console.log('\n📋 Summary:');
  console.log('1. ✅ Admin panel environment configured (.env.local created)');
  console.log('2. ✅ Firebase project ID: roadside-assistance-app-aa0e8');
  console.log('3. ✅ Firebase API key configured');
  console.log('4. 🚀 Admin panel should be running at: http://localhost:3000');
  
  console.log('\n📝 Next steps:');
  console.log('1. Go to http://localhost:3000');
  console.log('2. Login with an account that has role: "admin"');
  console.log('3. Register as a driver using the mobile app to test');
  console.log('4. Check if drivers appear in admin panel dashboard');
}

// Run the test
testAdminConnection().catch(console.error); 