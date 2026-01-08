// Manual push notification test - Direct Expo API

async function testPushNotificationManual() {
  try {
    const userId = 'CuP1dYc8ngv35GQ3yOHP';
    const pushToken = 'ExponentPushToken[L04ox6EBM99xyKrVK04l3T]';
    
    console.log('🔔 Testing manual push notification...');
    console.log('User ID:', userId);
    console.log('Push Token:', pushToken);
    
    // Manual test with Expo Push API
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    const message = {
      to: pushToken,
      sound: 'default',
      title: '🚗 MANUAL TEST SUCCESS!',
      body: 'Push notifications are working! User is authenticated.',
      data: {
        type: 'manual_test',
        userId: userId,
        timestamp: new Date().toISOString()
      },
      priority: 'high'
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('📊 Response:', JSON.stringify(result, null, 2));
    
    if (result.data && result.data[0] && result.data[0].status === 'ok') {
      console.log('✅ MANUAL PUSH TEST SUCCESSFUL!');
    } else {
      console.log('❌ Manual push test failed:', result);
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testPushNotificationManual(); 