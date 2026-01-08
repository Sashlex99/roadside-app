// Application-Specific Circuit Breaker Instances for Phase 4
// Pre-configured circuit breakers for roadside assistance operations

import { DatabaseCircuitBreaker, circuitBreakerManager } from './circuitBreaker';
import { CircuitBreakerConfig } from '../types/circuitBreaker';

/**
 * Circuit breaker configurations for different operation types
 */
const CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  // Driver-related operations
  'driver-locks': {
    name: 'driver-locks',
    failureThreshold: 5,        // Allow 5 failures before opening
    recoveryTimeout: 60000,     // 1 minute recovery time
    operationTimeout: 10000     // 10 second operation timeout
  },

  'driver-availability': {
    name: 'driver-availability',
    failureThreshold: 3,        // More sensitive for availability checks
    recoveryTimeout: 30000,     // 30 second recovery
    operationTimeout: 5000      // 5 second timeout for quick checks
  },

  'driver-location-updates': {
    name: 'driver-location-updates',
    failureThreshold: 10,       // Allow more failures for location updates
    recoveryTimeout: 45000,     // 45 second recovery
    operationTimeout: 8000      // 8 second timeout
  },

  // Order-related operations
  'order-creation': {
    name: 'order-creation',
    failureThreshold: 3,        // Critical operation - low tolerance
    recoveryTimeout: 45000,     // 45 second recovery
    operationTimeout: 12000     // 12 second timeout for complex creation
  },

  'order-updates': {
    name: 'order-updates',
    failureThreshold: 4,        // Moderate tolerance
    recoveryTimeout: 30000,     // 30 second recovery
    operationTimeout: 8000      // 8 second timeout
  },

  'order-cleanup': {
    name: 'order-cleanup',
    failureThreshold: 8,        // Higher tolerance for cleanup
    recoveryTimeout: 120000,    // 2 minute recovery
    operationTimeout: 30000     // 30 second timeout for cleanup operations
  },

  // Bid-related operations
  'bid-reservation': {
    name: 'bid-reservation',
    failureThreshold: 3,        // Critical for payment flow
    recoveryTimeout: 30000,     // 30 second recovery
    operationTimeout: 15000     // 15 second timeout
  },

  'bid-confirmation': {
    name: 'bid-confirmation',
    failureThreshold: 2,        // Very critical - final step
    recoveryTimeout: 60000,     // 1 minute recovery
    operationTimeout: 20000     // 20 second timeout
  },

  'bid-cancellation': {
    name: 'bid-cancellation',
    failureThreshold: 5,        // Allow more failures for cancellations
    recoveryTimeout: 45000,     // 45 second recovery
    operationTimeout: 10000     // 10 second timeout
  },

  'conflict-resolution': {
    name: 'conflict-resolution',
    failureThreshold: 4,        // Important for data consistency
    recoveryTimeout: 60000,     // 1 minute recovery
    operationTimeout: 15000     // 15 second timeout
  },

  // Payment-related operations
  'payment-processing': {
    name: 'payment-processing',
    failureThreshold: 2,        // Very critical - money involved
    recoveryTimeout: 120000,    // 2 minute recovery
    operationTimeout: 25000     // 25 second timeout
  },

  'payment-confirmation': {
    name: 'payment-confirmation',
    failureThreshold: 2,        // Very critical
    recoveryTimeout: 60000,     // 1 minute recovery
    operationTimeout: 15000     // 15 second timeout
  },

  // General database operations
  'database-queries': {
    name: 'database-queries',
    failureThreshold: 8,        // Higher tolerance for read operations
    recoveryTimeout: 30000,     // 30 second recovery
    operationTimeout: 8000      // 8 second timeout
  },

  'database-transactions': {
    name: 'database-transactions',
    failureThreshold: 4,        // Moderate tolerance for transactions
    recoveryTimeout: 45000,     // 45 second recovery
    operationTimeout: 20000     // 20 second timeout
  },

  // Notification operations
  'push-notifications': {
    name: 'push-notifications',
    failureThreshold: 10,       // High tolerance - not critical for core flow
    recoveryTimeout: 60000,     // 1 minute recovery
    operationTimeout: 10000     // 10 second timeout
  },

  // Location services (CRITICAL for roadside assistance)
  'location-services': {
    name: 'location-services',
    failureThreshold: 3,        // Low tolerance - GPS is critical
    recoveryTimeout: 45000,     // 45 second recovery
    operationTimeout: 10000     // 10 second timeout for GPS
  },

  'geocoding-services': {
    name: 'geocoding-services',
    failureThreshold: 5,        // Higher tolerance - addresses are nice-to-have
    recoveryTimeout: 60000,     // 1 minute recovery
    operationTimeout: 8000      // 8 second timeout for geocoding
  },

  'sms-notifications': {
    name: 'sms-notifications',
    failureThreshold: 8,        // High tolerance
    recoveryTimeout: 120000,    // 2 minute recovery
    operationTimeout: 15000     // 15 second timeout
  }
};

/**
 * Pre-created circuit breaker instances for immediate use
 */
