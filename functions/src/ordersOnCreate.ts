import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

// Constants
const INITIAL_RADIUS_KM = 5;

interface OrderLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface DriverLocationDoc {
  driverId: string;
  location: OrderLocation;
  geohash: string;
  timestamp: FirebaseFirestore.Timestamp;
}

export const onOrderCreate = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap: admin.firestore.DocumentSnapshot, context: functions.EventContext) => {
    const orderId = context.params.orderId as string;
    const data = snap.data();
    if (!data) return;

    const location = data.location as OrderLocation;
    if (!location) return;

    // Prepare geo-query bounds for initial radius
    const center: [number, number] = [location.latitude, location.longitude];
    const radiusInM = INITIAL_RADIUS_KM * 1000;
    const bounds = geohashQueryBounds(center, radiusInM);

    const matchedDriverIds = new Set<string>();

    // For each geohash bound, query driverLocations
    const queries = bounds.map((b) =>
      db
        .collection('driverLocations')
        .orderBy('geohash')
        .startAt(b[0])
        .endAt(b[1])
    );

    const snapshots = await Promise.all(queries.map((q) => q.get()));

    // Flatten docs
    snapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        const driverLoc = doc.data() as DriverLocationDoc;
        const { driverId, location: driverLocation } = driverLoc;
        if (!driverLocation) return;

        // Exclude duplicates
        if (matchedDriverIds.has(driverId)) return;

        // Calculate exact distance to filter radix false positives
        const distKm = distanceBetween(center, [driverLocation.latitude, driverLocation.longitude]);
        if (distKm <= INITIAL_RADIUS_KM) {
          matchedDriverIds.add(driverId);
        }
      });
    });

    if (matchedDriverIds.size === 0) {
      console.log(`No drivers within ${INITIAL_RADIUS_KM} km for order ${orderId}`);
      return;
    }

    // Fetch driver user docs to filter by isOnline and get FCM token
    const driverDocs = await db.getAll(...Array.from(matchedDriverIds).map((id) => db.collection('users').doc(id)));

    const tokens: string[] = [];
    const notifiedDrivers: string[] = [];

    driverDocs.forEach((docSnap) => {
      if (!docSnap.exists) return;
      const driverData = docSnap.data();
      if (!driverData) return;
      if (!driverData.isOnline) return; // only online drivers
      if (!driverData.fcmToken) return;

      tokens.push(driverData.fcmToken as string);
      notifiedDrivers.push(docSnap.id);
    });

    if (tokens.length === 0) {
      console.log('No online drivers with valid FCM tokens within radius.');
      return;
    }

    // Build notification payload
    const notificationTitle = 'Нова поръчка наблизо';
    const notificationBody = `Нова поръчка на ~${INITIAL_RADIUS_KM}км от вас - ${data.description}`;

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        orderId,
        address: location.address,
        description: data.description,
        distanceKm: INITIAL_RADIUS_KM.toString(),
      },
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
    };

    const response = await messaging.sendMulticast(message);
    console.log(`Sent notification for order ${orderId} to ${tokens.length} tokens successCount=${response.successCount}`);

    // Save list of notified drivers to order doc to avoid duplicates later
    await snap.ref.update({ notifiedDrivers });
  }); 