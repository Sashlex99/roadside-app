// Database Circuit Breaker Implementation for Phase 4
// Provides fault tolerance and automatic recovery for database operations

import {
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitBreakerHealth,
  CircuitBreakerResult,
  CircuitBreakerOpenError,
  CircuitBreakerAlert,
  CircuitBreakerOperation,
  CircuitBreakerEvents,
  CircuitBreakerManager
} from '../types/circuitBreaker';

/**
 * Main Database Circuit Breaker class
 * Implements the circuit breaker pattern for database operations
 */
export class DatabaseCircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private state: CircuitBreakerState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttemptTime = 0;
  private readonly eventListeners: Partial<CircuitBreakerEvents> = {};

  constructor(config: CircuitBreakerConfig | string) {
    if (typeof config === 'string') {
      // Create default config from name
      this.config = {
        name: config,
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        operationTimeout: 10000  // 10 seconds
      };
    } else {
      this.config = {
        operationTimeout: 10000,
        ...config
      };
    }

    console.log(`🔄 Circuit breaker [${this.config.name}] initialized:`, {
      failureThreshold: this.config.failureThreshold,
      recoveryTimeout: this.config.recoveryTimeout,
      operationTimeout: this.config.operationTimeout
    });
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: CircuitBreakerOperation<T>): Promise<T> {
    const startTime = Date.now();

    // Check if circuit is open
    if (this.isOpen()) {
      const timeUntilRetry = this.nextAttemptTime - Date.now();
      
      if (timeUntilRetry > 0) {
        const error = new CircuitBreakerOpenError(
          `Circuit breaker [${this.config.name}] is OPEN. System recovering. Try again in ${Math.ceil(timeUntilRetry / 1000)}s`,
          {
            circuitBreaker: this.config.name,
            retryAfter: timeUntilRetry,
            metadata: {
              failures: this.failures,
              lastFailureTime: this.lastFailureTime,
              state: this.state
            }
          }
        );

        console.warn(`🚫 [CIRCUIT_BREAKER] ${this.config.name} is OPEN:`, {
          failures: this.failures,
          timeUntilRetry: Math.ceil(timeUntilRetry / 1000),
          lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null
        });

        throw error;
      } else {
        // Time to try half-open
        this.state = 'HALF_OPEN';
        console.log(`🔄 [CIRCUIT_BREAKER] ${this.config.name} transitioning to HALF_OPEN`);
      }
    }

    try {
      // Execute the operation with timeout protection
      const result = await this.executeWithTimeout(operation);
      const duration = Date.now() - startTime;

      // Operation succeeded
      this.onSuccess(duration);
      
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Operation failed
      this.onFailure(error as Error, duration);
      
      throw error;
    }
  }

  /**
   * Execute operation with optional timeout
   */
  private async executeWithTimeout<T>(operation: CircuitBreakerOperation<T>): Promise<T> {
    if (!this.config.operationTimeout) {
      return operation();
    }

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.config.operationTimeout}ms`));
      }, this.config.operationTimeout);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle successful operation
   */
  private onSuccess(duration: number): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Success in half-open state - close the circuit
      this.state = 'CLOSED';
      this.failures = 0; // Reset failure count
      
      console.log(`✅ [CIRCUIT_BREAKER] ${this.config.name} CLOSED after successful recovery`);
      
      this.sendAlert({
        type: 'CIRCUIT_BREAKER_CLOSED',
        service: this.config.name,
        severity: 'MEDIUM',
        timestamp: new Date().toISOString(),
        metadata: {
          recoveryDuration: duration,
          previousFailures: this.failures
        }
      });

      this.emit('closed', this.getStats());
    }

    // Reset consecutive failures on any success
    if (this.failures > 0) {
      console.log(`🔄 [CIRCUIT_BREAKER] ${this.config.name} reset failure count after success (was ${this.failures})`);
      this.failures = 0;
    }

    this.emit('success', { duration }, this.getStats());
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error, duration: number): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    console.warn(`⚠️ [CIRCUIT_BREAKER] ${this.config.name} failure ${this.failures}/${this.config.failureThreshold}:`, {
      error: error.message,
      duration,
      state: this.state
    });

    // Check if we should open the circuit
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;

      console.error(`🚨 [CIRCUIT_BREAKER] ${this.config.name} OPENED after ${this.failures} failures`);
      
      this.sendAlert({
        type: 'CIRCUIT_BREAKER_OPENED',
        service: this.config.name,
        severity: 'HIGH',
        failures: this.failures,
        timestamp: new Date().toISOString(),
        metadata: {
          lastError: error.message,
          failureThreshold: this.config.failureThreshold,
          recoveryTimeout: this.config.recoveryTimeout
        }
      });

      this.emit('opened', this.getStats());
    } else if (this.state === 'HALF_OPEN') {
      // Failure in half-open state - back to open
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      
      console.warn(`🔄 [CIRCUIT_BREAKER] ${this.config.name} back to OPEN after half-open failure`);
    }

    this.emit('failure', error, this.getStats());
  }

  /**
   * Check if circuit is open
   */
  private isOpen(): boolean {
    return this.state === 'OPEN';
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const timeUntilRetry = this.isOpen() ? Math.max(0, this.nextAttemptTime - Date.now()) : undefined;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      timeUntilRetry
    };
  }

  /**
   * Get circuit breaker health information
   */
  getHealth(): CircuitBreakerHealth {
    const stats = this.getStats();
    const now = Date.now();
    
    // Calculate uptime (time since last failure or since creation)
    const uptime = this.lastFailureTime ? now - this.lastFailureTime : now;
    
    // Calculate error rate (failures / total operations in a reasonable window)
    const totalOperations = this.failures + this.successes;
    const errorRate = totalOperations > 0 ? (this.failures / totalOperations) * 100 : 0;

    return {
      name: this.config.name,
      status: this.state,
      failures: this.failures,
      healthy: this.state !== 'OPEN',
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
      metadata: {
        uptime,
        errorRate: Math.round(errorRate * 100) / 100, // Round to 2 decimals
        avgResponseTime: undefined // Would need additional tracking
      }
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    console.log(`🔄 [CIRCUIT_BREAKER] ${this.config.name} manually reset`);
    
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttemptTime = 0;
  }

  /**
   * Force circuit breaker to open (for testing/emergency)
   */
  forceOpen(reason: string = 'Manual intervention'): void {
    console.warn(`🚨 [CIRCUIT_BREAKER] ${this.config.name} force opened: ${reason}`);
    
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
    
    this.sendAlert({
      type: 'CIRCUIT_BREAKER_OPENED',
      service: this.config.name,
      severity: 'CRITICAL',
      timestamp: new Date().toISOString(),
      metadata: {
        reason,
        forced: true
      }
    });
  }

  /**
   * Force circuit breaker to close (for testing/recovery)
   */
  forceClose(reason: string = 'Manual intervention'): void {
    console.log(`✅ [CIRCUIT_BREAKER] ${this.config.name} force closed: ${reason}`);
    
    this.state = 'CLOSED';
    this.failures = 0;
    this.nextAttemptTime = 0;
  }

  /**
   * Add event listener
   */
  on<K extends keyof CircuitBreakerEvents>(
    event: K,
    listener: CircuitBreakerEvents[K]
  ): void {
    this.eventListeners[event] = listener;
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends keyof CircuitBreakerEvents>(
    event: K,
    ...args: Parameters<CircuitBreakerEvents[K]>
  ): void {
    const listener = this.eventListeners[event];
    if (listener) {
      try {
        (listener as any)(...args);
      } catch (error) {
        console.error(`Error in circuit breaker event listener [${event}]:`, error);
      }
    }
  }

  /**
   * Send alert for circuit breaker events
   */
  private async sendAlert(alert: CircuitBreakerAlert): Promise<void> {
    console.log(`🚨 [CIRCUIT_BREAKER_ALERT] ${alert.type}:`, alert);
    
    // TODO: Integrate with external alerting systems
    // This could send to Slack, email, monitoring systems, etc.
    
    try {
      // Example: Could store alerts in database for dashboard
      // await storeAlert(alert);
      
      // Example: Could send to webhook
      // await sendWebhookAlert(alert);
      
    } catch (error) {
      console.error('Failed to send circuit breaker alert:', error);
    }
  }
}

/**
 * Global Circuit Breaker Manager
 * Manages multiple circuit breakers across the application
 */
class CircuitBreakerManagerImpl implements CircuitBreakerManager {
  private circuitBreakers = new Map<string, DatabaseCircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  getCircuitBreaker(name: string): DatabaseCircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const circuitBreaker = new DatabaseCircuitBreaker(name);
      this.circuitBreakers.set(name, circuitBreaker);
    }
    return this.circuitBreakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  getAllCircuitBreakers(): Map<string, DatabaseCircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Get overall system health
   */
  getSystemHealth() {
    const circuitBreakers = Array.from(this.circuitBreakers.values());
    const healthReports = circuitBreakers.map(cb => cb.getHealth());
    
    const openCircuits = healthReports.filter(h => h.status === 'OPEN').length;
    const totalFailures = healthReports.reduce((sum, h) => sum + h.failures, 0);
    const healthy = openCircuits === 0;

    return {
      healthy,
      circuitBreakers: healthReports,
      openCircuits,
      totalFailures
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    console.log('🔄 Resetting all circuit breakers');
    this.circuitBreakers.forEach(cb => cb.reset());
  }
}

// Export global manager instance
export const circuitBreakerManager = new CircuitBreakerManagerImpl();

// Pre-configured circuit breakers for common operations
export const driverLockCircuitBreaker = new DatabaseCircuitBreaker({
  name: 'driver-locks',
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1 minute
  operationTimeout: 10000  // 10 seconds
});

export const bidReservationCircuitBreaker = new DatabaseCircuitBreaker({
  name: 'bid-reservation',
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  operationTimeout: 15000  // 15 seconds
});

export const orderCreationCircuitBreaker = new DatabaseCircuitBreaker({
  name: 'order-creation',
  failureThreshold: 4,
  recoveryTimeout: 45000, // 45 seconds
  operationTimeout: 8000   // 8 seconds
});

// Export types for external use
export {
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitBreakerHealth,
  CircuitBreakerResult,
  CircuitBreakerOpenError,
  CircuitBreakerAlert,
  CircuitBreakerOperation,
  CircuitBreakerEvents,
  CircuitBreakerManager
} from '../types/circuitBreaker'; 