// System Monitoring Dashboard for Phase 4 - Database Failure Recovery
// Provides real-time monitoring and alerting for circuit breakers and recovery systems

import { circuitBreakers, getSystemHealth, getDetailedSystemStatus } from './circuitBreakerInstances';
import { DatabaseCircuitBreaker } from './circuitBreaker';
import { CircuitBreakerHealth, CircuitBreakerAlert } from '../types/circuitBreaker';

/**
 * System health status levels
 */
export type SystemHealthLevel = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DOWN';

/**
 * Monitoring dashboard configuration
 */
export interface DashboardConfig {
  /** How often to refresh data (milliseconds) */
  refreshInterval: number;
  /** Alert thresholds */
  alertThresholds: {
    errorRateWarning: number;    // Error rate % to trigger warning
    errorRateCritical: number;   // Error rate % to trigger critical alert
    responseTimeWarning: number; // Response time ms to trigger warning
    responseTimeCritical: number; // Response time ms to trigger critical alert
    openCircuitCount: number;    // Number of open circuits to trigger alert
  };
  /** Whether to log detailed events */
  enableDetailedLogging: boolean;
  /** Whether to send external alerts */
  enableExternalAlerts: boolean;
}

/**
 * System metrics for monitoring
 */
export interface SystemMetrics {
  /** Overall system health */
  systemHealth: SystemHealthLevel;
  /** Total number of circuit breakers */
  totalCircuitBreakers: number;
  /** Number of open circuit breakers */
  openCircuitBreakers: number;
  /** Number of half-open circuit breakers */
  halfOpenCircuitBreakers: number;
  /** Number of closed circuit breakers */
  closedCircuitBreakers: number;
  /** Overall error rate percentage */
  overallErrorRate: number;
  /** Total operations in last period */
  totalOperations: number;
  /** Total failures in last period */
  totalFailures: number;
  /** Average response time */
  averageResponseTime: number;
  /** Timestamp of metrics */
  timestamp: Date;
  /** Individual circuit breaker health */
  circuitBreakerHealth: CircuitBreakerHealth[];
  /** Recent alerts */
  recentAlerts: CircuitBreakerAlert[];
}

/**
 * Real-time monitoring event
 */
export interface MonitoringEvent {
  /** Event type */
  type: 'CIRCUIT_OPENED' | 'CIRCUIT_CLOSED' | 'HIGH_ERROR_RATE' | 'SLOW_RESPONSE' | 'SYSTEM_DEGRADED';
  /** Event severity */
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  /** Event message */
  message: string;
  /** Circuit breaker or system component */
  component: string;
  /** Additional event data */
  data?: any;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * System Monitoring Dashboard class
 */
export class SystemMonitoringDashboard {
  private config: DashboardConfig;
  private metrics: SystemMetrics | null = null;
  private events: MonitoringEvent[] = [];
  private alertHistory: CircuitBreakerAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private eventListeners: Array<(event: MonitoringEvent) => void> = [];

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      refreshInterval: 5000, // 5 seconds
      alertThresholds: {
        errorRateWarning: 10,    // 10% error rate
        errorRateCritical: 25,   // 25% error rate
        responseTimeWarning: 5000,  // 5 second response time
        responseTimeCritical: 10000, // 10 second response time
        openCircuitCount: 2      // 2 open circuits
      },
      enableDetailedLogging: true,
      enableExternalAlerts: false,
      ...config
    };

