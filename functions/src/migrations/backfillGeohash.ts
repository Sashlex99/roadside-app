/**
 * One-time migration script to backfill geohash fields on existing driver locations
 *
 * Run via: curl -X POST https://europe-west3-{project}.cloudfunctions.net/backfillDriverGeohash
 *
 * This adds geohash and geohashPrefix to all existing driverLocations documents
 * that don't already have them.
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { geohashForLocation } from 'geofire-common';

export const backfillDriverGeohash = onRequest(
  { region: 'europe-west3', timeoutSeconds: 540, memory: '512MiB' },
  async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed. Use POST.');
      return;
    }

    const db = admin.firestore();
    const startTime = Date.now();

    try {
      console.log('🔄 [Migration] Starting geohash backfill...');

      // Get all driver locations
      const snapshot = await db.collection('driverLocations').get();

      console.log(`📊 [Migration] Found ${snapshot.size} driver location documents`);

      let updated = 0;
      let skipped = 0;
      let errors = 0;

      // Process in batches of 500 (Firestore batch limit)
      const BATCH_SIZE = 500;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skip if already has geohash
        if (data.geohash && data.geohashPrefix) {
          skipped++;
          continue;
        }

        // Skip if no valid location
        if (!data.location?.latitude || !data.location?.longitude) {
          console.warn(`⚠️ [Migration] Document ${doc.id} has no valid location, skipping`);
          skipped++;
          continue;
        }

        try {
          // Compute geohash
          const geohash = geohashForLocation(
            [data.location.latitude, data.location.longitude],
            9
          );
          const geohashPrefix = geohash.substring(0, 4);

          // Add to batch
          batch.update(doc.ref, {
            geohash,
            geohashPrefix
          });

          updated++;
          batchCount++;

          // Commit batch when full
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`✅ [Migration] Committed batch of ${batchCount} updates`);
            batch = db.batch();
            batchCount = 0;
          }
        } catch (err) {
          console.error(`❌ [Migration] Error processing ${doc.id}:`, err);
          errors++;
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`✅ [Migration] Committed final batch of ${batchCount} updates`);
      }

      const elapsed = Date.now() - startTime;

      const result = {
        success: true,
        stats: {
          total: snapshot.size,
          updated,
          skipped,
          errors,
          elapsedMs: elapsed
        }
      };

      console.log('✅ [Migration] Geohash backfill complete:', result);

      res.json(result);
    } catch (error) {
      console.error('❌ [Migration] Backfill failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);
