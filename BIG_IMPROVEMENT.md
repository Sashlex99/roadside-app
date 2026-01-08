// src/utils/firebaseWrapper.ts
class FirebaseOperationWrapper {
  private static readonly DEFAULT_TIMEOUT = 15000;
  private static readonly MAX_RETRIES = 3;
  
  static async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number = this.DEFAULT_TIMEOUT,
    context: string = 'firebase-operation'
  ): Promise<T> {
    const startTime = Date.now();
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        logger.error('FIREBASE_TIMEOUT', `Operation timed out after ${elapsed}ms`, { context });
        reject(new Error(`Firebase operation timeout after ${elapsed}ms: ${context}`));
      }, timeout);
    });
    
    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      const elapsed = Date.now() - startTime;
      logger.debug('FIREBASE_SUCCESS', `Operation completed in ${elapsed}ms`, { context });
      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      logger.error('FIREBASE_ERROR', `Operation failed after ${elapsed}ms`, { context, error });
      throw error;
    }
  }
  
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.MAX_RETRIES,
    context: string = 'firebase-retry'
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('FIREBASE_RETRY', `Attempt ${attempt}/${maxRetries}`, { context });
        return await this.executeWithTimeout(operation, this.DEFAULT_TIMEOUT, context);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          logger.error('FIREBASE_RETRY_EXHAUSTED', 'All retry attempts failed', { 
            context, 
            attempts: maxRetries, 
            finalError: lastError.message 
          });
          break;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        logger.warn('FIREBASE_RETRY', `Attempt ${attempt} failed, retrying in ${delay}ms`, { 
          context, 
          error: lastError.message 
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
  
  static async batchOperation<T>(
    operations: Array<() => Promise<T>>,
    batchSize: number = 10,
    context: string = 'firebase-batch'
  ): Promise<T[]> {
    const results: T[] = [];
    const errors: Error[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchPromises = batch.map((op, index) => 
        this.executeWithRetry(op, 2, `${context}-batch-${i + index}`)
          .catch(error => {
            errors.push(error);
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null) as T[]);
    }
    
    if (errors.length > 0) {
      logger.warn('FIREBASE_BATCH', `Batch completed with ${errors.length} errors`, { 
        context, 
        totalOperations: operations.length,
        successful: results.length,
        failed: errors.length
      });
    }
    
    return results;
  }
}

// Updated src/services/firestore.ts
export const createOrderSafe = async (
  orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'expiresAt'>
): Promise<string> => {
  return FirebaseOperationWrapper.executeWithRetry(async () => {
    const batch = writeBatch(db);
    const orderRef = doc(collection(db, COLLECTIONS.ORDERS));
    
    const now = new Date();
    const order: Omit<Order, 'id'> = {
      ...orderData,
      status: 'pending',
      searchRadius: 5,
      maxRadius: 50,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 2 * 60 * 1000)
    };
    
    batch.set(orderRef, {
      ...order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(order.expiresAt)
    });
    
    await batch.commit();
    return orderRef.id;
  }, 3, `createOrder-${orderData.clientId}`);
};
```

---

### **2. Memory Leaks от Real-time Subscriptions**
**Проблем:** Множество subscription listeners без proper cleanup  
**Време за изпълнение:** 2-3 дни  
**Impact:** 🔴 HIGH - memory leaks в production

#### **TO-DO List:**
- [ ] **2.1** Audit всички useEffect hooks за missing cleanup
- [ ] **2.2** Създай SubscriptionManager класа
- [ ] **2.3** Имплементирай auto-cleanup при component unmount
- [ ] **2.4** Добави subscription pooling за duplicate queries
- [ ] **2.5** Създай debugging tools за active subscriptions
- [ ] **2.6** Имплементирай subscription lifecycle logging
- [ ] **2.7** Добави memory usage monitoring
- [ ] **2.8** Създай automated tests за memory leaks
- [ ] **2.9** Refactor всички existing subscriptions
- [ ] **2.10** Добави subscription limits per component
- [ ] **2.11** Имплементирай subscription persistence при network changes
- [ ] **2.12** Тествай с memory profiling tools

#### **Код Примери:**

```typescript
// src/utils/SubscriptionManager.ts
class SubscriptionManager {
  private subscriptions = new Map<string, () => void>();
  private componentSubscriptions = new Map<string, Set<string>>();
  private subscriptionCount = 0;
  private readonly maxSubscriptionsPerComponent = 5;
  
  subscribe(
    key: string, 
    unsubscribe: () => void, 
    componentId: string = 'unknown'
  ): string {
    // Check subscription limits
    const componentSubs = this.componentSubscriptions.get(componentId) || new Set();
    if (componentSubs.size >= this.maxSubscriptionsPerComponent) {
      logger.warn('SUBSCRIPTION_LIMIT', 'Component subscription limit exceeded', {
        componentId,
        currentCount: componentSubs.size,
        limit: this.maxSubscriptionsPerComponent
      });
    }
    
    // Generate unique subscription ID
    const subscriptionId = `${key}-${++this.subscriptionCount}`;
    
    // Cleanup existing subscription with same key
    this.cleanup(key);
    
    // Store subscription
    this.subscriptions.set(subscriptionId, unsubscribe);
    componentSubs.add(subscriptionId);
    this.componentSubscriptions.set(componentId, componentSubs);
    
    logger.debug('SUBSCRIPTION_ADDED', 'New subscription registered', {
      subscriptionId,
      componentId,
      totalSubscriptions: this.subscriptions.size
    });
    
    return subscriptionId;
  }
  
  cleanup(subscriptionId: string) {
    const unsubscribe = this.subscriptions.get(subscriptionId);
    if (unsubscribe) {
      try {
        unsubscribe();
        this.subscriptions.delete(subscriptionId);
        
        // Remove from component tracking
        for (const [componentId, subs] of this.componentSubscriptions.entries()) {
          if (subs.has(subscriptionId)) {
            subs.delete(subscriptionId);
            if (subs.size === 0) {
              this.componentSubscriptions.delete(componentId);
            }
            break;
          }
        }
        
        logger.debug('SUBSCRIPTION_CLEANED', 'Subscription cleaned up', {
          subscriptionId,
          remainingSubscriptions: this.subscriptions.size
        });
      } catch (error) {
        logger.error('SUBSCRIPTION_CLEANUP_ERROR', 'Failed to cleanup subscription', {
          subscriptionId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  
  cleanupComponent(componentId: string) {
    const componentSubs = this.componentSubscriptions.get(componentId);
    if (componentSubs) {
      logger.debug('COMPONENT_CLEANUP', 'Cleaning up component subscriptions', {
        componentId,
        subscriptionCount: componentSubs.size
      });
      
      componentSubs.forEach(subscriptionId => this.cleanup(subscriptionId));
      this.componentSubscriptions.delete(componentId);
    }
  }
  
  cleanupAll() {
    logger.warn('SUBSCRIPTION_CLEANUP_ALL', 'Cleaning up all subscriptions', {
      totalSubscriptions: this.subscriptions.size
    });
    
    this.subscriptions.forEach((unsubscribe, subscriptionId) => {
      try {
        unsubscribe();
      } catch (error) {
        logger.error('SUBSCRIPTION_CLEANUP_ERROR', 'Error during cleanup', {
          subscriptionId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    this.subscriptions.clear();
    this.componentSubscriptions.clear();
  }
  
  getDebugInfo() {
    return {
      totalSubscriptions: this.subscriptions.size,
      componentBreakdown: Array.from(this.componentSubscriptions.entries()).map(
        ([componentId, subs]) => ({
          componentId,
          subscriptionCount: subs.size,
          subscriptionIds: Array.from(subs)
        })
      )
    };
  }
}

// Singleton instance
export const globalSubscriptionManager = new SubscriptionManager();

// src/hooks/useSubscriptionManager.ts
export const useSubscriptionManager = (componentName: string) => {
  const componentId = useRef(`${componentName}-${Date.now()}-${Math.random()}`);
  const manager = useRef(globalSubscriptionManager);
  
  const subscribe = useCallback((key: string, unsubscribe: () => void) => {
    return manager.current.subscribe(key, unsubscribe, componentId.current);
  }, []);
  
  const cleanup = useCallback((subscriptionId: string) => {
    manager.current.cleanup(subscriptionId);
  }, []);
  
  useEffect(() => {
    return () => {
      logger.debug('COMPONENT_UNMOUNT', 'Component unmounting, cleaning subscriptions', {
        componentId: componentId.current
      });
      manager.current.cleanupComponent(componentId.current);
    };
  }, []);
  
  // Debug info در development
  useEffect(() => {
    if (__DEV__) {
      const interval = setInterval(() => {
        const debugInfo = manager.current.getDebugInfo();
        if (debugInfo.totalSubscriptions > 20) {
          logger.warn('SUBSCRIPTION_DEBUG', 'High subscription count detected', debugInfo);
        }
      }, 30000); // Check every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, []);
  
  return { subscribe, cleanup };
};

// Updated useClientOrders.ts
export function useClientOrdersOptimized({ user, refreshAuth, logout, setCustomModal, setShowRequestModal }: UseClientOrdersParams) {
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [bids, setBids] = useState<any[]>([]);
  const { subscribe } = useSubscriptionManager('ClientOrders');
  
  useEffect(() => {
    if (!user?.uid) return;
    
    const subscriptionId = subscribe(
      `clientOrders-${user.uid}`,
      subscribeToClientOrders(user.uid, (orders) => {
        logger.debug('CLIENT_ORDERS_UPDATE', 'Received orders update', {
          userId: user.uid,
          orderCount: orders.length
        });
        
        const openOrder = orders.find((o) => 
          ['pending', 'searching', 'bidding', 'payment_pending', 'accepted'].includes(o.status) &&
          o.status !== 'expired'
        );
        
        setActiveOrder(openOrder || null);
      })
    );
    
    return () => {
      // Cleanup handled by useSubscriptionManager
    };
  }, [user?.uid, subscribe]);
  
  return { activeOrder, bids };
}
```

---

## ⚡ **PERFORMANCE ПОДОБРЕНИЯ - ПРИОРИТЕТ 2**

### **3. Централизиран Data Layer**
**Проблем:** Множество независими queries създават network congestion  
**Време за изпълнение:** 5-6 дни  
**Impact:** 🟠 MEDIUM - performance degradation

#### **TO-DO List:**
- [ ] **3.1** Design central data store архитектура
- [ ] **3.2** Имплементирай caching layer с TTL
- [ ] **3.3** Създай query deduplication mechanism
- [ ] **3.4** Добави background sync capabilities
- [ ] **3.5** Имплементирай optimistic updates
- [ ] **3.6** Създай data invalidation strategies
- [ ] **3.7** Добави offline storage synchronization
- [ ] **3.8** Имплементирай subscription consolidation
- [ ] **3.9** Създай performance monitoring
- [ ] **3.10** Refactor all existing data access
- [ ] **3.11** Добави cache warming strategies
- [ ] **3.12** Имплементирай cache size limits
- [ ] **3.13** Тествай cache hit rates
- [ ] **3.14** Добави cache metrics dashboard

#### **Код Примери:**

```typescript
// src/store/DataStore.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  subscribers: Set<(data: T) => void>;
}

interface QueryOptions {
  ttl?: number;
  forceRefresh?: boolean;
  optimistic?: boolean;
}

class DataStore {
  private cache = new Map<string, CacheEntry<any>>();
  private activeQueries = new Map<string, Promise<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  private readonly maxCacheSize = 1000;
  
  async get<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    options: QueryOptions = {}
  ): Promise<T> {
    const {
      ttl = this.defaultTTL,
      forceRefresh = false,
      optimistic = false
    } = options;
    
    // Check cache first
    if (!forceRefresh) {
      const cached = this.getFromCache<T>(key);
      if (cached) {
        logger.debug('CACHE_HIT', 'Data served from cache', { key });
        return cached;
      }
    }
    
    // Check if query is already in progress
    if (this.activeQueries.has(key)) {
      logger.debug('QUERY_DEDUP', 'Deduplicating active query', { key });
      return this.activeQueries.get(key)!;
    }
    
    // Execute query
    const queryPromise = this.executeQuery(key, fetcher, ttl);
    this.activeQueries.set(key, queryPromise);
    
    try {
      const data = await queryPromise;
      this.activeQueries.delete(key);
      return data;
    } catch (error) {
      this.activeQueries.delete(key);
      throw error;
    }
  }
  
  private async executeQuery<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl: number
  ): Promise<T> {
    try {
      logger.debug('QUERY_START', 'Starting data fetch', { key });
      const startTime = Date.now();
      
      const data = await fetcher();
      
      const elapsed = Date.now() - startTime;
      logger.debug('QUERY_SUCCESS', 'Data fetch completed', { key, elapsed });
      
      // Store in cache
      this.setCache(key, data, ttl);
      
      return data;
    } catch (error) {
      logger.error('QUERY_ERROR', 'Data fetch failed', { 
        key, 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;
    
    if (isExpired) {
      logger.debug('CACHE_EXPIRED', 'Cache entry expired', { key });
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  private setCache<T>(key: string, data: T, ttl: number) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      subscribers: new Set()
    };
    
    this.cache.set(key, entry);
    logger.debug('CACHE_SET', 'Data cached', { key, ttl });
    
    // Notify subscribers
    this.notifySubscribers(key, data);
  }
  
  subscribe<T>(key: string, callback: (data: T) => void): () => void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.subscribers.add(callback);
      
      // Immediately call with cached data if available
      const cached = this.getFromCache<T>(key);
      if (cached) {
        callback(cached);
      }
    }
    
    return () => {
      const entry = this.cache.get(key);
      if (entry) {
        entry.subscribers.delete(callback);
      }
    };
  }
  
  private notifySubscribers<T>(key: string, data: T) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('SUBSCRIBER_ERROR', 'Error notifying subscriber', {
            key,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    }
  }
  
  private evictOldest() {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('CACHE_EVICT', 'Evicted oldest cache entry', { key: oldestKey });
    }
  }
  
  invalidate(pattern: string | RegExp) {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      const shouldDelete = typeof pattern === 'string' 
        ? key.includes(pattern)
        : pattern.test(key);
        
      if (shouldDelete) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      logger.debug('CACHE_INVALIDATE', 'Cache entry invalidated', { key });
    });
    
    return keysToDelete.length;
  }
  
  getMetrics() {
    const now = Date.now();
    let expiredCount = 0;
    let totalSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      const isExpired = now - entry.timestamp > entry.ttl;
      if (isExpired) expiredCount++;
      
      // Estimate memory usage
      totalSize += JSON.stringify(entry.data).length;
    }
    
    return {
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      estimatedSizeBytes: totalSize,
      activeQueries: this.activeQueries.size
    };
  }
}

// Singleton instance
export const dataStore = new DataStore();

// src/hooks/useDataStore.ts
export const useQuery = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: QueryOptions & { enabled?: boolean } = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { enabled = true } = options;
  
  useEffect(() => {
    if (!enabled) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await dataStore.get(key, fetcher, options);
        
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Subscribe to cache updates
    const unsubscribe = dataStore.subscribe<T>(key, (newData) => {
      if (isMounted) {
        setData(newData);
      }
    });
    
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [key, enabled]);
  
  const refetch = useCallback(() => {
    return dataStore.get(key, fetcher, { ...options, forceRefresh: true });
  }, [key, fetcher, options]);
  
  const invalidate = useCallback(() => {
    dataStore.invalidate(key);
  }, [key]);
  
  return { data, loading, error, refetch, invalidate };
};
```

---

### **4. Image Processing Optimization**
**Проблем:** Synchronous image processing блокира UI thread  
**Време за изпълнение:** 3-4 дни  
**Impact:** 🟠 MEDIUM - UI freezing

#### **TO-DO List:**
- [ ] **4.1** Research Web Workers support в React Native
- [ ] **4.2** Имплементирай background image processing
- [ ] **4.3** Създай image compression pipeline
- [ ] **4.4** Добави progressive image loading
- [ ] **4.5** Имплементирай image caching strategy
- [ ] **4.6** Създай batch image processing
- [ ] **4.7** Добави image format optimization
- [ ] **4.8** Имплементирай lazy loading за gallery
- [ ] **4.9** Създай image quality settings
- [ ] **4.10** Добави image upload progress tracking
- [ ] **4.11** Имплементирай client-side resizing
- [ ] **4.12** Тествай различни image formats и sizes

#### **Код Примери:**

```typescript
// src/services/ImageProcessor.ts
interface ImageProcessingOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp';
  progressive?: boolean;
}

interface ProcessingJob {
  id: string;
  uri: string;
  options: ImageProcessingOptions;
  onProgress?: (progress: number) => void;
  onComplete: (result: string) => void;
  onError: (error: Error) => void;
}

class ImageProcessor {
  private queue: ProcessingJob[] = [];
  private processing = false;
  private maxConcurrentJobs = 2;
  private activeJobs = new Set<string>();
  
  async processImage(
    uri: string, 
    options: ImageProcessingOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const job: ProcessingJob = {
        id: `job-${Date.now()}-${Math.random()}`,
        uri,
        options: {
          quality: 0.8,
          maxWidth: 1920,
          maxHeight: 1080,
          format: 'jpeg',
          ...options
        },
        onProgress,
        onComplete: resolve,
        onError: reject
      };
      
      this.queue.push(job);
      this.processQueue();
    });
  }
  
  private async processQueue() {
    if (this.processing || this.activeJobs.size >= this.maxConcurrentJobs) {
      return;
    }
    
    const job = this.queue.shift();
    if (!job) return;
    
    this.processing = true;
    this.activeJobs.add(job.id);
    
    try {
      logger.debug('IMAGE_PROCESS_START', 'Starting image processing', {
        jobId: job.id,
        uri: job.uri.substring(0, 50) + '...',
        options: job.options
      });
      
      const result = await this.processImageJob(job);
      job.onComplete(result);
      
      logger.debug('IMAGE_PROCESS_SUCCESS', 'Image processing completed', {
        jobId: job.id
      });
    } catch (error) {
      logger.error('IMAGE_PROCESS_ERROR', 'Image processing failed', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error)
      });
      job.onError(error as Error);
    } finally {
      this.activeJobs.delete(job.id);
      this.processing = false;
      
      // Process next job
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }
  
  private async processImageJob(job: ProcessingJob): Promise<string> {
    const { uri, options, onProgress } = job;
    
    // Step 1: Load image (20% progress)
    onProgress?.(20);
    const { ImageManipulator } = await import('expo-image-manipulator');
    
    // Step 2: Calculate resize dimensions (40% progress)
    onProgress?.(40);
    const dimensions = await this.calculateDimensions(uri, options);
    
    // Step 3: Process image (60% progress)
    onProgress?.(60);
    const manipulateActions: any[] = [];
    
    if (dimensions) {
      manipulateActions.push({
        resize: dimensions
      });
    }
    
    // Step 4: Apply compression (80% progress)
    onProgress?.(80);
    const result = await ImageManipulator.manipulateAsync(
      uri,
      manipulateActions,
      {
        compress: options.quality,
        format: options.format === 'jpeg' ? ImageManipulator.SaveFormat.JPEG : ImageManipulator.SaveFormat.PNG,
        base64: true
      }
    );
    
    // Step 5: Generate final result (100% progress)
    onProgress?.(100);
    const base64String = `data:image/${options.format};base64,${result.base64}`;
    
    return base64String;
  }
  
  private async calculateDimensions(
    uri: string, 
    options: ImageProcessingOptions
  ): Promise<{ width: number; height: number } | null> {
    try {
      const { Image } = await import('react-native');
      
      return new Promise((resolve) => {
        Image.getSize(
          uri,
          (width, height) => {
            const { maxWidth = 1920, maxHeight = 1080 } = options;
            
            if (width <= maxWidth && height <= maxHeight) {
              resolve(null); // No resize needed
              return;
            }
            
            const aspectRatio = width / height;
            let newWidth = width;
            let newHeight = height;
            
            if (width > maxWidth) {
              newWidth = maxWidth;
              newHeight = newWidth / aspectRatio;
            }
            
            if (newHeight > maxHeight) {
              newHeight = maxHeight;
              newWidth = newHeight * aspectRatio;
            }
            
            resolve({
              width: Math.round(newWidth),
              height: Math.round(newHeight)
            });
          },
          (error) => {
            logger.warn('IMAGE_DIMENSIONS', 'Could not get image dimensions', { uri, error });
            resolve(null);
          }
        );
      });
    } catch (error) {
      logger.error('IMAGE_DIMENSIONS_ERROR', 'Error calculating dimensions', { error });
      return null;
    }
  }
  
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      activeJobs: this.activeJobs.size,
      processing: this.processing
    };
  }
  
  clearQueue() {
    this.queue = [];
    logger.debug('IMAGE_QUEUE_CLEARED', 'Processing queue cleared');
  }
}

// Singleton instance
export const imageProcessor = new ImageProcessor();

// src/hooks/useImageProcessor.ts
export const useImageProcessor = () => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  
  const processImage = useCallback(async (
    uri: string,
    options: ImageProcessingOptions = {}
  ): Promise<string> => {
    try {
      setProcessing(true);
      setProgress(0);
      setError(null);
      
      const result = await imageProcessor.processImage(
        uri,
        options,
        (progress) => setProgress(progress)
      );
      
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }, []);
  
  return {
    processImage,
    processing,
    progress,
    error,
    queueStatus: imageProcessor.getQueueStatus()
  };
};

// Updated RequestModal usage
export default function RequestModal({ /* props */ }: RequestModalProps) {
  const { processImage, processing: imageProcessing, progress } = useImageProcessor();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1.0, // High quality for processing
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        const processedImage = await processImage(
          result.assets[0].uri,
          {
            quality: 0.8,
            maxWidth: 1920,
            maxHeight: 1080,
            format: 'jpeg'
          }
        );
        
        setSelectedImage(processedImage);
      } catch (error) {
        logger.error('IMAGE_PICK_ERROR', 'Failed to process picked image', { error });
        // Fallback to original URI
        setSelectedImage(result.assets[0].uri);
      }
    }
  };
  
  return (
    // ... modal content
    <>
      {imageProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text>Processing image... {Math.round(progress)}%</Text>
        </View>
      )}
      {/* ... rest of modal */}
    </>
  );
}
```

---

## 🗄️ **STATE MANAGEMENT - ПРИОРИТЕТ 3**

### **5. Unified State Architecture**
**Проблем:** Разпръснато state в много компоненти  
**Време за изпълнение:** 4-5 дни  
**Impact:** 🟡 LOW-MEDIUM - maintainability issues

#### **TO-DO List:**
- [ ] **5.1** Design global state schema
- [ ] **5.2** Имплементирай Redux Toolkit или Zustand
- [ ] **5.3** Създай typed action creators
- [ ] **5.4** Имплементирай middleware за logging
- [ ] **5.5** Добави state persistence layer
- [ ] **5.6** Създай selectors за computed values
- [ ] **5.7** Имплементирай optimistic updates
- [ ] **5.8** Добави state hydration/dehydration
- [ ] **5.9** Refactor всички existing useState calls
- [ ] **5.10** Създай dev tools integration
- [ ] **5.11** Добави state migration strategies
- [ ] **5.12** Имплементирай state validation
- [ ] **5.13** Тествай state consistency
- [ ] **5.14** Добави state performance monitoring

#### **Код Примери:**

```typescript
// src/store/index.ts - Using Zustand for simplicity
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Order {
  id: string;
  status: OrderStatus;
  clientId: string;
  description: string;
  location: OrderLocation;
  createdAt: Date;
  expiresAt: Date;
}

