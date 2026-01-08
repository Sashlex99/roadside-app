/**
 * Offline Sync Utility
 * 
 * This utility manages operations that need to be synced when the device comes back online.
 * It provides a queue system for storing operations offline and syncing them when connected.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import SecureLogger from './secureLogger';
import { checkNetworkConnectivity } from './networkUtils';

// Storage keys for different data types
const STORAGE_KEYS = {
  OFFLINE_ORDERS: 'offline_orders',
  OFFLINE_BIDS: 'offline_bids', 
  OFFLINE_PROFILE_UPDATES: 'offline_profile_updates',
  OFFLINE_LOCATION_UPDATES: 'offline_location_updates',
  CACHED_ORDERS: 'cached_orders',
  CACHED_DRIVERS: 'cached_drivers',
  SYNC_METADATA: 'sync_metadata',
  CONFLICT_LOG: 'conflict_log'
} as const;

interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  documentId?: string;
  data: any;
  timestamp: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
  userId?: string;
}

interface SyncResult {
  success: boolean;
  operations: {
    successful: number;
    failed: number;
    conflicts: number;
  };
  conflicts: ConflictItem[];
  errors: Array<{ operation: OfflineOperation; error: string }>;
}

interface ConflictItem {
  operationId: string;
  type: 'data_conflict' | 'version_conflict' | 'deleted_conflict';
  description: string;
  localData: any;
  serverData: any;
  resolution?: 'local_wins' | 'server_wins' | 'manual_required';
}

interface CachedData {
  data: any;
  timestamp: number;
  expiresAt: number;
  version: string;
}

/**
 * Enhanced Offline Queue with intelligent prioritization
 */
export class EnhancedOfflineQueue {
  private static instance: EnhancedOfflineQueue;
  private isProcessing = false;
  private processingQueue: Set<string> = new Set();

  static getInstance(): EnhancedOfflineQueue {
    if (!this.instance) {
      this.instance = new EnhancedOfflineQueue();
    }
    return this.instance;
  }

