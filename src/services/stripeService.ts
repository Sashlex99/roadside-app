import { httpsCallable, getFunctions } from 'firebase/functions';
import { auth } from '../config/firebase';
import Constants from 'expo-constants';

// Get functions instance with correct region
const functions = getFunctions(auth.app, 'us-central1');

// Types for payment data
export interface PaymentIntentData {
  orderId: string;
  bidId: string;
  bidAmount: number;
  driverId: string;
  clientId: string;
}

export interface PaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  platformFee: number;
  bidAmount: number;
}

export interface PaymentProcessData {
  paymentIntentId: string;
  orderId: string;
  bidId: string;
}

export interface PaymentProcessResponse {
  success: boolean;
  orderId: string;
  bidId: string;
  paymentIntentId: string;
  paidAmount: number;
}

/**
 * Payment Link Types - New approach for platform fees
 */
export interface PaymentLinkData {
  orderId: string;
  amount: number; // Platform fee amount in BGN
  driverName: string;
}

export interface PaymentLinkResponse {
  success: boolean;
  paymentUrl: string;
  paymentLinkId: string;
}

/**
 * Creates a payment intent for order payment
 * @param data Payment intent data
 * @returns Payment intent response with client secret
 */
export async function createPaymentIntent(data: PaymentIntentData): Promise<PaymentIntentResponse> {
  try {
    console.log('💳 Creating payment intent:', data);
    
    const createPaymentIntentFunction = httpsCallable(functions, 'createPaymentIntent');
    const result = await createPaymentIntentFunction(data);
    
    const response = result.data as PaymentIntentResponse;
    
    console.log('✅ Payment intent created:', {
      paymentIntentId: response.paymentIntentId,
      amount: response.amount,
      platformFee: response.platformFee
    });
    
    return response;
  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to create payment intent: ${error.message}`
        : 'Failed to create payment intent'
    );
  }
}

/**
 * Processes a successful payment
 * @param data Payment processing data
 * @returns Payment processing response
 */
export async function processPayment(data: PaymentProcessData): Promise<PaymentProcessResponse> {
  try {
    console.log('🔄 Processing payment:', data);
    
    const processPaymentFunction = httpsCallable(functions, 'processPayment');
    const result = await processPaymentFunction(data);
    
    const response = result.data as PaymentProcessResponse;
    
    console.log('✅ Payment processed successfully:', response);
    
    return response;
  } catch (error) {
    console.error('❌ Error processing payment:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to process payment: ${error.message}`
        : 'Failed to process payment'
    );
  }
}

/**
 * Calculates platform fee and total amount
 * @param bidAmount Bid amount in BGN
 * @param feePercentage Platform fee percentage (default: 15%)
 * @returns Calculation breakdown
 */
export function calculatePaymentAmounts(bidAmount: number, feePercentage: number = 15) {
  const platformFee = Math.round(bidAmount * (feePercentage / 100));
  const totalAmount = bidAmount + platformFee;
  
  return {
    bidAmount,
    platformFee,
    totalAmount,
    feePercentage
  };
}

/**
 * Formats amount for display
 * @param amount Amount in BGN
 * @returns Formatted string (e.g., "50.00 лв")
 */
export function formatAmount(amount: number): string {
  return `${amount.toFixed(2)} лв`;
}

/**
 * Gets Stripe publishable key from app config
 * @returns Stripe publishable key
 */
export function getStripePublishableKey(): string {
  // 1) Try to read from app.json extra (easier for non-devs)
  const keyFromExtra = (Constants?.expoConfig as any)?.extra?.stripe?.publishableKey;
  if (keyFromExtra && typeof keyFromExtra === 'string') {
    return keyFromExtra;
  }

  // 2) Fallback: always return Stripe public test key so the app "just works" in test-mode
  return 'pk_test_51XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
}

/**
 * Validates payment amount
 * @param amount Amount to validate
 * @returns True if valid, false otherwise
 */
export function validatePaymentAmount(amount: number): boolean {
  // Minimum amount: 1 BGN, Maximum: 10000 BGN
  return amount >= 1 && amount <= 10000 && Number.isFinite(amount);
}

/**
 * Payment error handler
 * @param error Error object
 * @returns User-friendly error message
 */
export function handlePaymentError(error: any): string {
  if (error?.code) {
    switch (error.code) {
      case 'card_declined':
        return 'Картата беше отхвърлена. Моля, опитайте с друга карта.';
      case 'insufficient_funds':
        return 'Недостатъчни средства по картата.';
      case 'expired_card':
        return 'Картата е изтекла. Моля, опитайте с друга карта.';
      case 'incorrect_cvc':
        return 'Неправилен CVC код.';
      case 'processing_error':
        return 'Възникна грешка при обработката. Моля, опитайте отново.';
      case 'authentication_required':
        return 'Изисква се допълнителна автентификация.';
      default:
        return 'Възникна грешка при плащането. Моля, опитайте отново.';
    }
  }
  
  return error?.message || 'Възникна неочаквана грешка при плащането.';
}

/**
 * Creates a payment link for platform fee payment (15%)
 * This is the new preferred approach for handling payments
 * @param data Payment link data
 * @returns Payment link response with URL
 */
export async function createPaymentLink(data: PaymentLinkData): Promise<PaymentLinkResponse> {
  try {
    console.log('🔗 Creating payment link:', data);
    
    const createPaymentLinkFunction = httpsCallable(functions, 'createPaymentLink');
    const result = await createPaymentLinkFunction(data);
    
    const response = result.data as PaymentLinkResponse;
    
    console.log('✅ Payment link created:', {
      paymentLinkId: response.paymentLinkId,
      paymentUrl: response.paymentUrl
    });
    
    return response;
  } catch (error) {
    console.error('❌ Error creating payment link:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to create payment link: ${error.message}`
        : 'Failed to create payment link'
    );
  }
} 