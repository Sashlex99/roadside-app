import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// Admin authentication check
async function verifyAdmin(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;

  try {
    const adminDoc = await db.collection('admins').doc(uid).get();
    return adminDoc.exists;
  } catch (error) {
    console.error('Error verifying admin:', error);
    return false;
  }
}

/**
 * Get dashboard statistics for admin panel
 */
export const adminGetStats = onCall(
  { region: 'europe-west1' },
  async (request) => {
    // Verify admin
    if (!(await verifyAdmin(request.auth?.uid))) {
      throw new HttpsError('permission-denied', 'Admin access required');
    }

    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const thisWeekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get counts in parallel
      const [
        driversSnapshot,
        ordersSnapshot,
        todayOrdersSnapshot,
        yesterdayOrdersSnapshot,
        weekOrdersSnapshot,
        monthOrdersSnapshot,
      ] = await Promise.all([
        db.collection('driverLocations').get(),
        db.collection('orders').get(),
        db.collection('orders')
          .where('createdAt', '>=', Timestamp.fromDate(today))
          .get(),
        db.collection('orders')
          .where('createdAt', '>=', Timestamp.fromDate(yesterday))
          .where('createdAt', '<', Timestamp.fromDate(today))
          .get(),
        db.collection('orders')
          .where('createdAt', '>=', Timestamp.fromDate(thisWeekStart))
          .get(),
        db.collection('orders')
          .where('createdAt', '>=', Timestamp.fromDate(thisMonthStart))
          .get(),
      ]);

      // Calculate driver stats
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
      let onlineDrivers = 0;
      let busyDrivers = 0;

      driversSnapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate() || data.updatedAt?.toDate();
        if (data.isOnline && timestamp && timestamp > twoMinutesAgo) {
          onlineDrivers++;
          if (data.orderId) {
            busyDrivers++;
          }
        }
      });

      // Calculate order stats
      let pendingOrders = 0;
      let activeOrders = 0;
      let completedOrders = 0;
      let cancelledOrders = 0;
      let totalRevenue = 0;

      ordersSnapshot.forEach((doc) => {
        const data = doc.data();
        switch (data.status) {
          case 'pending':
          case 'searching':
          case 'bidding':
          case 'payment_pending':
            pendingOrders++;
            break;
          case 'accepted':
          case 'in_progress':
            activeOrders++;
            break;
          case 'completed':
            completedOrders++;
            if (data.acceptedPrice) {
              totalRevenue += data.acceptedPrice;
            }
            break;
          case 'cancelled':
          case 'expired':
            cancelledOrders++;
            break;
        }
      });

      // Calculate period-specific stats
      const calculatePeriodStats = (snapshot: admin.firestore.QuerySnapshot) => {
        let completed = 0;
        let cancelled = 0;
        let revenue = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.status === 'completed') {
            completed++;
            if (data.acceptedPrice) {
              revenue += data.acceptedPrice;
            }
          } else if (data.status === 'cancelled' || data.status === 'expired') {
            cancelled++;
          }
        });

        return { completed, cancelled, revenue, total: snapshot.size };
      };

      const todayStats = calculatePeriodStats(todayOrdersSnapshot);
      const yesterdayStats = calculatePeriodStats(yesterdayOrdersSnapshot);
      const weekStats = calculatePeriodStats(weekOrdersSnapshot);
      const monthStats = calculatePeriodStats(monthOrdersSnapshot);

      return {
        drivers: {
          total: driversSnapshot.size,
          online: onlineDrivers,
          busy: busyDrivers,
          available: onlineDrivers - busyDrivers,
        },
        orders: {
          total: ordersSnapshot.size,
          pending: pendingOrders,
          active: activeOrders,
          completed: completedOrders,
          cancelled: cancelledOrders,
        },
        today: todayStats,
        yesterday: yesterdayStats,
        thisWeek: weekStats,
        thisMonth: monthStats,
        revenue: {
          total: totalRevenue,
          today: todayStats.revenue,
          thisWeek: weekStats.revenue,
          thisMonth: monthStats.revenue,
        },
        timestamp: now.toISOString(),
      };
    } catch (error: any) {
      console.error('Error getting admin stats:', error);
      throw new HttpsError('internal', error.message || 'Failed to get stats');
    }
  }
);

/**
 * Get recent orders with pagination for admin panel
 */
export const adminGetOrders = onCall(
  { region: 'europe-west1' },
  async (request) => {
    // Verify admin
    if (!(await verifyAdmin(request.auth?.uid))) {
      throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { status, limit: reqLimit = 50, startAfter } = request.data || {};
    const queryLimit = Math.min(reqLimit, 100);

    try {
      let query = db.collection('orders')
        .orderBy('createdAt', 'desc')
        .limit(queryLimit);

      if (status && status !== 'all') {
        query = db.collection('orders')
          .where('status', '==', status)
          .orderBy('createdAt', 'desc')
          .limit(queryLimit);
      }

      if (startAfter) {
        const startDoc = await db.collection('orders').doc(startAfter).get();
        if (startDoc.exists) {
          query = query.startAfter(startDoc);
        }
      }

      const snapshot = await query.get();
      const orders: any[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientInfo?.name || data.clientName,
          clientPhone: data.clientInfo?.phone || data.clientPhone,
          status: data.status,
          description: data.description,
          location: data.location,
          createdAt: data.createdAt?.toDate?.().toISOString(),
          updatedAt: data.updatedAt?.toDate?.().toISOString(),
          acceptedDriverId: data.acceptedDriverId,
          acceptedDriverName: data.acceptedDriverName,
          acceptedPrice: data.acceptedPrice,
          bidsCount: data.bidsCount,
          serviceType: data.serviceType,
        });
      });

      return {
        orders,
        hasMore: orders.length === queryLimit,
        lastId: orders.length > 0 ? orders[orders.length - 1].id : null,
      };
    } catch (error: any) {
      console.error('Error getting admin orders:', error);
      throw new HttpsError('internal', error.message || 'Failed to get orders');
    }
  }
);

