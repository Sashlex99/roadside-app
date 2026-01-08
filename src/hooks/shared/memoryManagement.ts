import { useRef, useEffect, useCallback, useMemo } from 'react';

// ======================================================================
// UTILITY HOOKS FOR MEMORY MANAGEMENT
// ======================================================================

/**
 * Hook for managing setTimeout calls with automatic cleanup
 * Prevents memory leaks by tracking and cleaning up all timeouts
 */
export const useManagedTimeout = () => {
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const setManagedTimeout = useCallback((
    callback: () => void,
    delay: number,
    timeoutId?: string
  ): string => {
    // Generate unique ID if not provided
    const id = timeoutId || `timeout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Clear existing timeout with same ID
    const existingTimeout = timeoutsRef.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      console.log(`🧹 [useManagedTimeout] Cleared existing timeout: ${id}`);
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        console.error(`❌ [useManagedTimeout] Error in timeout callback ${id}:`, error);
      } finally {
        // Remove from tracking after execution
        timeoutsRef.current.delete(id);
        console.log(`✅ [useManagedTimeout] Timeout ${id} completed and cleaned up`);
      }
    }, delay);
    
    // Track the timeout
    timeoutsRef.current.set(id, timeout);
    console.log(`⏰ [useManagedTimeout] Set timeout ${id} for ${delay}ms`);
    
    return id;
  }, []);
  
  const clearManagedTimeout = useCallback((timeoutId: string) => {
    const timeout = timeoutsRef.current.get(timeoutId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(timeoutId);
      console.log(`🧹 [useManagedTimeout] Manually cleared timeout: ${timeoutId}`);
    }
  }, []);
  
  const clearAllTimeouts = useCallback(() => {
    console.log(`🧹 [useManagedTimeout] Clearing ${timeoutsRef.current.size} timeouts`);
    timeoutsRef.current.forEach((timeout, id) => {
      clearTimeout(timeout);
      console.log(`🧹 [useManagedTimeout] Cleared timeout: ${id}`);
    });
    timeoutsRef.current.clear();
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);
  
  return {
    setManagedTimeout,
    clearManagedTimeout,
    clearAllTimeouts,
    activeTimeoutCount: timeoutsRef.current.size
  };
};

// ======================================================================

/**
 * Hook for managing setInterval calls with automatic cleanup
 * Includes pause/resume functionality and error handling
 */
export const useManagedInterval = () => {
  const intervalsRef = useRef<Map<string, { 
    interval: NodeJS.Timeout; 
    callback: () => void; 
    delay: number; 
    paused: boolean;
  }>>(new Map());
  
  const setManagedInterval = useCallback((
    callback: () => void,
    delay: number,
    intervalId?: string
  ): string => {
    // Generate unique ID if not provided
    const id = intervalId || `interval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Clear existing interval with same ID
    const existingInterval = intervalsRef.current.get(id);
    if (existingInterval) {
      clearInterval(existingInterval.interval);
      console.log(`🧹 [useManagedInterval] Cleared existing interval: ${id}`);
    }
    
    // Set new interval with error handling
    const interval = setInterval(() => {
      const intervalData = intervalsRef.current.get(id);
      if (intervalData && !intervalData.paused) {
        try {
          callback();
        } catch (error) {
          console.error(`❌ [useManagedInterval] Error in interval callback ${id}:`, error);
        }
      }
    }, delay);
    
    // Track the interval
    intervalsRef.current.set(id, {
      interval,
      callback,
      delay,
      paused: false
    });
    
    console.log(`⏰ [useManagedInterval] Set interval ${id} for ${delay}ms`);
    
    return id;
  }, []);
  
  const clearManagedInterval = useCallback((intervalId: string) => {
    const intervalData = intervalsRef.current.get(intervalId);
    if (intervalData) {
      clearInterval(intervalData.interval);
      intervalsRef.current.delete(intervalId);
      console.log(`🧹 [useManagedInterval] Manually cleared interval: ${intervalId}`);
    }
  }, []);
  
  const pauseInterval = useCallback((intervalId: string) => {
    const intervalData = intervalsRef.current.get(intervalId);
    if (intervalData) {
      intervalData.paused = true;
      console.log(`⏸️ [useManagedInterval] Paused interval: ${intervalId}`);
    }
  }, []);
  
  const resumeInterval = useCallback((intervalId: string) => {
    const intervalData = intervalsRef.current.get(intervalId);
    if (intervalData) {
      intervalData.paused = false;
      console.log(`▶️ [useManagedInterval] Resumed interval: ${intervalId}`);
    }
  }, []);
  
  const clearAllIntervals = useCallback(() => {
    console.log(`🧹 [useManagedInterval] Clearing ${intervalsRef.current.size} intervals`);
    intervalsRef.current.forEach((intervalData, id) => {
      clearInterval(intervalData.interval);
      console.log(`🧹 [useManagedInterval] Cleared interval: ${id}`);
    });
    intervalsRef.current.clear();
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllIntervals();
    };
  }, [clearAllIntervals]);
  
  return {
    setManagedInterval,
    clearManagedInterval,
    pauseInterval,
    resumeInterval,
    clearAllIntervals,
    activeIntervalCount: intervalsRef.current.size
  };
};

