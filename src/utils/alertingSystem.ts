/**
 * External Alerting System for Phase 4 Database Failure Recovery
 * 
 * Provides multi-channel alert delivery with throttling, deduplication,
 * and configurable routing based on alert severity and type.
 */

import { CircuitBreakerAlert } from '../types/circuitBreaker';

// Alert Channel Types
export type AlertChannel = 'slack' | 'email' | 'webhook' | 'sms' | 'discord';

export interface AlertChannelConfig {
  enabled: boolean;
  priority: number; // Lower number = higher priority
  minSeverity: AlertSeverity;
  throttleMinutes?: number;
  retryAttempts?: number;
  timeout?: number;
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AlertMessage {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  source: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  tags?: string[];
  channels?: AlertChannel[];
}

export interface SlackConfig extends AlertChannelConfig {
  webhookUrl?: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface EmailConfig extends AlertChannelConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail?: string;
  toEmails?: string[];
}

export interface WebhookConfig extends AlertChannelConfig {
  url?: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  authToken?: string;
}

export interface SMSConfig extends AlertChannelConfig {
  apiKey?: string;
  fromNumber?: string;
  toNumbers?: string[];
}

export interface DiscordConfig extends AlertChannelConfig {
  webhookUrl?: string;
  username?: string;
  avatarUrl?: string;
}

export interface AlertingSystemConfig {
  enabled: boolean;
  defaultChannels: AlertChannel[];
  throttleWindow: number; // minutes
  maxRetries: number;
  channels: {
    slack?: SlackConfig;
    email?: EmailConfig;
    webhook?: WebhookConfig;
    sms?: SMSConfig;
    discord?: DiscordConfig;
  };
  severityRouting: {
    [key in AlertSeverity]: AlertChannel[];
  };
}

export interface AlertDeliveryResult {
  channel: AlertChannel;
  success: boolean;
  error?: string;
  responseTime?: number;
  retryCount?: number;
}

export interface AlertDeliveryReport {
  alertId: string;
  totalChannels: number;
  successfulChannels: number;
  failedChannels: number;
  results: AlertDeliveryResult[];
  totalTime: number;
}

// Alert throttling and deduplication
interface AlertThrottleEntry {
  alertId: string;
  lastSent: Date;
  count: number;
  channel: AlertChannel;
}

/**
 * External Alerting System Class
 */
export class ExternalAlertingSystem {
  private config: AlertingSystemConfig;
  private throttleCache: Map<string, AlertThrottleEntry> = new Map();
  private alertHistory: AlertMessage[] = [];
  private deliveryQueue: AlertMessage[] = [];
  private isProcessing: boolean = false;

  constructor(config: AlertingSystemConfig) {
    this.config = config;
    this.startQueueProcessor();
  }

  /**
   * Send alert through configured channels
   */
  async sendAlert(alert: AlertMessage): Promise<AlertDeliveryReport> {
    const startTime = Date.now();
    
    if (!this.config.enabled) {
      console.log(`🔇 Alerting disabled - alert ${alert.id} ignored`);
      return this.createEmptyReport(alert.id, startTime);
    }

    // Determine channels to use
    const channels = this.determineChannels(alert);
    
    // Check throttling and deduplication
    const allowedChannels = this.filterThrottledChannels(alert, channels);
    
    if (allowedChannels.length === 0) {
      console.log(`⏳ Alert ${alert.id} throttled on all channels`);
      return this.createEmptyReport(alert.id, startTime);
    }

    // Store alert in history
    this.alertHistory.push(alert);
    this.trimAlertHistory();

    // Send to channels
    const results: AlertDeliveryResult[] = [];
    
    for (const channel of allowedChannels) {
      const result = await this.sendToChannel(alert, channel);
      results.push(result);
      
      // Update throttle cache
      this.updateThrottleCache(alert, channel);
    }

    const totalTime = Date.now() - startTime;
    const successfulChannels = results.filter(r => r.success).length;
    
    console.log(`📨 Alert ${alert.id} sent to ${successfulChannels}/${results.length} channels in ${totalTime}ms`);

    return {
      alertId: alert.id,
      totalChannels: results.length,
      successfulChannels,
      failedChannels: results.length - successfulChannels,
      results,
      totalTime
    };
  }

