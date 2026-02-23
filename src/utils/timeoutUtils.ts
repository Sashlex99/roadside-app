// Timeout Utilities for Phase 4 - Database Failure Recovery
// Provides robust timeout handling for database operations
//
// ✅ ENHANCED: Addresses the "timeout doesn't cancel operations" issue
// JavaScript can't truly cancel Firestore operations, but this module:
// 1. Tracks operation state (cancelled/active)
// 2. Ignores results from timed-out operations
// 3. Provides rollback capabilities for operations that complete after timeout

/**
 * Operation state for tracking cancellation
 */
export interface OperationState {
  isCancelled: boolean;
  isCompleted: boolean;
  startTime: number;
  operationId: string;
}

/**
 * Creates a cancellation token for tracking operation state
 */
export const createCancellationToken = (operationId?: string): OperationState => ({
  isCancelled: false,
  isCompleted: false,
  startTime: Date.now(),
  operationId: operationId || `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
});

/**
 * Custom timeout error class with metadata
 */
export class TimeoutError extends Error {
  public readonly timeoutMs: number;
  public readonly operation: string;
  public readonly metadata?: any;

  constructor(message: string, options: { 
    timeoutMs: number; 
    operation?: string; 
    metadata?: any 
  }) {
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = options.timeoutMs;
    this.operation = options.operation || 'unknown';
    this.metadata = options.metadata;
  }
}

/**
 * Lock acquisition error for driver locking failures
 */
export class LockAcquisitionError extends Error {
  public readonly driverId: string;
  public readonly orderId: string;
  public readonly metadata?: any;

  constructor(message: string, options: { 
    driverId: string; 
    orderId: string; 
    metadata?: any 
  }) {
    super(message);
    this.name = 'LockAcquisitionError';
    this.driverId = options.driverId;
    this.orderId = options.orderId;
    this.metadata = options.metadata;
  }
}

/**
 * Lock verification error for integrity check failures
 */
export class LockVerificationError extends Error {
  public readonly driverId: string;
  public readonly expectedOrderId?: string;
  public readonly actualOrderId?: string;
  public readonly metadata?: any;

  constructor(message: string, options: { 
    driverId: string; 
    expectedOrderId?: string; 
    actualOrderId?: string; 
    metadata?: any 
  }) {
    super(message);
    this.name = 'LockVerificationError';
    this.driverId = options.driverId;
    this.expectedOrderId = options.expectedOrderId;
    this.actualOrderId = options.actualOrderId;
    this.metadata = options.metadata;
  }
}

/**
 * Creates a promise that rejects after a specified timeout
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message to throw on timeout
 * @param operation - Optional operation name for debugging
 * @returns Promise that rejects with TimeoutError
 */
export const createTimeoutPromise = <T = never>(
  timeoutMs: number, 
  errorMessage: string,
  operation?: string
): Promise<T> => {
  return new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage, { 
        timeoutMs, 
        operation,
        metadata: { triggeredAt: new Date().toISOString() }
      }));
    }, timeoutMs);

    // Clean up timeout if promise is used in a race
    const cleanup = () => clearTimeout(timeoutId);
    
    // Return a promise with cleanup function attached
    const promise = Promise.reject(new TimeoutError(errorMessage, { timeoutMs, operation }));
    (promise as any).cleanup = cleanup;
    return promise;
  });
};

/**
 * Wraps an operation with a timeout using Promise.race
 * @param operation - The async operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message for timeout
 * @param operationName - Optional name for debugging
 * @returns Promise that resolves with operation result or rejects with timeout
 */
export const withTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
  operationName?: string
): Promise<T> => {
  const timeoutPromise = createTimeoutPromise<T>(timeoutMs, errorMessage, operationName);

  try {
    const result = await Promise.race([operation, timeoutPromise]);
    return result;
  } catch (error) {
    // Clean up timeout if the operation completed with an error
    if ((timeoutPromise as any).cleanup) {
      (timeoutPromise as any).cleanup();
    }
    throw error;
  }
};

/**
 * ✅ ENHANCED: Cancellable operation wrapper that properly handles timeouts
 *
 * Unlike simple Promise.race, this:
 * 1. Tracks operation state
 * 2. Ignores results from cancelled operations
 * 3. Calls optional rollback if operation completes after timeout
 * 4. Prevents acting on stale data
 *
 * @param operationFn - Function that receives cancellation token and returns a promise
 * @param options - Configuration options
 * @returns Promise with result or timeout error
 */
export const withCancellableTimeout = async <T>(
  operationFn: (token: OperationState) => Promise<T>,
  options: {
    timeoutMs: number;
    operationName: string;
    onRollback?: (result: T, token: OperationState) => Promise<void>;
    onTimeout?: (token: OperationState) => void;
  }
): Promise<T> => {
  const { timeoutMs, operationName, onRollback, onTimeout } = options;
  const token = createCancellationToken(operationName);

  let timeoutId: NodeJS.Timeout;
  let operationResult: T | undefined;
  let operationError: Error | undefined;

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      token.isCancelled = true;
      onTimeout?.(token);

      console.warn(`⏱️ [${operationName}] Operation timed out after ${timeoutMs}ms (id: ${token.operationId})`);
      console.warn(`⏱️ [${operationName}] NOTE: Underlying operation continues but results will be ignored`);

      reject(new TimeoutError(`${operationName} timed out after ${timeoutMs}ms`, {
        timeoutMs,
        operation: operationName,
        metadata: {
          operationId: token.operationId,
          cancelled: true
        }
      }));
    }, timeoutMs);
  });

  // Wrap the operation to track completion
  const wrappedOperation = (async () => {
    try {
      const result = await operationFn(token);
      operationResult = result;
      token.isCompleted = true;

      // If operation completed AFTER timeout (token was cancelled)
      if (token.isCancelled) {
        console.warn(`⚠️ [${operationName}] Operation completed AFTER timeout (id: ${token.operationId})`);
        console.warn(`⚠️ [${operationName}] Result will be ignored, calling rollback if provided`);

        // Call rollback to undo the operation
        if (onRollback) {
          try {
            await onRollback(result, token);
            console.log(`✅ [${operationName}] Rollback completed successfully`);
          } catch (rollbackError) {
            console.error(`❌ [${operationName}] Rollback failed:`, rollbackError);
          }
        }

        // Still throw since we already rejected with timeout
        throw new Error('Operation completed after cancellation');
      }

      return result;
    } catch (error) {
      operationError = error as Error;
      throw error;
    }
  })();

  try {
    const result = await Promise.race([wrappedOperation, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);

    // If this is a timeout error, the operation might still complete
    // We've already set up handling for that in wrappedOperation
    throw error;
  }
};

/**
 * ✅ ENHANCED: Creates a guard function to check if operation should continue
 * Use this inside long-running operations to check cancellation state
 */
export const createCancellationGuard = (token: OperationState) => {
  return (checkpoint: string): void => {
    if (token.isCancelled) {
      console.log(`🛑 [${token.operationId}] Operation cancelled at checkpoint: ${checkpoint}`);
      throw new Error(`Operation cancelled at: ${checkpoint}`);
    }
  };
};

/**
 * ✅ ENHANCED: Wrapper for Firestore operations with proper cancellation handling
 *
 * Example usage:
 * ```typescript
 * const result = await withFirestoreTimeout(
 *   async (token, checkCancelled) => {
 *     checkCancelled('before-query');
 *     const doc = await getDoc(ref);
 *     checkCancelled('after-query');
 *     return doc.data();
 *   },
 *   {
 *     timeoutMs: 5000,
 *     operationName: 'get-user-doc',
 *     onRollback: async (result) => {
 *       // Undo any writes that happened
 *     }
 *   }
 * );
 * ```
 */
export const withFirestoreTimeout = async <T>(
  operationFn: (token: OperationState, checkCancelled: (checkpoint: string) => void) => Promise<T>,
  options: {
    timeoutMs: number;
    operationName: string;
    onRollback?: (result: T, token: OperationState) => Promise<void>;
  }
): Promise<T> => {
  return withCancellableTimeout(
    async (token) => {
      const checkCancelled = createCancellationGuard(token);
      return operationFn(token, checkCancelled);
    },
    {
      ...options,
      onTimeout: (token) => {
        console.log(`🔥 [Firestore] Operation ${options.operationName} timed out, but Firestore call continues...`);
        console.log(`🔥 [Firestore] Any results will be ignored. Consider rollback for write operations.`);
      }
    }
  );
};

/**
 * Creates a timeout promise with automatic cleanup
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message to throw
 * @param operation - Operation name for debugging
 * @returns Object with promise and cleanup function
 */
export const createManagedTimeout = <T = never>(
  timeoutMs: number,
  errorMessage: string,
  operation?: string
): { promise: Promise<T>; cleanup: () => void } => {
  let timeoutId: NodeJS.Timeout;
  
  const promise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage, { 
        timeoutMs, 
        operation,
        metadata: { 
          triggeredAt: new Date().toISOString(),
          managed: true
        }
      }));
    }, timeoutMs);
  });

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  return { promise, cleanup };
};

/**
 * Executes multiple operations with individual timeouts
 * @param operations - Array of operations with their timeout configs
 * @returns Promise that resolves when all operations complete or first timeout
 */
export const executeWithTimeouts = async <T>(
  operations: Array<{
    operation: Promise<T>;
    timeoutMs: number;
    name: string;
  }>
): Promise<T[]> => {
  const results: T[] = [];
  
  for (const { operation, timeoutMs, name } of operations) {
    try {
      const result = await withTimeout(
        operation,
        timeoutMs,
        `Operation ${name} timed out after ${timeoutMs}ms`,
        name
      );
      results.push(result);
    } catch (error) {
      console.error(`Operation ${name} failed:`, error);
      throw error;
    }
  }
  
  return results;
};

/**
 * Retry an operation with exponential backoff and timeout
 * @param operation - The operation to retry
 * @param options - Retry configuration
 * @returns Promise with operation result
 */
export const retryWithTimeout = async <T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    timeoutMs: number;
    backoffMultiplier?: number;
    baseDelayMs?: number;
    operationName?: string;
  }
): Promise<T> => {
  const {
    maxRetries,
    timeoutMs,
    backoffMultiplier = 2,
    baseDelayMs = 1000,
    operationName = 'unknown'
  } = options;

  let lastError: Error = new Error(`Operation ${operationName} failed after ${maxRetries} attempts`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(
        operation(),
        timeoutMs,
        `Operation ${operationName} timed out on attempt ${attempt}`,
        `${operationName}-attempt-${attempt}`
      );
      
      if (attempt > 1) {
        console.log(`✅ Operation ${operationName} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      console.warn(`⚠️ Operation ${operationName} failed on attempt ${attempt}:`, error instanceof Error ? error.message : error);
      
      if (attempt === maxRetries) {
        console.error(`❌ Operation ${operationName} failed after ${maxRetries} attempts`);
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      console.log(`🔄 Retrying ${operationName} in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Utility to check if an error is a timeout error
 * @param error - Error to check
 * @returns True if error is a TimeoutError
 */
export const isTimeoutError = (error: any): error is TimeoutError => {
  return error instanceof TimeoutError || error?.name === 'TimeoutError';
};

/**
 * Utility to check if an error is a lock acquisition error
 * @param error - Error to check
 * @returns True if error is a LockAcquisitionError
 */
export const isLockAcquisitionError = (error: any): error is LockAcquisitionError => {
  return error instanceof LockAcquisitionError || error?.name === 'LockAcquisitionError';
};

/**
 * Utility to check if an error is a lock verification error
 * @param error - Error to check
 * @returns True if error is a LockVerificationError
 */
export const isLockVerificationError = (error: any): error is LockVerificationError => {
  return error instanceof LockVerificationError || error?.name === 'LockVerificationError';
};

/**
 * Get timeout configuration based on operation type
 * @param operationType - Type of operation
 * @returns Recommended timeout in milliseconds
 */
export const getRecommendedTimeout = (operationType: string): number => {
  const timeouts: Record<string, number> = {
    'driver-lock': 10000,      // 10 seconds for driver locking
    'bid-reservation': 15000,  // 15 seconds for bid reservations
    'order-creation': 8000,    // 8 seconds for order creation
    'conflict-resolution': 12000, // 12 seconds for conflict resolution
    'database-query': 5000,    // 5 seconds for simple queries
    'transaction': 20000,      // 20 seconds for complex transactions
    'cleanup': 30000,          // 30 seconds for cleanup operations
    'default': 10000           // 10 seconds default
  };
  
  return timeouts[operationType] || timeouts.default;
};

/**
 * Creates a timeout configuration object for common operations
 * @param operationType - Type of operation
 * @param customTimeoutMs - Optional custom timeout
 * @returns Timeout configuration
 */
export const createTimeoutConfig = (
  operationType: string,
  customTimeoutMs?: number
) => {
  const timeoutMs = customTimeoutMs || getRecommendedTimeout(operationType);
  
  return {
    timeoutMs,
    errorMessage: `${operationType} operation timed out after ${timeoutMs}ms`,
    operationName: operationType,
    retryConfig: {
      maxRetries: operationType.includes('lock') ? 3 : 2,
      baseDelayMs: 1000,
      backoffMultiplier: 2
    }
  };
}; 