// ======================================================================

/**
 * Hook for managing Firestore subscriptions with automatic cleanup
 * Includes batch subscription management and error recovery
 */
export const useSubscriptionManager = () => {
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const errorCountRef = useRef<Map<string, number>>(new Map());
  
  const addSubscription = useCallback((
    unsubscribe: () => void,
    subscriptionId?: string
  ): string => {
    // Generate unique ID if not provided
    const id = subscriptionId || `subscription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Clear existing subscription with same ID
    const existingSubscription = subscriptionsRef.current.get(id);
    if (existingSubscription) {
      try {
        existingSubscription();
        console.log(`🧹 [useSubscriptionManager] Cleared existing subscription: ${id}`);
      } catch (error) {
        console.error(`❌ [useSubscriptionManager] Error clearing existing subscription ${id}:`, error);
      }
    }
    
    // Add new subscription
    subscriptionsRef.current.set(id, unsubscribe);
    errorCountRef.current.set(id, 0);
    console.log(`📡 [useSubscriptionManager] Added subscription: ${id}`);
    
    return id;
  }, []);
  
  const removeSubscription = useCallback((subscriptionId: string) => {
    const unsubscribe = subscriptionsRef.current.get(subscriptionId);
    if (unsubscribe) {
      try {
        unsubscribe();
        subscriptionsRef.current.delete(subscriptionId);
        errorCountRef.current.delete(subscriptionId);
        console.log(`🧹 [useSubscriptionManager] Removed subscription: ${subscriptionId}`);
      } catch (error) {
        console.error(`❌ [useSubscriptionManager] Error removing subscription ${subscriptionId}:`, error);
      }
    }
  }, []);
  
  const handleSubscriptionError = useCallback((subscriptionId: string, error: Error) => {
    console.error(`❌ [useSubscriptionManager] Subscription error for ${subscriptionId}:`, error);
    
    // Track error count
    const currentErrorCount = errorCountRef.current.get(subscriptionId) || 0;
    const newErrorCount = currentErrorCount + 1;
    errorCountRef.current.set(subscriptionId, newErrorCount);
    
    // If too many errors, remove the subscription
    if (newErrorCount >= 3) {
      console.warn(`⚠️ [useSubscriptionManager] Subscription ${subscriptionId} has ${newErrorCount} errors, removing it`);
      removeSubscription(subscriptionId);
    }
  }, [removeSubscription]);
  
  const clearAllSubscriptions = useCallback(() => {
    console.log(`🧹 [useSubscriptionManager] Clearing ${subscriptionsRef.current.size} subscriptions`);
    subscriptionsRef.current.forEach((unsubscribe, id) => {
      try {
        unsubscribe();
        console.log(`🧹 [useSubscriptionManager] Cleared subscription: ${id}`);
      } catch (error) {
        console.error(`❌ [useSubscriptionManager] Error clearing subscription ${id}:`, error);
      }
    });
    subscriptionsRef.current.clear();
    errorCountRef.current.clear();
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllSubscriptions();
    };
  }, [clearAllSubscriptions]);
  
  return {
    addSubscription,
    removeSubscription,
    handleSubscriptionError,
    clearAllSubscriptions,
    activeSubscriptionCount: subscriptionsRef.current.size
  };
};

// ======================================================================

/**
 * Hook for managing AbortController instances with automatic cleanup
 * Prevents network requests from continuing after component unmount
 */
export const useAbortController = () => {
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  
  const createController = useCallback((controllerId?: string): string => {
    // Generate unique ID if not provided
    const id = controllerId || `controller_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Abort existing controller with same ID
    const existingController = controllersRef.current.get(id);
    if (existingController) {
      existingController.abort();
      console.log(`🧹 [useAbortController] Aborted existing controller: ${id}`);
    }
    
    // Create new controller
    const controller = new AbortController();
    controllersRef.current.set(id, controller);
    console.log(`🎛️ [useAbortController] Created controller: ${id}`);
    
    return id;
  }, []);
  
  const getController = useCallback((controllerId: string): AbortController | undefined => {
    return controllersRef.current.get(controllerId);
  }, []);
  
  const abortController = useCallback((controllerId: string) => {
    const controller = controllersRef.current.get(controllerId);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(controllerId);
      console.log(`🛑 [useAbortController] Aborted controller: ${controllerId}`);
    }
  }, []);
  
  const abortAllControllers = useCallback(() => {
    console.log(`🧹 [useAbortController] Aborting ${controllersRef.current.size} controllers`);
    controllersRef.current.forEach((controller, id) => {
      controller.abort();
      console.log(`🧹 [useAbortController] Aborted controller: ${id}`);
    });
    controllersRef.current.clear();
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortAllControllers();
    };
  }, [abortAllControllers]);
  
  return {
    createController,
    getController,
    abortController,
    abortAllControllers,
    activeControllerCount: controllersRef.current.size
  };
};

