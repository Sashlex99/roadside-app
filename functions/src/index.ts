// Order trigger functions
export { onOrderCreate } from './ordersOnCreate';

// Push notification functions
export { onBidCreateNotification, onBidAcceptedNotification, sendTestNotification } from './notifications';

// Payment functions
export { createPaymentIntent, processPayment, handleStripeWebhook, createPaymentLink } from './payments';
export { createPaymentLinkHTTP, createPaymentLinkTest, handlePaymentLinkWebhook, verifyPaymentLink } from './customPayments';

// Driver lock cleanup functions (v2 scheduled - now fixed with correct region)
export {
  cleanupExpiredDriverLocks,
  manualCleanupDriverLocks,
  getDriverLockStats
} from './cleanupDriverLocks';

// Regional cache functions (N+1 optimization for nearby drivers)
export {
  updateRegionalCaches,
  manualRefreshRegionalCaches,
  getRegionalCacheStats
} from './regionCacheUpdater';

// Driver status change triggers (instant online/offline detection)
export {
  onDriverStatusChange,
  onDriverLocationCreated
} from './driverOfflineTrigger';

// Migration functions (one-time use)
export { backfillDriverGeohash } from './migrations/backfillGeohash';

// Admin utility functions (diagnostics)
export { checkDuplicateOrders, getDatabaseStats } from './adminUtils';

// Bid operations (server-side atomic transactions)
export {
  reserveBid,
  confirmBid,
  cancelBidReservation,
  restoreDriverBids
} from './bidOperations';