  /**
   * Send circuit breaker alert (convenience method)
   */
  async sendCircuitBreakerAlert(cbAlert: CircuitBreakerAlert): Promise<AlertDeliveryReport> {
    const alert: AlertMessage = {
      id: `cb-${cbAlert.service}-${Date.now()}`,
      title: `Circuit Breaker ${cbAlert.type}: ${cbAlert.service}`,
      message: this.formatCircuitBreakerMessage(cbAlert),
      severity: this.mapCircuitBreakerSeverity(cbAlert.type),
      source: 'circuit-breaker',
      timestamp: new Date(cbAlert.timestamp),
      metadata: cbAlert.metadata,
      tags: ['circuit-breaker', cbAlert.service, cbAlert.type]
    };

    return this.sendAlert(alert);
  }

  /**
   * Send system health alert
   */
  async sendHealthAlert(
    title: string,
    message: string,
    severity: AlertSeverity,
    metadata?: Record<string, any>
  ): Promise<AlertDeliveryReport> {
    const alert: AlertMessage = {
      id: `health-${Date.now()}`,
      title: `System Health: ${title}`,
      message,
      severity,
      source: 'system-health',
      timestamp: new Date(),
      metadata,
      tags: ['system-health', severity]
    };

    return this.sendAlert(alert);
  }

  /**
   * Queue alert for later processing
   */
  queueAlert(alert: AlertMessage): void {
    this.deliveryQueue.push(alert);
    console.log(`📥 Alert ${alert.id} queued for delivery`);
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    totalAlerts: number;
    recentAlerts: number;
    queuedAlerts: number;
    throttledAlerts: number;
    channelStats: Record<AlertChannel, { sent: number; failed: number }>;
  } {
    const recentAlerts = this.alertHistory.filter(
      alert => Date.now() - alert.timestamp.getTime() < 3600000 // Last hour
    ).length;

    const channelStats: Record<AlertChannel, { sent: number; failed: number }> = {
      slack: { sent: 0, failed: 0 },
      email: { sent: 0, failed: 0 },
      webhook: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 },
      discord: { sent: 0, failed: 0 }
    };

    return {
      totalAlerts: this.alertHistory.length,
      recentAlerts,
      queuedAlerts: this.deliveryQueue.length,
      throttledAlerts: this.throttleCache.size,
      channelStats
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AlertingSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(`⚙️ Alerting system configuration updated`);
  }

  /**
   * Clear throttle cache
   */
  clearThrottleCache(): void {
    this.throttleCache.clear();
    console.log(`🧹 Alert throttle cache cleared`);
  }

  // Private methods

  private determineChannels(alert: AlertMessage): AlertChannel[] {
    // Use explicit channels if provided
    if (alert.channels && alert.channels.length > 0) {
      return alert.channels;
    }

    // Use severity-based routing
    const routedChannels = this.config.severityRouting[alert.severity] || [];
    
    // Fallback to default channels
    return routedChannels.length > 0 ? routedChannels : this.config.defaultChannels;
  }

  private filterThrottledChannels(alert: AlertMessage, channels: AlertChannel[]): AlertChannel[] {
    return channels.filter(channel => {
      const throttleKey = `${alert.source}-${channel}`;
      const throttleEntry = this.throttleCache.get(throttleKey);
      
      if (!throttleEntry) return true;
      
      const channelConfig = this.config.channels[channel];
      const throttleMinutes = channelConfig?.throttleMinutes || this.config.throttleWindow;
      const timeSinceLastSent = Date.now() - throttleEntry.lastSent.getTime();
      
      return timeSinceLastSent > (throttleMinutes * 60 * 1000);
    });
  }

  private async sendToChannel(alert: AlertMessage, channel: AlertChannel): Promise<AlertDeliveryResult> {
    const startTime = Date.now();
    
    try {
      const channelConfig = this.config.channels[channel];
      
      if (!channelConfig?.enabled) {
        return {
          channel,
          success: false,
          error: 'Channel disabled',
          responseTime: Date.now() - startTime
        };
      }

      // Check minimum severity
      if (!this.meetsSeverityRequirement(alert.severity, channelConfig.minSeverity)) {
        return {
          channel,
          success: false,
          error: 'Below minimum severity',
          responseTime: Date.now() - startTime
        };
      }

      let success = false;
      let error: string | undefined;

      switch (channel) {
        case 'slack':
          success = await this.sendToSlack(alert, channelConfig as SlackConfig);
          break;
        case 'email':
          success = await this.sendToEmail(alert, channelConfig as EmailConfig);
          break;
        case 'webhook':
          success = await this.sendToWebhook(alert, channelConfig as WebhookConfig);
          break;
        case 'sms':
          success = await this.sendToSMS(alert, channelConfig as SMSConfig);
          break;
        case 'discord':
          success = await this.sendToDiscord(alert, channelConfig as DiscordConfig);
          break;
        default:
          success = false;
          error = `Unknown channel: ${channel}`;
      }

      return {
        channel,
        success,
        error,
        responseTime: Date.now() - startTime
      };

    } catch (err) {
      return {
        channel,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };
    }
  }

