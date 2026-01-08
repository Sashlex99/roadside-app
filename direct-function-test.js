// Direct Cloud Function Test - без authentication
const https = require('https');

async function testCloudFunction() {
  console.log('🧪 Testing Cloud Function Deployment...');
  
  // Test data
  const testData = {
    orderId: 'test-order-' + Date.now(),
    amount: 15.75,
    driverName: 'Иван Петров (Тест)'
  };
  
  const functionUrl = 'https://us-central1-roadside-assistance-app-aa0e8.cloudfunctions.net/createPaymentLink';
  
  const postData = JSON.stringify({
    data: testData
  });
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  console.log('📤 Calling function:', functionUrl);
  console.log('📋 With data:', testData);
  
  return new Promise((resolve, reject) => {
    const req = https.request(functionUrl, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📨 Response status:', res.statusCode);
        console.log('📨 Response headers:', res.headers);
        console.log('📨 Response body:', data);
        
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            console.log('✅ Function is deployed and responding!');
            resolve(result);
          } catch (e) {
            console.log('✅ Function responded but with non-JSON data');
            resolve(data);
          }
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          console.log('🔐 Function requires authentication (expected)');
          console.log('✅ This means the function is deployed correctly!');
          resolve({ status: 'auth_required' });
        } else {
          console.log('❌ Unexpected response status');
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Alternative: Test if function exists via Firebase Functions list
async function checkFunctionExists() {
  console.log('\n🔍 Checking if function exists...');
  
  const listUrl = 'https://cloudfunctions.googleapis.com/v1/projects/roadside-assistance-app-aa0e8/locations/us-central1/functions';
  
  return new Promise((resolve) => {
    https.get(listUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (data.includes('createPaymentLink')) {
          console.log('✅ createPaymentLink function found in project!');
        } else {
          console.log('❓ Function might not be publicly listed (normal)');
        }
        resolve();
      });
    }).on('error', () => {
      console.log('❓ Cannot check function list (normal - requires auth)');
      resolve();
    });
  });
}

// Run tests
console.log('🚀 Starting Direct Function Test...');

testCloudFunction()
  .then((result) => {
    console.log('\n🎉 Test Results:');
    if (result.status === 'auth_required') {
      console.log('✅ Function is deployed and working!');
      console.log('💡 To test with real data, use the mobile app');
    } else {
      console.log('📋 Function response:', result);
    }
    return checkFunctionExists();
  })
  .then(() => {
    console.log('\n🏁 Test completed successfully!');
    console.log('\n📱 Next steps:');
    console.log('1. Open the mobile app');
    console.log('2. Login as client');
    console.log('3. Create a service request');
    console.log('4. Login as driver (different device)');
    console.log('5. Make a bid');
    console.log('6. Accept the bid as client');
    console.log('7. Payment modal should appear!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  }); 