export const circuitBreakers = {
  // Driver operations
  driverLocks: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['driver-locks']),
  driverAvailability: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['driver-availability']),
  driverLocationUpdates: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['driver-location-updates']),

  // Order operations  
  orderCreation: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['order-creation']),
  orderUpdates: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['order-updates']),
  orderCleanup: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['order-cleanup']),

  // Bid operations
  bidReservation: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['bid-reservation']),
  bidConfirmation: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['bid-confirmation']),
  bidCancellation: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['bid-cancellation']),
  conflictResolution: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['conflict-resolution']),

  // Payment operations
  paymentProcessing: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['payment-processing']),
  paymentConfirmation: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['payment-confirmation']),

  // General database operations
  databaseQueries: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['database-queries']),
  databaseTransactions: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['database-transactions']),

  // Notification operations
  pushNotifications: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['push-notifications']),
  smsNotifications: new DatabaseCircuitBreaker(CIRCUIT_BREAKER_CONFIGS['sms-notifications'])
};

/**
 * Register all circuit breakers with the global manager
 */
Object.values(circuitBreakers).forEach(circuitBreaker => {
  const config = (circuitBreaker as any).config;
  circuitBreakerManager.getAllCircuitBreakers().set(config.name, circuitBreaker);
});

/**
 * Get a circuit breaker by operation type
 * @param operationType - The type of operation (e.g., 'driver-locks', 'bid-reservation')
 * @returns Circuit breaker instance
 */
export const getCircuitBreaker = (operationType: string): DatabaseCircuitBreaker => {
  const circuitBreaker = circuitBreakerManager.getCircuitBreaker(operationType);
  if (!circuitBreaker) {
    // Create a new circuit breaker with default config if not found
    const config = CIRCUIT_BREAKER_CONFIGS[operationType] || {
      name: operationType,
      failureThreshold: 5,
      recoveryTimeout: 60000,
      operationTimeout: 10000
    };
    return new DatabaseCircuitBreaker(config);
  }
  return circuitBreaker;
};

/**
 * Utility function to execute an operation with the appropriate circuit breaker
 * @param operationType - Type of operation
 * @param operation - The operation to execute
 * @returns Promise with operation result
 */
export const executeWithCircuitBreaker = async <T>(
  operationType: string,
  operation: () => Promise<T>
): Promise<T> => {
  const circuitBreaker = getCircuitBreaker(operationType);
  return circuitBreaker.execute(operation);
};

/**
 * Get system health status for all circuit breakers
 * @returns System health information
 */
export const getSystemHealth = () => {
  return circuitBreakerManager.getSystemHealth();
};

/**
 * Get health status for a specific operation type
 * @param operationType - Type of operation
 * @returns Health information
 */
export const getOperationHealth = (operationType: string) => {
  const circuitBreaker = getCircuitBreaker(operationType);
  return circuitBreaker.getHealth();
};

/**
 * Reset all circuit breakers (for emergency recovery)
 * @param reason - Reason for reset
 */
export const resetAllCircuitBreakers = (reason: string = 'Manual reset') => {
  console.log(`🔄 Resetting all circuit breakers: ${reason}`);
  Object.values(circuitBreakers).forEach(cb => cb.reset());
  console.log('✅ All circuit breakers reset successfully');
};

/**
 * Get detailed status of all circuit breakers
 * @returns Detailed status information
 */
export const getDetailedSystemStatus = () => {
  const systemHealth = getSystemHealth();
  const detailedStatus = Object.entries(circuitBreakers).map(([key, cb]) => ({
    operation: key,
    health: cb.getHealth(),
    stats: cb.getStats()
  }));

  return {
    summary: systemHealth,
    details: detailedStatus,
    timestamp: new Date().toISOString()
  };
};

/**
 * Monitor circuit breaker events and log them
 */
export const setupCircuitBreakerMonitoring = () => {
  Object.values(circuitBreakers).forEach(cb => {
    // Monitor circuit breaker events
    cb.on('opened', (stats) => {
      console.error(`🚨 Circuit breaker OPENED: ${(cb as any).config.name}`, stats);
    });

    cb.on('closed', (stats) => {
      console.log(`✅ Circuit breaker CLOSED: ${(cb as any).config.name}`, stats);
    });

    cb.on('failure', (error, stats) => {
      console.warn(`⚠️ Circuit breaker failure: ${(cb as any).config.name}`, {
        error: error.message,
        stats
      });
    });

    cb.on('success', (result, stats) => {
      // Only log successes for previously failed circuits
      if (stats.failures > 0 || stats.state === 'HALF_OPEN') {
        console.log(`✅ Circuit breaker success: ${(cb as any).config.name}`, {
          stats,
          recovering: stats.state === 'HALF_OPEN'
        });
      }
    });
  });

  console.log('🔍 Circuit breaker monitoring enabled for all instances');
};

// Initialize monitoring on module load
setupCircuitBreakerMonitoring();

// Export configurations for external reference
export { CIRCUIT_BREAKER_CONFIGS };

console.log(`🔄 Initialized ${Object.keys(circuitBreakers).length} circuit breaker instances for roadside assistance operations`); 