  /**
   * Add operation to offline queue with priority
   */
  async addOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const operationWithMeta: OfflineOperation = {
      ...operation,
      id: `${operation.collection}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0
    };

    try {
      const existingOperations = await this.getStoredOperations();
      existingOperations.push(operationWithMeta);
      
      // Sort by priority and timestamp
      const sortedOperations = this.sortOperationsByPriority(existingOperations);
      
      // Store in background to avoid blocking
      AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_ORDERS, JSON.stringify(sortedOperations)).catch(error => {
        SecureLogger.error('SYSTEM', 'Failed to store offline operations', error);
      });
      
      SecureLogger.info('SYSTEM', `Added operation to offline queue: ${operationWithMeta.id}`, {
        type: operationWithMeta.type,
        collection: operationWithMeta.collection,
        priority: operationWithMeta.priority
      });
      
      return operationWithMeta.id;
    } catch (error) {
      SecureLogger.error('SYSTEM', 'Failed to add operation to offline queue', error);
      throw error;
    }
  }

  /**
   * Process all pending offline operations
   */
  async processQueue(): Promise<SyncResult> {
    if (this.isProcessing) {
      SecureLogger.warn('SYSTEM', 'Queue processing already in progress');
      return {
        success: false,
        operations: { successful: 0, failed: 0, conflicts: 0 },
        conflicts: [],
        errors: []
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      SecureLogger.info('SYSTEM', 'Starting offline queue processing');
      
      // Check network connectivity first
      const networkStatus = await checkNetworkConnectivity();
      if (!networkStatus.isConnected) {
        SecureLogger.warn('SYSTEM', 'No network connectivity - aborting sync');
        return {
          success: false,
          operations: { successful: 0, failed: 0, conflicts: 0 },
          conflicts: [],
          errors: []
        };
      }

      const operations = await this.getStoredOperations();
      const result: SyncResult = {
        success: true,
        operations: { successful: 0, failed: 0, conflicts: 0 },
        conflicts: [],
        errors: []
      };

      // Process operations in priority order
      for (const operation of operations) {
        if (this.processingQueue.has(operation.id)) {
          continue; // Skip if already processing
        }

        this.processingQueue.add(operation.id);

        try {
          const syncResult = await this.processOperation(operation);
          
          if (syncResult.success) {
            result.operations.successful++;
            await this.removeOperation(operation.id);
          } else if (syncResult.isConflict) {
            result.operations.conflicts++;
            result.conflicts.push(syncResult.conflict!);
            await this.handleConflict(operation, syncResult.conflict!);
          } else {
            result.operations.failed++;
            result.errors.push({ operation, error: syncResult.error || 'Unknown error' });
            await this.handleOperationFailure(operation);
          }
        } catch (error) {
          result.operations.failed++;
          result.errors.push({ operation, error: error instanceof Error ? error.message : String(error) });
          await this.handleOperationFailure(operation);
        } finally {
          this.processingQueue.delete(operation.id);
        }
      }

      const duration = Date.now() - startTime;
      SecureLogger.info('SYSTEM', 'Offline queue processing completed', {
        duration,
        result
      });

      return result;

    } catch (error) {
      SecureLogger.error('SYSTEM', 'Failed to process offline queue', error);
      return {
        success: false,
        operations: { successful: 0, failed: 0, conflicts: 0 },
        conflicts: [],
        errors: []
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual operation
   */
  private async processOperation(operation: OfflineOperation): Promise<{
    success: boolean;
    isConflict?: boolean;
    conflict?: ConflictItem;
    error?: string;
  }> {
    try {
      switch (operation.type) {
        case 'create':
          if (operation.collection === 'orders') {
            const { createOrder } = await import('../services/firestore');
            const orderId = await createOrder(operation.data);
            SecureLogger.info('SYSTEM', `Created order from offline queue: ${orderId}`);
            return { success: true };
          }
          break;
          
        case 'update':
          // Handle updates with conflict detection
          const updateResult = await this.updateWithConflictDetection(operation);
          return updateResult;
          
        case 'delete':
          // Handle deletes with Firebase SDK directly
          if (operation.documentId) {
            const { deleteDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../config/firebase');
            await deleteDoc(doc(db, operation.collection, operation.documentId));
            return { success: true };
          }
          break;
      }

      return { success: false, error: 'Unsupported operation type' };
      
    } catch (error) {
      SecureLogger.error('SYSTEM', `Failed to process operation ${operation.id}`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Update with conflict detection
   */
  private async updateWithConflictDetection(operation: OfflineOperation): Promise<{
    success: boolean;
    isConflict?: boolean;
    conflict?: ConflictItem;
    error?: string;
  }> {
    try {
      // Import Firebase SDK functions and database
      const { getDoc, updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      
      if (!operation.documentId) {
        return { success: false, error: 'Document ID required for update' };
      }

      // Get current server data
      const docRef = doc(db, operation.collection, operation.documentId);
      const serverDoc = await getDoc(docRef);
      
      if (!serverDoc.exists()) {
        return {
          success: false,
          isConflict: true,
          conflict: {
            operationId: operation.id,
            type: 'deleted_conflict',
            description: 'Document was deleted on server',
            localData: operation.data,
            serverData: null,
            resolution: 'manual_required'
          }
        };
      }

      const serverData = serverDoc.data();
      
      // Simple conflict detection - check if updatedAt changed
      if (serverData.updatedAt && operation.data.expectedVersion) {
        const serverUpdatedAt = serverData.updatedAt.toDate?.() || serverData.updatedAt;
        const expectedUpdatedAt = new Date(operation.data.expectedVersion);
        
        if (serverUpdatedAt > expectedUpdatedAt) {
          return {
            success: false,
            isConflict: true,
            conflict: {
              operationId: operation.id,
              type: 'version_conflict',
              description: 'Document was modified on server after local changes',
              localData: operation.data,
              serverData: serverData,
              resolution: 'server_wins' // Default resolution
            }
          };
        }
      }

      // No conflict, proceed with update
      await updateDoc(docRef, operation.data);
      return { success: true };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Handle operation failure with retry logic
   */
  private async handleOperationFailure(operation: OfflineOperation): Promise<void> {
    operation.retryCount++;
    
    if (operation.retryCount < operation.maxRetries) {
      // Keep in queue for retry with exponential backoff
      const delay = Math.pow(2, operation.retryCount) * 1000; // 2s, 4s, 8s, etc.
      SecureLogger.warn('SYSTEM', `Retrying operation ${operation.id} in ${delay}ms (attempt ${operation.retryCount}/${operation.maxRetries})`);
      
      setTimeout(async () => {
        try {
          await this.updateOperation(operation.id, operation);
        } catch (error) {
          SecureLogger.error('SYSTEM', 'Failed to update operation for retry', error);
        }
      }, delay);
    } else {
      // Max retries exceeded, remove from queue
      SecureLogger.error('SYSTEM', `Max retries exceeded for operation ${operation.id}, removing from queue`);
      await this.removeOperation(operation.id);
    }
  }

  /**
   * Handle conflict resolution
   */
  private async handleConflict(operation: OfflineOperation, conflict: ConflictItem): Promise<void> {
    try {
      // Log conflict for manual resolution
      const conflicts = await this.getStoredConflicts();
      conflicts.push(conflict);
      await AsyncStorage.setItem(STORAGE_KEYS.CONFLICT_LOG, JSON.stringify(conflicts));
      
      // Apply default resolution if available
      if (conflict.resolution === 'server_wins') {
        SecureLogger.info('SYSTEM', `Auto-resolving conflict ${conflict.operationId} - server wins`);
        await this.removeOperation(operation.id);
      } else if (conflict.resolution === 'local_wins') {
        SecureLogger.info('SYSTEM', `Auto-resolving conflict ${conflict.operationId} - local wins`);
        // Force update
        operation.data.forceUpdate = true;
        await this.updateOperation(operation.id, operation);
      } else {
        SecureLogger.warn('SYSTEM', `Manual resolution required for conflict ${conflict.operationId}`);
        // Keep operation in queue for manual resolution
      }
      
    } catch (error) {
      SecureLogger.error('SYSTEM', 'Failed to handle conflict', error);
    }
  }

  /**
   * Sort operations by priority
   */
  private sortOperationsByPriority(operations: OfflineOperation[]): OfflineOperation[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    return operations.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by timestamp (older first)
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Get stored operations
   */
  private async getStoredOperations(): Promise<OfflineOperation[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_ORDERS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      SecureLogger.error('SYSTEM', 'Failed to get stored operations', error);
      return [];
    }
  }

  /**
   * Get stored conflicts
   */
  private async getStoredConflicts(): Promise<ConflictItem[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CONFLICT_LOG);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      SecureLogger.error('SYSTEM', 'Failed to get stored conflicts', error);
      return [];
    }
  }

  /**
   * Remove operation from queue
   */
  private async removeOperation(operationId: string): Promise<void> {
    try {
      const operations = await this.getStoredOperations();
      const filteredOperations = operations.filter(op => op.id !== operationId);
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_ORDERS, JSON.stringify(filteredOperations));
    } catch (error) {
      SecureLogger.error('SYSTEM', 'Failed to remove operation', error);
    }
  }

  /**
   * Update operation in queue
   */
  private async updateOperation(operationId: string, updatedOperation: OfflineOperation): Promise<void> {
    try {
      const operations = await this.getStoredOperations();
      const index = operations.findIndex(op => op.id === operationId);
      if (index !== -1) {
        operations[index] = updatedOperation;
        await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_ORDERS, JSON.stringify(operations));
      }
    } catch (error) {
      SecureLogger.error('SYSTEM', 'Failed to update operation', error);
    }
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{
    totalOperations: number;
    operationsByPriority: Record<string, number>;
    conflicts: number;
    isProcessing: boolean;
  }> {
    try {
      const operations = await this.getStoredOperations();
      const conflicts = await this.getStoredConflicts();
      
      const operationsByPriority = operations.reduce((acc, op) => {
        acc[op.priority] = (acc[op.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalOperations: operations.length,
        operationsByPriority,
        conflicts: conflicts.length,
        isProcessing: this.isProcessing
      };
    } catch (error) {
      SecureLogger.error('SYSTEM', 'Failed to get queue status', error);
      return {
        totalOperations: 0,
        operationsByPriority: {},
        conflicts: 0,
        isProcessing: false
      };
    }
  }

  /**
   * Clear all offline data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_ORDERS),
        AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_BIDS),
        AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_PROFILE_UPDATES),
        AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_LOCATION_UPDATES),
        AsyncStorage.removeItem(STORAGE_KEYS.CONFLICT_LOG)
      ]);
      
      SecureLogger.info('SYSTEM', 'Cleared all offline data');
    } catch (error) {
      SecureLogger.error('SYSTEM', 'Failed to clear offline data', error);
    }
  }
}

// Export singleton instance
export const offlineSync = EnhancedOfflineQueue.getInstance(); 