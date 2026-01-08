import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { colors } from '../constants/colors';
import { checkNetworkConnectivity } from '../utils/networkUtils';
import { offlineSync } from '../utils/offlineSync';
import SecureLogger, { LogCategory } from '../utils/secureLogger';

interface OfflineStatusBarProps {
  onSync?: () => void;
  showDetails?: boolean;
}

interface NetworkStatus {
  isOnline: boolean;
  connectionType?: string;
  lastChecked: Date;
}

interface QueueStatus {
  totalOperations: number;
  operationsByPriority: Record<string, number>;
  conflicts: number;
  isProcessing: boolean;
}

/**
 * Offline Status Bar Component
 * Shows network status, sync progress, and offline queue information
 */
const OfflineStatusBar: React.FC<OfflineStatusBarProps> = ({ onSync, showDetails = false }) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: true,
    lastChecked: new Date()
  });
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    totalOperations: 0,
    operationsByPriority: {},
    conflicts: 0,
    isProcessing: false
  });
  const [showDetailedStatus, setShowDetailedStatus] = useState(showDetails);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Network monitoring
  useEffect(() => {
    let networkCheckInterval: NodeJS.Timeout;
    let queueCheckInterval: NodeJS.Timeout;

    const checkNetworkStatus = async () => {
      try {
        const status = await checkNetworkConnectivity();
        const newNetworkStatus = {
          isOnline: status.isConnected,
          connectionType: status.connectionType,
          lastChecked: new Date()
        };

        setNetworkStatus(prev => {
          // Trigger animation if status changed
          if (prev.isOnline !== newNetworkStatus.isOnline) {
            triggerStatusChangeAnimation(newNetworkStatus.isOnline);
          }
          return newNetworkStatus;
        });
      } catch (error) {
        SecureLogger.error('SYSTEM', 'Failed to check network status', error);
      }
    };

    const checkQueueStatus = async () => {
      try {
        const status = await offlineSync.getQueueStatus();
        setQueueStatus(status);
      } catch (error) {
        SecureLogger.error('SYSTEM', 'Failed to check queue status', error);
      }
    };

    // Initial checks
    checkNetworkStatus();
    checkQueueStatus();

    // Set up monitoring intervals
    console.log('🔄 [OfflineStatusBar] Setting up monitoring intervals');
    networkCheckInterval = setInterval(checkNetworkStatus, 5000); // Check every 5 seconds
    queueCheckInterval = setInterval(checkQueueStatus, 2000); // Check every 2 seconds

    return () => {
      console.log('🧹 [OfflineStatusBar] Cleaning up monitoring intervals');
      if (networkCheckInterval) {
        clearInterval(networkCheckInterval);
        console.log('✅ [OfflineStatusBar] Network check interval cleared');
      }
      if (queueCheckInterval) {
        clearInterval(queueCheckInterval);
        console.log('✅ [OfflineStatusBar] Queue check interval cleared');
      }
    };
  }, []);

  const triggerStatusChangeAnimation = (isOnline: boolean) => {
    // Pulse animation for status changes
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSync = async () => {
    if (!networkStatus.isOnline) {
      return; // Can't sync without network
    }

    try {
      SecureLogger.info('SYSTEM', 'Manual sync requested');
      const result = await offlineSync.processQueue();
      
      if (onSync) {
        onSync();
      }
      
      // Update queue status after sync
      const newQueueStatus = await offlineSync.getQueueStatus();
      setQueueStatus(newQueueStatus);
      
      SecureLogger.info('SYSTEM', 'Manual sync completed', result);
    } catch (error) {
      SecureLogger.error('SYSTEM', 'Manual sync failed', error);
    }
  };

  const toggleExpanded = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    
    Animated.timing(slideAnim, {
      toValue: newExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const getStatusIcon = () => {
    if (!networkStatus.isOnline) {
      return '📴';
    }
    if (queueStatus.isProcessing) {
      return '🔄';
    }
    if (queueStatus.totalOperations > 0) {
      return '⏳';
    }
    return '🟢';
  };

  const getStatusText = () => {
    if (!networkStatus.isOnline) {
      return 'Офлайн';
    }
    if (queueStatus.isProcessing) {
      return 'Синхронизиране...';
    }
    if (queueStatus.totalOperations > 0) {
      return `${queueStatus.totalOperations} операции в опашката`;
    }
    return 'Онлайн';
  };

  const getStatusColor = () => {
    if (!networkStatus.isOnline) {
      return colors.error;
    }
    if (queueStatus.isProcessing) {
      return colors.warning;
    }
    if (queueStatus.totalOperations > 0) {
      return colors.warning;
    }
    return colors.success;
  };

  const shouldShowBar = !networkStatus.isOnline || queueStatus.totalOperations > 0 || showDetailedStatus;

  if (!shouldShowBar) {
    return null; // Hide when everything is normal
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        { opacity: fadeAnim, backgroundColor: getStatusColor() }
      ]}
    >
      <TouchableOpacity 
        style={styles.statusRow}
        onPress={toggleExpanded}
        activeOpacity={0.8}
      >
        <View style={styles.statusInfo}>
          <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {queueStatus.isProcessing && (
            <ActivityIndicator size="small" color={colors.textOnPrimary} style={styles.loader} />
          )}
        </View>
        
        {networkStatus.isOnline && queueStatus.totalOperations > 0 && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleSync}
            disabled={queueStatus.isProcessing}
          >
            <Text style={styles.syncButtonText}>
              {queueStatus.isProcessing ? 'Синхронизиране...' : 'Синхронизирай'}
            </Text>
          </TouchableOpacity>
        )}
        
        <Text style={styles.expandIcon}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      <Animated.View 
        style={[
          styles.detailsContainer,
          {
            maxHeight: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 200],
            }),
          }
        ]}
      >
        {isExpanded && (
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Мрежа:</Text>
              <Text style={styles.detailValue}>
                {networkStatus.isOnline ? 
                  `${networkStatus.connectionType || 'Активна'} • ${networkStatus.lastChecked.toLocaleTimeString()}` : 
                  'Няма връзка'
                }
              </Text>
            </View>
            
            {queueStatus.totalOperations > 0 && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Чакащи операции:</Text>
                  <Text style={styles.detailValue}>{queueStatus.totalOperations}</Text>
                </View>
                
                {Object.entries(queueStatus.operationsByPriority).map(([priority, count]) => (
                  <View key={priority} style={styles.subDetailRow}>
                    <Text style={styles.subDetailLabel}>
                      {priority === 'critical' ? 'Критични' :
                       priority === 'high' ? 'Високи' :
                       priority === 'medium' ? 'Средни' : 'Ниски'}:
                    </Text>
                    <Text style={styles.subDetailValue}>{count}</Text>
                  </View>
                ))}
              </>
            )}
            
            {queueStatus.conflicts > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Конфликти:</Text>
                <Text style={[styles.detailValue, styles.conflictText]}>
                  {queueStatus.conflicts} изискват внимание
                </Text>
              </View>
            )}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Статус:</Text>
              <Text style={styles.detailValue}>
                {queueStatus.isProcessing ? 'Обработка в ход...' : 'Готов'}
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 8,
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  statusText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  loader: {
    marginLeft: 8,
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  syncButtonText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  expandIcon: {
    color: colors.textOnPrimary,
    fontSize: 12,
    opacity: 0.7,
  },
  detailsContainer: {
    overflow: 'hidden',
  },
  details: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    color: colors.textOnPrimary,
    fontSize: 12,
    opacity: 0.8,
  },
  detailValue: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  subDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 16,
    marginBottom: 2,
  },
  subDetailLabel: {
    color: colors.textOnPrimary,
    fontSize: 11,
    opacity: 0.7,
  },
  subDetailValue: {
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '500',
  },
  conflictText: {
    color: '#FFD700', // Gold color for conflicts
    fontWeight: '600',
  },
});

export default OfflineStatusBar; 