/**
 * Get order details with bids for admin panel
 */
export const adminGetOrderDetails = onCall(
  { region: 'europe-west1' },
  async (request) => {
    // Verify admin
    if (!(await verifyAdmin(request.auth?.uid))) {
      throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { orderId } = request.data || {};
    if (!orderId) {
      throw new HttpsError('invalid-argument', 'Order ID is required');
    }

    try {
      // Get order
      const orderDoc = await db.collection('orders').doc(orderId).get();
      if (!orderDoc.exists) {
        throw new HttpsError('not-found', 'Order not found');
      }

      const orderData = orderDoc.data()!;

      // Get bids
      const bidsSnapshot = await db.collection('orders').doc(orderId)
        .collection('bids')
        .orderBy('createdAt', 'desc')
        .get();

      const bids: any[] = [];
      bidsSnapshot.forEach((doc) => {
        const data = doc.data();
        bids.push({
          id: doc.id,
          driverId: data.driverId,
          driverName: data.driverName,
          driverPhone: data.driverPhone,
          price: data.price,
          estimatedArrival: data.estimatedArrival,
          note: data.note,
          status: data.status,
          createdAt: data.createdAt?.toDate?.().toISOString(),
          acceptedAt: data.acceptedAt?.toDate?.().toISOString(),
        });
      });

      // Get client info
      let clientInfo = null;
      if (orderData.clientId) {
        const clientDoc = await db.collection('users').doc(orderData.clientId).get();
        if (clientDoc.exists) {
          const clientData = clientDoc.data()!;
          clientInfo = {
            id: clientDoc.id,
            name: clientData.name,
            phone: clientData.phone,
            email: clientData.email,
          };
        }
      }

      // Get driver info
      let driverInfo = null;
      if (orderData.acceptedDriverId) {
        const driverDoc = await db.collection('drivers').doc(orderData.acceptedDriverId).get();
        if (driverDoc.exists) {
          const driverData = driverDoc.data()!;
          driverInfo = {
            id: driverDoc.id,
            name: driverData.name,
            phone: driverData.phone,
            vehicleInfo: driverData.vehicleInfo,
          };
        }
      }

      return {
        order: {
          id: orderDoc.id,
          ...orderData,
          createdAt: orderData.createdAt?.toDate?.().toISOString(),
          updatedAt: orderData.updatedAt?.toDate?.().toISOString(),
          completedAt: orderData.completedAt?.toDate?.().toISOString(),
        },
        bids,
        clientInfo,
        driverInfo,
      };
    } catch (error: any) {
      console.error('Error getting order details:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Failed to get order details');
    }
  }
);

/**
 * Cancel an order (admin action)
 */
export const adminCancelOrder = onCall(
  { region: 'europe-west1' },
  async (request) => {
    // Verify admin
    if (!(await verifyAdmin(request.auth?.uid))) {
      throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { orderId, reason } = request.data || {};
    if (!orderId) {
      throw new HttpsError('invalid-argument', 'Order ID is required');
    }

    try {
      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        throw new HttpsError('not-found', 'Order not found');
      }

      const orderData = orderDoc.data()!;

      // Can't cancel completed orders
      if (orderData.status === 'completed') {
        throw new HttpsError('failed-precondition', 'Cannot cancel completed orders');
      }

      // Update order status
      await orderRef.update({
        status: 'cancelled',
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: 'admin',
        cancellationReason: reason || 'Cancelled by admin',
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Create system alert for audit trail
      await db.collection('systemAlerts').add({
        type: 'info',
        service: 'admin',
        message: `Order ${orderId.slice(-8)} cancelled by admin: ${reason || 'No reason provided'}`,
        timestamp: FieldValue.serverTimestamp(),
        resolved: true,
        resolvedAt: FieldValue.serverTimestamp(),
      });

      return { success: true, orderId };
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Failed to cancel order');
    }
  }
);

/**
 * Log system alert (for monitoring)
 */
export const logSystemAlert = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const { type, service, message } = request.data || {};

    if (!type || !service || !message) {
      throw new HttpsError('invalid-argument', 'Type, service, and message are required');
    }

    try {
      await db.collection('systemAlerts').add({
        type,
        service,
        message,
        timestamp: FieldValue.serverTimestamp(),
        resolved: false,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error logging system alert:', error);
      throw new HttpsError('internal', error.message || 'Failed to log alert');
    }
  }
);

/**
 * Resolve a system alert
 */
export const resolveSystemAlert = onCall(
  { region: 'europe-west1' },
  async (request) => {
    // Verify admin
    if (!(await verifyAdmin(request.auth?.uid))) {
      throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { alertId } = request.data || {};
    if (!alertId) {
      throw new HttpsError('invalid-argument', 'Alert ID is required');
    }

    try {
      await db.collection('systemAlerts').doc(alertId).update({
        resolved: true,
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: request.auth?.uid,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error resolving alert:', error);
      throw new HttpsError('internal', error.message || 'Failed to resolve alert');
    }
  }
);
