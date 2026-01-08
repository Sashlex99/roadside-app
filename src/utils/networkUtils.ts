// ✅ FIXED: Remove incorrect import and use proper network detection
// import NetInfo from '@react-native-async-storage/async-storage'; // ❌ WRONG LIBRARY

export interface NetworkStatus {
  isConnected: boolean;
  connectionType: string;
  isInternetReachable: boolean;
}

/**
 * ✅ IMPROVED: More reliable network connectivity check
 */
export const checkNetworkConnectivity = async (): Promise<NetworkStatus> => {
  try {
    // ✅ IMPROVED: Test multiple endpoints for better reliability
    const testEndpoints = [
      'https://www.google.com/generate_204',
      'https://firebase.googleapis.com/v1/projects', // Firebase endpoint
      'https://cloudflaretest.com' // Cloudflare test
    ];
    
    let isConnected = false;
    
    for (const endpoint of testEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout per endpoint
        
        const response = await fetch(endpoint, {
          method: 'HEAD',
          cache: 'no-cache',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          isConnected = true;
          break; // Stop on first successful connection
        }
      } catch (endpointError) {
        // Continue to next endpoint
        console.log(`Network test failed for ${endpoint}:`, endpointError);
        continue;
      }
    }
    
    return {
      isConnected,
      connectionType: isConnected ? 'wifi' : 'none', // Simplified
      isInternetReachable: isConnected,
    };
  } catch (error) {
    console.warn('All network connectivity tests failed:', error);
    return {
      isConnected: false,
      connectionType: 'none',
      isInternetReachable: false,
    };
  }
};

/**
 * Tests Firebase connectivity
 */
export const testFirebaseConnectivity = async (): Promise<boolean> => {
  try {
    // Try to make a simple Firestore request
    const { getFirestore, doc, getDoc } = await import('firebase/firestore');
    const db = getFirestore();
    
    // Try to read from a known collection with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const testDoc = doc(db, 'test', 'connectivity');
    await getDoc(testDoc);
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.warn('Firebase connectivity test failed:', error);
    return false;
  }
};

/**
 * Retry logic for network operations
 */
export const retryNetworkOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Network operation attempt ${attempt}/${maxRetries} failed:`, error);
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('permission') || 
            message.includes('unauthorized') ||
            message.includes('not-found')) {
          throw error; // Don't retry permission/auth errors
        }
      }
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};

/**
 * Queue for offline operations
 */
class OfflineQueue {
  private queue: Array<{ operation: () => Promise<any>, id: string }> = [];
  private isProcessing = false;

  add(operation: () => Promise<any>, id?: string): void {
    this.queue.push({ 
      operation, 
      id: id || Date.now().toString() 
    });
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      const networkStatus = await checkNetworkConnectivity();
      
      if (!networkStatus.isConnected) {
        console.log('No network connection, keeping operations in queue');
        return;
      }

      while (this.queue.length > 0) {
        const { operation, id } = this.queue.shift()!;
        
        try {
          await operation();
          console.log(`✅ Offline operation ${id} completed`);
        } catch (error) {
          console.error(`❌ Offline operation ${id} failed:`, error);
          
          // Put it back in queue for retry
          this.queue.unshift({ operation, id });
          break; // Stop processing on error
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

export const offlineQueue = new OfflineQueue();

/**
 * Auto-retry failed operations when network comes back
 */
/**
 * ✅ FIXED: Initialize network recovery with proper cleanup
 * @returns cleanup function to clear the interval
 */
export const initializeNetworkRecovery = (): (() => void) => {
  let lastNetworkState = true;
  
  console.log('🔄 [NetworkUtils] Initializing network recovery monitoring');
  
  // Check network status periodically
  const intervalId = setInterval(async () => {
    try {
      const networkStatus = await checkNetworkConnectivity();
      
      // If network just came back online
      if (networkStatus.isConnected && !lastNetworkState) {
        console.log('🔗 Network recovered, processing offline queue...');
        await offlineQueue.processQueue();
      }
      
      lastNetworkState = networkStatus.isConnected;
    } catch (error) {
      console.error('Error checking network status:', error);
    }
  }, 30000); // Check every 30 seconds
  
  // ✅ FIXED: Return cleanup function
  return () => {
    console.log('🧹 [NetworkUtils] Cleaning up network recovery monitoring');
    clearInterval(intervalId);
  };
}; 