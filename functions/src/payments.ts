import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(
  functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
);

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// TypeScript interfaces
interface PaymentIntentData {
  orderId: string;
  bidId: string;
  bidAmount: number; // Amount in BGN (whole numbers, e.g., 50 for 50 лв)
  driverId: string;
  clientId: string;
}

interface PaymentProcessData {
  paymentIntentId: string;
  orderId: string;
  bidId: string;
}

interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  status: string;
}

/**
 * Creates a Stripe Payment Intent for order payment
 * Amount calculation: bidAmount + platformFee (15%)
 * Returns data needed for Payment Sheet (Apple Pay / Google Pay)
 */
export const createPaymentIntent = functions.https.onCall(
  async (data: PaymentIntentData, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to create payment intent'
      );
    }

    const { orderId, bidId, bidAmount, driverId, clientId } = data;

    try {
      // Validate input data
      if (!orderId || !bidId || !bidAmount || !driverId || !clientId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required payment data'
        );
      }

      // Verify the user is the client for this order
      const orderDoc = await admin.firestore()
        .collection('orders')
        .doc(orderId)
        .get();

      const order = orderDoc.data();
      if (!order || order.clientId !== context.auth.uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'User not authorized for this order'
        );
      }

      // Verify the bid exists (bids are stored in top-level 'bids' collection)
      const bidDoc = await admin.firestore()
        .collection('bids')
        .doc(bidId)
        .get();

      if (!bidDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Bid not found'
        );
      }

      // Calculate amounts (convert BGN to stotinki for Stripe)
      const platformFeePercentage = 15; // 15%
      const bidAmountInStotinki = bidAmount * 100;
      const platformFeeInStotinki = Math.round(bidAmountInStotinki * (platformFeePercentage / 100));
      const totalAmountInStotinki = bidAmountInStotinki + platformFeeInStotinki;

      // Convert back to BGN for display
      const platformFee = platformFeeInStotinki / 100;
      const totalAmount = totalAmountInStotinki / 100;

      console.log('💰 Payment calculation:', {
        bidAmount,
        platformFee,
        totalAmount,
        amountInStotinki: totalAmountInStotinki
      });

      // Get or create Stripe Customer for Payment Sheet
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(clientId)
        .get();

      const userData = userDoc.data();
      let customerId = userData?.stripeCustomerId;

      if (!customerId) {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: userData?.email || undefined,
          name: userData?.fullName || undefined,
          metadata: {
            firebaseUid: clientId,
            source: 'roadside-assistance-app'
          }
        });
        customerId = customer.id;

        // Save customer ID to user profile
        await admin.firestore()
          .collection('users')
          .doc(clientId)
          .update({
            stripeCustomerId: customerId,
            updatedAt: new Date()
          });

        console.log('👤 Created new Stripe customer:', customerId);
      }

      // Create ephemeral key for Payment Sheet
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2023-10-16' }
      );

      // Create Stripe Payment Intent with customer
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmountInStotinki,
        currency: 'eur',
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          orderId,
          bidId,
          driverId,
          clientId,
          bidAmount: bidAmount.toString(),
          platformFee: platformFee.toString(),
          source: 'roadside-assistance-app'
        },
        description: `Пътна помощ - Поръчка ${orderId}`,
      });

      // Save payment intent to Firestore
      await admin.firestore()
        .collection('payments')
        .doc(paymentIntent.id)
        .set({
          paymentIntentId: paymentIntent.id,
          orderId,
          bidId,
          driverId,
          clientId,
          customerId,
          bidAmount,
          platformFee,
          totalAmount,
          status: 'created',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      console.log('✅ Payment Intent created for Payment Sheet:', {
        paymentIntentId: paymentIntent.id,
        customerId,
        amount: totalAmount,
        orderId
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customerId,
        amount: totalAmount,
        platformFee,
        bidAmount
      };

    } catch (error) {
      console.error('❌ Error creating payment intent:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        'internal',
        'Failed to create payment intent'
      );
    }
  }
);

/**
 * Processes successful payment and updates order status
 */