interface Bid {
  id: string;
  orderId: string;
  driverId: string;
  proposedPrice: number;
  status: 'active' | 'accepted' | 'rejected';
  driverInfo: {
    name: string;
    phone: string;
  };
}

interface AppState {
  // User state
  user: {
    data: User | null;
    loading: boolean;
    error: string | null;
  };
  
  // Orders state
  orders: {
    active: Order | null;
    history: Order[];
    loading: boolean;
    error: string | null;
    lastFetch: number | null;
  };
  
  // Bids state
  bids: {
    byOrderId: Record<string, Bid[]>;
    loading: boolean;
    error: string | null;
  };
  
  // UI state
  ui: {
    modals: {
      request: {
        visible: boolean;
        data?: any;
      };
      bids: {
        visible: boolean;
        orderId?: string;
      };
      payment: {
        visible: boolean;
        amount: number;
        paymentUrl: string;
        driverName: string;
      };
      settings: {
        visible: boolean;
      };
    };
    notifications: {
      visible: boolean;
      title: string;
      message: string;
      type: 'success' | 'error' | 'info';
    };
    loading: {
      global: boolean;
      operations: Record<string, boolean>;
    };
  };
  
  // Location state
  location: {
    current: LocationData | null;
    loading: boolean;
    error: string | null;
    lastUpdate: number | null;
  };
  
