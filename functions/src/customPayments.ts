import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(
  functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
);

/**
 * Custom authentication verification using AuthContext token
 */
async function verifyCustomToken(authToken: string): Promise<{ uid: string; email: string } | null> {
  try {
    // In a real implementation, you would verify the token against your auth system
    // For now, we'll decode it and verify against Firestore users
    
    // This is a simplified approach - in production you should use proper JWT verification
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/roadside-assistance-app-aa0e8/databases/(default)/documents/users?pageSize=100`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );
    
    if (!response.ok) {
      console.error('❌ Token verification failed:', response.status);
      return null;
    }
    
    const data = await response.json() as any;
    const users = data.documents?.map((doc: any) => ({
      uid: doc.name.split('/').pop(),
      ...firestoreFieldsToObject(doc.fields)
    })) || [];
    
    // Find user by token (simplified - in production use proper JWT verification)
    const user = users.find((u: any) => u.email); // Simplified check
    
    if (user) {
      return { uid: user.uid, email: user.email };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error verifying custom token:', error);
    return null;
  }
}

/**
 * Helper function to convert Firestore fields
 */
function firestoreFieldsToObject(fields: any): any {
  const obj: any = {};
  for (const key in fields) {
    const field = fields[key];
    if (field.nullValue !== undefined) {
      obj[key] = null;
    } else if (field.stringValue !== undefined) {
      obj[key] = field.stringValue;
    } else if (field.integerValue !== undefined) {
      obj[key] = parseInt(field.integerValue);
    } else if (field.doubleValue !== undefined) {
      obj[key] = parseFloat(field.doubleValue);
    } else if (field.booleanValue !== undefined) {
      obj[key] = field.booleanValue;
    } else if (field.timestampValue !== undefined) {
      obj[key] = new Date(field.timestampValue);
    }
  }
  return obj;
}

/**
 * HTTP Cloud Function for creating payment links with custom authentication
 */
export const createPaymentLinkHTTP = functions.region('europe-west3').https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  
  try {
    // Get authorization header (optional for testing)
    const authHeader = req.headers.authorization;
    console.log('🔑 Auth header:', authHeader ? 'Present' : 'Missing');
    
    // For now, skip token validation to test the payment flow
    // In production, implement proper JWT verification
    console.log('✅ Skipping token validation for testing');
    
    // Get request data
    const { data } = req.body;
    const { orderId, amount, driverName, userId } = data;
    
    // Validate input data
    if (!orderId || !amount || !driverName || !userId) {
      res.status(400).json({ 
        error: 'Missing required payment link data: orderId, amount, driverName, userId' 
      });
      return;
    }
    
    // Skip order validation for testing
    // In production, uncomment the order validation below
    console.log('⚠️ Skipping order validation for testing purposes');
    
    /*
    // Verify the user is the client for this order
    const orderDoc = await admin.firestore()
      .collection('orders')
      .doc(orderId)
      .get();
    
    const order = orderDoc.data();
    if (!order || order.clientId !== userId) {
      res.status(403).json({ 
        error: 'User not authorized for this order' 
      });
      return;
    }
    */
    
    console.log('💰 Creating payment link:', {
      orderId,
      amount,
      driverName,
      clientId: userId
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
        clientId: userId,
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
        clientId: userId,
        driverName,
        amount,
        status: 'created',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    
    // Return success response
    res.status(200).json({
      success: true,
      paymentUrl: paymentLink.url,
      paymentLinkId: paymentLink.id
    });
    
  } catch (error) {
    console.error('❌ Error in createPaymentLinkHTTP:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * NEW HTTP Cloud Function for creating payment links - Testing Version
 */
export const createPaymentLinkTest = functions.region('europe-west3').https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  
  try {
    console.log('🧪 TEST FUNCTION - Creating payment link');
    
    // Get request data
    const { data } = req.body;
    const { orderId, amount, driverName, userId } = data;
    
    console.log('📤 Received data:', { orderId, amount, driverName, userId });
    
    // Validate input data
    if (!orderId || !amount || !driverName || !userId) {
      console.log('❌ Missing required data');
      res.status(400).json({ 
        error: 'Missing required payment link data: orderId, amount, driverName, userId' 
      });
      return;
    }
    
    console.log('✅ All required data present');
    
    // First create a product and price, then create payment link
    console.log('🏭 Creating Stripe product...');
    const product = await stripe.products.create({
      name: 'Такса платформа - Пътна помощ',
      description: `Услуга от ${driverName}`,
    });
    
    console.log('💰 Creating price for product...');
    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: Math.round(amount * 100), // Stripe uses cents/stotinki
      product: product.id,
    });
    
    console.log('🔗 Creating payment link...');
    
    // Determine redirect URLs based on environment
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'roadsideassistance://'
      : 'exp://192.168.96.22:8081/--/';
    
    const successUrl = `${baseUrl}payment-success?orderId=${orderId}&amount=${amount}`;
    const cancelUrl = `${baseUrl}payment-cancelled?orderId=${orderId}&amount=${amount}`;
    
    console.log('🔗 Success URL:', successUrl);
    console.log('🔗 Cancel URL:', cancelUrl);
    
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price: price.id,
        quantity: 1,
      }],
      metadata: {
        orderId,
        clientId: userId,
        type: 'platform_fee',
        driverName
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: successUrl
        }
      },
      // Add automatic tax calculation if needed
      automatic_tax: { enabled: false },
      // Add payment method types
      payment_method_types: ['card'],
      // Add billing address collection
      billing_address_collection: 'auto'
    });
    
    console.log('✅ Stripe payment link created:', paymentLink.id);
    
    // Save payment link info to Firestore
    await admin.firestore()
      .collection('paymentLinks')
      .doc(paymentLink.id)
      .set({
        paymentLinkId: paymentLink.id,
        orderId,
        clientId: userId,
        driverName,
        amount,
        status: 'created',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    
    console.log('✅ Payment link saved to Firestore');
    
    // Return success response
    res.status(200).json({
      success: true,
      paymentUrl: paymentLink.url,
      paymentLinkId: paymentLink.id
    });
    
    console.log('🎉 Payment link creation completed successfully');
    
  } catch (error) {
    console.error('❌ Error in createPaymentLinkTest:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Webhook handler for Stripe payment link events
 */
export const handlePaymentLinkWebhook = functions.region('europe-west3').https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

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

  console.log('📨 Payment Link webhook received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as any;
        await handlePaymentLinkSuccess(session);
        break;

      default:
        console.log(`🔔 Unhandled payment link event type: ${event.type}`);
        // Try to handle any payment completion event
        if (event.type.includes('payment') && event.type.includes('completed')) {
          const paymentEvent = event.data.object as any;
          await handleGenericPaymentCompleted(paymentEvent, event.type);
        }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error handling payment link webhook:', error);
    res.status(500).send('Webhook handler failed');
  }
});

/**
 * Handle successful payment link completion
 * ✅ UPDATED: Now compatible with 2-phase commit pattern
 * Only confirms the bid if order is in payment_pending status with a reserved bid
 */
async function handlePaymentLinkSuccess(session: any) {
  console.log('✅ Payment link completed:', session.id);
  
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error('❌ No orderId in session metadata');
    return;
  }

  try {
    // ✅ NEW: Use transaction to implement Phase 2 of 2-phase commit
    await admin.firestore().runTransaction(async (transaction) => {
      // 1. Read order to check current status
      const orderRef = admin.firestore().collection('orders').doc(orderId);
      const orderDoc = await transaction.get(orderRef);
      
      if (!orderDoc.exists) {
        throw new Error('Order not found');
      }
      
      const orderData = orderDoc.data()!;
      
      // 2. Only confirm if order is in payment_pending status (2-phase commit)
      if (orderData.status !== 'payment_pending') {
        console.log(`⚠️ Order ${orderId} is not in payment_pending status (${orderData.status}), skipping auto-confirmation`);
        return;
      }
      
      if (!orderData.reservedBidId) {
        console.log(`⚠️ Order ${orderId} has no reserved bid, skipping auto-confirmation`);
        return;
      }
      
      // 3. Read the reserved bid (bids are stored in top-level 'bids' collection)
      const bidRef = admin.firestore()
        .collection('bids')
        .doc(orderData.reservedBidId);
      const bidDoc = await transaction.get(bidRef);
      
      if (!bidDoc.exists) {
        console.log(`⚠️ Reserved bid ${orderData.reservedBidId} not found, skipping auto-confirmation`);
        return;
      }
      
      const bidData = bidDoc.data()!;
      
      if (bidData.status !== 'reserved') {
        console.log(`⚠️ Bid ${orderData.reservedBidId} is not reserved (${bidData.status}), skipping auto-confirmation`);
        return;
      }
      
      // 4. Confirm the bid (Phase 2 of 2-phase commit)
      transaction.update(orderRef, {
        status: 'accepted',
        acceptedBidId: orderData.reservedBidId,
        acceptedDriverId: orderData.reservedDriverId,
        paymentStatus: 'paid',
        paidAt: new Date(),
        acceptedAt: new Date(),
        updatedAt: new Date(),
      });
      
      // 5. Mark bid as accepted
      transaction.update(bidRef, {
        status: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log(`✅ [WEBHOOK] 2-phase commit completed for order ${orderId}, bid ${orderData.reservedBidId}`);
    });

    // Update payment link record
    const paymentLinkId = session.payment_link;
    if (paymentLinkId) {
      await admin.firestore()
        .collection('paymentLinks')
        .doc(paymentLinkId)
        .update({
          status: 'completed',
          sessionId: session.id,
          completedAt: new Date(),
          updatedAt: new Date(),
        });
    }

    console.log('✅ Payment webhook processing completed for order:', orderId);
  } catch (error) {
    console.error('❌ Error in payment webhook:', error);
  }
}

/**
 * Handle generic payment completion events
 * ✅ UPDATED: Now compatible with 2-phase commit pattern
 */
async function handleGenericPaymentCompleted(paymentEvent: any, eventType: string) {
  console.log('✅ Generic payment completed:', eventType, paymentEvent.id);
  
  // Try to find orderId in metadata
  const orderId = paymentEvent.metadata?.orderId;
  if (!orderId) {
    console.error('❌ No orderId in payment event metadata');
    return;
  }

  try {
    // ✅ NEW: Use same 2-phase commit logic as handlePaymentLinkSuccess
    await admin.firestore().runTransaction(async (transaction) => {
      // 1. Read order to check current status
      const orderRef = admin.firestore().collection('orders').doc(orderId);
      const orderDoc = await transaction.get(orderRef);
      
      if (!orderDoc.exists) {
        throw new Error('Order not found');
      }
      
      const orderData = orderDoc.data()!;
      
      // 2. Only confirm if order is in payment_pending status (2-phase commit)
      if (orderData.status !== 'payment_pending') {
        console.log(`⚠️ Order ${orderId} is not in payment_pending status (${orderData.status}), skipping auto-confirmation`);
        return;
      }
      
      if (!orderData.reservedBidId) {
        console.log(`⚠️ Order ${orderId} has no reserved bid, skipping auto-confirmation`);
        return;
      }
      
      // 3. Read the reserved bid (bids are stored in top-level 'bids' collection)
      const bidRef = admin.firestore()
        .collection('bids')
        .doc(orderData.reservedBidId);
      const bidDoc = await transaction.get(bidRef);
      
      if (!bidDoc.exists) {
        console.log(`⚠️ Reserved bid ${orderData.reservedBidId} not found, skipping auto-confirmation`);
        return;
      }
      
      const bidData = bidDoc.data()!;
      
      if (bidData.status !== 'reserved') {
        console.log(`⚠️ Bid ${orderData.reservedBidId} is not reserved (${bidData.status}), skipping auto-confirmation`);
        return;
      }
      
      // 4. Confirm the bid (Phase 2 of 2-phase commit)
      transaction.update(orderRef, {
        status: 'accepted',
        acceptedBidId: orderData.reservedBidId,
        acceptedDriverId: orderData.reservedDriverId,
        paymentStatus: 'paid',
        paidAt: new Date(),
        acceptedAt: new Date(),
        updatedAt: new Date(),
      });
      
      // 5. Mark bid as accepted
      transaction.update(bidRef, {
        status: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log(`✅ [WEBHOOK] Generic payment 2-phase commit completed for order ${orderId}, bid ${orderData.reservedBidId}`);
    });

    console.log('✅ Generic payment webhook processing completed for order:', orderId);
  } catch (error) {
    console.error('❌ Error in generic payment webhook:', error);
  }
} 