    this.setupCircuitBreakerEventListeners();
  }

  /**
   * Start monitoring dashboard
   */
  start(): void {
    if (this.monitoringInterval) {
      console.warn('📊 Dashboard already running');
      return;
    }

    console.log('📊 Starting system monitoring dashboard...');
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeSystemHealth();
    }, this.config.refreshInterval);

    // Initial metrics collection
    this.collectMetrics();
    this.analyzeSystemHealth();

    this.emitEvent({
      type: 'SYSTEM_DEGRADED',
      severity: 'INFO',
      message: 'System monitoring dashboard started',
      component: 'monitoring-dashboard',
      timestamp: new Date()
    });
  }

  /**
   * Stop monitoring dashboard
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('📊 System monitoring dashboard stopped');
    }
  }

  /**
   * Collect current system metrics
   */
  private collectMetrics(): void {
    try {
      const systemHealth = getSystemHealth();
      const detailedStatus = getDetailedSystemStatus();

      const totalOperations = detailedStatus.details.reduce((sum, detail) => 
        sum + detail.stats.failures + detail.stats.successes, 0);
      
      const totalFailures = detailedStatus.details.reduce((sum, detail) => 
        sum + detail.stats.failures, 0);

      const errorRate = totalOperations > 0 ? (totalFailures / totalOperations) * 100 : 0;

      // Calculate average response time (simplified - would need actual timing data)
      const avgResponseTime = this.calculateAverageResponseTime();

      // Count circuit breaker states
      const openCount = systemHealth.circuitBreakers.filter(cb => cb.status === 'OPEN').length;
      const halfOpenCount = systemHealth.circuitBreakers.filter(cb => cb.status === 'HALF_OPEN').length;
      const closedCount = systemHealth.circuitBreakers.filter(cb => cb.status === 'CLOSED').length;

      // Determine overall system health level
      const systemHealthLevel = this.determineSystemHealthLevel(
        errorRate,
        avgResponseTime,
        openCount,
        halfOpenCount
      );

      this.metrics = {
        systemHealth: systemHealthLevel,
        totalCircuitBreakers: systemHealth.circuitBreakers.length,
        openCircuitBreakers: openCount,
        halfOpenCircuitBreakers: halfOpenCount,
        closedCircuitBreakers: closedCount,
        overallErrorRate: Math.round(errorRate * 100) / 100,
        totalOperations,
        totalFailures,
        averageResponseTime: avgResponseTime,
        timestamp: new Date(),
        circuitBreakerHealth: systemHealth.circuitBreakers,
        recentAlerts: this.alertHistory.slice(-10)
      };

      if (this.config.enableDetailedLogging) {
        console.log(`📊 Metrics collected: Health=${systemHealthLevel}, Error Rate=${errorRate.toFixed(2)}%, Open CBs=${openCount}`);
      }

    } catch (error) {
      console.error('❌ Failed to collect system metrics:', error);
    }
  }

  /**
   * Analyze system health and trigger alerts
   */
  private analyzeSystemHealth(): void {
    if (!this.metrics) return;

    const { overallErrorRate, averageResponseTime, openCircuitBreakers } = this.metrics;

    // Check error rate thresholds
    if (overallErrorRate >= this.config.alertThresholds.errorRateCritical) {
      this.emitEvent({
        type: 'HIGH_ERROR_RATE',
        severity: 'CRITICAL',
        message: `Critical error rate: ${overallErrorRate.toFixed(2)}%`,
        component: 'system',
        data: { errorRate: overallErrorRate },
        timestamp: new Date()
      });
    } else if (overallErrorRate >= this.config.alertThresholds.errorRateWarning) {
      this.emitEvent({
        type: 'HIGH_ERROR_RATE',
        severity: 'WARNING',
        message: `High error rate: ${overallErrorRate.toFixed(2)}%`,
        component: 'system',
        data: { errorRate: overallErrorRate },
        timestamp: new Date()
      });
    }

    // Check response time thresholds
    if (averageResponseTime >= this.config.alertThresholds.responseTimeCritical) {
      this.emitEvent({
        type: 'SLOW_RESPONSE',
        severity: 'CRITICAL',
        message: `Critical response time: ${averageResponseTime}ms`,
        component: 'system',
        data: { responseTime: averageResponseTime },
        timestamp: new Date()
      });
    } else if (averageResponseTime >= this.config.alertThresholds.responseTimeWarning) {
      this.emitEvent({
        type: 'SLOW_RESPONSE',
        severity: 'WARNING',
        message: `Slow response time: ${averageResponseTime}ms`,
        component: 'system',
        data: { responseTime: averageResponseTime },
        timestamp: new Date()
      });
    }

    // Check open circuit breaker count
    if (openCircuitBreakers >= this.config.alertThresholds.openCircuitCount) {
      this.emitEvent({
        type: 'SYSTEM_DEGRADED',
        severity: 'CRITICAL',
        message: `Multiple circuit breakers open: ${openCircuitBreakers}`,
        component: 'circuit-breakers',
        data: { openCircuits: openCircuitBreakers },
        timestamp: new Date()
      });
    }
  }

  /**
   * Setup event listeners for circuit breakers
   */
  private setupCircuitBreakerEventListeners(): void {
    Object.values(circuitBreakers).forEach(circuitBreaker => {
      const cbName = (circuitBreaker as any).config?.name || 'unknown';

      circuitBreaker.on('opened', (stats) => {
        this.emitEvent({
          type: 'CIRCUIT_OPENED',
          severity: 'CRITICAL',
          message: `Circuit breaker opened: ${cbName}`,
          component: cbName,
          data: { stats },
          timestamp: new Date()
        });
      });

      circuitBreaker.on('closed', (stats) => {
        this.emitEvent({
          type: 'CIRCUIT_CLOSED',
          severity: 'INFO',
          message: `Circuit breaker closed: ${cbName}`,
          component: cbName,
          data: { stats },
          timestamp: new Date()
        });
      });
    });
  }

  /**
   * Emit monitoring event
   */
  private emitEvent(event: MonitoringEvent): void {
    this.events.push(event);

    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events.shift();
    }

    // Log event
    if (this.config.enableDetailedLogging) {
      const emoji = event.severity === 'CRITICAL' ? '🚨' : 
                   event.severity === 'WARNING' ? '⚠️' : 'ℹ️';
      console.log(`${emoji} [${event.component}] ${event.message}`);
    }

    // Send external alerts if enabled
    if (this.config.enableExternalAlerts && event.severity !== 'INFO') {
      this.sendExternalAlert(event);
    }

    // Notify event listeners
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  /**
   * Send external alert (placeholder for webhook/email/Slack integration)
   */
  private async sendExternalAlert(event: MonitoringEvent): Promise<void> {
    try {
      // Placeholder for external alerting
      console.log(`📧 External alert sent: ${event.message}`);
      
      // Example integrations:
      // await sendSlackAlert(event);
      // await sendEmailAlert(event);
      // await callWebhook(event);
      
    } catch (error) {
      console.error('Failed to send external alert:', error);
    }
  }

  /**
   * Calculate average response time (simplified implementation)
   */
  private calculateAverageResponseTime(): number {
    // In a real implementation, this would track actual operation timing
    // For now, return a placeholder based on system health
    if (!this.metrics) return 100;

    const { openCircuitBreakers, overallErrorRate } = this.metrics;
    
    // Simulate response time based on system state
    let baseTime = 100; // 100ms base response time
    
    if (openCircuitBreakers > 0) {
      baseTime += openCircuitBreakers * 500; // +500ms per open circuit
    }
    
    if (overallErrorRate > 10) {
      baseTime += overallErrorRate * 20; // +20ms per % error rate above 10%
    }

    return Math.round(baseTime);
  }

  /**
   * Determine overall system health level
   */
  private determineSystemHealthLevel(
    errorRate: number,
    avgResponseTime: number,
    openCircuits: number,
    halfOpenCircuits: number
  ): SystemHealthLevel {
    // Critical conditions
    if (openCircuits >= 3 || errorRate >= 50 || avgResponseTime >= 15000) {
      return 'DOWN';
    }

    // Degraded conditions
    if (openCircuits >= 2 || errorRate >= 25 || avgResponseTime >= 10000) {
      return 'CRITICAL';
    }

    // Warning conditions
    if (openCircuits >= 1 || halfOpenCircuits >= 2 || errorRate >= 10 || avgResponseTime >= 5000) {
      return 'DEGRADED';
    }

    return 'HEALTHY';
  }

  /**
   * Get current system metrics
   */
  getMetrics(): SystemMetrics | null {
    return this.metrics ? { ...this.metrics } : null;
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 20): MonitoringEvent[] {
    return this.events.slice(-count).reverse(); // Most recent first
  }

  /**
   * Get events by severity
   */
  getEventsBySeverity(severity: MonitoringEvent['severity']): MonitoringEvent[] {
    return this.events.filter(event => event.severity === severity);
  }

  /**
   * Get dashboard summary for display
   */
  getDashboardSummary(): {
    status: SystemHealthLevel;
    criticalAlerts: number;
    warningAlerts: number;
    openCircuits: number;
    errorRate: number;
    responseTime: number;
    uptime: string;
  } {
    if (!this.metrics) {
      return {
        status: 'DOWN',
        criticalAlerts: 0,
        warningAlerts: 0,
        openCircuits: 0,
        errorRate: 0,
        responseTime: 0,
        uptime: '0s'
      };
    }

    const criticalAlerts = this.events.filter(e => e.severity === 'CRITICAL').length;
    const warningAlerts = this.events.filter(e => e.severity === 'WARNING').length;
    
    return {
      status: this.metrics.systemHealth,
      criticalAlerts,
      warningAlerts,
      openCircuits: this.metrics.openCircuitBreakers,
      errorRate: this.metrics.overallErrorRate,
      responseTime: this.metrics.averageResponseTime,
      uptime: this.calculateUptime()
    };
  }

  /**
   * Calculate system uptime
   */
  private calculateUptime(): string {
    // Simplified uptime calculation
    const uptimeMs = Date.now() - (this.metrics?.timestamp.getTime() || Date.now());
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: MonitoringEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: MonitoringEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Reset all metrics and events (for testing)
   */
  reset(): void {
    this.metrics = null;
    this.events = [];
    this.alertHistory = [];
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): string {
    if (!this.metrics) {
      return JSON.stringify({ error: 'No metrics available' });
    }

    return JSON.stringify({
      timestamp: this.metrics.timestamp,
      system_health: this.metrics.systemHealth,
      circuit_breakers: {
        total: this.metrics.totalCircuitBreakers,
        open: this.metrics.openCircuitBreakers,
        half_open: this.metrics.halfOpenCircuitBreakers,
        closed: this.metrics.closedCircuitBreakers
      },
      performance: {
        error_rate: this.metrics.overallErrorRate,
        avg_response_time: this.metrics.averageResponseTime,
        total_operations: this.metrics.totalOperations,
        total_failures: this.metrics.totalFailures
      },
      alerts: {
        critical: this.getEventsBySeverity('CRITICAL').length,
        warning: this.getEventsBySeverity('WARNING').length
      }
    }, null, 2);
  }
}