  // Driver-specific state
  driver: {
    isOnline: boolean;
    orders: Order[];
    activeOrder: Order | null;
    settings: {
      radius: number;
      autoAccept: boolean;
    };
  };
}

interface AppActions {
  // User actions
  setUser: (user: User | null) => void;
  setUserLoading: (loading: boolean) => void;
  setUserError: (error: string | null) => void;
  
  // Order actions
  setActiveOrder: (order: Order | null) => void;
  addOrderToHistory: (order: Order) => void;
  setOrdersLoading: (loading: boolean) => void;
  setOrdersError: (error: string | null) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  
  // Bid actions
  setBidsForOrder: (orderId: string, bids: Bid[]) => void;
  addBid: (bid: Bid) => void;
  updateBidStatus: (bidId: string, status: Bid['status']) => void;
  setBidsLoading: (loading: boolean) => void;
  
  // UI actions
  showModal: (modal: keyof AppState['ui']['modals'], data?: any) => void;
  hideModal: (modal: keyof AppState['ui']['modals']) => void;
  showNotification: (title: string, message: string, type: AppState['ui']['notifications']['type']) => void;
  hideNotification: () => void;
  setGlobalLoading: (loading: boolean) => void;
  setOperationLoading: (operation: string, loading: boolean) => void;
  
