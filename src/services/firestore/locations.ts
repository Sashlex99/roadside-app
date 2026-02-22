// Location Operations Module
// Split from firestore.ts for better maintainability

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DriverLocation } from '../../types/firestore';
import { COLLECTIONS } from './orders';

// Haversine distance calculation (km)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Update driver location
 */
export const updateDriverLocation = async (driverId: string, location: DriverLocation): Promise<void> => {
  try {
    const locationRef = doc(db, COLLECTIONS.DRIVER_LOCATIONS, driverId);
    // Use server timestamp for consistency across devices and time zones
    // This ensures accurate staleness detection and cache invalidation
    await setDoc(locationRef, {
      ...location,
      timestamp: serverTimestamp(), // Server time for accurate freshness
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log(`✅ [FIRESTORE] Driver ${driverId} location updated`);
  } catch (error) {
    console.error("Error updating driver location:", error);
    throw error;
  }
};

/**
 * Get driver location
 */
export const getDriverLocation = async (driverId: string): Promise<DriverLocation | null> => {
  try {
    const locationDoc = await getDoc(doc(db, COLLECTIONS.DRIVER_LOCATIONS, driverId));

    if (locationDoc.exists()) {
      const data = locationDoc.data();
      return {
        ...data,
        updatedAt: data.updatedAt?.toDate(),
      } as unknown as DriverLocation;
    } else {
      console.log("Driver location not found:", driverId);
      return null;
    }
  } catch (error) {
    console.error("Error getting driver location:", error);
    return null;
  }
};

/**
 * Subscribe to nearby online drivers within a radius
 * Returns an unsubscribe function
 */
export const subscribeToNearbyDrivers = (
  clientLocation: { latitude: number; longitude: number },
  radiusKm: number,
  callback: (drivers: DriverLocation[]) => void
): (() => void) => {
  // Calculate time threshold - only show drivers active in last 2 minutes
  // (10s update interval means inactive drivers should be stale within 30s)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const driversRef = collection(db, COLLECTIONS.DRIVER_LOCATIONS);

  // Query for online drivers with recent timestamps
  const q = query(
    driversRef,
    where('isOnline', '==', true)
  );

  if (__DEV__) {
    console.log(`📍 [NearbyDrivers] Subscribing to drivers within ${radiusKm}km of (${clientLocation.latitude.toFixed(4)}, ${clientLocation.longitude.toFixed(4)})`);
  }

  return onSnapshot(q, (snapshot) => {
    const drivers: DriverLocation[] = [];
    const now = Date.now();

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();

      // Check timestamp - only include recently active drivers
      const timestamp = data.timestamp?.toDate?.() || data.updatedAt?.toDate?.();
      if (!timestamp || timestamp < twoMinutesAgo) {
        return; // Skip stale drivers
      }

      // Parse location data
      const driverLat = data.location?.latitude || data.latitude;
      const driverLng = data.location?.longitude || data.longitude;

      if (!driverLat || !driverLng) {
        return; // Skip invalid locations
      }

      // Calculate distance from client
      const distance = calculateDistance(
        clientLocation.latitude,
        clientLocation.longitude,
        driverLat,
        driverLng
      );

      // Only include drivers within radius
      if (distance <= radiusKm) {
        drivers.push({
          driverId: docSnapshot.id,
          location: {
            latitude: driverLat,
            longitude: driverLng,
            address: data.location?.address || data.address || ''
          },
          isOnline: true,
          timestamp: timestamp,
          orderId: data.orderId,
          heading: data.heading,
          speed: data.speed
        });
      }
    });

    if (__DEV__) {
      console.log(`📍 [NearbyDrivers] Found ${drivers.length} online drivers within ${radiusKm}km`);
    }

    callback(drivers);
  }, (error) => {
    console.error('[NearbyDrivers] Subscription error:', error);
    callback([]); // Return empty array on error
  });
}; 