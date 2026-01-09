import { useStripe, PresentPaymentSheetResult } from '@stripe/stripe-react-native';
import { useState } from 'react';
import { Platform } from 'react-native';
import { createPaymentIntent, processPayment } from '../services/stripeService';

interface StartPaymentParams {
  orderId: string;
  bidId: string;
  bidAmount: number;
  driverId: string;
  clientId: string;
}

interface PaymentSheetResult {
  success: boolean;
  cancelled?: boolean;
  errorMessage?: string;
}

/**
 * Payment Sheet hook with Apple Pay and Google Pay support
 * Uses Stripe Payment Sheet for native wallet payments
 */
export function usePaymentSheet() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  const startPaymentSheet = async (params: StartPaymentParams): Promise<PaymentSheetResult> => {
    try {
      setLoading(true);
      console.log('💳 Starting Payment Sheet with Apple Pay / Google Pay support');

      // 1. Create payment intent via Cloud Function (returns ephemeralKey + customerId)
      const intentResp = await createPaymentIntent({
        orderId: params.orderId,
        bidId: params.bidId,
        bidAmount: params.bidAmount,
        driverId: params.driverId,
        clientId: params.clientId,
      });

      console.log('✅ Payment Intent created:', {
        paymentIntentId: intentResp.paymentIntentId,
        hasEphemeralKey: !!intentResp.ephemeralKey,
        hasCustomerId: !!intentResp.customerId,
      });

      // 2. Init payment sheet with Apple Pay / Google Pay
      const initRes = await initPaymentSheet({
        merchantDisplayName: 'Пътна помощ',
        paymentIntentClientSecret: intentResp.clientSecret,
        customerEphemeralKeySecret: intentResp.ephemeralKey,
        customerId: intentResp.customerId,
        // Apple Pay configuration (iOS only)
        applePay: Platform.OS === 'ios' ? {
          merchantCountryCode: 'BG',
        } : undefined,
        // Google Pay configuration (Android only)
        googlePay: Platform.OS === 'android' ? {
          merchantCountryCode: 'BG',
          testEnv: __DEV__,
        } : undefined,
        defaultBillingDetails: {},
        returnURL: 'roadsideassistance://payment-complete',
        allowsDelayedPaymentMethods: false,
      });

      if (initRes.error) {
        console.error('❌ Payment Sheet init error:', initRes.error);
        return { success: false, errorMessage: initRes.error.message };
      }

      console.log('✅ Payment Sheet initialized, presenting...');

      // 3. Present sheet (shows Apple Pay, Google Pay, and card options)
      const presentRes: PresentPaymentSheetResult = await presentPaymentSheet();

      if (presentRes.error) {
        if (presentRes.error.code === 'Canceled') {
          console.log('ℹ️ Payment cancelled by user');
          return { success: false, cancelled: true };
        }
        console.error('❌ Payment Sheet present error:', presentRes.error);
        return { success: false, errorMessage: presentRes.error.message };
      }

      console.log('✅ Payment successful, confirming in backend...');

      // 4. Confirm payment in backend (updates order status etc.)
      await processPayment({
        paymentIntentId: intentResp.paymentIntentId,
        orderId: params.orderId,
        bidId: params.bidId,
      });

      console.log('✅ Payment completed and confirmed!');
      return { success: true };
    } catch (err: any) {
      console.error('❌ Payment Sheet error:', err);
      return { success: false, errorMessage: err?.message || 'Unknown error' };
    } finally {
      setLoading(false);
    }
  };

  return { startPaymentSheet, loading };
} 