/**
 * Client-side service for bid operations via Cloud Functions
 *
 * This service provides a clean interface to call server-side
 * bid operations that handle:
 * - Atomic transactions
 * - Driver locking
 * - Conflict resolution
 * - Proper timeout handling
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

// ============================================================
// TYPES
// ============================================================

export interface ReserveBidRequest {
  orderId: string;
  bidId: string;
}

export interface ReserveBidResponse {
  success: boolean;
  reservationId: string;
  driverId: string;
  bidAmount: number;
  expiresAt: string;
}

export interface ConfirmBidRequest {
  orderId: string;
  bidId: string;
  paymentIntentId?: string;
  paymentLinkId?: string;
}

export interface ConfirmBidResponse {
  success: boolean;
  orderId: string;
  acceptedDriverId: string;
}

export interface CancelReservationRequest {
  orderId: string;
  bidId: string;
  reason?: string;
}

export interface CancelReservationResponse {
  success: boolean;
  message: string;
}

export interface RestoreDriverBidsRequest {
  driverId: string;
  orderId: string;
}

export interface RestoreDriverBidsResponse {
  success: boolean;
  restoredCount: number;
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Reserve a bid for payment
 *
 * This calls the server-side reserveBid Cloud Function which:
 * - Validates bid and order state
 * - Acquires driver lock atomically
 * - Reserves the bid in a single transaction
 * - Has proper server-side timeout (30 seconds)
 *
 * @param orderId - ID of the order
 * @param bidId - ID of the bid to reserve
 * @returns Promise with reservation details
 */
