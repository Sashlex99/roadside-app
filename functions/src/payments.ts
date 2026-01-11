import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripeSecretKey = functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ STRIPE SECRET KEY NOT CONFIGURED!');
}

const stripe = new Stripe(stripeSecretKey || 'sk_test_placeholder');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Creates a Stripe Payment Intent for platform fee payment (15% of bid)
 * Returns data needed for Payment Sheet (Apple Pay / Google Pay)
 */
export const createPaymentIntent = functions
  .region('europe-west3')
  .https.onCall(async (data, context) => {
    console.log('🚀 createPaymentIntent called with:', JSON.stringify(data));

    // Verify authentication
    if (!context.auth) {
      console.error('❌ User not authenticated');
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { orderId, bidId, bidAmount, driverId, clientId } = data;

    // Validate input
    if (!orderId || !bidId || !bidAmount || !driverId || !clientId) {
      console.error('❌ Missing required fields:', { orderId, bidId, bidAmount, driverId, clientId });
      throw new functions.https.HttpsError('invalid-argument', 'Missing required payment data');
    }

    try {
      // 1. Verify order exists and belongs to this client
      console.log('📋 Step 1: Verifying order...');
      const orderDoc = await db.collection('orders').doc(orderId).get();

      if (!orderDoc.exists) {
        console.error('❌ Order not found:', orderId);
        throw new functions.https.HttpsError('not-found', 'Order not found');
      }

      const order = orderDoc.data();
      if (order?.clientId !== context.auth.uid) {
        console.error('❌ User not authorized for order:', { orderClientId: order?.clientId, authUid: context.auth.uid });
        throw new functions.https.HttpsError('permission-denied', 'User not authorized for this order');
      }
      console.log('✅ Order verified');

      // 2. Verify bid exists
      console.log('📋 Step 2: Verifying bid...');
      const bidDoc = await db.collection('bids').doc(bidId).get();

      if (!bidDoc.exists) {
        console.error('❌ Bid not found:', bidId);
        throw new functions.https.HttpsError('not-found', 'Bid not found');
      }
      console.log('✅ Bid verified');

      // 3. Calculate platform fee (15% of bid amount)
      console.log('📋 Step 3: Calculating amount...');
      const platformFeePercent = 15;
      const platformFeeAmount = Math.round(bidAmount * (platformFeePercent / 100) * 100); // Convert to cents

      console.log('💰 Amount calculation:', {
        bidAmount,
        platformFeePercent,
        platformFeeAmountCents: platformFeeAmount,
        platformFeeEUR: platformFeeAmount / 100
      });

      // Minimum amount check (Stripe requires at least 50 cents for EUR)
      if (platformFeeAmount < 50) {
        console.error('❌ Amount too low:', platformFeeAmount);
        throw new functions.https.HttpsError('invalid-argument', 'Payment amount too low (minimum 0.50 EUR)');
      }

      // 4. Get or create Stripe customer
      console.log('📋 Step 4: Getting/creating Stripe customer...');
      const userDoc = await db.collection('users').doc(clientId).get();
      const userData = userDoc.data();
      let customerId = userData?.stripeCustomerId;

      if (!customerId) {
        console.log('👤 Creating new Stripe customer...');
        const customer = await stripe.customers.create({
          email: userData?.email || undefined,
          name: userData?.fullName || undefined,
          metadata: {
            firebaseUid: clientId,
            source: 'roadside-assistance-app'
          }
        });
        customerId = customer.id;

        // Save customer ID
        await db.collection('users').doc(clientId).update({
          stripeCustomerId: customerId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Stripe customer created:', customerId);
      } else {
        console.log('✅ Using existing Stripe customer:', customerId);
      }

      // 5. Create ephemeral key for Payment Sheet
      console.log('📋 Step 5: Creating ephemeral key...');
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2023-10-16' }
      );
      console.log('✅ Ephemeral key created');

      // 6. Create Payment Intent
      console.log('📋 Step 6: Creating Payment Intent...');
      const paymentIntent = await stripe.paymentIntents.create({
        amount: platformFeeAmount,
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
          platformFee: (platformFeeAmount / 100).toString(),
          source: 'roadside-assistance-app'
        },
        description: `Platform fee - Order ${orderId}`,
      });
      console.log('✅ Payment Intent created:', paymentIntent.id);

      // 7. Save payment record
      console.log('📋 Step 7: Saving payment record...');
      await db.collection('payments').doc(paymentIntent.id).set({
        paymentIntentId: paymentIntent.id,
        orderId,
        bidId,
        driverId,
        clientId,
        customerId,
        bidAmount,
        platformFee: platformFeeAmount / 100,
        totalAmount: platformFeeAmount / 100,
        currency: 'eur',
        status: 'created',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Payment record saved');

      // Return response
      const response = {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customerId,
        amount: platformFeeAmount / 100,
        platformFee: platformFeeAmount / 100,
        bidAmount
      };

      console.log('🎉 createPaymentIntent SUCCESS:', {
        paymentIntentId: response.paymentIntentId,
        amount: response.amount
      });

      return response;

    } catch (error: any) {
      console.error('❌ createPaymentIntent ERROR:', {
        message: error.message,
        code: error.code,
        type: error.type,
      });

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      if (error.type === 'StripeInvalidRequestError') {
        console.error('❌ Stripe Invalid Request:', error.message);
        throw new functions.https.HttpsError('invalid-argument', `Stripe error: ${error.message}`);
      }

      throw new functions.https.HttpsError('internal', 'Failed to create payment intent');
    }
  });

/**
 * Processes successful payment and updates order status
 */
export const processPayment = functions
  .region('europe-west3')
  .https.onCall(async (data, context) => {
    console.log('🚀 processPayment called with:', JSON.stringify(data));

    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { paymentIntentId, orderId, bidId } = data;

    if (!paymentIntentId || !orderId || !bidId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required data');
    }

    try {
      // Verify payment succeeded
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Payment not successful. Status: ${paymentIntent.status}`
        );
      }

      // Get the bid to retrieve driverId
      const bidDoc = await db.collection('bids').doc(bidId).get();
      if (!bidDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Bid not found');
      }
      const bidData = bidDoc.data();
      const driverId = bidData?.driverId;

      if (!driverId) {
        throw new functions.https.HttpsError('invalid-argument', 'Bid has no driverId');
      }

      // Update payment record
      await db.collection('payments').doc(paymentIntentId).update({
        status: 'succeeded',
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update order - status 'accepted' so driver app can find it
      await db.collection('orders').doc(orderId).update({
        status: 'accepted',
        acceptedBidId: bidId,
        acceptedDriverId: driverId,
        paymentStatus: 'paid',
        paymentIntentId,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update bid
      await db.collection('bids').doc(bidId).update({
        status: 'accepted',
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log('✅ processPayment SUCCESS');

      return {
        success: true,
        orderId,
        bidId,
        paymentIntentId,
        paidAmount: paymentIntent.amount / 100
      };

    } catch (error: any) {
      console.error('❌ processPayment ERROR:', error.message);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError('internal', 'Failed to process payment');
    }
  });

/**
 * Stripe webhook handler
 */
export const handleStripeWebhook = functions
  .region('europe-west3')
  .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ Webhook secret not configured');
      res.status(400).send('Webhook secret not configured');
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    console.log('📨 Webhook received:', event.type);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      await db.collection('payments').doc(paymentIntent.id).update({
        status: 'succeeded',
        webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ received: true });
  });

/**
 * Creates a simple payment link (alternative method)
 */
export const createPaymentLink = functions
  .region('europe-west3')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { orderId, amount, driverName } = data;

    if (!orderId || !amount || !driverName) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required data');
    }

    try {
      // Create a product first
      const product = await stripe.products.create({
        name: 'Platform Fee - Roadside Assistance',
        description: `Service by ${driverName}`,
      });

      // Create a price for this product
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(amount * 100),
        currency: 'eur',
      });

      // Create payment link with the price
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [{
          price: price.id,
          quantity: 1,
        }],
        metadata: {
          orderId,
          clientId: context.auth.uid,
        },
      });

      return {
        success: true,
        paymentUrl: paymentLink.url,
        paymentLinkId: paymentLink.id
      };

    } catch (error: any) {
      console.error('❌ createPaymentLink ERROR:', error.message);
      throw new functions.https.HttpsError('internal', 'Failed to create payment link');
    }
  });
