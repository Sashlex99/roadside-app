/**
 * Admin Utility Functions
 * Diagnostic and maintenance tools for the app
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Check for duplicate orders
 * Finds orders from the same client created within 2 minutes of each other
 *
 * Usage: curl https://checkduplicateorders-sqp2idjqxa-ey.a.run.app
 */
export const checkDuplicateOrders = onRequest(
  { region: 'europe-west3' },
  async (req, res) => {
    try {
      console.log('🔍 Checking for duplicate orders...');

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const snap = await db.collection('orders')
        .where('createdAt', '>=', thirtyDaysAgo)
        .orderBy('createdAt', 'desc')
        .get();

      console.log(`📊 Total orders in last 30 days: ${snap.size}`);

      // Group by clientId
      const byClient = new Map<string, Array<{
        id: string;
        createdAt: Date;
        status: string;
        description?: string;
      }>>();

      snap.forEach(doc => {
        const data = doc.data();
        const clientId = data.clientId;

        if (!byClient.has(clientId)) {
          byClient.set(clientId, []);
        }

        byClient.get(clientId)!.push({
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          status: data.status,
          description: data.description?.substring(0, 50)
        });
      });

      // Find potential duplicates (orders within 2 minutes)
      const duplicates: Array<{
        clientId: string;
        order1: { id: string; status: string; createdAt: string };
        order2: { id: string; status: string; createdAt: string };
        timeDiffSeconds: number;
      }> = [];

      byClient.forEach((orders, clientId) => {
        if (orders.length < 2) return;

        // Sort by creation time
        orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        for (let i = 0; i < orders.length - 1; i++) {
          const current = orders[i];
          const next = orders[i + 1];

          const timeDiff = (next.createdAt.getTime() - current.createdAt.getTime()) / 1000;

          // If created within 2 minutes of each other
          if (timeDiff < 120) {
            duplicates.push({
              clientId,
              order1: {
                id: current.id,
                status: current.status,
                createdAt: current.createdAt.toISOString()
              },
              order2: {
                id: next.id,
                status: next.status,
                createdAt: next.createdAt.toISOString()
              },
              timeDiffSeconds: Math.round(timeDiff)
            });
          }
        }
      });

      // Status breakdown
      const statusCounts: Record<string, number> = {};
      snap.forEach(doc => {
        const status = doc.data().status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const result = {
        totalOrders: snap.size,
        uniqueClients: byClient.size,
        duplicatesFound: duplicates.length,
        duplicates,
        statusBreakdown: statusCounts,
        checkedPeriod: '30 days',
        duplicateThreshold: '2 minutes'
      };

      console.log(`✅ Check complete. Found ${duplicates.length} potential duplicates.`);

      res.json(result);
    } catch (error) {
      console.error('❌ Error checking duplicates:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get database statistics
 * Returns counts and status of all major collections
 */
export const getDatabaseStats = onRequest(
  { region: 'europe-west3' },
  async (req, res) => {
    try {
      const stats: Record<string, any> = {};

      // Orders
      const ordersSnap = await db.collection('orders').count().get();
      stats.orders = { total: ordersSnap.data().count };

      // Users
      const usersSnap = await db.collection('users').count().get();
      stats.users = { total: usersSnap.data().count };

      // Bids
      const bidsSnap = await db.collection('bids').count().get();
      stats.bids = { total: bidsSnap.data().count };

      // Driver locations (online)
      const onlineDriversSnap = await db.collection('driverLocations')
        .where('isOnline', '==', true)
        .count().get();
      stats.onlineDrivers = onlineDriversSnap.data().count;

      // Regional caches
      const cachesSnap = await db.collection('nearbyDriversCache').count().get();
      stats.regionalCaches = cachesSnap.data().count;

      // Driver locks
      const locksSnap = await db.collection('driverLocks').count().get();
      stats.driverLocks = locksSnap.data().count;

      // Circuit breaker alerts
      const alertsSnap = await db.collection('circuitBreakerAlerts').count().get();
      stats.circuitBreakerAlerts = alertsSnap.data().count;

      res.json({
        timestamp: new Date().toISOString(),
        stats
      });
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);
