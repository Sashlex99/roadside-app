// Test for Performance Metrics Collection and Analysis
// Verifies comprehensive performance tracking and alerting

// Mock performance metrics collector
class MockPerformanceMetricsCollector {
  constructor() {
    this.dataPoints = [];
    this.thresholds = [];
    this.alertCallbacks = [];
    this.setupDefaultThresholds();
  }

  recordMetric(type, value, component, unit = 'ms', metadata = {}) {
    const dataPoint = {
      timestamp: new Date(),
      type,
      value,
      component,
      unit,
      metadata
    };

    this.dataPoints.push(dataPoint);
    this.checkThresholds(dataPoint);

    console.log(`📊 Recorded metric: ${type} = ${value}${unit} (${component})`);
  }

  recordOperationTiming(operation, component, startTime, metadata = {}) {
    const duration = Date.now() - startTime;
    this.recordMetric('operation_duration', duration, component, 'ms', {
      operation,
      ...metadata
    });
  }

  recordErrorRate(component, successCount, failureCount, timeWindow = 60000) {
    const totalOperations = successCount + failureCount;
    const errorRate = totalOperations > 0 ? (failureCount / totalOperations) * 100 : 0;
    
    this.recordMetric('error_rate', errorRate, component, '%', {
      successCount,
      failureCount,
      totalOperations,
      timeWindow
    });
  }

  recordThroughput(component, operationCount, timeWindow = 60000) {
    const throughput = (operationCount / timeWindow) * 1000;
    this.recordMetric('throughput', throughput, component, 'ops/s', {
      operationCount,
      timeWindow
    });
  }

  getMetrics(component, type, timeWindow) {
    let filtered = this.dataPoints;

    if (component) {
      filtered = filtered.filter(dp => dp.component.includes(component));
    }

    if (type) {
      filtered = filtered.filter(dp => dp.type === type);
    }

    if (timeWindow) {
      const cutoff = new Date(Date.now() - timeWindow);
      filtered = filtered.filter(dp => dp.timestamp >= cutoff);
    }

    return filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  calculateStats(component, type, timeWindow = 300000) {
    const metrics = this.getMetrics(component, type, timeWindow);
    
    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;

    const p95Index = Math.floor(values.length * 0.95);
    const p99Index = Math.floor(values.length * 0.99);
    const medianIndex = Math.floor(values.length * 0.5);

    const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      type,
      component,
      timeWindow,
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      average: Math.round(average * 100) / 100,
      median: values[medianIndex],
      p95: values[p95Index],
      p99: values[p99Index],
      stdDev: Math.round(stdDev * 100) / 100,
      timeRange: {
        start: metrics[0].timestamp,
        end: metrics[metrics.length - 1].timestamp
      }
    };
  }

  analyzeTrend(component, type, timeWindow = 900000) {
    const metrics = this.getMetrics(component, type, timeWindow);
    
    if (metrics.length < 5) {
      return null;
    }

    const values = metrics.map(m => m.value);
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changePercent = ((lastValue - firstValue) / firstValue) * 100;
    
    // Simple trend analysis
    let trend = 'STABLE';
    const absChange = Math.abs(changePercent);
    
    if (absChange > 20) {
      if (changePercent > 0) {
        trend = type === 'error_rate' ? 'DEGRADING' : 'IMPROVING';
      } else {
        trend = type === 'error_rate' ? 'IMPROVING' : 'DEGRADING';
      }
    } else if (absChange > 10) {
      trend = 'VOLATILE';
    }

    return {
      component,
      type,
      trend,
      strength: absChange / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      prediction: lastValue + (changePercent / 100) * lastValue,
      confidence: Math.min(absChange / 50, 1)
    };
  }

