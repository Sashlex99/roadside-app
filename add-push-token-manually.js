const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./functions/service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'roadside-assistance-app-aa0e8'
});

async function addPushTokenManually() {
  try {
    const userId = 'CuP1dYc8ngv35GQ3yOHP'; // From your logs
    const pushToken = 'ExponentPushToken[L04ox6EBM99xyKrVK04l3T]';
    
    await admin.firestore().collection('users').doc(userId).update({
      pushToken: pushToken,
      pushTokenUpdatedAt: new Date(),
      pushTokenDevice: {
        platform: 'android',
        deviceName: 'Test Device',
        modelName: 'Android'
      }
    });
    
    console.log('✅ Push token added manually to Firestore');
    console.log('User ID:', userId);
    console.log('Push Token:', pushToken);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addPushTokenManually(); 