  // Location actions
  setLocation: (location: LocationData | null) => void;
  setLocationLoading: (loading: boolean) => void;
  setLocationError: (error: string | null) => void;
  
  // Driver actions
  setDriverOnline: (online: boolean) => void;
  setDriverOrders: (orders: Order[]) => void;
  setDriverActiveOrder: (order: Order | null) => void;
  updateDriverSettings: (settings: Partial<AppState['driver']['settings']>) => void;
}

type AppStore = AppState & AppActions;

const initialState: AppState = {
  user: {
    data: null,
    loading: false,
    error: null,
  },
  orders: {
    active: null,
    history: [],
    loading: false,
    error: null,
    lastFetch: null,
  },
  bids: {
    byOrderId: {},
    loading: false,
    error: null,
  },
  ui: {
    modals: {
      request: { visible: false },
      bids: { visible: false },
      payment: { visible: false, amount: 0, paymentUrl: '', driverName: '' },
      settings: { visible: false },
    },
    notifications: {
      visible: false,
      title: '',
      message: '',
      type: 'info',
    },
    loading: {
      global: false,
      operations: {},
    },
  },
  location: {
    current: null,
    loading: false,
    error: null,
    lastUpdate: null,
  },
  driver: {
    isOnline: false,
    orders: [],
    activeOrder: null,
    settings: {
      radius: 50,
      autoAccept: false,
    },
  },
};

