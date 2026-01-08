'use client'

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

/**
 * Admin Panel System Monitoring Dashboard
 * 
 * Web interface for monitoring circuit breakers, performance metrics,
 * and system health in real-time.
 */

interface CircuitBreakerStatus {
  name: string;
  state: 'OPEN' | 'CLOSED' | 'HALF_OPEN';
  failures: number;
  successes: number;
  successRate: number;
  lastFailureTime?: string;
  health: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

interface SystemHealth {
  overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  score: number;
  timestamp: string;
}

interface PerformanceMetrics {
  avgResponseTime: number;
  errorRate: number;
  throughput: number;
  healthScore: number;
  trends: {
    responseTime: 'IMPROVING' | 'STABLE' | 'DEGRADING';
    errorRate: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  };
}

interface AlertSummary {
  totalAlerts: number;
  recentAlerts: number;
  queuedAlerts: number;
  criticalAlerts: number;
  channelStats: Record<string, { sent: number; failed: number }>;
}

const MonitoringDashboard: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerStatus[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Mock data loading (in real implementation, this would call the monitoring APIs)
  const loadMonitoringData = async () => {
    setIsLoading(true);
    
    try {
      // Simulate API calls to monitoring endpoints
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock system health data
      const mockHealth: SystemHealth = {
        overallHealth: 'HEALTHY',
        score: 87,
        timestamp: new Date().toISOString()
      };
      
      // Mock circuit breaker data
      const mockCircuitBreakers: CircuitBreakerStatus[] = [
        {
          name: 'driver-locks',
          state: 'CLOSED',
          failures: 2,
          successes: 150,
          successRate: 98.7,
          health: 'HEALTHY'
        },
        {
          name: 'bid-reservation',
          state: 'CLOSED',
          failures: 0,
          successes: 89,
          successRate: 100,
          health: 'HEALTHY'
        },
        {
          name: 'payment-processing',
          state: 'HALF_OPEN',
          failures: 5,
          successes: 12,
          successRate: 70.6,
          lastFailureTime: '2 minutes ago',
          health: 'WARNING'
        },
        {
          name: 'push-notifications',
          state: 'OPEN',
          failures: 15,
          successes: 45,
          successRate: 75,
          lastFailureTime: '30 seconds ago',
          health: 'CRITICAL'
        }
      ];
      
      // Mock performance metrics
      const mockPerformance: PerformanceMetrics = {
        avgResponseTime: 245,
        errorRate: 2.3,
        throughput: 156,
        healthScore: 85,
        trends: {
          responseTime: 'STABLE',
          errorRate: 'IMPROVING'
        }
      };
      
      // Mock alert summary
      const mockAlerts: AlertSummary = {
        totalAlerts: 24,
        recentAlerts: 3,
        queuedAlerts: 0,
        criticalAlerts: 1,
        channelStats: {
          slack: { sent: 15, failed: 0 },
          email: { sent: 8, failed: 1 },
          webhook: { sent: 1, failed: 0 }
        }
      };
      
      setSystemHealth(mockHealth);
      setCircuitBreakers(mockCircuitBreakers);
      setPerformanceMetrics(mockPerformance);
      setAlertSummary(mockAlerts);
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('Error loading monitoring data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    loadMonitoringData();
    
    if (autoRefresh) {
      const interval = setInterval(loadMonitoringData, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'HEALTHY': return 'text-green-600 bg-green-50';
      case 'WARNING': return 'text-yellow-600 bg-yellow-50';
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'HEALTHY': return <CheckCircle className="h-4 w-4" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4" />;
      case 'CRITICAL': return <XCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'CLOSED': return 'bg-green-100 text-green-800';
      case 'HALF_OPEN': return 'bg-yellow-100 text-yellow-800';
      case 'OPEN': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'IMPROVING': return '📈';
      case 'DEGRADING': return '📉';
      default: return '➡️';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading monitoring data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMonitoringData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {getHealthIcon(systemHealth.overallHealth)}
              <span className="ml-2">System Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{systemHealth.score}%</div>
                <Badge className={getHealthColor(systemHealth.overallHealth)}>
                  {systemHealth.overallHealth}
                </Badge>
              </div>
              <div className="text-sm text-gray-500">
                Overall system health score based on all monitoring metrics
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="circuits">Circuit Breakers</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Circuit Breakers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{circuitBreakers.length}</div>
                <div className="flex space-x-2 mt-2">
                  <Badge className="bg-green-100 text-green-800">
                    {circuitBreakers.filter(cb => cb.state === 'CLOSED').length} Closed
                  </Badge>
                  <Badge className="bg-red-100 text-red-800">
                    {circuitBreakers.filter(cb => cb.state === 'OPEN').length} Open
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceMetrics?.avgResponseTime}ms
                </div>
                <div className="text-sm text-gray-500">
                  {getTrendIcon(performanceMetrics?.trends.responseTime || 'STABLE')} Response Time
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {alertSummary?.criticalAlerts}
                </div>
                <div className="text-sm text-gray-500">
                  Critical alerts in last hour
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Circuit Breaker Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Circuit Breaker Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {circuitBreakers.slice(0, 4).map((cb, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center">
                        {getHealthIcon(cb.health)}
                        <span className="ml-2 font-medium">{cb.name}</span>
                      </div>
                      <Badge className={getStateColor(cb.state)}>
                        {cb.state}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      Success Rate: {cb.successRate.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Circuit Breakers Tab */}
        <TabsContent value="circuits" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {circuitBreakers.map((cb, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      {getHealthIcon(cb.health)}
                      <span className="ml-2">{cb.name}</span>
                    </span>
                    <Badge className={getStateColor(cb.state)}>
                      {cb.state}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Success Rate:</span>
                      <span className="font-medium">{cb.successRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Failures:</span>
                      <span className="font-medium">{cb.failures}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Successes:</span>
                      <span className="font-medium">{cb.successes}</span>
                    </div>
                    {cb.lastFailureTime && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Last Failure:</span>
                        <span className="font-medium text-red-600">{cb.lastFailureTime}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {performanceMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performanceMetrics.avgResponseTime}ms</div>
                  <div className="text-sm text-gray-500">
                    {getTrendIcon(performanceMetrics.trends.responseTime)} Average
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Error Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performanceMetrics.errorRate}%</div>
                  <div className="text-sm text-gray-500">
                    {getTrendIcon(performanceMetrics.trends.errorRate)} Last hour
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Throughput</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performanceMetrics.throughput}</div>
                  <div className="text-sm text-gray-500">Requests/minute</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Health Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performanceMetrics.healthScore}%</div>
                  <div className="text-sm text-gray-500">Overall performance</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {alertSummary && (
            <>
              {/* Alert Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{alertSummary.totalAlerts}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recent (1h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{alertSummary.recentAlerts}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Queued</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{alertSummary.queuedAlerts}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Critical</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{alertSummary.criticalAlerts}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Channel Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Alert Channel Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(alertSummary.channelStats).map(([channel, stats]) => (
                      <div key={channel} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center space-x-3">
                          <span className="font-medium capitalize">{channel}</span>
                        </div>
                        <div className="flex space-x-4 text-sm">
                          <span className="text-green-600">Sent: {stats.sent}</span>
                          <span className="text-red-600">Failed: {stats.failed}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringDashboard; 