// ======================================================================

/**
 * Comprehensive resource manager that combines all memory management utilities
 * Use this for complex components that need multiple types of cleanup
 */
export const useResourceManager = () => {
  const timeoutManager = useManagedTimeout();
  const intervalManager = useManagedInterval();
  const subscriptionManager = useSubscriptionManager();
  const abortControllerManager = useAbortController();
  
  const cleanupAll = useCallback(() => {
    console.log('🧹 [useResourceManager] Cleaning up all resources...');
    timeoutManager.clearAllTimeouts();
    intervalManager.clearAllIntervals();
    subscriptionManager.clearAllSubscriptions();
    abortControllerManager.abortAllControllers();
    console.log('✅ [useResourceManager] All resources cleaned up');
  }, [timeoutManager, intervalManager, subscriptionManager, abortControllerManager]);
  
  const getResourceStatus = useCallback(() => {
    return {
      timeouts: timeoutManager.activeTimeoutCount,
      intervals: intervalManager.activeIntervalCount,
      subscriptions: subscriptionManager.activeSubscriptionCount,
      controllers: abortControllerManager.activeControllerCount
    };
  }, [timeoutManager, intervalManager, subscriptionManager, abortControllerManager]);
  
  return {
    // Individual managers
    timeouts: timeoutManager,
    intervals: intervalManager,
    subscriptions: subscriptionManager,
    controllers: abortControllerManager,
    
    // Combined utilities
    cleanupAll,
    getResourceStatus
  };
};

// ======================================================================

// TypeScript interfaces for better type safety
export interface TimeoutManager {
  setManagedTimeout: (callback: () => void, delay: number, timeoutId?: string) => string;
  clearManagedTimeout: (timeoutId: string) => void;
  clearAllTimeouts: () => void;
  activeTimeoutCount: number;
}

export interface IntervalManager {
  setManagedInterval: (callback: () => void, delay: number, intervalId?: string) => string;
  clearManagedInterval: (intervalId: string) => void;
  pauseInterval: (intervalId: string) => void;
  resumeInterval: (intervalId: string) => void;
  clearAllIntervals: () => void;
  activeIntervalCount: number;
}

export interface SubscriptionManager {
  addSubscription: (unsubscribe: () => void, subscriptionId?: string) => string;
  removeSubscription: (subscriptionId: string) => void;
  handleSubscriptionError: (subscriptionId: string, error: Error) => void;
  clearAllSubscriptions: () => void;
  activeSubscriptionCount: number;
}

export interface AbortControllerManager {
  createController: (controllerId?: string) => string;
  getController: (controllerId: string) => AbortController | undefined;
  abortController: (controllerId: string) => void;
  abortAllControllers: () => void;
  activeControllerCount: number;
}

export interface ResourceManager {
  timeouts: TimeoutManager;
  intervals: IntervalManager;
  subscriptions: SubscriptionManager;
  controllers: AbortControllerManager;
  cleanupAll: () => void;
  getResourceStatus: () => {
    timeouts: number;
    intervals: number;
    subscriptions: number;
    controllers: number;
  };
} 