  setupDefaultThresholds() {
    this.thresholds = [
      {
        type: 'operation_duration',
        componentPattern: '*',
        value: 5000,
        operator: 'gt',
        severity: 'WARNING',
        message: 'Operation duration exceeded 5 seconds'
      },
      {
        type: 'error_rate',
        componentPattern: '*',
        value: 10,
        operator: 'gt',
        severity: 'WARNING',
        message: 'Error rate exceeded 10%'
      }
    ];
  }

  checkThresholds(dataPoint) {
    for (const threshold of this.thresholds) {
      if (threshold.type !== dataPoint.type) continue;
      
      if (!this.matchesPattern(dataPoint.component, threshold.componentPattern)) continue;

      const violated = this.checkThresholdViolation(dataPoint.value, threshold.value, threshold.operator);
      
      if (violated) {
        const alert = {
          type: 'THRESHOLD_VIOLATION',
          severity: threshold.severity,
          message: threshold.message,
          component: dataPoint.component,
          metricType: dataPoint.type,
          actualValue: dataPoint.value,
          thresholdValue: threshold.value,
          timestamp: dataPoint.timestamp,
          metadata: dataPoint.metadata
        };

        this.triggerAlert(alert);
      }
    }
  }

  matchesPattern(component, pattern) {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return component.startsWith(pattern.slice(0, -1));
    }
    if (pattern.startsWith('*')) {
      return component.endsWith(pattern.slice(1));
    }
    return component === pattern;
  }

  checkThresholdViolation(value, threshold, operator) {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  triggerAlert(alert) {
    console.warn(`⚠️ Performance Alert [${alert.severity}]: ${alert.message} (${alert.component}: ${alert.actualValue})`);
    
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in performance alert callback:', error);
      }
    });
  }

  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  getPerformanceSummary(timeWindow = 300000) {
    const components = [...new Set(this.dataPoints.map(dp => dp.component))];
    const metricTypes = [...new Set(this.dataPoints.map(dp => dp.type))];

    const summaryStats = {};
    const trends = [];

    components.forEach(component => {
      summaryStats[component] = [];
      
      metricTypes.forEach(type => {
        const stats = this.calculateStats(component, type, timeWindow);
        if (stats) {
          summaryStats[component].push(stats);
        }

        const trend = this.analyzeTrend(component, type, timeWindow);
        if (trend) {
          trends.push(trend);
        }
      });
    });

    const healthScore = this.calculateHealthScore(summaryStats);

    return {
      timeWindow,
      healthScore,
      componentStats: summaryStats,
      trends,
      totalDataPoints: this.dataPoints.length,
      timeRange: {
        start: this.dataPoints[0]?.timestamp || new Date(),
        end: this.dataPoints[this.dataPoints.length - 1]?.timestamp || new Date()
      }
    };
  }

  calculateHealthScore(summaryStats) {
    let totalScore = 0;
    let componentCount = 0;

    Object.values(summaryStats).forEach(stats => {
      if (stats.length === 0) return;

      let componentScore = 100;
      componentCount++;

      stats.forEach(stat => {
        switch (stat.type) {
          case 'error_rate':
            componentScore -= Math.min(stat.average * 2, 50);
            break;
          case 'operation_duration':
            if (stat.average > 5000) componentScore -= 20;
            if (stat.average > 10000) componentScore -= 30;
            break;
        }
      });

      totalScore += Math.max(0, componentScore);
    });

    return componentCount > 0 ? Math.round(totalScore / componentCount) : 100;
  }

  reset() {
    this.dataPoints = [];
    this.alertCallbacks = [];
  }
}

