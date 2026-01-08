/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

export { onOrderCreate } from './ordersOnCreate';

// Push notification functions  
export { onBidCreateNotification, sendTestNotification } from './notifications';

// Payment functions
export { createPaymentIntent, processPayment, handleStripeWebhook, createPaymentLink } from './payments';
export { createPaymentLinkHTTP, createPaymentLinkTest, handlePaymentLinkWebhook } from './customPayments';

// 🧹 Driver lock cleanup functions
// TEMPORARILY DISABLED - Firebase v2 scheduled functions have container issues
// TODO: Fix initialization and re-enable
// export {
//   cleanupExpiredDriverLocks,
//   manualCleanupDriverLocks,
//   getDriverLockStats
// } from './cleanupDriverLocks';