export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,
        
        // User actions
        setUser: (user) => set((state) => ({ 
          user: { ...state.user, data: user, error: null } 
        })),
        setUserLoading: (loading) => set((state) => ({ 
          user: { ...state.user, loading } 
        })),
        setUserError: (error) => set((state) => ({ 
          user: { ...state.user, error, loading: false } 
        })),
        
        // Order actions
        setActiveOrder: (order) => set((state) => ({
          orders: { ...state.orders, active: order }
        })),
        addOrderToHistory: (order) => set((state) => ({
          orders: {
            ...state.orders,
            history: [order, ...state.orders.history.filter(o => o.id !== order.id)]
          }
        })),
        setOrdersLoading: (loading) => set((state) => ({
          orders: { ...state.orders, loading }
        })),
        setOrdersError: (error) => set((state) => ({
          orders: { ...state.orders, error, loading: false }
        })),
        updateOrderStatus: (orderId, status) => set((state) => {
          const updatedHistory = state.orders.history.map(order =>
            order.id === orderId ? { ...order, status } : order
          );
          
          const updatedActive = state.orders.active?.id === orderId
            ? { ...state.orders.active, status }
            : state.orders.active;
            
          return {
            orders: {
              ...state.orders,
              active: updatedActive,
              history: updatedHistory
            }
          };
        }),
        
        // Bid actions
        setBidsForOrder: (orderId, bids) => set((state) => ({
          bids: {
            ...state.bids,
            byOrderId: { ...state.bids.byOrderId, [orderId]: bids }
          }
        })),
        addBid: (bid) => set((state) => {
          const existingBids = state.bids.byOrderId[bid.orderId] || [];
          const updatedBids = [bid, ...existingBids.filter(b => b.id !== bid.id)];
          
          return {
            bids: {
              ...state.bids,
              byOrderId: { ...state.bids.byOrderId, [bid.orderId]: updatedBids }
            }
          };
        }),
        updateBidStatus: (bidId, status) => set((state) => {
          const updatedByOrderId = { ...state.bids.byOrderId };
          
          Object.keys(updatedByOrderId).forEach(orderId => {
            updatedByOrderId[orderId] = updatedByOrderId[orderId].map(bid =>
              bid.id === bidId ? { ...bid, status } : bid
            );
          });
          
          return {
            bids: { ...state.bids, byOrderId: updatedByOrderId }
          };
        }),
        setBidsLoading: (loading) => set((state) => ({
          bids: { ...state.bids, loading }
        })),
        
        // UI actions
        showModal: (modal, data = {}) => set((state) => ({
          ui: {
            ...state.ui,
            modals: {
              ...state.ui.modals,
              [modal]: { visible: true, ...data }
            }
          }
        })),
        hideModal: (modal) => set((state) => ({
          ui: {
            ...state.ui,
            modals: {
              ...state.ui.modals,
              [modal]: { ...state.ui.modals[modal], visible: false }
            }
          }
        })),
        showNotification: (title, message, type) => set((state) => ({
          ui: {
            ...state.ui,
            notifications: { visible: true, title, message, type }
          }
        })),
        hideNotification: () => set((state) => ({
          ui: {
            ...state.ui,
            notifications: { ...state.ui.notifications, visible: false }
          }
        })),
        setGlobalLoading: (loading) => set((state) => ({
          ui: { ...state.ui, loading: { ...state.ui.loading, global: loading } }
        })),
        setOperationLoading: (operation, loading) => set((state) => ({
          ui: {
            ...state.ui,
            loading: {
              ...state.ui.loading,
              operations: { ...state.ui.loading.operations, [operation]: loading }
            }
          }
        })),
        
        // Location actions
        setLocation: (location) => set((state) => ({
          location: {
            ...state.location,
            current: location,
            lastUpdate: Date.now(),
            error: null
          }
        })),
        setLocationLoading: (loading) => set((state) => ({
          location: { ...state.location, loading }
        })),
        setLocationError: (error) => set((state) => ({
          location: { ...state.location, error, loading: false }
        })),
        
        // Driver actions
        setDriverOnline: (online) => set((state) => ({
          driver: { ...state.driver, isOnline: online }
        })),
        setDriverOrders: (orders) => set((state) => ({
          driver: { ...state.driver, orders }
        })),
        setDriverActiveOrder: (order) => set((state) => ({
          driver: { ...state.driver, activeOrder: order }
        })),
        updateDriverSettings: (settings) => set((state) => ({
          driver: {
            ...state.driver,
            settings: { ...state.driver.settings, ...settings }
          }
        })),
      }),
      {
        name: 'roadside-assistance-store',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          // Only persist specific parts of state
          user: state.user,
          driver: {
            settings: state.driver.settings
          },
          orders: {
            history: state.orders.history.slice(0, 20) // Keep only last 20 orders
          }
        }),
      }
    )
  )
);

// Selectors for computed values
export const useAppSelectors = () => {
  const store = useAppStore();
  
  return {
    // User selectors
    isAuthenticated: !!store.user.data,
    userType: store.user.data?.userType,
    isDriver: store.user.data?.userType === 'driver',
    isClient: store.user.data?.userType === 'client',
    
    // Order selectors
    hasActiveOrder: !!store.orders.active,
    activeOrderBids: store.orders.active 
      ? store.bids.byOrderId[store.orders.active.id] || []
      : [],
    pendingOrdersCount: store.driver.orders.filter(o => o.status === 'pending').length,
    
    // UI selectors
    isAnyModalVisible: Object.values(store.ui.modals).some(modal => modal.visible),
    isLoading: store.ui.loading.global || Object.values(store.ui.loading.operations).some(Boolean),
    
    // Location selectors
    hasLocation: !!store.location.current,
    locationAge: store.location.lastUpdate 
      ? Date.now() - store.location.lastUpdate 
      : Infinity,
      
    // Driver selectors
    canReceiveOrders: store.driver.isOnline && !!store.location.current,
  };
};