  private async sendToSlack(alert: AlertMessage, config: SlackConfig): Promise<boolean> {
    if (!config.webhookUrl) {
      console.log(`❌ Slack webhook URL not configured`);
      return false;
    }

    const payload = {
      channel: config.channel || '#alerts',
      username: config.username || 'Roadside Assistant Bot',
      icon_emoji: config.iconEmoji || ':warning:',
      text: `*${alert.title}*`,
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        fields: [
          { title: 'Message', value: alert.message, short: false },
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Source', value: alert.source, short: true },
          { title: 'Time', value: alert.timestamp.toISOString(), short: true }
        ]
      }]
    };

    // Simulate Slack API call (in real implementation, use fetch)
    console.log(`📱 Sending Slack alert: ${alert.title}`);
    console.log(`   Channel: ${config.channel}`);
    console.log(`   Severity: ${alert.severity}`);
    
    return true; // Simulated success
  }

  private async sendToEmail(alert: AlertMessage, config: EmailConfig): Promise<boolean> {
    if (!config.toEmails || config.toEmails.length === 0) {
      console.log(`❌ Email recipients not configured`);
      return false;
    }

    // Simulate email sending (in real implementation, use nodemailer or similar)
    console.log(`📧 Sending email alert: ${alert.title}`);
    console.log(`   To: ${config.toEmails.join(', ')}`);
    console.log(`   From: ${config.fromEmail}`);
    console.log(`   Severity: ${alert.severity}`);
    
    return true; // Simulated success
  }

  private async sendToWebhook(alert: AlertMessage, config: WebhookConfig): Promise<boolean> {
    if (!config.url) {
      console.log(`❌ Webhook URL not configured`);
      return false;
    }

    const payload = {
      alert: {
        id: alert.id,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        source: alert.source,
        timestamp: alert.timestamp.toISOString(),
        metadata: alert.metadata,
        tags: alert.tags
      }
    };

    // Simulate webhook call (in real implementation, use fetch)
    console.log(`🔗 Sending webhook alert: ${alert.title}`);
    console.log(`   URL: ${config.url}`);
    console.log(`   Method: ${config.method || 'POST'}`);
    
    return true; // Simulated success
  }

  private async sendToSMS(alert: AlertMessage, config: SMSConfig): Promise<boolean> {
    if (!config.toNumbers || config.toNumbers.length === 0) {
      console.log(`❌ SMS recipients not configured`);
      return false;
    }

    const message = `${alert.title}: ${alert.message}`;

    // Simulate SMS sending (in real implementation, use Twilio or similar)
    console.log(`📱 Sending SMS alert: ${alert.title}`);
    console.log(`   To: ${config.toNumbers.join(', ')}`);
    console.log(`   Message: ${message.substring(0, 100)}...`);
    
    return true; // Simulated success
  }

  private async sendToDiscord(alert: AlertMessage, config: DiscordConfig): Promise<boolean> {
    if (!config.webhookUrl) {
      console.log(`❌ Discord webhook URL not configured`);
      return false;
    }

    const embed = {
      title: alert.title,
      description: alert.message,
      color: this.getSeverityColorDiscord(alert.severity),
      timestamp: alert.timestamp.toISOString(),
      fields: [
        { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
        { name: 'Source', value: alert.source, inline: true }
      ]
    };

    // Simulate Discord webhook call
    console.log(`🎮 Sending Discord alert: ${alert.title}`);
    console.log(`   Webhook: ${config.webhookUrl.substring(0, 50)}...`);
    
    return true; // Simulated success
  }

  private formatCircuitBreakerMessage(cbAlert: CircuitBreakerAlert): string {
    let message = `Circuit breaker for ${cbAlert.service} is now ${cbAlert.type}`;
    
    if (cbAlert.metadata) {
      if (cbAlert.metadata.failureRate) {
        message += `\nFailure Rate: ${cbAlert.metadata.failureRate}%`;
      }
      if (cbAlert.metadata.avgResponseTime) {
        message += `\nAvg Response Time: ${cbAlert.metadata.avgResponseTime}ms`;
      }
      if (cbAlert.metadata.affectedOperations) {
        message += `\nAffected Operations: ${cbAlert.metadata.affectedOperations.join(', ')}`;
      }
    }
    
    return message;
  }

  private mapCircuitBreakerSeverity(type: string): AlertSeverity {
    switch (type) {
      case 'CIRCUIT_BREAKER_OPENED': return 'high';
      case 'CIRCUIT_BREAKER_CLOSED': return 'low';
      case 'HIGH_FAILURE_RATE': return 'medium';
      default: return 'medium';
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'low': return 'good';
      case 'medium': return 'warning';
      case 'high': return 'danger';
      case 'critical': return 'danger';
      default: return 'warning';
    }
  }

  private getSeverityColorDiscord(severity: AlertSeverity): number {
    switch (severity) {
      case 'low': return 0x00ff00;      // Green
      case 'medium': return 0xffff00;   // Yellow
      case 'high': return 0xff8000;     // Orange
      case 'critical': return 0xff0000; // Red
      default: return 0xffff00;         // Yellow
    }
  }

  private meetsSeverityRequirement(alertSeverity: AlertSeverity, minSeverity: AlertSeverity): boolean {
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityLevels[alertSeverity] >= severityLevels[minSeverity];
  }

  private updateThrottleCache(alert: AlertMessage, channel: AlertChannel): void {
    const throttleKey = `${alert.source}-${channel}`;
    const existing = this.throttleCache.get(throttleKey);
    
    this.throttleCache.set(throttleKey, {
      alertId: alert.id,
      lastSent: new Date(),
      count: existing ? existing.count + 1 : 1,
      channel
    });
  }

  private trimAlertHistory(): void {
    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
  }

  private createEmptyReport(alertId: string, startTime: number): AlertDeliveryReport {
    return {
      alertId,
      totalChannels: 0,
      successfulChannels: 0,
      failedChannels: 0,
      results: [],
      totalTime: Date.now() - startTime
    };
  }

  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing || this.deliveryQueue.length === 0) return;
      
      this.isProcessing = true;
      
      while (this.deliveryQueue.length > 0) {
        const alert = this.deliveryQueue.shift();
        if (alert) {
          await this.sendAlert(alert);
        }
      }
      
      this.isProcessing = false;
    }, 5000); // Process queue every 5 seconds
  }
}

