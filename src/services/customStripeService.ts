/**
 * Custom Stripe Service that uses AuthContext token
 * This bypasses Firebase Auth and uses direct HTTP calls to Cloud Functions
 */

import { appConfig } from '../config/environment';

export interface PaymentLinkData {
  orderId: string;
  amount: number; // Platform fee amount in BGN
  driverName: string;
  redirectUrl?: string; // Optional custom redirect URL after payment success
}

export interface PaymentLinkResponse {
  success: boolean;
  paymentUrl: string;
  paymentLinkId: string;
}

/**
 * Creates a payment link using direct HTTP call to Cloud Function
 * This bypasses Firebase Auth authentication issues
 */
export async function createPaymentLinkWithToken(
  data: PaymentLinkData, 
  authToken: string,
  userId: string
): Promise<PaymentLinkResponse> {
  try {
    console.log('🔗 Creating payment link with custom token:', data);
    
    const functionUrl = `https://us-central1-${appConfig.FIREBASE_PROJECT_ID}.cloudfunctions.net/createPaymentLinkTest`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        data: {
          ...data,
          userId,
        }
      })
    });
    
    console.log('📨 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HTTP Error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Payment link created via HTTP:', result);
    
    // Extract the actual result from Cloud Function response format
    const paymentLinkResult = result.result || result.data || result;
    
    return paymentLinkResult as PaymentLinkResponse;
  } catch (error) {
    console.error('❌ Error creating payment link via HTTP:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to create payment link: ${error.message}`
        : 'Failed to create payment link'
    );
  }
} 