// Action creators with side effects
export const useAppActions = () => {
  const store = useAppStore();
  
  return {
    // Async user actions
    loginUser: async (email: string, password: string) => {
      store.setUserLoading(true);
      try {
        const { login } = await import('../contexts/AuthContext');
        const user = await login(email, password);
        store.setUser(user);
        return user;
      } catch (error) {
        store.setUserError(error instanceof Error ? error.message : 'Login failed');
        throw error;
      }
    },
    
    // Async order actions
    createOrder: async (orderData: any) => {
      store.setOperationLoading('createOrder', true);
      try {
        const { createOrder } = await import('../services/firestore');
        const orderId = await createOrder(orderData);
        
        // Optimistic update
        const newOrder = {
          id: orderId,
          ...orderData,
          status: 'pending' as OrderStatus,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 2 * 60 * 1000)
        };
        
        store.setActiveOrder(newOrder);
        store.addOrderToHistory(newOrder);
        
        return orderId;
      } catch (error) {
        store.setOrdersError(error instanceof Error ? error.message : 'Failed to create order');
        throw error;
      } finally {
        store.setOperationLoading('createOrder', false);
      }
    },
    
    // UI actions with side effects
    showSuccessNotification: (message: string) => {
      store.showNotification('Success', message, 'success');
      setTimeout(() => store.hideNotification(), 3000);
    },
    
    showErrorNotification: (message: string) => {
      store.showNotification('Error', message, 'error');
      setTimeout(() => store.hideNotification(), 5000);
    },
  };
};

// Hook for subscribing to specific state changes
export const useAppStoreSubscribe = () => {
  const store = useAppStore();
  
  const subscribe = useCallback(<T>(
    selector: (state: AppStore) => T,
    callback: (value: T, previousValue: T) => void
  ) => {
    return store.subscribe(
      selector,
      callback
    );
  }, [store]);
  
  return { subscribe };
};
```

---

## 🛡️ **ERROR HANDLING - ПРИОРИТЕТ 4**

### **6. Unified Error Handling System**
**Проблем:** Inconsistent error handling patterns навсякъде  
**Време за изпълнение:** 2-3 дни  
**Impact:** 🟡 LOW-MEDIUM - poor user experience при errors

#### **TO-DO List:**
- [ ] **6.1** Design error taxonomy и classification
- [ ] **6.2** Създай ErrorHandler singleton класа
- [ ] **6.3** Имплементирай error recovery strategies
- [ ] **6.4** Добави error reporting към analytics
- [ ] **6.5** Създай user-friendly error messages
- [ ] **6.6** Имплементирай retry mechanisms
- [ ] **6.7** Добави error boundaries за React components
- [ ] **6.8** Създай error logging с context
- [ ] **6.9** Имплементирай error notification system
- [ ] **6.10** Refactor всички existing try/catch blocks
- [ ] **6.11** Добави error debugging tools
- [ ] **6.12** Тествай error scenarios

#### **Код Примери:**

```typescript
// src/utils/ErrorHandler.ts
export enum ErrorType {
  NETWORK = 'network',
  AUTH = 'auth',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout',
  FIREBASE = 'firebase',
  PAYMENT = 'payment',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
  context?: Record<string, any>;
  stack?: string;
  timestamp: number;
}

export interface RecoveryAction {
  label: string;
  action: () => Promise<void> | void;
  primary?: boolean;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorInfo[] = [];
  private maxLogSize = 100;
  
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  handle(
    error: any, 
    context: string = 'unknown',
    customRecovery?: RecoveryAction[]
  ): ErrorInfo {
    const errorInfo = this.categorizeError(error, context);
    
    // Log error
    this.logError(errorInfo);
    
    // Report to analytics
    this.reportError(errorInfo);
    
    // Show user message
    this.showUserMessage(errorInfo, customRecovery);
    
    // Attempt automatic recovery
    this.attemptRecovery(errorInfo);
    
    return errorInfo;
  }
  
  private categorizeError(error: any, context: string): ErrorInfo {
    const timestamp = Date.now();
    let type = ErrorType.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let userMessage = 'Възникна неочаквана грешка. Моля опитайте отново.';
    let recoverable = false;
    let retryable = false;
    
    const message = error?.message || error?.toString() || 'Unknown error';
    const stack = error?.stack;
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      type = ErrorType.NETWORK;
      severity = ErrorSeverity.MEDIUM;
      userMessage = 'Проблем с мрежовата връзка. Проверете интернета си и опитайте отново.';
      recoverable = true;
      retryable = true;
    }
    
    // Authentication errors
    else if (error?.code === 'permission-denied' || message.includes('authentication')) {
      type = ErrorType.AUTH;
      severity = ErrorSeverity.HIGH;
      userMessage = 'Проблем с автентификацията. Моля влезте отново в профила си.';
      recoverable = true;
      retryable = false;
    }
    
    // Permission errors
    else if (error?.code === 'permission-denied') {
      type = ErrorType.PERMISSION;
      severity = ErrorSeverity.HIGH;
      userMessage = 'Нямате права за тази операция.';
      recoverable = false;
      retryable = false;
    }
    
    // Validation errors
    else if (message.includes('validation') || message.includes('invalid')) {
      type = ErrorType.VALIDATION;
      severity = ErrorSeverity.LOW;
      userMessage = 'Невалидни данни. Моля проверете въведената информация.';
      recoverable = true;
      retryable = false;
    }
    
    // Timeout errors
    else if (message.includes('timeout') || message.includes('timed out')) {
      type = ErrorType.TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
      userMessage = 'Операцията отне твърде много време. Моля опитайте отново.';
      recoverable = true;
      retryable = true;
    }
    
    // Firebase specific errors
    else if (error?.code && error.code.startsWith('firestore/')) {
      type = ErrorType.FIREBASE;
      severity = ErrorSeverity.HIGH;
      
      switch (error.code) {
        case 'firestore/unavailable':
          userMessage = 'Услугата временно не е достъпна. Опитайте отново след малко.';
          retryable = true;
          break;
        case 'firestore/deadline-exceeded':
          userMessage = 'Операцията отне твърде много време. Опитайте отново.';
          retryable = true;
          break;
        default:
          userMessage = 'Проблем с базата данни. Опитайте отново или се свържете с поддръжката.';
      }
      recoverable = true;
    }
    
    // Payment errors
    else if (context.includes('payment') || context.includes('stripe')) {
      type = ErrorType.PAYMENT;
      severity = ErrorSeverity.HIGH;
      userMessage = 'Проблем с плащането. Проверете данните си и опитайте отново.';
      recoverable = true;
      retryable = true;
    }
    
