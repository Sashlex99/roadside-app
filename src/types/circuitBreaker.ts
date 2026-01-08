// Circuit Breaker TypeScript Interfaces for Phase 4
// Database Failure Recovery System

/**
 * Circuit breaker states
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerConfig {
  /** Name identifier for the circuit breaker */
  name: string;
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in milliseconds to wait before trying to close the circuit */
  recoveryTimeout: number;
  /** Optional timeout for individual operations */
  operationTimeout?: number;
}

/**
 * Circuit breaker operational statistics
 */
export interface CircuitBreakerStats {
  /** Current state of the circuit breaker */
  state: CircuitBreakerState;
  /** Total number of failed operations */
  failures: number;
  /** Total number of successful operations */
  successes: number;
  /** Timestamp of the last failure */
  lastFailureTime: number | null;
  /** Timestamp of the last success */
  lastSuccessTime: number | null;
  /** Time remaining until circuit can be closed (if open) */
  timeUntilRetry?: number;
}

/**
 * Circuit breaker health status information
 */
export interface CircuitBreakerHealth {
  /** Circuit breaker identifier */
  name: string;
  /** Current operational status */
  status: CircuitBreakerState;
  /** Number of current failures */
  failures: number;
  /** Whether the circuit breaker is healthy */
  healthy: boolean;
  /** Last failure timestamp if any */
  lastFailure: Date | null;
  /** Additional metadata */
  metadata?: {
    uptime: number;
    errorRate: number;
    avgResponseTime?: number;
  };
}

/**
 * Result of a circuit breaker operation
 */
export interface CircuitBreakerResult<T> {
  /** Whether the operation was successful */
  success: boolean;
  /** The result data if successful */
  data?: T;
  /** Error information if failed */
  error?: string;
  /** Operation duration in milliseconds */
  duration: number;
  /** Circuit breaker state at time of operation */
  circuitState: CircuitBreakerState;
}

/**
 * Custom error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  public readonly circuitBreakerName: string;
  public readonly retryAfter: number;
  public readonly metadata?: any;

  constructor(message: string, options: { 
    circuitBreaker: string; 
    retryAfter: number; 
    metadata?: any 
  }) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
    this.circuitBreakerName = options.circuitBreaker;
    this.retryAfter = options.retryAfter;
    this.metadata = options.metadata;
  }
}

/**
 * Alert types for circuit breaker events
 */
export interface CircuitBreakerAlert {
  /** Type of alert */
  type: 'CIRCUIT_BREAKER_OPENED' | 'CIRCUIT_BREAKER_CLOSED' | 'HIGH_FAILURE_RATE';
  /** Service or component name */
  service: string;
  /** Alert severity level */
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** Number of failures that triggered the alert */
  failures?: number;
  /** Alert timestamp */
  timestamp: string;
  /** Additional alert metadata */
  metadata?: {
    failureRate?: number;
    avgResponseTime?: number;
    affectedOperations?: string[];
    recoveryDuration?: number;
    previousFailures?: number;
    lastError?: string;
    failureThreshold?: number;
    recoveryTimeout?: number;
    reason?: string;
    forced?: boolean;
    [key: string]: any; // Allow additional properties
  };
}

/**
 * Circuit breaker operation wrapper type
 */
export type CircuitBreakerOperation<T> = () => Promise<T>;

/**
 * Circuit breaker event listener types
 */
export interface CircuitBreakerEvents {
  /** Fired when circuit breaker opens */
  opened: (stats: CircuitBreakerStats) => void;
  /** Fired when circuit breaker closes */
  closed: (stats: CircuitBreakerStats) => void;
  /** Fired on each failure */
  failure: (error: Error, stats: CircuitBreakerStats) => void;
  /** Fired on each success */
  success: (result: any, stats: CircuitBreakerStats) => void;
}

/**
 * System-wide circuit breaker manager interface
 */
export interface CircuitBreakerManager {
  /** Get circuit breaker by name */
  getCircuitBreaker(name: string): DatabaseCircuitBreaker | undefined;
  /** Get all circuit breakers */
  getAllCircuitBreakers(): Map<string, DatabaseCircuitBreaker>;
  /** Get overall system health */
  getSystemHealth(): {
    healthy: boolean;
    circuitBreakers: CircuitBreakerHealth[];
    openCircuits: number;
    totalFailures: number;
  };
}

// Forward declaration for the main class
export declare class DatabaseCircuitBreaker {
  constructor(config: CircuitBreakerConfig | string);
  execute<T>(operation: CircuitBreakerOperation<T>): Promise<T>;
  getStats(): CircuitBreakerStats;
  getHealth(): CircuitBreakerHealth;
  reset(): void;
} 