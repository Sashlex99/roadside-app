import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// TypeScript interfaces
interface PushNotificationData {
  orderId?: string;
  bidId?: string;
  type: 'new_order' | 'new_bid' | 'bid_accepted' | 'test';
  distance?: string;
  driverName?: string;
  price?: number;
  priority?: 'normal' | 'high';
  timestamp?: number;
}

interface ExpoPushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: PushNotificationData;
  priority: 'normal' | 'high';
  channelId?: string;
}

interface ExpoPushResponse {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: any;
}

interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

interface NearbyDriver {
  id: string;
  pushToken: string;
  distance: number;
}

// Constants
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_NOTIFICATION_DISTANCE_KM = 15;
const MAX_BODY_LENGTH = 100;

/**
 * Изпраща push notification чрез Expo Push API
 * @param expoPushToken - Expo push token
 * @param title - Заглавие на notification
 * @param body - Съдържание на notification
 * @param data - Допълнителни данни
 * @returns Promise<ExpoPushResponse>
 */
async function sendPushNotification(
  expoPushToken: string, 
  title: string, 
  body: string, 
  data: PushNotificationData
): Promise<ExpoPushResponse> {
  // Validate input
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken[')) {
    throw new Error('Invalid Expo push token format');
  }

  const message: ExpoPushMessage = {
    to: expoPushToken,
    sound: 'default',
    title: title.substring(0, 50), // Limit title length
    body: body.substring(0, MAX_BODY_LENGTH), // Limit body length
    data: {
      ...data,
      timestamp: Date.now()
    },
    priority: data.priority || 'high',
    channelId: 'roadside-assistance-default'
  };

  try {
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: ExpoPushResponse = await response.json();
    console.log('✅ Push notification sent:', { 
      token: expoPushToken.substring(0, 20) + '...', 
      title, 
      status: result.status 
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error sending push notification:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      token: expoPushToken.substring(0, 20) + '...',
      title
    });
    throw error;
  }
}

/**
 * Изчислява разстоянието между две GPS координати (Haversine formula)
 * @param lat1 - Latitude на първата точка
 * @param lon1 - Longitude на първата точка
 * @param lat2 - Latitude на втората точка
 * @param lon2 - Longitude на втората точка
 * @returns Разстояние в километри
 */
function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * При създаване на нова поръчка - нотифицира близки шофьори
 */