export const reserveBidViaCloudFunction = async (
  orderId: string,
  bidId: string
): Promise<ReserveBidResponse> => {
  const startTime = Date.now();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 [CLOUD FUNCTION] reserveBid - START');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Order ID: ${orderId}`);
  console.log(`📋 Bid ID: ${bidId}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log('📡 Sending request to Cloud Function...');

  try {
    const reserveBidFn = httpsCallable<ReserveBidRequest, ReserveBidResponse>(
      functions,
      'reserveBid'
    );

    console.log('⏳ Waiting for server response (timeout: 30s)...');
    const result = await reserveBidFn({ orderId, bidId });
    const duration = Date.now() - startTime;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [CLOUD FUNCTION] reserveBid - SUCCESS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🎫 Reservation ID: ${result.data.reservationId}`);
    console.log(`👤 Driver ID: ${result.data.driverId}`);
    console.log(`💰 Bid Amount: ${result.data.bidAmount} EUR`);
    console.log(`⏰ Expires at: ${result.data.expiresAt}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return result.data;

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ [CLOUD FUNCTION] reserveBid - FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🔴 Error Code: ${error?.code || 'unknown'}`);
    console.log(`🔴 Error Message: ${error?.message || 'Unknown error'}`);
    console.log(`🔴 Full Error:`, JSON.stringify(error, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Extract meaningful error message
    const errorMessage = extractErrorMessage(error);
    throw new Error(errorMessage);
  }
};

/**
 * Confirm a bid after successful payment
 *
 * This calls the server-side confirmBid Cloud Function which:
 * - Validates the reserved bid
 * - Confirms the bid and updates order
 * - Resolves driver conflicts (cancels other bids)
 * - Releases driver lock
 *
 * @param orderId - ID of the order
 * @param bidId - ID of the bid to confirm
 * @param paymentIntentId - Optional Stripe payment intent ID
 * @param paymentLinkId - Optional payment link ID
 * @returns Promise with confirmation result
 */
export const confirmBidViaCloudFunction = async (
  orderId: string,
  bidId: string,
  paymentIntentId?: string,
  paymentLinkId?: string
): Promise<ConfirmBidResponse> => {
  const startTime = Date.now();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 [CLOUD FUNCTION] confirmBid - START');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Order ID: ${orderId}`);
  console.log(`📋 Bid ID: ${bidId}`);
  console.log(`💳 Payment Intent: ${paymentIntentId || 'N/A'}`);
  console.log(`🔗 Payment Link: ${paymentLinkId || 'N/A'}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log('📡 Sending request to Cloud Function...');

  try {
    const confirmBidFn = httpsCallable<ConfirmBidRequest, ConfirmBidResponse>(
      functions,
      'confirmBid'
    );

    console.log('⏳ Waiting for server response (timeout: 30s)...');
    const result = await confirmBidFn({
      orderId,
      bidId,
      paymentIntentId,
      paymentLinkId
    });
    const duration = Date.now() - startTime;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [CLOUD FUNCTION] confirmBid - SUCCESS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📋 Order ID: ${result.data.orderId}`);
    console.log(`👤 Accepted Driver: ${result.data.acceptedDriverId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return result.data;

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ [CLOUD FUNCTION] confirmBid - FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🔴 Error Code: ${error?.code || 'unknown'}`);
    console.log(`🔴 Error Message: ${error?.message || 'Unknown error'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const errorMessage = extractErrorMessage(error);
    throw new Error(errorMessage);
  }
};

/**
 * Cancel a bid reservation
 *
 * This calls the server-side cancelBidReservation Cloud Function which:
 * - Validates the reserved bid
 * - Reverts bid to pending status
 * - Reverts order status
 * - Releases driver lock
 *
 * @param orderId - ID of the order
 * @param bidId - ID of the bid to cancel
 * @param reason - Optional cancellation reason
 * @returns Promise with cancellation result
 */
export const cancelBidReservationViaCloudFunction = async (
  orderId: string,
  bidId: string,
  reason?: string
): Promise<CancelReservationResponse> => {
  const startTime = Date.now();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚫 [CLOUD FUNCTION] cancelBidReservation - START');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Order ID: ${orderId}`);
  console.log(`📋 Bid ID: ${bidId}`);
  console.log(`📝 Reason: ${reason || 'Not specified'}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log('📡 Sending request to Cloud Function...');

  try {
    const cancelBidFn = httpsCallable<CancelReservationRequest, CancelReservationResponse>(
      functions,
      'cancelBidReservation'
    );

    console.log('⏳ Waiting for server response (timeout: 30s)...');
    const result = await cancelBidFn({
      orderId,
      bidId,
      reason
    });
    const duration = Date.now() - startTime;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [CLOUD FUNCTION] cancelBidReservation - SUCCESS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📝 Message: ${result.data.message}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return result.data;

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ [CLOUD FUNCTION] cancelBidReservation - FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🔴 Error Code: ${error?.code || 'unknown'}`);
    console.log(`🔴 Error Message: ${error?.message || 'Unknown error'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const errorMessage = extractErrorMessage(error);
    throw new Error(errorMessage);
  }
};

/**
 * Restore bids for a driver after order cancellation
 *
 * When an order is cancelled, this restores any bids that were
 * cancelled due to driver conflict resolution.
 *
 * @param driverId - ID of the driver
 * @param orderId - ID of the cancelled order
 * @returns Promise with restoration result
 */
export const restoreDriverBidsViaCloudFunction = async (
  driverId: string,
  orderId: string
): Promise<RestoreDriverBidsResponse> => {
  const startTime = Date.now();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 [CLOUD FUNCTION] restoreDriverBids - START');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`👤 Driver ID: ${driverId}`);
  console.log(`📋 Order ID: ${orderId}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log('📡 Sending request to Cloud Function...');

  try {
    const restoreBidsFn = httpsCallable<RestoreDriverBidsRequest, RestoreDriverBidsResponse>(
      functions,
      'restoreDriverBids'
    );

    console.log('⏳ Waiting for server response (timeout: 30s)...');
    const result = await restoreBidsFn({
      driverId,
      orderId
    });
    const duration = Date.now() - startTime;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [CLOUD FUNCTION] restoreDriverBids - SUCCESS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🔢 Restored count: ${result.data.restoredCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return result.data;

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ [CLOUD FUNCTION] restoreDriverBids - FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🔴 Error Code: ${error?.code || 'unknown'}`);
    console.log(`🔴 Error Message: ${error?.message || 'Unknown error'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const errorMessage = extractErrorMessage(error);
    throw new Error(errorMessage);
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Extract a user-friendly error message from Cloud Function errors
 */
function extractErrorMessage(error: any): string {
  // Firebase Functions errors have a specific structure
  if (error.code) {
    // Common error codes and user-friendly messages
    const errorMessages: Record<string, string> = {
      'unauthenticated': 'You must be logged in to perform this action',
      'permission-denied': 'You do not have permission to perform this action',
      'not-found': 'The requested resource was not found',
      'failed-precondition': error.message || 'Operation cannot be performed in current state',
      'invalid-argument': error.message || 'Invalid input provided',
      'internal': 'An internal error occurred. Please try again.',
      'unavailable': 'Service temporarily unavailable. Please try again.',
      'deadline-exceeded': 'Operation timed out. Please try again.',
    };

    // Check if we have a custom message for this code
    const friendlyMessage = errorMessages[error.code.replace('functions/', '')];
    if (friendlyMessage) {
      return friendlyMessage;
    }
  }

  // If error has a message, use it
  if (error.message) {
    // Clean up Firebase-specific prefixes
    return error.message
      .replace(/^INTERNAL:\s*/, '')
      .replace(/^functions\/[a-z-]+:\s*/i, '');
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if an error is a specific type
 */
export function isDriverLockError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  return message.includes('driver is currently locked') ||
         message.includes('lock') && message.includes('another order');
}

export function isBidNotPendingError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  return message.includes('bid is not pending');
}

export function isOrderNotValidError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  return message.includes('order is not in valid state') ||
         message.includes('order is not in payment_pending');
}

console.log('🔧 Bid operations client service initialized');
