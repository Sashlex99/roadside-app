/**
 * Payment Flow Testing - Issue #3 
 * 
 * Tests double payment vulnerability and idempotency
 * Demonstrates Firebase Admin SDK testing capabilities
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'roadside-assistance-bf'
  });
}

const db = admin.firestore();

/**
 * Simulates payment processing with idempotency protection
 */
async function processPaymentWithIdempotency(orderId, paymentData, idempotencyKey) {
  console.log(`💳 Processing payment for order ${orderId} with key ${idempotencyKey}`);
  
  try {
    return await db.runTransaction(async (transaction) => {
      // 1. Check if payment already processed with this idempotency key
      const paymentsQuery = await transaction.get(
        db.collection('payments').where('idempotencyKey', '==', idempotencyKey)
      );
      
      if (!paymentsQuery.empty) {
        console.log(`⚠️  Payment already processed with key ${idempotencyKey}`);
        const existingPayment = paymentsQuery.docs[0].data();
        return { 
          success: false, 
          reason: 'duplicate_payment',
          existingPaymentId: paymentsQuery.docs[0].id,
          amount: existingPayment.amount
        };
      }
      
      // 2. Validate order exists and is in correct state
      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await transaction.get(orderRef);
      
      if (!orderDoc.exists) {
        throw new Error('Order not found');
      }
      
      const orderData = orderDoc.data();
      
      if (orderData.status !== 'payment_pending') {
        throw new Error(`Order status is ${orderData.status}, payment not allowed`);
      }
      
      if (orderData.paymentStatus === 'completed') {
        throw new Error('Payment already completed for this order');
      }
      
      // 3. Create payment record with idempotency key
      const paymentRef = db.collection('payments').doc();
      transaction.set(paymentRef, {
        orderId: orderId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'BGN',
        paymentMethod: paymentData.paymentMethod,
        idempotencyKey: idempotencyKey,
        status: 'completed',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        platformFee: orderData.platformFee || 0
      });
      
      // 4. Update order payment status
      transaction.update(orderRef, {
        paymentStatus: 'completed',
        paymentId: paymentRef.id,
        paidAmount: paymentData.amount,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'confirmed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Payment processed successfully: ${paymentRef.id}`);
      return {
        success: true,
        paymentId: paymentRef.id,
        amount: paymentData.amount
      };
    });
    
  } catch (error) {
    console.log(`❌ Payment failed: ${error.message}`);
    return {
      success: false,
      reason: 'processing_error',
      error: error.message
    };
  }
}

/**
 * Setup test data for payment testing
 */
async function setupPaymentTestData() {
  const timestamp = Date.now();
  const orderId = `payment-test-${timestamp}`;
  
  // Create test order in payment_pending state
  await db.collection('orders').doc(orderId).set({
    clientId: 'test-client',
    status: 'payment_pending',
    acceptedBidId: 'test-bid',
    acceptedDriverId: 'test-driver',
    finalPrice: 100,
    platformFee: 15,
    description: 'Payment test order',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log(`✅ Test order created: ${orderId}`);
  return orderId;
}

/**
 * Cleanup payment test data
 */
async function cleanupPaymentTestData(orderId) {
  const batch = db.batch();
  
  // Delete payments
  const paymentsSnapshot = await db.collection('payments')
    .where('orderId', '==', orderId)
    .get();
  
  paymentsSnapshot.forEach(doc => batch.delete(doc.ref));
  
  // Delete order
  batch.delete(db.collection('orders').doc(orderId));
  
  await batch.commit();
  console.log('🧹 Payment test data cleaned up');
}

/**
 * Test double payment prevention
 */
async function testDoublePaymentPrevention() {
  console.log('🚀 DOUBLE PAYMENT PREVENTION TEST - Issue #3\n');
  
  const orderId = await setupPaymentTestData();
  const idempotencyKey = `test-payment-${Date.now()}`;
  
  const paymentData = {
    amount: 100,
    currency: 'BGN',
    paymentMethod: 'card'
  };
  
  console.log('💳 Simulating rapid double-click on payment button...');
  console.log(`Using idempotency key: ${idempotencyKey}\n`);
  
  const startTime = Date.now();
  
  // Simulate simultaneous payment attempts
  const [result1, result2, result3] = await Promise.allSettled([
    processPaymentWithIdempotency(orderId, paymentData, idempotencyKey),
    processPaymentWithIdempotency(orderId, paymentData, idempotencyKey),
    processPaymentWithIdempotency(orderId, paymentData, idempotencyKey)
  ]);
  
  const duration = Date.now() - startTime;
  
  console.log('\n📊 PAYMENT TEST RESULTS:');
  console.log(`⏱️  Duration: ${duration}ms`);
  
  const results = [result1, result2, result3];
  const successCount = results.filter(r => 
    r.status === 'fulfilled' && r.value.success
  ).length;
  
  const duplicateCount = results.filter(r =>
    r.status === 'fulfilled' && r.value.reason === 'duplicate_payment'
  ).length;
  
  console.log(`✅ Successful payments: ${successCount}/3`);
  console.log(`🔄 Duplicate prevented: ${duplicateCount}/3`);
  
  console.log('\n🎯 DOUBLE PAYMENT TEST RESULT:');
  
  if (successCount === 1 && duplicateCount === 2) {
    console.log('✅ PASS: Only one payment processed, duplicates prevented');
    
    // Verify final state
    const finalOrder = await db.collection('orders').doc(orderId).get();
    const finalData = finalOrder.data();
    
    console.log(`   Order status: ${finalData.status}`);
    console.log(`   Payment status: ${finalData.paymentStatus}`);
    console.log(`   Amount paid: ${finalData.paidAmount} BGN`);
    
    // Check payment records
    const payments = await db.collection('payments')
      .where('orderId', '==', orderId)
      .get();
    
    console.log(`   Payment records: ${payments.size} (should be 1)`);
    
  } else {
    console.log('❌ FAIL: Double payment vulnerability detected!');
    console.log('   Multiple payments may have been processed');
  }
  
  // Show individual results
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const { success, reason, amount } = result.value;
      console.log(`   Attempt ${index + 1}: ${success ? 'SUCCESS' : 'PREVENTED'} ${reason ? `(${reason})` : ''}`);
    }
  });
  
  await cleanupPaymentTestData(orderId);
  console.log('\n🏁 Payment test completed!');
}

/**
 * Test different idempotency scenarios
 */
async function testIdempotencyScenarios() {
  console.log('🔑 IDEMPOTENCY KEY SCENARIOS TEST\n');
  
  const orderId = await setupPaymentTestData();
  
  const scenarios = [
    { key: 'key-1', amount: 100, description: 'First payment' },
    { key: 'key-1', amount: 100, description: 'Duplicate with same key' },
    { key: 'key-2', amount: 50, description: 'Different key, different amount' }
  ];
  
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`📝 Scenario ${i + 1}: ${scenario.description}`);
    
    const result = await processPaymentWithIdempotency(
      orderId, 
      { amount: scenario.amount, currency: 'BGN', paymentMethod: 'card' },
      scenario.key
    );
    
    console.log(`   Result: ${result.success ? 'SUCCESS' : 'PREVENTED'} ${result.reason ? `(${result.reason})` : ''}\n`);
  }
  
  await cleanupPaymentTestData(orderId);
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'double-payment':
        await testDoublePaymentPrevention();
        break;
        
      case 'idempotency':
        await testIdempotencyScenarios();
        break;
        
      case 'all':
        await testDoublePaymentPrevention();
        console.log('\n' + '='.repeat(50) + '\n');
        await testIdempotencyScenarios();
        break;
        
      default:
        console.log('Available payment tests:');
        console.log('  double-payment  - Test double payment prevention');
        console.log('  idempotency     - Test idempotency key scenarios');
        console.log('  all             - Run all payment tests');
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  testDoublePaymentPrevention, 
  testIdempotencyScenarios, 
  processPaymentWithIdempotency 
}; 