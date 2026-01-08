// Performance Metrics Collection and Analysis for Phase 4
// Tracks detailed performance data for circuit breakers and database operations

import { CircuitBreakerStats } from '../types/circuitBreaker';

/**
 * Performance metric types
 */
export type MetricType = 
  | 'operation_duration'
  | 'error_rate' 
  | 'throughput'
  | 'circuit_breaker_state'
  | 'database_latency'
  | 'recovery_time'
  | 'compensation_time';

/**
 * Performance metric data point
 */
export interface MetricDataPoint {
  /** Timestamp of the metric */
  timestamp: Date;
  /** Type of metric */
  type: MetricType;
  /** Metric value */
  value: number;
  /** Associated operation or component */
  component: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Unit of measurement */
  unit: string;
}

/**
 * Aggregated metric statistics
 */
export interface MetricStats {
  /** Metric type */
  type: MetricType;
  /** Component name */
  component: string;
  /** Time period for aggregation */
  timeWindow: number;
  /** Total data points */
  count: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Average value */
  average: number;
  /** Median value */
  median: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
  /** Standard deviation */
  stdDev: number;
  /** Time range of data */
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Performance trend analysis
 */
export interface TrendAnalysis {
  /** Component being analyzed */
  component: string;
  /** Metric type */
  type: MetricType;
  /** Trend direction */
  trend: 'IMPROVING' | 'DEGRADING' | 'STABLE' | 'VOLATILE';
  /** Trend strength (0-1) */
  strength: number;
  /** Change percentage over time period */
  changePercent: number;
  /** Prediction for next period */
  prediction?: number;
  /** Confidence in prediction (0-1) */
  confidence?: number;
}

/**
 * Performance alert threshold
 */
export interface PerformanceThreshold {
  /** Metric type */
  type: MetricType;
  /** Component pattern (glob-like) */
  componentPattern: string;
  /** Threshold value */
  value: number;
  /** Comparison operator */
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  /** Alert severity */
  severity: 'WARNING' | 'CRITICAL';
  /** Alert message template */
  message: string;
}

/**
 * Performance metrics collector and analyzer
 */
export class PerformanceMetricsCollector {
  private dataPoints: MetricDataPoint[] = [];
  private thresholds: PerformanceThreshold[] = [];
  private alertCallbacks: Array<(alert: PerformanceAlert) => void> = [];
  private maxDataPoints = 10000; // Keep last 10k data points
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupDefaultThresholds();
    this.startCleanupInterval();
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    type: MetricType,
    value: number,
    component: string,
    unit: string = 'ms',
    metadata?: Record<string, any>
  ): void {
    const dataPoint: MetricDataPoint = {
      timestamp: new Date(),
      type,
      value,
      component,
      unit,
      metadata
    };

    this.dataPoints.push(dataPoint);

    // Check thresholds for alerts
    this.checkThresholds(dataPoint);

    // Keep only recent data points
    if (this.dataPoints.length > this.maxDataPoints) {
      this.dataPoints = this.dataPoints.slice(-this.maxDataPoints);
    }
  }

  /**
   * Record operation timing
   */
  recordOperationTiming(
    operation: string,
    component: string,
    startTime: number,
    metadata?: Record<string, any>
  ): void {
    const duration = Date.now() - startTime;
    this.recordMetric('operation_duration', duration, component, 'ms', {
      operation,
      ...metadata
    });
  }

  /**
   * Record error rate
   */
  recordErrorRate(
    component: string,
    successCount: number,
    failureCount: number,
    timeWindow: number = 60000 // 1 minute
  ): void {
    const totalOperations = successCount + failureCount;
    const errorRate = totalOperations > 0 ? (failureCount / totalOperations) * 100 : 0;
    
    this.recordMetric('error_rate', errorRate, component, '%', {
      successCount,
      failureCount,
      totalOperations,
      timeWindow
    });
  }

  /**
   * Record throughput (operations per second)
   */
  recordThroughput(
    component: string,
    operationCount: number,
    timeWindow: number = 60000 // 1 minute
  ): void {
    const throughput = (operationCount / timeWindow) * 1000; // ops per second
    this.recordMetric('throughput', throughput, component, 'ops/s', {
      operationCount,
      timeWindow
    });
  }

  /**
   * Record database latency
   */
  recordDatabaseLatency(
    operation: string,
    latency: number,
    metadata?: Record<string, any>
  ): void {
    this.recordMetric('database_latency', latency, `database-${operation}`, 'ms', {
      operation,
      ...metadata
    });
  }

  /**
   * Record circuit breaker state change
   */
  recordCircuitBreakerState(
    circuitBreakerName: string,
    newState: string,
    stats: CircuitBreakerStats
  ): void {
    const stateValue = newState === 'OPEN' ? 2 : newState === 'HALF_OPEN' ? 1 : 0;
    
    this.recordMetric('circuit_breaker_state', stateValue, circuitBreakerName, 'state', {
      state: newState,
      failures: stats.failures,
      successes: stats.successes,
      timeUntilRetry: stats.timeUntilRetry
    });
  }