    return {
      type,
      severity,
      message,
      userMessage,
      recoverable,
      retryable,
      context: { originalContext: context },
      stack,
      timestamp
    };
  }
  
  private logError(errorInfo: ErrorInfo) {
    // Add to local log
    this.errorLog.unshift(errorInfo);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
    
    // Console logging based on severity
    const logData = {
      type: errorInfo.type,
      severity: errorInfo.severity,
      message: errorInfo.message,
      context: errorInfo.context,
      timestamp: new Date(errorInfo.timestamp).toISOString()
    };
    
    switch (errorInfo.severity) {
      case ErrorSeverity.CRITICAL:
        logger.critical('ERROR_CRITICAL', errorInfo.message, logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('ERROR_HIGH', errorInfo.message, logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('ERROR_MEDIUM', errorInfo.message, logData);
        break;
      case ErrorSeverity.LOW:
        logger.debug('ERROR_LOW', errorInfo.message, logData);
        break;
    }
  }
  
  private async reportError(errorInfo: ErrorInfo) {
    // Only report high severity errors in production
    if (errorInfo.severity === ErrorSeverity.LOW || __DEV__) {
      return;
    }
    
    try {
      // Report to Firebase Analytics or Crashlytics
      const { analytics } = await import('../config/firebase');
      
      // Log custom event
      // analytics.logEvent('app_error', {
      //   error_type: errorInfo.type,
      //   error_severity: errorInfo.severity,
      //   error_message: errorInfo.message.substring(0, 100),
      //   error_context: JSON.stringify(errorInfo.context).substring(0, 100)
      // });
      
      // For critical errors, also send to external service
      if (errorInfo.severity === ErrorSeverity.CRITICAL) {
        await this.sendToCrashlytics(errorInfo);
      }
    } catch (reportingError) {
      logger.warn('ERROR_REPORTING', 'Failed to report error', { reportingError });
    }
  }
  
  private async sendToCrashlytics(errorInfo: ErrorInfo) {
    try {
      // Integration with Firebase Crashlytics
      // const crashlytics = firebase.crashlytics();
      // crashlytics.recordError(new Error(errorInfo.message));
      // crashlytics.setAttributes({
      //   error_type: errorInfo.type,
      //   error_context: JSON.stringify(errorInfo.context)
      // });
    } catch (error) {
      logger.warn('CRASHLYTICS', 'Failed to send to Crashlytics', { error });
    }
  }
  
  private showUserMessage(errorInfo: ErrorInfo, customRecovery?: RecoveryAction[]) {
    // Get store instance for showing notifications
    const { useAppStore } = require('../store');
    const store = useAppStore.getState();
    
    const actions: RecoveryAction[] = customRecovery || [];
    
    // Add default recovery actions based on error type
    if (errorInfo.retryable) {
      actions.unshift({
        label: 'Опитай отново',
        action: () => {
          // The caller should provide retry logic
          logger.debug('ERROR_RETRY', 'User requested retry');
        },
        primary: true
      });
    }
    
    if (errorInfo.type === ErrorType.AUTH) {
      actions.push({
        label: 'Влез отново',
        action: async () => {
          const { logout } = await import('../contexts/AuthContext');
          await logout();
        }
      });
    }
    
    // Always add dismiss action
    actions.push({
      label: 'Затвори',
      action: () => {
        store.hideNotification();
      }
    });
    
    // Show notification with actions
    store.showNotification(
      this.getSeverityTitle(errorInfo.severity),
      errorInfo.userMessage,
      this.getSeverityType(errorInfo.severity)
    );
    
    // Auto-hide for low severity errors
    if (errorInfo.severity === ErrorSeverity.LOW) {
      setTimeout(() => store.hideNotification(), 3000);
    }
  }
  
  private getSeverityTitle(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'Критична грешка';
      case ErrorSeverity.HIGH:
        return 'Грешка';
      case ErrorSeverity.MEDIUM:
        return 'Проблем';
      case ErrorSeverity.LOW:
        return 'Внимание';
      default:
        return 'Известие';
    }
  }
  
  private getSeverityType(severity: ErrorSeverity): 'success' | 'error' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'info';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'info';
    }
  }
  
  private async attemptRecovery(errorInfo: ErrorInfo) {
    if (!errorInfo.recoverable) return;
    
    logger.debug('ERROR_RECOVERY', 'Attempting automatic recovery', {
      type: errorInfo.type,
      context: errorInfo.context
    });
    
    switch (errorInfo.type) {
      case ErrorType.NETWORK:
        await this.recoverFromNetworkError();
        break;
      case ErrorType.AUTH:
        await this.recoverFromAuthError();
        break;
      case ErrorType.FIREBASE:
        await this.recoverFromFirebaseError();
        break;
      default:
        logger.debug('ERROR_RECOVERY', 'No automatic recovery available for error type', {
          type: errorInfo.type
        });
    }
  }
  
  private async recoverFromNetworkError() {
    // Check network connectivity
    const { checkNetworkConnectivity } = await import('./networkUtils');
    const networkStatus = await checkNetworkConnectivity();
    
    if (networkStatus.isConnected) {
      logger.debug('ERROR_RECOVERY', 'Network recovered, processing offline queue');
      
      // Process offline queue
      const { offlineQueue } = await import('./networkUtils');
      await offlineQueue.processQueue();
    }
  }
  
  private async recoverFromAuthError() {
    // Attempt to refresh authentication
    try {
      const { refreshAuth } = await import('../contexts/AuthContext');
      await refreshAuth();
      logger.debug('ERROR_RECOVERY', 'Authentication refreshed successfully');
    } catch (error) {
      logger.warn('ERROR_RECOVERY', 'Failed to refresh authentication', { error });
    }
  }
  
  private async recoverFromFirebaseError() {
    // Attempt to reconnect to Firebase
    try {
      const { enableNetwork } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      
      await enableNetwork(db);
      logger.debug('ERROR_RECOVERY', 'Firebase network re-enabled');
    } catch (error) {
      logger.warn('ERROR_RECOVERY', 'Failed to recover Firebase connection', { error });
    }
  }
  
  getErrorLog(): ErrorInfo[] {
    return [...this.errorLog];
  }
  
  clearErrorLog() {
    this.errorLog = [];
    logger.debug('ERROR_LOG', 'Error log cleared');
  }
  
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      recent: this.errorLog.filter(e => Date.now() - e.timestamp < 24 * 60 * 60 * 1000).length
    };
    
    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });
    
    return stats;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility hook for error handling
export const useErrorHandler = () => {
  const handle = useCallback((
    error: any, 
    context: string = 'unknown',
    customRecovery?: RecoveryAction[]
  ) => {
    return errorHandler.handle(error, context, customRecovery);
  }, []);
  
  const retryableHandle = useCallback((
    error: any,
    context: string,
    retryFunction: () => Promise<void>
  ) => {
    return errorHandler.handle(error, context, [{
      label: 'Опитай отново',
      action: retryFunction,
      primary: true
    }]);
  }, []);
  
  return { handle, retryableHandle, errorLog: errorHandler.getErrorLog() };
};

