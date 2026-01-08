import { useStripe, PresentPaymentSheetResult } from '@stripe/stripe-react-native';
import { useState } from 'react';
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

export function usePaymentSheet() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  const startPaymentSheet = async (params: StartPaymentParams): Promise<PaymentSheetResult> => {
    try {
      setLoading(true);
      // 1. Create payment intent via Cloud Function
      const intentResp = await createPaymentIntent({
        orderId: params.orderId,
        bidId: params.bidId,
        bidAmount: params.bidAmount,
        driverId: params.driverId,
        clientId: params.clientId,
      });

      // 2. Init payment sheet
      const initRes = await initPaymentSheet({
        merchantDisplayName: 'Пътна помощ',
        paymentIntentClientSecret: intentResp.clientSecret,
        defaultBillingDetails: {},
      });
      if (initRes.error) {
        return { success: false, errorMessage: initRes.error.message };
      }

      // 3. Present sheet
      const presentRes: PresentPaymentSheetResult = await presentPaymentSheet();
      if (presentRes.error) {
        if (presentRes.error.code === 'Canceled') {
          return { success: false, cancelled: true };
        }
        return { success: false, errorMessage: presentRes.error.message };
      }

      // 4. Confirm payment in backend (updates order status etc.)
      await processPayment({
        paymentIntentId: intentResp.paymentIntentId,
        orderId: params.orderId,
        bidId: params.bidId,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, errorMessage: err?.message || 'Unknown error' };
    } finally {
      setLoading(false);
    }
  };

  return { startPaymentSheet, loading };
} 