export const onOrderCreateNotification = functions
  .region('europe-west3')
  .firestore
  .document('orders/{orderId}')
  .onCreate(async (snap: admin.firestore.DocumentSnapshot, context: functions.EventContext) => {
    const order = snap.data();
    if (!order) {
      console.error('❌ Order data is undefined');
      return;
    }
    
    const orderId = context.params.orderId as string;
    console.log(`📱 New order created: ${orderId}`);
    
    try {
      // Validate order data
      if (!order.location?.latitude || !order.location?.longitude) {
        console.error('❌ Order missing location data');
        return;
      }
      
      if (typeof order.location.latitude !== 'number' || typeof order.location.longitude !== 'number') {
        console.error('❌ Order location data is not numeric');
        return;
      }

      // Намери всички онлайн шофьори
      const driversSnapshot = await admin.firestore()
        .collection('users')
        .where('userType', '==', 'driver')
        .where('isOnline', '==', true)
        .where('pushToken', '!=', null)
        .get();
      
      console.log(`🔍 Found ${driversSnapshot.size} online drivers with push tokens`);
      
      const nearbyDrivers: NearbyDriver[] = [];
      
      driversSnapshot.forEach((doc) => {
        const driver = doc.data();
        
        // Validate driver data
        if (!driver.currentLocation?.latitude || !driver.currentLocation?.longitude || !driver.pushToken) {
          return;
        }
        
        // Validate numeric coordinates
        if (typeof driver.currentLocation.latitude !== 'number' || typeof driver.currentLocation.longitude !== 'number') {
          console.warn(`Driver ${doc.id} has invalid coordinate data`);
          return;
        }

        const distance = calculateDistance(
          order.location.latitude,
          order.location.longitude,
          driver.currentLocation.latitude,
          driver.currentLocation.longitude
        );
        
        // Включи шофьори в определения радиус
        if (distance <= MAX_NOTIFICATION_DISTANCE_KM) {
          nearbyDrivers.push({
            id: doc.id,
            pushToken: driver.pushToken,
            distance
          });
        }
      });
      
      console.log(`📍 Found ${nearbyDrivers.length} drivers within ${MAX_NOTIFICATION_DISTANCE_KM}km`);
      
      if (nearbyDrivers.length === 0) {
        console.log('⚠️ No nearby drivers found for notification');
        await snap.ref.update({
          notificationsStats: {
            driversNotified: 0,
            notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            reason: 'no_nearby_drivers'
          }
        });
        return;
      }
      
      // Изпрати notifications на близките шофьори
      const notifications = nearbyDrivers.map(driver => 
        sendPushNotification(
          driver.pushToken,
          '🚗 Нова заявка за пътна помощ',
          `${order.description.substring(0, 50)}... - ${driver.distance}км от вас`,
          { 
            orderId, 
            type: 'new_order',
            distance: driver.distance.toString(),
            priority: 'high'
          }
        ).catch((error: any) => {
          console.error(`❌ Failed to send notification to driver ${driver.id}:`, error);
          return { status: 'error', message: error?.message || 'Unknown error' };
        })
      );
      
      const results = await Promise.allSettled(notifications);
      
      // Count successful notifications
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && 
        (result.value as ExpoPushResponse).status === 'ok'
      ).length;
      
      console.log(`✅ Sent ${successCount}/${nearbyDrivers.length} notifications for order ${orderId}`);
      
      // Запиши статистика в поръчката
      await snap.ref.update({
        notificationsStats: {
          driversNotified: successCount,
          driversInRange: nearbyDrivers.length,
          notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          maxDistance: MAX_NOTIFICATION_DISTANCE_KM
        }
      });
      
    } catch (error) {
      console.error(`❌ Error sending notifications for order ${orderId}:`, error);
      
      // Update order with error info
      await snap.ref.update({
        notificationsStats: {
          driversNotified: 0,
          notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

/**
 * При създаване на нова оферта - нотифицира клиента
 */
export const onBidCreateNotification = functions
  .region('europe-west3')
  .firestore
  .document('orders/{orderId}/bids/{bidId}')
  .onCreate(async (snap: admin.firestore.DocumentSnapshot, context: functions.EventContext) => {
    const bid = snap.data();
    if (!bid) {
      console.error('❌ Bid data is undefined');
      return;
    }
    
    const { orderId, bidId } = context.params;
    console.log(`📱 New bid created: ${bidId} for order ${orderId}`);
    
    try {
      // Validate bid data
      if (!bid.driverInfo?.name || !bid.proposedPrice) {
        console.error('❌ Bid missing required data');
        return;
      }

      // Вземи данните за поръчката
      const orderDoc = await admin.firestore()
        .collection('orders')
        .doc(orderId as string)
        .get();
      
      const order = orderDoc.data();
      if (!order) {
        console.error(`❌ Order ${orderId} not found`);
        return;
      }
      
      // Вземи push token на клиента
      const clientDoc = await admin.firestore()
        .collection('users')
        .doc(order.clientId)
        .get();
      
      const client = clientDoc.data();
      if (!client?.pushToken) {
        console.log(`⚠️ Client ${order.clientId} has no push token`);
        return;
      }
      
      // Изпрати notification на клиента
      await sendPushNotification(
        client.pushToken,
        '💰 Нова оферта получена!',
        `${bid.driverInfo.name} предлага ${bid.proposedPrice}лв`,
        { 
          orderId: orderId as string, 
          bidId: bidId as string, 
          type: 'new_bid',
          driverName: bid.driverInfo.name,
          price: bid.proposedPrice,
          priority: 'high'
        }
      );
      
      console.log(`✅ Sent bid notification to client for order ${orderId}`);
      
    } catch (error) {
      console.error(`❌ Error sending bid notification for order ${orderId}:`, error);
    }
  });

// При приемане на оферта - нотифицира шофьора
export const onBidAcceptedNotification = functions
  .region('europe-west3')
  .firestore
  .document('orders/{orderId}')
  .onUpdate(async (change: any, context: any) => {
    const before = change.before.data();
    const after = change.after.data();
    const orderId = context.params.orderId;
    
    // Проверка дали статусът се е променил на 'accepted'
    if (before.status !== 'accepted' && after.status === 'accepted' && after.acceptedBidId) {
      console.log(`📱 Bid accepted for order: ${orderId}`);
      
      try {
        // Вземи данните за приетата оферта (bids are stored in top-level 'bids' collection)
        const bidDoc = await admin.firestore()
          .collection('bids')
          .doc(after.acceptedBidId)
          .get();
        
        const bid = bidDoc.data();
        if (!bid) {
          console.error(`❌ Bid ${after.acceptedBidId} not found`);
          return;
        }
        
        // Вземи push token на шофьора
        const driverDoc = await admin.firestore()
          .collection('users')
          .doc(bid.driverId)
          .get();
        
        const driver = driverDoc.data();
        if (!driver?.pushToken) {
          console.log(`⚠️ Driver ${bid.driverId} has no push token`);
          return;
        }
        
        // Изпрати notification на шофьора
        await sendPushNotification(
          driver.pushToken,
          '🎉 Вашата оферта е приета!',
          `Клиентът одобри вашата оферта от ${bid.proposedPrice}лв. Започнете навигация към местоположението.`,
          { 
            orderId, 
            bidId: after.acceptedBidId,
            type: 'bid_accepted',
            price: bid.proposedPrice 
          }
        );
        
        console.log(`✅ Sent acceptance notification to driver for order ${orderId}`);
        
      } catch (error) {
        console.error(`❌ Error sending acceptance notification for order ${orderId}:`, error);
      }
    }
  });

// Test function за изпращане на push notifications
export const sendTestNotification = functions.region('europe-west3').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { pushToken, title, body } = data;
  
  if (!pushToken) {
    throw new functions.https.HttpsError('invalid-argument', 'Push token is required');
  }
  
  try {
    await sendPushNotification(
      pushToken,
      title || '🧪 Test Notification',
      body || 'This is a test notification from Firebase Functions!',
      { type: 'test', timestamp: Date.now() }
    );
    
    return { success: true, message: 'Test notification sent' };
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
}); 