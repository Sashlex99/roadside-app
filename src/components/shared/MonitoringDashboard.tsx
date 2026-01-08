/**
 * Real-time System Monitoring Dashboard Component
 * 
 * Displays circuit breaker status, system health, performance metrics,
 * and recent alerts in a user-friendly interface for the mobile app.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, Dimensions } from 'react-native';
import { globalMonitoringDashboard } from '../../utils/systemMonitoringDashboard';
import { globalPerformanceMetrics } from '../../utils/performanceMetrics';
import { globalAlertingSystem } from '../../utils/alertingSystem';
import { circuitBreakers, getSystemHealth } from '../../utils/circuitBreakerInstances';

interface MonitoringDashboardProps {
  onAlertPress?: (alertId: string) => void;
  onCircuitBreakerPress?: (cbName: string) => void;
  refreshInterval?: number; // in milliseconds
  visible?: boolean;
}

interface SystemHealthData {
  overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  score: number;
  circuitBreakers: any[];
  recentAlerts: any[];
  performanceMetrics: any;
  systemMetrics: any;
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  onAlertPress,
  onCircuitBreakerPress,
  refreshInterval = 10000, // 10 seconds
  visible = true
}) => {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'circuits' | 'alerts' | 'metrics'>('overview');

  // Load monitoring data
  const loadMonitoringData = useCallback(async () => {
    try {
      // Get system health from circuit breakers
      const systemHealth = await getSystemHealth();
      
      // Get monitoring dashboard data
      const dashboardMetrics = globalMonitoringDashboard.getSystemMetrics();
      
      // Get performance metrics
      const performanceMetrics = globalPerformanceMetrics.getMetrics();
      
      // Get recent alerts
      const alertStats = globalAlertingSystem.getAlertStats();
      
      // Get circuit breaker statuses
      const cbStatuses = Object.entries(circuitBreakers).map(([name, cb]) => ({
        name,
        state: cb.getState(),
        stats: cb.getStats(),
        health: cb.getHealth()
      }));

      // Calculate overall health score
      const overallScore = Math.min(
        systemHealth.healthScore,
        dashboardMetrics.systemHealth.score,
        performanceMetrics.healthScore || 100
      );

      const overallHealth = overallScore >= 80 ? 'HEALTHY' : 
                           overallScore >= 60 ? 'WARNING' : 'CRITICAL';

      setHealthData({
        overallHealth,
        score: overallScore,
        circuitBreakers: cbStatuses,
        recentAlerts: [], // Will be populated with actual alert data
        performanceMetrics,
        systemMetrics: dashboardMetrics
      });

      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('Error loading monitoring data:', error);
      Alert.alert('Monitoring Error', 'Failed to load system monitoring data');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!visible) return;

    loadMonitoringData();
    
    const interval = setInterval(loadMonitoringData, refreshInterval);
    
    return () => clearInterval(interval);
  }, [visible, refreshInterval, loadMonitoringData]);

  // Manual refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMonitoringData();
  }, [loadMonitoringData]);

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'closed': return '#10B981'; // Green
      case 'warning':
      case 'half-open': return '#F59E0B'; // Yellow
      case 'critical':
      case 'open': return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
  };

  // Get status icon
  const getStatusIcon = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'closed': return '✅';
      case 'warning':
      case 'half-open': return '⚠️';
      case 'critical':
      case 'open': return '❌';
      default: return '⚪';
    }
  };

  if (!visible) return null;

  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>System Monitoring</Text>
        <Text style={styles.lastUpdated}>
          Last updated: {lastUpdated.toLocaleTimeString()}
        </Text>
      </View>

      {/* Health Overview */}
      {healthData && (
        <View style={[
          styles.healthOverview,
          { backgroundColor: getStatusColor(healthData.overallHealth) + '20' }
        ]}>
          <Text style={styles.healthScore}>
            {getStatusIcon(healthData.overallHealth)} Health Score: {Math.round(healthData.score)}%
          </Text>
          <Text style={[styles.healthStatus, { color: getStatusColor(healthData.overallHealth) }]}>
            {healthData.overallHealth}
          </Text>
        </View>
      )}

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {(['overview', 'circuits', 'alerts', 'metrics'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, selectedTab === tab && styles.activeTab]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[styles.tabText, selectedTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {selectedTab === 'overview' && healthData && (
          <OverviewTab 
            data={healthData} 
            onCircuitBreakerPress={onCircuitBreakerPress}
          />
        )}

        {selectedTab === 'circuits' && healthData && (
          <CircuitBreakersTab 
            circuitBreakers={healthData.circuitBreakers}
            onPress={onCircuitBreakerPress}
          />
        )}

        {selectedTab === 'alerts' && healthData && (
          <AlertsTab 
            alerts={healthData.recentAlerts}
            alertStats={globalAlertingSystem.getAlertStats()}
            onPress={onAlertPress}
          />
        )}

        {selectedTab === 'metrics' && healthData && (
          <MetricsTab 
            performanceMetrics={healthData.performanceMetrics}
            systemMetrics={healthData.systemMetrics}
          />
        )}
      </ScrollView>
    </View>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  data: SystemHealthData;
  onCircuitBreakerPress?: (cbName: string) => void;
}> = ({ data, onCircuitBreakerPress }) => (
  <View style={styles.tabContent}>
    {/* Quick Stats */}
    <View style={styles.statsGrid}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{data.circuitBreakers.length}</Text>
        <Text style={styles.statLabel}>Circuit Breakers</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>
          {data.circuitBreakers.filter(cb => cb.state === 'OPEN').length}
        </Text>
        <Text style={styles.statLabel}>Open Circuits</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{data.recentAlerts.length}</Text>
        <Text style={styles.statLabel}>Recent Alerts</Text>
      </View>
    </View>

    {/* Circuit Breaker Status Summary */}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Circuit Breaker Status</Text>
      {data.circuitBreakers.slice(0, 5).map((cb, index) => (
        <TouchableOpacity
          key={index}
          style={styles.circuitBreakerItem}
          onPress={() => onCircuitBreakerPress?.(cb.name)}
        >
          <View style={styles.circuitBreakerHeader}>
            <Text style={styles.circuitBreakerName}>{cb.name}</Text>
            <View style={[
              styles.stateIndicator,
              { backgroundColor: getStatusColor(cb.state) }
            ]}>
              <Text style={styles.stateText}>{cb.state}</Text>
            </View>
          </View>
          <Text style={styles.circuitBreakerStats}>
            Failures: {cb.stats.failures} | Success Rate: {Math.round(cb.stats.successRate || 0)}%
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    {/* Performance Summary */}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Performance Summary</Text>
      <View style={styles.performanceGrid}>
        <View style={styles.performanceCard}>
          <Text style={styles.performanceValue}>
            {Math.round(data.performanceMetrics.avgResponseTime || 0)}ms
          </Text>
          <Text style={styles.performanceLabel}>Avg Response Time</Text>
        </View>
        <View style={styles.performanceCard}>
          <Text style={styles.performanceValue}>
            {Math.round((data.performanceMetrics.errorRate || 0) * 100)}%
          </Text>
          <Text style={styles.performanceLabel}>Error Rate</Text>
        </View>
      </View>
    </View>
  </View>
);

// Circuit Breakers Tab Component
const CircuitBreakersTab: React.FC<{
  circuitBreakers: any[];
  onPress?: (cbName: string) => void;
}> = ({ circuitBreakers, onPress }) => (
  <View style={styles.tabContent}>
    {circuitBreakers.map((cb, index) => (
      <TouchableOpacity
        key={index}
        style={styles.circuitBreakerCard}
        onPress={() => onPress?.(cb.name)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{cb.name}</Text>
          <View style={[
            styles.stateIndicator,
            { backgroundColor: getStatusColor(cb.state) }
          ]}>
            <Text style={styles.stateText}>{cb.state}</Text>
          </View>
        </View>
        
        <View style={styles.cardStats}>
          <Text style={styles.statLine}>Failures: {cb.stats.failures}</Text>
          <Text style={styles.statLine}>Successes: {cb.stats.successes}</Text>
          <Text style={styles.statLine}>
            Success Rate: {Math.round(cb.stats.successRate || 0)}%
          </Text>
          <Text style={styles.statLine}>
            Last Failure: {cb.stats.lastFailureTime || 'None'}
          </Text>
        </View>
      </TouchableOpacity>
    ))}
  </View>
);

// Alerts Tab Component
const AlertsTab: React.FC<{
  alerts: any[];
  alertStats: any;
  onPress?: (alertId: string) => void;
}> = ({ alerts, alertStats, onPress }) => (
  <View style={styles.tabContent}>
    {/* Alert Stats */}
    <View style={styles.alertStatsGrid}>
      <View style={styles.alertStatCard}>
        <Text style={styles.alertStatValue}>{alertStats.totalAlerts}</Text>
        <Text style={styles.alertStatLabel}>Total Alerts</Text>
      </View>
      <View style={styles.alertStatCard}>
        <Text style={styles.alertStatValue}>{alertStats.recentAlerts}</Text>
        <Text style={styles.alertStatLabel}>Recent (1h)</Text>
      </View>
      <View style={styles.alertStatCard}>
        <Text style={styles.alertStatValue}>{alertStats.queuedAlerts}</Text>
        <Text style={styles.alertStatLabel}>Queued</Text>
      </View>
    </View>

    {/* Recent Alerts List */}
    <Text style={styles.sectionTitle}>Recent Alerts</Text>
    {alerts.length === 0 ? (
      <Text style={styles.noDataText}>No recent alerts</Text>
    ) : (
      alerts.map((alert, index) => (
        <TouchableOpacity
          key={index}
          style={styles.alertItem}
          onPress={() => onPress?.(alert.id)}
        >
          <View style={styles.alertHeader}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertTime}>{alert.timestamp}</Text>
          </View>
          <Text style={styles.alertMessage}>{alert.message}</Text>
          <View style={[
            styles.alertSeverity,
            { backgroundColor: getStatusColor(alert.severity) }
          ]}>
            <Text style={styles.alertSeverityText}>{alert.severity.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      ))
    )}
  </View>
);

// Metrics Tab Component
const MetricsTab: React.FC<{
  performanceMetrics: any;
  systemMetrics: any;
}> = ({ performanceMetrics, systemMetrics }) => (
  <View style={styles.tabContent}>
    <Text style={styles.sectionTitle}>Performance Metrics</Text>
    
    <View style={styles.metricsGrid}>
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>
          {Math.round(performanceMetrics.avgResponseTime || 0)}ms
        </Text>
        <Text style={styles.metricLabel}>Avg Response Time</Text>
      </View>
      
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>
          {Math.round((performanceMetrics.errorRate || 0) * 100)}%
        </Text>
        <Text style={styles.metricLabel}>Error Rate</Text>
      </View>
      
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>
          {Math.round(performanceMetrics.throughput || 0)}
        </Text>
        <Text style={styles.metricLabel}>Throughput/min</Text>
      </View>
      
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>
          {Math.round(performanceMetrics.healthScore || 0)}%
        </Text>
        <Text style={styles.metricLabel}>Health Score</Text>
      </View>
    </View>

    <Text style={styles.sectionTitle}>System Metrics</Text>
    
    <View style={styles.systemMetricsContainer}>
      <Text style={styles.systemMetricItem}>
        Memory Usage: {Math.round(systemMetrics.systemHealth?.memoryUsage || 0)}%
      </Text>
      <Text style={styles.systemMetricItem}>
        CPU Usage: {Math.round(systemMetrics.systemHealth?.cpuUsage || 0)}%
      </Text>
      <Text style={styles.systemMetricItem}>
        Active Connections: {systemMetrics.systemHealth?.activeConnections || 0}
      </Text>
      <Text style={styles.systemMetricItem}>
        Database Health: {systemMetrics.systemHealth?.databaseHealth || 'Unknown'}
      </Text>
    </View>
  </View>
);

// Styles
const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  healthOverview: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthScore: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  healthStatus: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
  },
  activeTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  circuitBreakerItem: {
    backgroundColor: '#ffffff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  circuitBreakerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  circuitBreakerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  stateIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  circuitBreakerStats: {
    fontSize: 12,
    color: '#6b7280',
  },
  performanceGrid: {
    flexDirection: 'row',
  },
  performanceCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  performanceLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  circuitBreakerCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardStats: {
    marginTop: 8,
  },
  statLine: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  alertStatsGrid: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  alertStatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  alertStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  alertStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  noDataText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    marginTop: 32,
  },
  alertItem: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  alertTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  alertMessage: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  alertSeverity: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  alertSeverityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 16,
    margin: '1%',
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  systemMetricsContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  systemMetricItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
};

export default MonitoringDashboard;

// Helper function for status colors (moved outside component for reuse)
const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'closed': return '#10B981'; // Green
    case 'warning':
    case 'half-open': return '#F59E0B'; // Yellow
    case 'critical':
    case 'open': return '#EF4444'; // Red
    default: return '#6B7280'; // Gray
  }
}; 