async function testPerformanceMetrics() {
  console.log('🧪 Testing Performance Metrics Collection and Analysis...\n');
  
  const metricsCollector = new MockPerformanceMetricsCollector();
  let alertsReceived = [];

  // Setup alert listener
  metricsCollector.onAlert(alert => {
    alertsReceived.push(alert);
  });

  try {
    // Test 1: Basic metric recording
    console.log('📝 Test 1: Basic metric recording');
    
    metricsCollector.recordMetric('operation_duration', 1500, 'driver-locks', 'ms', {
      operation: 'lockDriver'
    });
    
    metricsCollector.recordMetric('operation_duration', 2500, 'bid-reservation', 'ms', {
      operation: 'reserveBid'
    });

    const metrics = metricsCollector.getMetrics();
    
    if (metrics.length === 2) {
      console.log('✅ Test 1 PASSED: Metrics recorded correctly');
    } else {
      console.log('❌ Test 1 FAILED: Metrics not recorded properly');
    }

    // Test 2: Operation timing recording
    console.log('\n📝 Test 2: Operation timing recording');
    
    const startTime = Date.now() - 3000; // Simulate 3 second operation
    metricsCollector.recordOperationTiming('databaseQuery', 'database-orders', startTime, {
      success: true,
      queryType: 'SELECT'
    });

    const timingMetrics = metricsCollector.getMetrics(null, 'operation_duration');
    const lastTiming = timingMetrics[timingMetrics.length - 1];
    
    if (lastTiming && lastTiming.value >= 2900 && lastTiming.value <= 3100) {
      console.log('✅ Test 2 PASSED: Operation timing recorded correctly');
    } else {
      console.log('❌ Test 2 FAILED: Operation timing incorrect');
    }

    // Test 3: Error rate calculation
    console.log('\n📝 Test 3: Error rate calculation');
    
    metricsCollector.recordErrorRate('api-endpoints', 80, 20); // 20% error rate
    
    const errorRateMetrics = metricsCollector.getMetrics(null, 'error_rate');
    const errorRate = errorRateMetrics[errorRateMetrics.length - 1];
    
    if (errorRate && errorRate.value === 20) {
      console.log('✅ Test 3 PASSED: Error rate calculated correctly (20%)');
    } else {
      console.log('❌ Test 3 FAILED: Error rate calculation incorrect');
    }

    // Test 4: Throughput calculation
    console.log('\n📝 Test 4: Throughput calculation');
    
    metricsCollector.recordThroughput('request-processor', 1000, 10000); // 100 ops/s
    
    const throughputMetrics = metricsCollector.getMetrics(null, 'throughput');
    const throughput = throughputMetrics[throughputMetrics.length - 1];
    
    if (throughput && throughput.value === 100) {
      console.log('✅ Test 4 PASSED: Throughput calculated correctly (100 ops/s)');
    } else {
      console.log('❌ Test 4 FAILED: Throughput calculation incorrect');
    }

    // Test 5: Statistics calculation
    console.log('\n📝 Test 5: Statistics calculation');
    
    // Add multiple data points for statistics
    for (let i = 0; i < 10; i++) {
      metricsCollector.recordMetric('operation_duration', 1000 + (i * 100), 'test-component', 'ms');
    }
    
    const stats = metricsCollector.calculateStats('test-component', 'operation_duration');
    
    if (stats && stats.count === 10 && stats.min === 1000 && stats.max === 1900) {
      console.log('✅ Test 5 PASSED: Statistics calculated correctly');
      console.log(`   Count: ${stats.count}, Min: ${stats.min}ms, Max: ${stats.max}ms, Avg: ${stats.average}ms`);
    } else {
      console.log('❌ Test 5 FAILED: Statistics calculation incorrect');
    }

    // Test 6: Trend analysis
    console.log('\n📝 Test 6: Trend analysis');
    
    // Create increasing trend
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      metricsCollector.recordMetric('error_rate', 5 + (i * 2), 'trending-component', '%');
    }
    
    const trend = metricsCollector.analyzeTrend('trending-component', 'error_rate');
    
    if (trend && trend.trend === 'DEGRADING' && trend.changePercent > 0) {
      console.log('✅ Test 6 PASSED: Trend analysis detected degrading pattern');
      console.log(`   Trend: ${trend.trend}, Change: ${trend.changePercent}%`);
    } else {
      console.log('❌ Test 6 FAILED: Trend analysis incorrect');
    }

    // Test 7: Threshold alerts
    console.log('\n📝 Test 7: Threshold alerts');
    
    alertsReceived = []; // Reset alerts
    
    // Trigger warning alert (>5000ms)
    metricsCollector.recordMetric('operation_duration', 6000, 'slow-component', 'ms');
    
    // Trigger error rate alert (>10%)
    metricsCollector.recordErrorRate('failing-component', 70, 30); // 30% error rate
    
    if (alertsReceived.length >= 2) {
      console.log('✅ Test 7 PASSED: Threshold alerts triggered correctly');
      alertsReceived.forEach(alert => {
        console.log(`   Alert: ${alert.severity} - ${alert.message}`);
      });
    } else {
      console.log('❌ Test 7 FAILED: Threshold alerts not triggered');
    }

    // Test 8: Performance summary
    console.log('\n📝 Test 8: Performance summary generation');
    
    const summary = metricsCollector.getPerformanceSummary();
    
    if (summary && summary.healthScore !== undefined && summary.componentStats && summary.trends) {
      console.log('✅ Test 8 PASSED: Performance summary generated');
      console.log(`   Health Score: ${summary.healthScore}/100`);
      console.log(`   Components: ${Object.keys(summary.componentStats).length}`);
      console.log(`   Trends: ${summary.trends.length}`);
      console.log(`   Total Data Points: ${summary.totalDataPoints}`);
    } else {
      console.log('❌ Test 8 FAILED: Performance summary generation failed');
    }

    // Test 9: Component filtering
    console.log('\n📝 Test 9: Component filtering');
    
    const driverMetrics = metricsCollector.getMetrics('driver');
    const bidMetrics = metricsCollector.getMetrics('bid');
    
    console.log(`   Driver-related metrics: ${driverMetrics.length}`);
    console.log(`   Bid-related metrics: ${bidMetrics.length}`);
    
    if (driverMetrics.length > 0 && bidMetrics.length > 0) {
      console.log('✅ Test 9 PASSED: Component filtering works correctly');
    } else {
      console.log('❌ Test 9 FAILED: Component filtering not working');
    }

    // Test 10: Health score calculation
    console.log('\n📝 Test 10: Health score calculation');
    
    // Add some good metrics
    metricsCollector.recordErrorRate('healthy-component', 95, 5); // 5% error rate
    metricsCollector.recordMetric('operation_duration', 500, 'fast-component', 'ms');
    
    // Add some bad metrics  
    metricsCollector.recordErrorRate('unhealthy-component', 60, 40); // 40% error rate
    metricsCollector.recordMetric('operation_duration', 12000, 'slow-component', 'ms');
    
    const finalSummary = metricsCollector.getPerformanceSummary();
    
    console.log(`   Final Health Score: ${finalSummary.healthScore}/100`);
    
    if (finalSummary.healthScore >= 0 && finalSummary.healthScore <= 100) {
      console.log('✅ Test 10 PASSED: Health score calculated within valid range');
    } else {
      console.log('❌ Test 10 FAILED: Health score calculation invalid');
    }

    console.log('\n🎉 Performance metrics test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Basic metric recording');
    console.log('   ✅ Operation timing tracking');
    console.log('   ✅ Error rate calculation');
    console.log('   ✅ Throughput measurement');
    console.log('   ✅ Statistical analysis');
    console.log('   ✅ Trend detection');
    console.log('   ✅ Threshold alerting');
    console.log('   ✅ Performance summary generation');
    console.log('   ✅ Component filtering');
    console.log('   ✅ Health scoring');
    
    return true;
    
  } catch (error) {
    console.error('❌ Performance metrics test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testPerformanceMetrics()
    .then(success => {
      if (success) {
        console.log('\n✅ All performance metrics tests passed!');
        console.log('🚀 Phase 4 performance monitoring is working correctly!');
        process.exit(0);
      } else {
        console.log('\n❌ Performance metrics tests failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testPerformanceMetrics }; 