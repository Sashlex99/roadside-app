#!/usr/bin/env node

const { testBasicBidRestoration } = require('./test-basic-bid-restoration');
const { testMultiClientScenario } = require('./test-multi-client-scenario');

console.log('🚀 CRITICAL BID RESTORATION TEST SUITE\n');
console.log('Testing the fix for the major bid restoration bug...\n');

const runTestSuite = async () => {
  const results = { passed: 0, failed: 0, errors: [] };
  
  const tests = [
    { name: 'Basic Bid Restoration', fn: testBasicBidRestoration },
    { name: 'Multi-Client Scenario (N1/N2)', fn: testMultiClientScenario }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n📋 Running: ${test.name}`);
      console.log('='.repeat(50));
      
      const startTime = Date.now();
      await test.fn();
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${test.name} PASSED (${duration}ms)`);
      results.passed++;
      
    } catch (error) {
      console.error(`❌ ${test.name} FAILED: ${error.message}`);
      results.failed++;
      results.errors.push({ test: test.name, error: error.message });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUITE SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / tests.length) * 100).toFixed(1)}%`);
  
  if (results.failed > 0) {
    console.log('\n🚨 FAILURES:');
    results.errors.forEach(err => {
      console.log(`  - ${err.test}: ${err.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED! The bid restoration fix is working correctly.');
    process.exit(0);
  }
};

runTestSuite().catch(error => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
}); 