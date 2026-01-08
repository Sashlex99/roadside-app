/**
 * Production Health Check System
 * 
 * This system monitors the health of the application in production,
 * including performance metrics, error rates, and system status.
 */

import SecureLogger from './secureLogger';
import { checkNetworkConnectivity } from './networkUtils';
import { auth } from '../config/firebase';

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  checks: {
    [key: string]: {
      status: 'pass' | 'warn' | 'fail';
      message: string;
      details?: any;
      duration?: number;
    };
  };
  overallScore: number; // 0-100
  timestamp: string;
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map();
  private static memoryWarningThreshold = 50 * 1024 * 1024; // 50MB

  static startMeasurement(name: string): void {
    this.measurements.set(name, performance.now());
  }

  static endMeasurement(name: string): number {
    const startTime = this.measurements.get(name);
    if (!startTime) {
      console.warn(`No start time found for measurement: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.measurements.delete(name);
    
    // Log slow operations
    if (duration > 1000) { // > 1 second
      SecureLogger.warn('SYSTEM', `Slow operation detected: ${name}`, { duration });
    }

    return duration;
  }

  static checkMemoryUsage(): { status: 'pass' | 'warn' | 'fail'; usage?: number; message: string } {
    if (typeof (performance as any).memory !== 'undefined') {
      const memory = (performance as any).memory;
      const usedMemory = memory.usedJSHeapSize;
      const totalMemory = memory.totalJSHeapSize;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      if (usedMemory > this.memoryWarningThreshold) {
        return {
          status: usedMemory > this.memoryWarningThreshold * 2 ? 'fail' : 'warn',
          usage: usedMemory,
          message: `High memory usage: ${(usedMemory / 1024 / 1024).toFixed(2)}MB (${memoryUsagePercent.toFixed(1)}%)`
        };
      }

      return {
        status: 'pass',
        usage: usedMemory,
        message: `Memory usage normal: ${(usedMemory / 1024 / 1024).toFixed(2)}MB (${memoryUsagePercent.toFixed(1)}%)`
      };
    }

    return {
      status: 'warn',
      message: 'Memory usage monitoring not available'
    };
  }
}

/**
 * Comprehensive health check runner
 */
export class HealthChecker {
  private static async checkFirebaseConnectivity(): Promise<{ status: 'pass' | 'warn' | 'fail'; message: string; duration?: number }> {
    const start = performance.now();
    
    try {
      // Check Firebase Auth connectivity
      const user = auth.currentUser;
      if (user) {
        await user.getIdToken(true); // Force refresh to test connectivity
      }
      
      const duration = performance.now() - start;
      return {
        status: 'pass',
        message: 'Firebase connectivity OK',
        duration
      };
    } catch (error: any) {
      const duration = performance.now() - start;
      return {
        status: error.code === 'network-request-failed' ? 'fail' : 'warn',
        message: `Firebase connectivity issue: ${error.message}`,
        duration
      };
    }
  }

  private static async checkNetworkStatus(): Promise<{ status: 'pass' | 'warn' | 'fail'; message: string; duration?: number }> {
    const start = performance.now();
    
    try {
      const networkStatus = await checkNetworkConnectivity();
      const duration = performance.now() - start;
      
      if (!networkStatus.isConnected) {
        return {
          status: 'fail',
          message: 'No network connectivity',
          duration
        };
      }

      return {
        status: 'pass',
        message: `Network connected (${networkStatus.connectionType})`,
        duration
      };
    } catch (error: any) {
      const duration = performance.now() - start;
      return {
        status: 'fail',
        message: `Network check failed: ${error.message}`,
        duration
      };
    }
  }

  private static checkLocalStorage(): { status: 'pass' | 'warn' | 'fail'; message: string } {
    try {
      const testKey = '__health_check_test__';
      const testValue = Date.now().toString();
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrieved === testValue) {
        return {
          status: 'pass',
          message: 'Local storage working'
        };
      } else {
        return {
          status: 'fail',
          message: 'Local storage read/write mismatch'
        };
      }
    } catch (error: any) {
      return {
        status: 'fail',
        message: `Local storage error: ${error.message}`
      };
    }
  }

  private static async checkAuthState(): Promise<{ status: 'pass' | 'warn' | 'fail'; message: string }> {
    try {
      const user = auth.currentUser;
      if (user) {
        // Check if token is still valid
        const token = await user.getIdTokenResult();
        const isExpired = new Date() > new Date(token.expirationTime);
        
        if (isExpired) {
          return {
            status: 'warn',
            message: 'Auth token expired but user still logged in'
          };
        }

        return {
          status: 'pass',
          message: 'User authenticated with valid token'
        };
      } else {
        return {
          status: 'pass',
          message: 'No user authenticated (normal for logged out state)'
        };
      }
    } catch (error: any) {
      return {
        status: 'warn',
        message: `Auth state check failed: ${error.message}`
      };
    }
  }

  /**
   * Run comprehensive health check
   */
  static async runHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const checks: HealthCheckResult['checks'] = {};

    // Run all health checks in parallel for speed
    const [
      firebaseCheck,
      networkCheck,
      authCheck
    ] = await Promise.allSettled([
      this.checkFirebaseConnectivity(),
      this.checkNetworkStatus(),
      this.checkAuthState()
    ]);

    // Process results
    checks.firebase = firebaseCheck.status === 'fulfilled' ? firebaseCheck.value : {
      status: 'fail',
      message: 'Firebase check failed to execute'
    };

    checks.network = networkCheck.status === 'fulfilled' ? networkCheck.value : {
      status: 'fail',
      message: 'Network check failed to execute'
    };

    checks.auth = authCheck.status === 'fulfilled' ? authCheck.value : {
      status: 'fail',
      message: 'Auth check failed to execute'
    };

    // Synchronous checks
    checks.localStorage = this.checkLocalStorage();
    checks.memory = PerformanceMonitor.checkMemoryUsage();

    // Calculate overall health score
    const totalChecks = Object.keys(checks).length;
    let passCount = 0;
    let warnCount = 0;

    Object.values(checks).forEach(check => {
      if (check.status === 'pass') passCount++;
      else if (check.status === 'warn') warnCount++;
    });

    const overallScore = Math.round(((passCount + warnCount * 0.5) / totalChecks) * 100);

    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (overallScore < 50) {
      overallStatus = 'critical';
    } else if (overallScore < 80 || Object.values(checks).some(check => check.status === 'fail')) {
      overallStatus = 'warning';
    }

    const totalDuration = performance.now() - startTime;
    
    const result: HealthCheckResult = {
      status: overallStatus,
      checks,
      overallScore,
      timestamp: new Date().toISOString()
    };

    // Log health check results
    if (overallStatus === 'critical') {
      SecureLogger.critical('SYSTEM', 'Critical health issues detected', { result, duration: totalDuration });
    } else if (overallStatus === 'warning') {
      SecureLogger.warn('SYSTEM', 'Health warnings detected', { result, duration: totalDuration });
    } else {
      SecureLogger.info('SYSTEM', 'All systems healthy', { score: overallScore, duration: totalDuration });
    }

    return result;
  }

  /**
   * Schedule periodic health checks
   */
  static startPeriodicHealthChecks(intervalMinutes: number = 5): () => void {
    console.log(`🏥 Starting periodic health checks every ${intervalMinutes} minutes`);
    
    const interval = setInterval(async () => {
      try {
        await this.runHealthCheck();
      } catch (error) {
        SecureLogger.error('SYSTEM', 'Periodic health check failed', error);
      }
    }, intervalMinutes * 60 * 1000);

    // Return cleanup function
    return () => {
      console.log('🏥 Stopping periodic health checks');
      clearInterval(interval);
    };
  }
}

/**
 * Enhanced error reporting for production
 */
export class ProductionErrorReporter {
  private static maxReports = 50;
  private static reportKey = 'app_production_error_reports';

  static reportError(error: Error, context: {
    category: string;
    action: string;
    userId?: string;
    additionalData?: any;
  }): void {
    const errorReport = {
      id: `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location?.href : 'unknown',
      appVersion: require('../../package.json')?.version || 'unknown'
    };

    // Log through our system
    SecureLogger.critical('SYSTEM', `Production error: ${context.action}`, errorReport);

    // Store for later analysis (in production, you'd send to external service)
    try {
      const existingReports = localStorage.getItem(this.reportKey) || '[]';
      const reports = JSON.parse(existingReports);
      reports.push(errorReport);
      
      // Keep only recent reports
      const recentReports = reports.slice(-this.maxReports);
      localStorage.setItem(this.reportKey, JSON.stringify(recentReports));
    } catch (e) {
      console.warn('Could not store error report:', e);
    }
  }

  static getStoredReports(): any[] {
    try {
      const reports = localStorage.getItem(this.reportKey) || '[]';
      return JSON.parse(reports);
    } catch (e) {
      console.warn('Could not retrieve error reports:', e);
      return [];
    }
  }

  static clearStoredReports(): void {
    try {
      localStorage.removeItem(this.reportKey);
    } catch (e) {
      console.warn('Could not clear error reports:', e);
    }
  }
}

// Export convenience functions
export const runHealthCheck = () => HealthChecker.runHealthCheck();
export const startHealthMonitoring = (intervalMinutes?: number) => HealthChecker.startPeriodicHealthChecks(intervalMinutes);
export const reportProductionError = (error: Error, context: any) => ProductionErrorReporter.reportError(error, context); 

export const trackSlowOperation = (name: string, duration: number, threshold: number = 2000) => {
  if (duration > threshold) {
    SecureLogger.warn('SYSTEM', `Slow operation detected: ${name}`, { duration });
  }
}; 