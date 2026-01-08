const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function sendPushNotification(pushToken) {
  console.log('Testing push notification...');
  console.log('Push Token:', pushToken);
  
  const message = {
    to: pushToken,
    sound: 'default',
    title: 'Roadside Assistance Test',
    body: 'Push notifications are working perfectly!',
    data: {
      type: 'test',
      timestamp: new Date().toISOString()
    }
  };

  try {
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
    console.log('Response:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

// Command line usage
if (process.argv.length > 2) {
  const pushToken = process.argv[2];
  sendPushNotification(pushToken);
} else {
  console.log('Usage: node simple-push-test.js YOUR_PUSH_TOKEN');
  console.log('Example: node simple-push-test.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
} 