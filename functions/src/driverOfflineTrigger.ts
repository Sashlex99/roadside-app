/**
 * Driver Status Change Trigger
 *
 * Instantly updates the regional cache when a driver goes online or offline.
 * This eliminates the 30-60 second delay from scheduled cache updates.
 *
 * When driver goes OFFLINE:
 * - Immediately removes driver from nearbyDriversCache
 * - Client sees icon disappear within 1-2 seconds
 *
 * When driver goes ONLINE:
 * - Immediately adds driver to nearbyDriversCache
 * - Client sees icon appear within 1-2 seconds
 */

import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Compact driver summary for cache (must match regionCacheUpdater.ts)
interface DriverSummary {
  id: string;
  lat: number;
  lng: number;
  heading?: number;
  ts: number;
}

/**
 * Triggered when driverLocations document is updated
 * Instantly updates cache when driver goes online/offline
 */
export const onDriverStatusChange = onDocumentUpdated(
  {
    document: 'driverLocations/{driverId}',
    region: 'europe-west3',
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const driverId = event.params.driverId;

    if (!before || !after) {
      console.log(`⚠️ [DriverTrigger] Missing data for driver ${driverId}`);
      return;
    }

    const wasOnline = before.isOnline === true;
    const isNowOnline = after.isOnline === true;

    // Only trigger when online status actually changes
    if (wasOnline === isNowOnline) {
      // Just a location update, not a status change
      // The scheduled cache updater will handle position updates
      return;
    }

    // ========== DRIVER WENT OFFLINE ==========
    if (wasOnline && !isNowOnline) {
      console.log(`🔴 [DriverTrigger] Driver ${driverId} went OFFLINE - removing from cache instantly`);

      const geohashPrefix = after.geohashPrefix || before.geohashPrefix;
      if (!geohashPrefix) {
        console.log(`⚠️ [DriverTrigger] No geohashPrefix for driver ${driverId}, skipping cache update`);
        return;
      }

      try {
        const cacheRef = db.collection('nearbyDriversCache').doc(geohashPrefix);
        const cacheDoc = await cacheRef.get();

        if (cacheDoc.exists) {
          const data = cacheDoc.data();
          const currentDrivers: DriverSummary[] = data?.drivers || [];
          const updatedDrivers = currentDrivers.filter((d) => d.id !== driverId);

          await cacheRef.update({
            drivers: updatedDrivers,
            driverCount: updatedDrivers.length,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`✅ [DriverTrigger] Removed ${driverId} from cache ${geohashPrefix} (${currentDrivers.length} → ${updatedDrivers.length} drivers)`);
        } else {
          console.log(`ℹ️ [DriverTrigger] Cache ${geohashPrefix} doesn't exist, nothing to remove`);
        }
      } catch (error) {
        console.error(`❌ [DriverTrigger] Failed to remove driver from cache:`, error);
      }

      return;
    }

    // ========== DRIVER WENT ONLINE ==========
    if (!wasOnline && isNowOnline) {
      console.log(`🟢 [DriverTrigger] Driver ${driverId} went ONLINE - adding to cache instantly`);

      const geohashPrefix = after.geohashPrefix;
      if (!geohashPrefix) {
        console.log(`⚠️ [DriverTrigger] No geohashPrefix for driver ${driverId}, skipping cache update`);
        return;
      }

      if (!after.location?.latitude || !after.location?.longitude) {
        console.log(`⚠️ [DriverTrigger] No location for driver ${driverId}, skipping cache update`);
        return;
      }

      try {
        const cacheRef = db.collection('nearbyDriversCache').doc(geohashPrefix);
        const cacheDoc = await cacheRef.get();

        // Create driver summary
        const driverTimestamp = after.timestamp?.toDate?.() || new Date();
        const newDriver: DriverSummary = {
          id: driverId,
          lat: after.location.latitude,
          lng: after.location.longitude,
          ts: Math.floor(driverTimestamp.getTime() / 1000)
        };

        // Only include heading if available
        if (after.heading !== undefined && after.heading !== null) {
          newDriver.heading = after.heading;
        }

        if (cacheDoc.exists) {
          const data = cacheDoc.data();
          // Remove any existing entry for this driver, then add updated one
          const existingDrivers: DriverSummary[] = (data?.drivers || []).filter(
            (d: DriverSummary) => d.id !== driverId
          );
          existingDrivers.push(newDriver);

          await cacheRef.update({
            drivers: existingDrivers,
            driverCount: existingDrivers.length,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`✅ [DriverTrigger] Added ${driverId} to existing cache ${geohashPrefix} (now ${existingDrivers.length} drivers)`);
        } else {
          // Create new cache document for this region
          await cacheRef.set({
            regionId: geohashPrefix,
            drivers: [newDriver],
            driverCount: 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`✅ [DriverTrigger] Created cache ${geohashPrefix} with driver ${driverId}`);
        }
      } catch (error) {
        console.error(`❌ [DriverTrigger] Failed to add driver to cache:`, error);
      }

      return;
    }
  }
);

/**
 * Triggered when a new driverLocations document is created
 * Handles first-time driver going online
 */
export const onDriverLocationCreated = onDocumentCreated(
  {
    document: 'driverLocations/{driverId}',
    region: 'europe-west3',
  },
  async (event) => {
    const data = event.data?.data();
    const driverId = event.params.driverId;

    if (!data) {
      console.log(`⚠️ [DriverTrigger] No data for new driver ${driverId}`);
      return;
    }

    // Only add to cache if driver is online
    if (data.isOnline !== true) {
      console.log(`ℹ️ [DriverTrigger] New driver ${driverId} is not online, skipping cache`);
      return;
    }

    const geohashPrefix = data.geohashPrefix;
    if (!geohashPrefix) {
      console.log(`⚠️ [DriverTrigger] No geohashPrefix for new driver ${driverId}`);
      return;
    }

    if (!data.location?.latitude || !data.location?.longitude) {
      console.log(`⚠️ [DriverTrigger] No location for new driver ${driverId}`);
      return;
    }

    console.log(`🆕 [DriverTrigger] New driver ${driverId} created ONLINE - adding to cache`);

    try {
      const cacheRef = db.collection('nearbyDriversCache').doc(geohashPrefix);
      const cacheDoc = await cacheRef.get();

      const driverTimestamp = data.timestamp?.toDate?.() || new Date();
      const newDriver: DriverSummary = {
        id: driverId,
        lat: data.location.latitude,
        lng: data.location.longitude,
        ts: Math.floor(driverTimestamp.getTime() / 1000)
      };

      if (data.heading !== undefined && data.heading !== null) {
        newDriver.heading = data.heading;
      }

      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data();
        const existingDrivers: DriverSummary[] = (cacheData?.drivers || []).filter(
          (d: DriverSummary) => d.id !== driverId
        );
        existingDrivers.push(newDriver);

        await cacheRef.update({
          drivers: existingDrivers,
          driverCount: existingDrivers.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ [DriverTrigger] Added new driver ${driverId} to cache ${geohashPrefix}`);
      } else {
        await cacheRef.set({
          regionId: geohashPrefix,
          drivers: [newDriver],
          driverCount: 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ [DriverTrigger] Created cache ${geohashPrefix} for new driver ${driverId}`);
      }
    } catch (error) {
      console.error(`❌ [DriverTrigger] Failed to add new driver to cache:`, error);
    }
  }
);
