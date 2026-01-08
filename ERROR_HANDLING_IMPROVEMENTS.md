# 🛡️ Error Handling & Logic Improvements

## 🔍 Critical Issues Identified

### **1. Potential Infinite Loop in AuthContext**
**File:** `src/contexts/AuthContext.tsx`
**Issue:** Network recovery could trigger infinite auth refresh attempts

```typescript
// CURRENT - Potential infinite loop
const refreshAuth = async () => {
  try {
    // ...refresh logic
  } catch (error) {
    await forceLogout(); // This could trigger another auth state change
  }
};

// IMPROVEMENT - Add circuit breaker
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;
const REFRESH_COOLDOWN = 30000; // 30 seconds
let lastRefreshAttempt = 0;

const refreshAuth = async () => {
  const now = Date.now();
  
  if (now - lastRefreshAttempt < REFRESH_COOLDOWN) {
    console.log('Auth refresh in cooldown period');
    return;
  }
  
  if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
    console.log('Max refresh attempts reached, forcing logout');
    await forceLogout();
    return;
  }
  
  try {
    refreshAttempts++;
    lastRefreshAttempt = now;
    // ...refresh logic
    refreshAttempts = 0; // Reset on success
  } catch (error) {
    if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
      await forceLogout();
    }
  }
};
```

### **2. Race Condition in Order Creation**
**File:** `src/services/firestore/orders.ts`
**Issue:** Multiple order creation attempts could create duplicates

```typescript
// CURRENT - Potential duplicate creation
export const createOrder = async (orderData, options) => {
  try {
    return await createOrderWithFirebaseBugWorkaround(orderData, options);
  } catch (error) {
    const { createOrderViaREST } = await import('../firestoreREST');
    return await createOrderViaREST(orderData); // No duplicate check
  }
};

// IMPROVEMENT - Add duplicate prevention
const pendingCreations = new Map<string, Promise<string>>();

export const createOrder = async (orderData, options) => {
  // Create unique key for this order request
  const orderKey = JSON.stringify({
    clientId: orderData.clientId,
    description: orderData.description.trim(),
    location: {
      lat: Math.round(orderData.location.latitude * 10000),
      lng: Math.round(orderData.location.longitude * 10000)
    },
    timestamp: Math.floor(Date.now() / 10000) // 10-second window
  });
  
  // Check if same order is already being created
  if (pendingCreations.has(orderKey)) {
    console.log('Duplicate order creation detected, using existing promise');
    return await pendingCreations.get(orderKey)!;
  }
  
  const creationPromise = (async () => {
    try {
      return await createOrderWithFirebaseBugWorkaround(orderData, options);
    } catch (error) {
      const { createOrderViaREST } = await import('../firestoreREST');
      return await createOrderViaREST(orderData);
    } finally {
      pendingCreations.delete(orderKey);
    }
  })();
  
  pendingCreations.set(orderKey, creationPromise);
  return await creationPromise;
};
```

### **3. Memory Leak in OfflineQueue**
**File:** `src/utils/offlineSync.ts`
**Issue:** Processing queue grows without bounds

```typescript
// CURRENT - Unbounded queue growth
export class EnhancedOfflineQueue {
  private processingQueue = new Set<string>();
  
  async processQueue(): Promise<SyncResult> {
    // Queue can grow indefinitely
  }
}

// IMPROVEMENT - Add queue size limits
export class EnhancedOfflineQueue {
  private processingQueue = new Set<string>();
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly MAX_PROCESSING_TIME = 300000; // 5 minutes
  
  async addOperation(operation: OfflineOperation): Promise<boolean> {
    const operations = await this.getStoredOperations();
    
    if (operations.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest low-priority operations
      const lowPriorityOps = operations
        .filter(op => op.priority === 'low')
        .sort((a, b) => a.timestamp - b.timestamp);
      
      if (lowPriorityOps.length > 0) {
        await this.removeOperation(lowPriorityOps[0].id);
      } else {
        console.warn('Queue full, rejecting operation');
        return false;
      }
    }
    
    return true;
  }
  
  async processQueue(): Promise<SyncResult> {
    const startTime = Date.now();
    
    // Add timeout for processing
    const timeoutPromise = new Promise<SyncResult>((resolve) => {
      setTimeout(() => {
        console.warn('Queue processing timeout');
        resolve({
          success: false,
          operations: { successful: 0, failed: 0, conflicts: 0 },
          conflicts: [],
          errors: ['Processing timeout']
        });
      }, this.MAX_PROCESSING_TIME);
    });
    
    const processingPromise = this.processQueueInternal();
    
    return Promise.race([processingPromise, timeoutPromise]);
  }
}
```