  /**
   * Record recovery time (time to recover from failure)
   */
  recordRecoveryTime(
    component: string,
    recoveryTime: number,
    metadata?: Record<string, any>
  ): void {
    this.recordMetric('recovery_time', recoveryTime, component, 'ms', metadata);
  }

  /**
   * Record compensation action timing
   */
  recordCompensationTime(
    operation: string,
    compensationTime: number,
    actionsCount: number
  ): void {
    this.recordMetric('compensation_time', compensationTime, `compensation-${operation}`, 'ms', {
      operation,
      actionsCount
    });
  }

  /**
   * Get metrics for a specific component and type
   */
  getMetrics(
    component?: string,
    type?: MetricType,
    timeWindow?: number
  ): MetricDataPoint[] {
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

  /**
   * Calculate statistics for metrics
   */
  calculateStats(
    component: string,
    type: MetricType,
    timeWindow: number = 300000 // 5 minutes
  ): MetricStats | null {
    const metrics = this.getMetrics(component, type, timeWindow);
    
    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;

    // Calculate percentiles
    const p95Index = Math.floor(values.length * 0.95);
    const p99Index = Math.floor(values.length * 0.99);
    const medianIndex = Math.floor(values.length * 0.5);

    // Calculate standard deviation
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

  /**
   * Analyze performance trends
   */
  analyzeTrend(
    component: string,
    type: MetricType,
    timeWindow: number = 900000 // 15 minutes
  ): TrendAnalysis | null {
    const metrics = this.getMetrics(component, type, timeWindow);
    
    if (metrics.length < 10) {
      return null; // Need at least 10 data points for trend analysis
    }

    const values = metrics.map(m => m.value);
    const timestamps = metrics.map(m => m.timestamp.getTime());
    
    // Simple linear regression for trend
    const n = values.length;
    const sumX = timestamps.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = timestamps.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = timestamps.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Determine trend direction and strength
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changePercent = ((lastValue - firstValue) / firstValue) * 100;
    
    // Calculate correlation coefficient for trend strength
    const avgX = sumX / n;
    const avgY = sumY / n;
    
    const numerator = timestamps.reduce((sum, x, i) => sum + (x - avgX) * (values[i] - avgY), 0);
    const denomX = Math.sqrt(timestamps.reduce((sum, x) => sum + Math.pow(x - avgX, 2), 0));
    const denomY = Math.sqrt(values.reduce((sum, y) => sum + Math.pow(y - avgY, 2), 0));
    
    const correlation = Math.abs(numerator / (denomX * denomY));
    
    // Determine trend direction
    let trend: TrendAnalysis['trend'] = 'STABLE';
    
    if (correlation > 0.7) {
      if (slope > 0) {
        trend = type === 'error_rate' ? 'DEGRADING' : 'IMPROVING';
      } else {
        trend = type === 'error_rate' ? 'IMPROVING' : 'DEGRADING';
      }
    } else if (correlation > 0.3) {
      trend = 'VOLATILE';
    }

    // Predict next value
    const nextTimestamp = Date.now() + (timeWindow / 10); // 10% into future
    const prediction = slope * nextTimestamp + intercept;

    return {
      component,
      type,
      trend,
      strength: correlation,
      changePercent: Math.round(changePercent * 100) / 100,
      prediction: Math.round(prediction * 100) / 100,
      confidence: correlation
    };
  }

  /**
   * Setup default performance thresholds
   */
  private setupDefaultThresholds(): void {
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
        type: 'operation_duration',
        componentPattern: '*',
        value: 10000,
        operator: 'gt',
        severity: 'CRITICAL',
        message: 'Operation duration exceeded 10 seconds'
      },
      {
        type: 'error_rate',
        componentPattern: '*',
        value: 10,
        operator: 'gt',
        severity: 'WARNING',
        message: 'Error rate exceeded 10%'
      },
      {
        type: 'error_rate',
        componentPattern: '*',
        value: 25,
        operator: 'gt',
        severity: 'CRITICAL',
        message: 'Error rate exceeded 25%'
      },
      {
        type: 'database_latency',
        componentPattern: 'database-*',
        value: 3000,
        operator: 'gt',
        severity: 'WARNING',
        message: 'Database latency exceeded 3 seconds'
      },
      {
        type: 'recovery_time',
        componentPattern: '*',
        value: 30000,
        operator: 'gt',
        severity: 'CRITICAL',
        message: 'Recovery time exceeded 30 seconds'
      }
    ];
  }

