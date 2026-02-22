/**
 * Regional Cache Updater
 *
 * Aggregates online driver locations into regional caches for efficient
 * nearby driver queries. This solves the N+1 query problem by:
 *
 * 1. Reading all online drivers once (server-side, every 60s)
 * 2. Grouping them by 4-char geohash prefix (~20km cells)
 * 3. Writing compressed summaries to nearbyDriversCache/{regionId}
 *
 * Clients then subscribe to 4-8 regional cache documents instead of
 * querying 10,000+ individual driver documents.
 *
 * Cost reduction: ~99% (from millions of reads to thousands)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { geohashForLocation } from 'geofire-common';

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Compact driver summary for cache (minimizes document size)
interface DriverSummary {
  id: string;
  lat: number;
  lng: number;
  heading?: number;
  ts: number; // Unix timestamp in seconds (compact)
}

// Regional cache document structure
interface RegionalCache {
  regionId: string;
  drivers: DriverSummary[];
  driverCount: number;
  updatedAt: admin.firestore.FieldValue;
}

/**
 * Scheduled function that updates regional driver caches
 * Runs every 1 minute (minimum for Cloud Scheduler)
 *
 * In practice, this gives 30-60 second data freshness which is
 * acceptable for "nearby available drivers" display.
 */
export const updateRegionalCaches = onSchedule(
  {
    // Note: Cloud Scheduler minimum is 1 minute. Online/offline detection
    // is now instant via Firestore triggers (onDriverStatusChange).
    // This cache update handles position changes for moving drivers.
    schedule: 'every 1 minutes',
    timeZone: 'Europe/Sofia',
    region: 'europe-west3',
  },
  async () => {
    const startTime = Date.now();
    const db = admin.firestore();

    try {
      // Get all online drivers with recent timestamps (last 2 minutes)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      const driversSnap = await db.collection('driverLocations')
        .where('isOnline', '==', true)
        .get();

      // Filter by timestamp client-side (Firestore can't do compound inequality)
      const activeDrivers = driversSnap.docs.filter(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate?.() || data.timestamp;
        return timestamp && timestamp > twoMinutesAgo;
      });

      console.log(`📍 [RegionCache] Found ${activeDrivers.length} active online drivers (of ${driversSnap.size} total online)`);

      // Group drivers by region (4-char geohash prefix = ~20km cells)
      const regions = new Map<string, DriverSummary[]>();

      activeDrivers.forEach(doc => {
        const data = doc.data();

        // Get or compute geohash prefix
        let prefix = data.geohashPrefix;
        if (!prefix && data.location?.latitude && data.location?.longitude) {
          const geohash = geohashForLocation(
            [data.location.latitude, data.location.longitude],
            4
          );
          prefix = geohash;
        }

        if (!prefix) {
          console.warn(`⚠️ [RegionCache] Driver ${doc.id} has no location, skipping`);
          return;
        }

        if (!regions.has(prefix)) {
          regions.set(prefix, []);
        }

        // Create compact driver summary (preserve driver's original timestamp)
        const driverTimestamp = data.timestamp?.toDate?.() || data.updatedAt?.toDate?.() || new Date();
        const summary: DriverSummary = {
          id: doc.id,
          lat: data.location.latitude,
          lng: data.location.longitude,
          ts: Math.floor(driverTimestamp.getTime() / 1000) // Driver's actual timestamp in Unix seconds
        };

        // Only include heading if available (saves space)
        if (data.heading !== undefined && data.heading !== null) {
          summary.heading = data.heading;
        }

        regions.get(prefix)!.push(summary);
      });

      console.log(`📍 [RegionCache] Grouped into ${regions.size} regions`);

      // Batch write regional caches
      const batch = db.batch();
      let updatedRegions = 0;
      let clearedRegions = 0;

      // Update regions with drivers
      for (const [regionId, drivers] of regions) {
        const cacheRef = db.collection('nearbyDriversCache').doc(regionId);
        const cacheData: RegionalCache = {
          regionId,
          drivers,
          driverCount: drivers.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(cacheRef, cacheData);
        updatedRegions++;
      }

      // Clear stale regions (regions that had drivers but now don't)
      const existingCachesSnap = await db.collection('nearbyDriversCache').get();

      existingCachesSnap.forEach(doc => {
        if (!regions.has(doc.id)) {
          // Region no longer has active drivers - clear it
          batch.set(doc.ref, {
            regionId: doc.id,
            drivers: [],
            driverCount: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          clearedRegions++;
        }
      });

      await batch.commit();

      const elapsed = Date.now() - startTime;
      console.log(`✅ [RegionCache] Updated ${updatedRegions} regions, cleared ${clearedRegions} stale regions in ${elapsed}ms`);
      console.log(`📊 [RegionCache] Total drivers: ${activeDrivers.length}, Regions: ${regions.size}`);

    } catch (error) {
      console.error('❌ [RegionCache] Error updating regional caches:', error);
      throw error;
    }
  }
);

/**
 * HTTP endpoint for manual cache refresh (useful for testing/debugging)
 * Can be called via: curl -X POST https://europe-west3-{project}.cloudfunctions.net/manualRefreshRegionalCaches
 */
export const manualRefreshRegionalCaches = onRequest(
  { region: 'europe-west3' },
  async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      const db = admin.firestore();
      const startTime = Date.now();

      // Same logic as scheduled function
      const driversSnap = await db.collection('driverLocations')
        .where('isOnline', '==', true)
        .get();

      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const activeDrivers = driversSnap.docs.filter(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate?.() || data.timestamp;
        return timestamp && timestamp > twoMinutesAgo;
      });

      const regions = new Map<string, DriverSummary[]>();

      activeDrivers.forEach(doc => {
        const data = doc.data();
        let prefix = data.geohashPrefix;
        if (!prefix && data.location?.latitude && data.location?.longitude) {
          prefix = geohashForLocation([data.location.latitude, data.location.longitude], 4);
        }
        if (!prefix) return;

        if (!regions.has(prefix)) {
          regions.set(prefix, []);
        }

        // Preserve driver's original timestamp
        const driverTimestamp = data.timestamp?.toDate?.() || data.updatedAt?.toDate?.() || new Date();
        const summary: DriverSummary = {
          id: doc.id,
          lat: data.location.latitude,
          lng: data.location.longitude,
          ts: Math.floor(driverTimestamp.getTime() / 1000)
        };
        // Only include heading if available (Firestore doesn't allow undefined)
        if (data.heading !== undefined && data.heading !== null) {
          summary.heading = data.heading;
        }
        regions.get(prefix)!.push(summary);
      });

      const batch = db.batch();
      for (const [regionId, drivers] of regions) {
        const cacheRef = db.collection('nearbyDriversCache').doc(regionId);
        batch.set(cacheRef, {
          regionId,
          drivers,
          driverCount: drivers.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      await batch.commit();

      const elapsed = Date.now() - startTime;

      res.json({
        success: true,
        stats: {
          totalOnlineDrivers: driversSnap.size,
          activeDrivers: activeDrivers.length,
          regions: regions.size,
          elapsedMs: elapsed
        }
      });
    } catch (error) {
      console.error('❌ [RegionCache] Manual refresh error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get regional cache statistics (for monitoring/debugging)
 */
export const getRegionalCacheStats = onCall(
  { region: 'europe-west3' },
  async () => {
    const db = admin.firestore();

    try {
      const cachesSnap = await db.collection('nearbyDriversCache').get();

      let totalDrivers = 0;
      let activeRegions = 0;
      const regionStats: { regionId: string; driverCount: number }[] = [];

      cachesSnap.forEach(doc => {
        const cache = doc.data();
        const count = cache.driverCount || 0;
        totalDrivers += count;
        if (count > 0) {
          activeRegions++;
          regionStats.push({
            regionId: doc.id,
            driverCount: count
          });
        }
      });

      // Sort by driver count descending
      regionStats.sort((a, b) => b.driverCount - a.driverCount);

      return {
        totalRegions: cachesSnap.size,
        activeRegions,
        totalDrivers,
        topRegions: regionStats.slice(0, 10) // Top 10 busiest regions
      };
    } catch (error) {
      console.error('❌ [RegionCache] Stats error:', error);
      throw new HttpsError('internal', 'Failed to get stats');
    }
  }
);