// React Error Boundary component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>, 
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorHandler.handle(error, `react-error-boundary:${errorInfo.componentStack}`);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="warning-outline" size={64} color="#ef4444" />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>
            Възникна неочаквана грешка
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>
            Приложението ще бъде рестартирано автоматично
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: '#ef4444',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 8,
              marginTop: 20
            }}
            onPress={() => {
              this.setState({ hasError: false, error: undefined });
              // Optionally restart app
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
              Рестартирай
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return this.props.children;
  }
}

// Usage examples in existing code:

// Updated RequestModal with error handling
export default function RequestModal({ /* props */ }: RequestModalProps) {
  const { handle: handleError, retryableHandle } = useErrorHandler();
  
  const proceedWithOrderCreation = async () => {
    try {
      const orderId = await createOrder(orderData);
      // Success handling
    } catch (error) {
      retryableHandle(
        error,
        'order-creation',
        () => proceedWithOrderCreation()
      );
    }
  };
  
  // ... rest of component
}

// Updated useClientOrders with error handling
export function useClientOrders({ /* params */ }: UseClientOrdersParams) {
  const { handle: handleError } = useErrorHandler();
  
  useEffect(() => {
    try {
      const unsubscribe = subscribeToClientOrders(user.uid, (orders) => {
        // Handle success
      });
      return unsubscribe;
    } catch (error) {
      handleError(error, 'client-orders-subscription');
    }
  }, [user?.uid, handleError]);
  
  // ... rest of hook
}
```

---

## 🔒 **SECURITY IMPROVEMENTS - ПРИОРИТЕТ 5**

### **7. Security Hardening**
**Проблем:** Exposed API keys и insufficient validation  
**Време за изпълнение:** 2-3 дни  
**Impact:** 🟠 MEDIUM - security vulnerabilities

#### **TO-DO List:**
- [ ] **7.1** Move all API keys към environment variables
- [ ] **7.2** Имплементирай input validation library (Zod)
- [ ] **7.3** Добави rate limiting за API calls
- [ ] **7.4** Създай security headers за requests
- [ ] **7.5** Имплементирай request signing
- [ ] **7.6** Добави client-side encryption за sensitive data
- [ ] **7.7** Създай security audit logging
- [ ] **7.8** Имплементирай secure storage за tokens
- [ ] **7.9** Добави CSRF protection
- [ ] **7.10** Валидирай всички user inputs
- [ ] **7.11** Имплементирай secure communication protocols
- [ ] **7.12** Тествай security vulnerabilities

---

## 📈 **MONITORING & ANALYTICS - ПРИОРИТЕТ 6**

### **8. Performance & Error Monitoring**
**Проблем:** Липса на visibility в production issues  
**Време за изпълнение:** 3-4 дни  
**Impact:** 🟡 LOW-MEDIUM - blind spots в production

#### **TO-DO List:**
- [ ] **8.1** Setup Firebase Performance Monitoring
- [ ] **8.2** Имплементирай Crashlytics за crash reporting
- [ ] **8.3** Добави custom performance metrics
- [ ] **8.4** Създай real-time dashboards
- [ ] **8.5** Имплементирай user behavior analytics
- [ ] **8.6** Добави A/B testing capabilities
- [ ] **8.7** Създай automated alerts за critical issues
- [ ] **8.8** Имплементирай user feedback collection
- [ ] **8.9** Добави performance benchmarking
- [ ] **8.10** Създай health check endpoints
- [ ] **8.11** Имплементирай log aggregation
- [ ] **8.12** Тествай monitoring accuracy

---

## 🧪 **TESTING INFRASTRUCTURE - ПРИОРИТЕТ 7**

### **9. Automated Testing Setup**
**Проблем:** Липса на comprehensive testing  
**Време за изпълнение:** 5-6 дни  
**Impact:** 🟡 LOW-MEDIUM - quality assurance gaps

#### **TO-DO List:**
- [ ] **9.1** Setup Jest testing framework
- [ ] **9.2** Имплементирай React Native Testing Library
- [ ] **9.3** Създай unit tests за services
- [ ] **9.4** Добави integration tests за workflows
- [ ] **9.5** Имплементирай E2E testing с Detox
- [ ] **9.6** Създай mock services за testing
- [ ] **9.7** Добави visual regression testing
- [ ] **9.8** Имплементирай performance testing
- [ ] **9.9** Създай test data generators
- [ ] **9.10** Добави CI/CD pipeline testing
- [ ] **9.11** Имплементирай test coverage reporting
- [ ] **9.12** Създай automated test runs

---

## 📋 **IMPLEMENTATION TIMELINE**

### **Week 1: Critical Issues**
- ✅ Firebase SDK Promise fixes
- ✅ Memory leak cleanup
- ✅ Basic error handling

### **Week 2: Performance**
- ✅ Data layer optimization
- ✅ Image processing improvements
- ✅ State management refactor

### **Week 3: Architecture**
- ✅ Security hardening
- ✅ Monitoring setup
- ✅ Testing infrastructure

### **Week 4: Polish & Testing**
- ✅ Comprehensive testing
- ✅ Performance optimization
- ✅ Production deployment

---

## 🎯 **SUCCESS METRICS**

### **Performance Targets:**
- 📱 App startup time: < 3 seconds
- 🔄 Order creation time: < 5 seconds  
- 💾 Memory usage: < 200MB steady state
- 🌐 Offline capability: 100% core features
- ⚡ UI responsiveness: 60 FPS

### **Reliability Targets:**
- 🛡️ Crash rate: < 0.1%
- 🔄 Success rate: > 99.5%
- ⏱️ Error recovery: < 10 seconds
- 📊 Monitoring coverage: 100%

### **Security Targets:**
- 🔒 Zero exposed credentials
- 🛡️ 100% input validation
- 🔐 Encrypted sensitive data
- 📝 Complete audit trails

---

## 📞 **SUPPORT & ESCALATION**

**Technical Lead:** Development Team  
**Implementation Timeline:** 4 weeks  
**Testing Phase:** 1 week  
**Production Rollout:** Gradual deployment  

**Priority Escalation:**
- 🚨 P1 (Critical): Immediate fix required
- 🟠 P2 (High): Fix within 24 hours  
- 🟡 P3 (Medium): Fix within 1 week
- ⚪ P4 (Low): Fix within 1 month

**Rollback Plan:** All changes are feature-flagged and can be reverted instantly if issues arise.

---

Този план покрива всички критични области за подобрение с konkretni, actionable задачи. Искаш ли да развием някоя конкретна секция по-подробно? 🚀