// Global monitoring dashboard instance
export const globalMonitoringDashboard = new SystemMonitoringDashboard();

/**
 * Utility functions for dashboard integration
 */
export const dashboardUtils = {
  /**
   * Start monitoring with custom config
   */
  startMonitoring: (config?: Partial<DashboardConfig>) => {
    if (config) {
      // Create new dashboard with custom config
      const customDashboard = new SystemMonitoringDashboard(config);
      customDashboard.start();
      return customDashboard;
    } else {
      globalMonitoringDashboard.start();
      return globalMonitoringDashboard;
    }
  },

  /**
   * Get quick health check
   */
  getHealthCheck: () => {
    const metrics = globalMonitoringDashboard.getMetrics();
    if (!metrics) {
      return { healthy: false, message: 'Monitoring not available' };
    }

    return {
      healthy: metrics.systemHealth === 'HEALTHY',
      status: metrics.systemHealth,
      message: `System ${metrics.systemHealth.toLowerCase()}: ${metrics.openCircuitBreakers} open circuits, ${metrics.overallErrorRate}% error rate`
    };
  },

  /**
   * Force metrics collection
   */
  refreshMetrics: () => {
    (globalMonitoringDashboard as any).collectMetrics();
    (globalMonitoringDashboard as any).analyzeSystemHealth();
  }
};

console.log('📊 System monitoring dashboard initialized'); 