  /**
   * Check thresholds and trigger alerts
   */
  private checkThresholds(dataPoint: MetricDataPoint): void {
    for (const threshold of this.thresholds) {
      if (threshold.type !== dataPoint.type) continue;
      
      // Simple pattern matching (could be enhanced with real glob matching)
      if (!this.matchesPattern(dataPoint.component, threshold.componentPattern)) continue;

      const violated = this.checkThresholdViolation(dataPoint.value, threshold.value, threshold.operator);
      
      if (violated) {
        const alert: PerformanceAlert = {
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

  /**
   * Check if component matches pattern
   */
  private matchesPattern(component: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return component.startsWith(pattern.slice(0, -1));
    }
    if (pattern.startsWith('*')) {
      return component.endsWith(pattern.slice(1));
    }
    return component === pattern;
  }

  /**
   * Check threshold violation
   */
  private checkThresholdViolation(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  /**
   * Trigger performance alert
   */
  private triggerAlert(alert: PerformanceAlert): void {
    console.warn(`⚠️ Performance Alert [${alert.severity}]: ${alert.message} (${alert.component}: ${alert.actualValue})`);
    
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in performance alert callback:', error);
      }
    });
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Start cleanup interval to manage memory
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      // Remove data points older than 1 hour
      const cutoff = new Date(Date.now() - 3600000);
      this.dataPoints = this.dataPoints.filter(dp => dp.timestamp >= cutoff);
    }, 300000); // Run every 5 minutes
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(timeWindow: number = 300000): PerformanceSummary {
    const components = [...new Set(this.dataPoints.map(dp => dp.component))];
    const metricTypes = [...new Set(this.dataPoints.map(dp => dp.type))];

    const summaryStats: Record<string, MetricStats[]> = {};
    const trends: TrendAnalysis[] = [];

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

    // Calculate overall health score
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

  /**
   * Calculate overall system health score (0-100)
   */
  private calculateHealthScore(summaryStats: Record<string, MetricStats[]>): number {
    let totalScore = 0;
    let componentCount = 0;

    Object.values(summaryStats).forEach(stats => {
      if (stats.length === 0) return;

      let componentScore = 100;
      componentCount++;

      stats.forEach(stat => {
        switch (stat.type) {
          case 'error_rate':
            componentScore -= Math.min(stat.average * 2, 50); // Max penalty 50 points
            break;
          case 'operation_duration':
            if (stat.average > 5000) componentScore -= 20;
            if (stat.average > 10000) componentScore -= 30;
            break;
          case 'database_latency':
            if (stat.average > 1000) componentScore -= 15;
            if (stat.average > 3000) componentScore -= 25;
            break;
        }
      });

      totalScore += Math.max(0, componentScore);
    });

    return componentCount > 0 ? Math.round(totalScore / componentCount) : 100;
  }

  /**
   * Export metrics in various formats
   */
  exportMetrics(format: 'json' | 'csv' | 'prometheus' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.dataPoints, null, 2);
      
      case 'csv':
        return this.exportCSV();
      
      case 'prometheus':
        return this.exportPrometheus();
      
      default:
        return JSON.stringify(this.dataPoints);
    }
  }

  /**
   * Export metrics as CSV
   */
  private exportCSV(): string {
    const headers = ['timestamp', 'type', 'value', 'component', 'unit', 'metadata'];
    const rows = this.dataPoints.map(dp => [
      dp.timestamp.toISOString(),
      dp.type,
      dp.value.toString(),
      dp.component,
      dp.unit,
      JSON.stringify(dp.metadata || {})
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Export metrics in Prometheus format
   */
  private exportPrometheus(): string {
    const metrics = new Map<string, MetricDataPoint[]>();
    
    this.dataPoints.forEach(dp => {
      const key = `${dp.type}_${dp.component}`;
      if (!metrics.has(key)) {
        metrics.set(key, []);
      }
      metrics.get(key)!.push(dp);
    });

    let output = '';
    metrics.forEach((dataPoints, key) => {
      const latest = dataPoints[dataPoints.length - 1];
      output += `# TYPE ${key} gauge\n`;
      output += `${key}{component="${latest.component}"} ${latest.value}\n`;
    });

    return output;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.dataPoints = [];
    this.alertCallbacks = [];
  }
}

/**
 * Performance alert interface
 */
export interface PerformanceAlert {
  type: 'THRESHOLD_VIOLATION' | 'TREND_ALERT' | 'ANOMALY_DETECTED';
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  component: string;
  metricType: MetricType;
  actualValue: number;
  thresholdValue?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Performance summary interface
 */
export interface PerformanceSummary {
  timeWindow: number;
  healthScore: number;
  componentStats: Record<string, MetricStats[]>;
  trends: TrendAnalysis[];
  totalDataPoints: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

// Global performance metrics collector
export const globalPerformanceMetrics = new PerformanceMetricsCollector();

/**
 * Utility decorator for timing functions
 */
export function timed(component: string, operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const operationName = operation || propertyName;

      try {
        const result = await method.apply(this, args);
        globalPerformanceMetrics.recordOperationTiming(operationName, component, startTime, {
          success: true,
          args: args.length
        });
        return result;
      } catch (error) {
        globalPerformanceMetrics.recordOperationTiming(operationName, component, startTime, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          args: args.length
        });
        throw error;
      }
    };

    return descriptor;
  };
}

console.log('📊 Performance metrics system initialized'); 