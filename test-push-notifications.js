const fetch = require('node-fetch');

// Test push notification function
async function sendTestPushNotification(pushToken) {
  try {
    console.log('🔔 Testing push notification...');
    console.log('📱 Push Token:', pushToken);
    
    const message = {
      to: pushToken,
      sound: 'default',
      title: '🚗 Roadside Assistance',
      body: '✅ Push notifications работят перфектно!',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      },
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
      console.log('✅ Push notification sent successfully!');
      return true;
    } else {
      console.log('❌ Push notification failed:', result);
      return false;
    }
  } catch (error) {
    console.error('💥 Error sending push notification:', error);
    return false;
  }
}

// Test with multiple tokens
async function testMultipleNotifications(tokens) {
  console.log('🔔 Testing multiple push notifications...');
  
  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: '🚗 Roadside Assistance',
    body: '📱 Bulk notification test - Success!',
    data: {
      type: 'bulk_test',
      timestamp: new Date().toISOString()
    },
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('📊 Bulk Response:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('💥 Error sending bulk notifications:', error);
    return null;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Push Notification Tests...\n');
  
  // Replace with your actual push token
  const testToken = 'ExponentPushToken[PLACEHOLDER]';
  
  if (testToken === 'ExponentPushToken[PLACEHOLDER]') {
    console.log('⚠️  Please replace PLACEHOLDER with your actual push token');
    console.log('📱 Get your push token from the debug panel in the app');
    console.log('🔗 Or use: node test-push-notifications.js YOUR_PUSH_TOKEN');
    return;
  }
  
  // Test single notification
  await sendTestPushNotification(testToken);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test multiple notifications
  const multipleTokens = [testToken]; // Add more tokens here
  await testMultipleNotifications(multipleTokens);
}

// Command line argument support
if (process.argv.length > 2) {
  const pushToken = process.argv[2];
  console.log('🔔 Using push token from command line...');
  sendTestPushNotification(pushToken);
} else {
  main();
}

module.exports = { sendTestPushNotification, testMultipleNotifications }; 