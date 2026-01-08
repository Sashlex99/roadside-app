/**
 * Test script for new test payment link function
 */

const https = require('https');

// Test data
const testData = {
  data: {
    orderId: 'test-order-123',
    amount: 7.5, // 15% of 50 BGN
    driverName: 'Тест Шофьор',
    userId: 'test-user-123'
  }
};

// Use a test token
const testToken = 'test-token-placeholder-1234567890';

const postData = JSON.stringify(testData);

const options = {
  hostname: 'us-central1-roadside-assistance-app-aa0e8.cloudfunctions.net',
  port: 443,
  path: '/createPaymentLinkTest',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${testToken}`,
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing NEW payment link function...');
console.log('📤 Request data:', testData);
console.log('🔗 URL:', `https://${options.hostname}${options.path}`);

const req = https.request(options, (res) => {
  console.log('📨 Response status:', res.statusCode);
  console.log('📋 Response headers:', res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('✅ Response body:', JSON.stringify(response, null, 2));
      
      if (res.statusCode === 200) {
        console.log('🎉 SUCCESS: Payment link created!');
        console.log('💳 Payment URL:', response.paymentUrl);
        console.log('🆔 Payment Link ID:', response.paymentLinkId);
      } else {
        console.log('❌ ERROR: Function returned error status');
      }
    } catch (error) {
      console.log('📄 Raw response:', data);
      console.error('❌ Error parsing response:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write(postData);
req.end();

console.log('⏳ Waiting for response...'); 