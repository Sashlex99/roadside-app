import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
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
 * Sends push notification via Expo Push API
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
 * Calculates distance between two GPS coordinates (Haversine formula)
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
 * On new order creation - notify nearby drivers
 */
export const onOrderCreateNotification = onDocumentCreated(
  { document: 'orders/{orderId}', region: 'europe-west3' },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.error('❌ No document data in event');
      return;
    }

    const order = snap.data();
    if (!order) {
      console.error('❌ Order data is undefined');
      return;
    }

    const orderId = event.params.orderId;
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

      // Find all online drivers
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

        // Include drivers within the defined radius
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

      // Send notifications to nearby drivers
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

      // Save statistics to the order
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
  }
);

/**
 * On new bid creation - notify the client
 * Listens on top-level bids collection (where the app writes bids)
 */
export const onBidCreateNotification = onDocumentCreated(
  { document: 'bids/{bidId}', region: 'europe-west3' },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.error('❌ No document data in event');
      return;
    }

    const bid = snap.data();
    if (!bid) {
      console.error('❌ Bid data is undefined');
      return;
    }

    const bidId = event.params.bidId;
    const orderId = bid.orderId;

    if (!orderId) {
      console.error('❌ Bid missing orderId field');
      return;
    }

    console.log(`📱 New bid created: ${bidId} for order ${orderId}`);

    try {
      // Validate bid data
      if (!bid.driverInfo?.name || !bid.proposedPrice) {
        console.error('❌ Bid missing required data');
        return;
      }

      // Get the order data
      const orderDoc = await admin.firestore()
        .collection('orders')
        .doc(orderId)
        .get();

      const order = orderDoc.data();
      if (!order) {
        console.error(`❌ Order ${orderId} not found`);
        return;
      }

      // Get client's push token
      const clientDoc = await admin.firestore()
        .collection('users')
        .doc(order.clientId)
        .get();

      const client = clientDoc.data();
      if (!client?.pushToken) {
        console.log(`⚠️ Client ${order.clientId} has no push token`);
        return;
      }

      // Send notification to client
      await sendPushNotification(
        client.pushToken,
        '💰 Нова оферта получена!',
        `${bid.driverInfo.name} предлага ${bid.proposedPrice}лв`,
        {
          orderId,
          bidId,
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
  }
);

/**
 * On bid acceptance - notify the driver
 */
export const onBidAcceptedNotification = onDocumentUpdated(
  { document: 'orders/{orderId}', region: 'europe-west3' },
  async (event) => {
    if (!event.data) {
      console.error('❌ No document data in event');
      return;
    }

    const before = event.data.before.data();
    const after = event.data.after.data();
    const orderId = event.params.orderId;

    // Check if the status changed to 'accepted'
    if (before.status !== 'accepted' && after.status === 'accepted' && after.acceptedBidId) {
      console.log(`📱 Bid accepted for order: ${orderId}`);

      try {
        // Get the accepted bid data (bids are stored in top-level 'bids' collection)
        const bidDoc = await admin.firestore()
          .collection('bids')
          .doc(after.acceptedBidId)
          .get();

        const bid = bidDoc.data();
        if (!bid) {
          console.error(`❌ Bid ${after.acceptedBidId} not found`);
          return;
        }

        // Get driver's push token
        const driverDoc = await admin.firestore()
          .collection('users')
          .doc(bid.driverId)
          .get();

        const driver = driverDoc.data();
        if (!driver?.pushToken) {
          console.log(`⚠️ Driver ${bid.driverId} has no push token`);
          return;
        }

        // Send notification to driver
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
  }
);

/**
 * Test function for sending push notifications
 */
export const sendTestNotification = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { pushToken, title, body } = request.data;

    if (!pushToken) {
      throw new HttpsError('invalid-argument', 'Push token is required');
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
      throw new HttpsError('internal', 'Failed to send notification');
    }
  }
);