export const processPayment = functions.https.onCall(
  async (data: PaymentProcessData, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to process payment'
      );
    }

    const { paymentIntentId, orderId, bidId } = data;

    try {
      // Validate input
      if (!paymentIntentId || !orderId || !bidId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required payment processing data'
        );
      }

      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Payment not successful. Status: ${paymentIntent.status}`
        );
      }

      // Update payment record
      await admin.firestore()
        .collection('payments')
        .doc(paymentIntentId)
        .update({
          status: 'succeeded',
          paidAt: new Date(),
          updatedAt: new Date(),
          stripePaymentIntentStatus: paymentIntent.status
        });

      // Update order status
      await admin.firestore()
        .collection('orders')
        .doc(orderId)
        .update({
          status: 'paid',
          acceptedBidId: bidId,
          paymentStatus: 'paid',
          paymentIntentId: paymentIntentId,
          finalPrice: paymentIntent.metadata.bidAmount ? parseInt(paymentIntent.metadata.bidAmount) : 0,
          platformFee: paymentIntent.metadata.platformFee ? parseInt(paymentIntent.metadata.platformFee) : 0,
          paidAt: new Date(),
          updatedAt: new Date(),
        });

      // Update bid status (bids are stored in top-level 'bids' collection)
      await admin.firestore()
        .collection('bids')
        .doc(bidId)
        .update({
          status: 'accepted',
          acceptedAt: new Date(),
          updatedAt: new Date(),
        });

      console.log('✅ Payment processed successfully:', {
        paymentIntentId,
        orderId,
        bidId,
        amount: paymentIntent.amount / 100
      });

      // TODO: Send notification to driver about accepted bid
      // This will be handled by the existing onBidAcceptedNotification trigger

      return {
        success: true,
        orderId,
        bidId,
        paymentIntentId,
        paidAmount: paymentIntent.amount / 100
      };

    } catch (error) {
      console.error('❌ Error processing payment:', error);
      
      // Update payment record with error
      if (paymentIntentId) {
        await admin.firestore()
          .collection('payments')
          .doc(paymentIntentId)
          .update({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date(),
          });
      }

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        'internal',
        'Failed to process payment'
      );
    }
  }
);

/**
 * Stripe webhook handler for payment events
 */
export const handleStripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('❌ Stripe webhook secret not configured');
    res.status(400).send('Webhook secret not configured');
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err);
    res.status(400).send(`Webhook Error: ${err}`);
    return;
  }

  console.log('📨 Stripe webhook received:', event.type);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(failedPayment);
        break;

      default:
        console.log(`🔔 Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error handling webhook:', error);
    res.status(500).send('Webhook handler failed');
  }
});

/**
 * Handle successful payment webhook
 */
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  
  console.log('✅ Payment succeeded webhook:', paymentIntentId);

  // Update payment record
  await admin.firestore()
    .collection('payments')
    .doc(paymentIntentId)
    .update({
      status: 'succeeded',
      webhookProcessedAt: new Date(),
      updatedAt: new Date(),
    });

  // Additional webhook-specific processing can be added here
}

/**
 * Handle failed payment webhook
 */
async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  
  console.log('❌ Payment failed webhook:', paymentIntentId);

  // Update payment record
  await admin.firestore()
    .collection('payments')
    .doc(paymentIntentId)
    .update({
      status: 'failed',
      webhookProcessedAt: new Date(),
      updatedAt: new Date(),
      failureReason: paymentIntent.last_payment_error?.message || 'Unknown failure'
    });

  // Reset order status if payment failed
  if (paymentIntent.metadata.orderId) {
    await admin.firestore()
      .collection('orders')
      .doc(paymentIntent.metadata.orderId)
      .update({
        status: 'bidding', // Reset to bidding status
        paymentStatus: 'failed',
        updatedAt: new Date(),
      });
  }
}

/**
 * Creates a Stripe Payment Link for platform fee payment
 * This is the new approach as requested by the project manager
 */
export const createPaymentLink = functions.https.onCall(async (data, context) => {
  // Validate authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { orderId, amount, driverName } = data;

  try {
    // Validate input data
    if (!orderId || !amount || !driverName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required payment link data: orderId, amount, driverName'
      );
    }

    // Verify the user is the client for this order
    const orderDoc = await admin.firestore()
      .collection('orders')
      .doc(orderId)
      .get();

    const order = orderDoc.data();
    if (!order || order.clientId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User not authorized for this order'
      );
    }

    console.log('💰 Creating payment link:', {
      orderId,
      amount,
      driverName,
      clientId: context.auth.uid
    });

    // Create payment link за 15% platform fee
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Такса платформа - Пътна помощ',
            description: `Услуга от ${driverName}`,
            images: ['https://i.imgur.com/EHyR2nP.png'], // Optional logo
          },
          unit_amount: Math.round(amount * 100), // Stripe uses cents/stotinki
        },
        quantity: 1,
      }] as any,
      metadata: {
        orderId,
        clientId: context.auth.uid,
        type: 'platform_fee',
        driverName
      },
      payment_method_types: ['card'],
      // Success redirect
      after_completion: {
        type: 'hosted_confirmation',
        hosted_confirmation: {
          custom_message: 'Благодарим! Платформената такса е платена успешно.'
        }
      }
    });

    // Log за debugging
    console.log('✅ Payment link created:', {
      paymentLinkId: paymentLink.id,
      url: paymentLink.url,
      orderId
    });

    // Save payment link info to Firestore
    await admin.firestore()
      .collection('paymentLinks')
      .doc(paymentLink.id)
      .set({
        paymentLinkId: paymentLink.id,
        orderId,
        clientId: context.auth.uid,
        driverName,
        amount,
        status: 'created',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return { 
      success: true,
      paymentUrl: paymentLink.url,
      paymentLinkId: paymentLink.id
    };
  } catch (error) {
    console.error('❌ Stripe payment link error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to create payment link');
  }
}); 