// Default configuration
export const defaultAlertingConfig: AlertingSystemConfig = {
  enabled: true,
  defaultChannels: ['slack', 'email'],
  throttleWindow: 15, // 15 minutes
  maxRetries: 3,
  channels: {
    slack: {
      enabled: true,
      priority: 1,
      minSeverity: 'medium',
      throttleMinutes: 10,
      channel: '#roadside-alerts',
      username: 'Roadside Assistant',
      iconEmoji: ':car:'
    },
    email: {
      enabled: true,
      priority: 2,
      minSeverity: 'high',
      throttleMinutes: 30,
      toEmails: ['admin@roadside-assistance.bg']
    },
    webhook: {
      enabled: false,
      priority: 3,
      minSeverity: 'medium',
      method: 'POST'
    },
    sms: {
      enabled: false,
      priority: 4,
      minSeverity: 'critical',
      throttleMinutes: 60
    },
    discord: {
      enabled: false,
      priority: 5,
      minSeverity: 'medium'
    }
  },
  severityRouting: {
    low: ['slack'],
    medium: ['slack', 'email'],
    high: ['slack', 'email', 'webhook'],
    critical: ['slack', 'email', 'webhook', 'sms']
  }
};

// Global alerting system instance
export const globalAlertingSystem = new ExternalAlertingSystem(defaultAlertingConfig);

// Convenience functions
export const sendAlert = (alert: AlertMessage) => globalAlertingSystem.sendAlert(alert);
export const sendCircuitBreakerAlert = (alert: CircuitBreakerAlert) => globalAlertingSystem.sendCircuitBreakerAlert(alert);
export const sendHealthAlert = (title: string, message: string, severity: AlertSeverity, metadata?: Record<string, any>) => 
  globalAlertingSystem.sendHealthAlert(title, message, severity, metadata);
export const queueAlert = (alert: AlertMessage) => globalAlertingSystem.queueAlert(alert);
export const getAlertStats = () => globalAlertingSystem.getAlertStats(); 