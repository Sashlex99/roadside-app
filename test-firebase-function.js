const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testFirebaseFunction(pushToken) {
  try {
    console.log('Testing Firebase Cloud Function...');
    console.log('Push Token:', pushToken);
    
    const response = await fetch('http://127.0.0.1:5001/roadside-assistance-app-aa0e8/us-central1/sendTestNotification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pushToken: pushToken
      }),
    });

    const result = await response.text();
    console.log('Firebase Function Response:', result);
    
    if (response.ok) {
      console.log('✅ Firebase Cloud Function test successful!');
    } else {
      console.log('❌ Firebase Cloud Function test failed');
    }
    
    return result;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

// Command line usage
if (process.argv.length > 2) {
  const pushToken = process.argv[2];
  testFirebaseFunction(pushToken);
} else {
  console.log('Usage: node test-firebase-function.js YOUR_PUSH_TOKEN');
  console.log('Example: node test-firebase-function.js ExponentPushToken[L04ox6EBM99xyKrVK04l3T]');
} 