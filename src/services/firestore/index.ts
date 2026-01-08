// Main Firestore Service Index
// Re-exports all functions from split modules for backward compatibility

// Export collections constant
export { COLLECTIONS } from './orders';

// Order Operations
export {
  createOrder,
  createOrderWithFirebaseBugWorkaround,
  createOrderWithRetry,
  findRecentOrdersByClient,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  validateAndFixDriverAvailability,
  cleanupOrphanedReservedBids,
  findOrdersInRadius,
  subscribeToClientOrders,
  getActiveOrders,
  getAcceptedOrdersForDriver
} from './orders';

// Bid Operations
export {
  createBid,
  getBidsForOrder,
  reserveBid,
  confirmBid,
  cancelBidReservation,
  acceptBid,
  subscribeToBidsForOrder
} from './bids';

// User Operations
export {
  getUser,
  getOnlineDriversCount,
  subscribeToOnlineDriversCount,
  updateDriverOnlineStatus,
  ensureFirebaseAuth
} from './users';

// Location Operations
export {
  updateDriverLocation,
  getDriverLocation
} from './locations';

// Migration Operations
export {
  scanUserDocumentsForImageIssues,
  fixUserDocumentImages,
  batchMigrateUserDocumentImages
} from './migrations';

// Analytics Operations
export {
  createOrderAnalytics,
  getOrderAnalytics,
  getAnalyticsSummary
} from './analytics'; 