## 🛠️ Critical Fixes

### **1. Enhanced Error Boundary**
```typescript
interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  fallbackComponent?: React.ComponentType;
  onRecovery?: () => void;
}

export class EnhancedErrorBoundary extends Component {
  private retryCount = 0;
  private readonly maxRetries: number;
  
  constructor(props: Props & ErrorRecoveryOptions) {
    super(props);
    this.maxRetries = props.maxRetries || 3;
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced error categorization
    const errorCategory = this.categorizeError(error);
    
    switch (errorCategory) {
      case 'network':
        this.handleNetworkError(error);
        break;
      case 'auth':
        this.handleAuthError(error);
        break;
      case 'memory':
        this.handleMemoryError(error);
        break;
      default:
        this.handleGenericError(error, errorInfo);
    }
  }
  
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('auth') || message.includes('permission')) {
      return 'auth';
    }
    if (message.includes('memory') || message.includes('heap')) {
      return 'memory';
    }
    
    return 'generic';
  }
  
  private async handleNetworkError(error: Error) {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      
      // Wait for network recovery
      const networkRecovered = await this.waitForNetworkRecovery();
      
      if (networkRecovered) {
        this.setState({ hasError: false });
        this.props.onRecovery?.();
      }
    }
  }
  
  private async waitForNetworkRecovery(): Promise<boolean> {
    return new Promise((resolve) => {
      const checkNetwork = async () => {
        try {
          const { checkNetworkConnectivity } = await import('../utils/networkUtils');
          const status = await checkNetworkConnectivity();
          
          if (status.isConnected) {
            resolve(true);
          } else {
            setTimeout(checkNetwork, 5000); // Check every 5 seconds
          }
        } catch {
          resolve(false);
        }
      };
      
      checkNetwork();
      
      // Give up after 30 seconds
      setTimeout(() => resolve(false), 30000);
    });
  }
}
```

### **2. Safe Async Operations**
```typescript
export const createSafeAsyncWrapper = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    timeout?: number;
    retries?: number;
    fallback?: R;
    onError?: (error: Error) => void;
  } = {}
) => {
  const { timeout = 30000, retries = 2, fallback, onError } = options;
  
  return async (...args: T): Promise<R> => {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), timeout);
        });
        
        const operationPromise = fn(...args);
        
        return await Promise.race([operationPromise, timeoutPromise]);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    onError?.(lastError!);
    
    if (fallback !== undefined) {
      return fallback;
    }
    
    throw lastError!;
  };
};

// Usage example
const safeCreateOrder = createSafeAsyncWrapper(createOrder, {
  timeout: 45000,
  retries: 2,
  onError: (error) => console.error('Order creation failed:', error)
});
```

### **3. Resource Cleanup Manager**
```typescript
export class ResourceManager {
  private resources = new Set<() => void>();
  private timers = new Set<NodeJS.Timeout>();
  private subscriptions = new Set<() => void>();
  
  addTimer(timer: NodeJS.Timeout): NodeJS.Timeout {
    this.timers.add(timer);
    return timer;
  }
  
  addSubscription(unsubscribe: () => void): () => void {
    this.subscriptions.add(unsubscribe);
    return unsubscribe;
  }
  
  addResource(cleanup: () => void): () => void {
    this.resources.add(cleanup);
    return cleanup;
  }
  
  cleanup(): void {
    // Clear timers
    this.timers.forEach(timer => {
      try {
        clearTimeout(timer);
      } catch (error) {
        console.warn('Timer cleanup error:', error);
      }
    });
    this.timers.clear();
    
    // Clear subscriptions
    this.subscriptions.forEach(unsub => {
      try {
        unsub();
      } catch (error) {
        console.warn('Subscription cleanup error:', error);
      }
    });
    this.subscriptions.clear();
    
    // Clear other resources
    this.resources.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Resource cleanup error:', error);
      }
    });
    this.resources.clear();
  }
}

// Hook for automatic resource management
export const useResourceManager = () => {
  const managerRef = useRef(new ResourceManager());
  
  useEffect(() => {
    return () => {
      managerRef.current.cleanup();
    };
  }, []);
  
  return managerRef.current;
};
``` 