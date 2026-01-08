/**
 * Simplified Health Check API Endpoints for Phase 4 Database Failure Recovery
 * 
 * Provides basic health check endpoints for monitoring system status.
 */

import { Request, Response } from 'express';
import { globalAlertingSystem } from '../utils/alertingSystem';
import { circuitBreakers, getSystemHealth } from '../utils/circuitBreakerInstances';

// Simple health check response interfaces
interface HealthCheckResponse {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    circuitBreakers: {
      status: 'pass' | 'warn' | 'fail';
      open: number;
      total: number;
      message: string;
    };
    alerting: {
      status: 'pass' | 'warn' | 'fail';
      recentAlerts: number;
      message: string;
    };
    system: {
      status: 'pass' | 'warn' | 'fail';
      healthy: boolean;
      message: string;
    };
  };
}

/**
 * Main health check endpoint
 * GET /health
 */
export const getHealthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    
    // Get system health
    const systemHealth = await getSystemHealth();
    
    // Get alert stats
    const alertStats = globalAlertingSystem.getAlertStats();
    
    // Count circuit breakers
    const totalCircuitBreakers = Object.keys(circuitBreakers).length;
    const openCircuits = systemHealth.openCircuits;
    
    // Determine component statuses
    const circuitBreakerStatus = openCircuits === 0 ? 'pass' : openCircuits <= 2 ? 'warn' : 'fail';
    const alertingStatus = alertStats.recentAlerts === 0 ? 'pass' : alertStats.recentAlerts <= 3 ? 'warn' : 'fail';
    const systemStatus = systemHealth.healthy ? 'pass' : 'fail';
    
    // Calculate overall status
    const allStatuses = [circuitBreakerStatus, alertingStatus, systemStatus];
    const overallStatus = allStatuses.includes('fail') ? 'critical' : 
                         allStatuses.includes('warn') ? 'warning' : 'healthy';

    const healthResponse: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      uptime: process.uptime(),
      checks: {
        circuitBreakers: {
          status: circuitBreakerStatus,
          open: openCircuits,
          total: totalCircuitBreakers,
          message: `${openCircuits} of ${totalCircuitBreakers} circuit breakers are open`
        },
        alerting: {
          status: alertingStatus,
          recentAlerts: alertStats.recentAlerts,
          message: `${alertStats.recentAlerts} recent alerts, ${alertStats.queuedAlerts} queued`
        },
        system: {
          status: systemStatus,
          healthy: systemHealth.healthy,
          message: systemHealth.healthy ? 'System is healthy' : 'System has issues'
        }
      }
    };

    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'critical' ? 503 : 200;
    
    res.status(statusCode).json(healthResponse);

  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'critical',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      uptime: process.uptime(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Circuit breaker health endpoint
 * GET /health/circuit-breakers
 */
export const getCircuitBreakerHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const systemHealth = await getSystemHealth();
    
    const circuitBreakerData = systemHealth.circuitBreakers.map(cb => ({
      name: cb.name,
      status: cb.status,
      healthy: cb.healthy,
      failures: cb.failures,
      lastFailure: cb.lastFailure ? cb.lastFailure.toISOString() : null
    }));

    const response = {
      circuitBreakers: circuitBreakerData,
      summary: {
        total: circuitBreakerData.length,
        open: systemHealth.openCircuits,
        healthy: systemHealth.circuitBreakers.filter(cb => cb.healthy).length
      },
      overallHealth: systemHealth.healthy ? 'healthy' : 'critical'
    };

    const statusCode = systemHealth.healthy ? 200 : 503;
    res.status(statusCode).json(response);
    
  } catch (error) {
    console.error('Circuit breaker health check failed:', error);
    res.status(503).json({
      error: 'Circuit breaker health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Alerting system health endpoint
 * GET /health/alerts
 */
export const getAlertingHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const alertStats = globalAlertingSystem.getAlertStats();
    
    const response = {
      stats: {
        totalAlerts: alertStats.totalAlerts,
        recentAlerts: alertStats.recentAlerts,
        queuedAlerts: alertStats.queuedAlerts,
        throttledAlerts: alertStats.throttledAlerts
      },
      channels: alertStats.channelStats,
      status: alertStats.recentAlerts <= 3 ? 'healthy' : 'warning'
    };

    const statusCode = response.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);
    
  } catch (error) {
    console.error('Alerting health check failed:', error);
    res.status(503).json({
      error: 'Alerting health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * System status endpoint
 * GET /health/system
 */
export const getSystemStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const [systemHealth, alertStats] = await Promise.all([
      getSystemHealth(),
      globalAlertingSystem.getAlertStats()
    ]);

    const response = {
      overall: {
        healthy: systemHealth.healthy,
        timestamp: new Date().toISOString()
      },
      components: {
        circuitBreakers: {
          healthy: systemHealth.healthy,
          openCircuits: systemHealth.openCircuits,
          totalCircuits: Object.keys(circuitBreakers).length
        },
        alerting: {
          healthy: alertStats.recentAlerts <= 3,
          recentAlerts: alertStats.recentAlerts,
          queuedAlerts: alertStats.queuedAlerts
        }
      },
      metadata: {
        totalFailures: systemHealth.totalFailures,
        uptime: process.uptime()
      }
    };

    const statusCode = systemHealth.healthy ? 200 : 503;
    res.status(statusCode).json(response);
    
  } catch (error) {
    console.error('System status check failed:', error);
    res.status(503).json({
      error: 'System status check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Liveness probe endpoint
 * GET /health/live
 */
export const getLivenessProbe = (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

/**
 * Readiness probe endpoint
 * GET /health/ready
 */
export const getReadinessProbe = async (req: Request, res: Response): Promise<void> => {
  try {
    const systemHealth = await getSystemHealth();
    const isReady = systemHealth.healthy && systemHealth.openCircuits <= 3;
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          systemHealthy: systemHealth.healthy,
          openCircuits: systemHealth.openCircuits
        }
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          systemHealthy: systemHealth.healthy,
          openCircuits: systemHealth.openCircuits
        }
      });
    }
    
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 