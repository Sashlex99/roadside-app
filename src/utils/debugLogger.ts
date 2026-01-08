interface LogLevel {
  ERROR: 0;
  WARN: 1;
  INFO: 2;
  DEBUG: 3;
}

const LOG_LEVEL: LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

class DebugLogger {
  private currentLevel: number = __DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO;
  private logs: Array<{ timestamp: string; level: string; category: string; message: string; data?: any }> = [];
  private maxLogs: number = 1000;

  private shouldLog(level: number): boolean {
    return level <= this.currentLevel;
  }

  private formatMessage(level: string, category: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.sss
    const emoji = this.getEmoji(level);
    const formattedMessage = `${emoji} [${timestamp}] [${category}] ${message}`;
    
    if (data !== undefined) {
      return `${formattedMessage}\n${JSON.stringify(data, null, 2)}`;
    }
    
    return formattedMessage;
  }

  private getEmoji(level: string): string {
    switch (level) {
      case 'ERROR': return '❌';
      case 'WARN': return '⚠️';
      case 'INFO': return 'ℹ️';
      case 'DEBUG': return '🔍';
      default: return '📝';
    }
  }

  private addToHistory(level: string, category: string, message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(logEntry);
    
    // Keep only the last N logs to prevent memory issues
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  error(category: string, message: string, data?: any): void {
    if (this.shouldLog(LOG_LEVEL.ERROR)) {
      const formatted = this.formatMessage('ERROR', category, message, data);
      console.error(formatted);
      this.addToHistory('ERROR', category, message, data);
    }
  }

  warn(category: string, message: string, data?: any): void {
    if (this.shouldLog(LOG_LEVEL.WARN)) {
      const formatted = this.formatMessage('WARN', category, message, data);
      console.warn(formatted);
      this.addToHistory('WARN', category, message, data);
    }
  }

  info(category: string, message: string, data?: any): void {
    if (this.shouldLog(LOG_LEVEL.INFO)) {
      const formatted = this.formatMessage('INFO', category, message, data);
      console.log(formatted);
      this.addToHistory('INFO', category, message, data);
    }
  }

  debug(category: string, message: string, data?: any): void {
    if (this.shouldLog(LOG_LEVEL.DEBUG)) {
      const formatted = this.formatMessage('DEBUG', category, message, data);
      console.log(formatted);
      this.addToHistory('DEBUG', category, message, data);
    }
  }

  // Special methods for critical operations
  authEvent(event: string, data?: any): void {
    this.info('AUTH', event, data);
  }

  firestoreEvent(event: string, data?: any): void {
    this.info('FIRESTORE', event, data);
  }

  networkEvent(event: string, data?: any): void {
    this.info('NETWORK', event, data);
  }

  paymentEvent(event: string, data?: any): void {
    this.info('PAYMENT', event, data);
  }

  // Critical errors that need immediate attention
  criticalError(category: string, message: string, error: any): void {
    const errorData = {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      timestamp: Date.now(),
    };
    
    this.error(category, `CRITICAL: ${message}`, errorData);
    
    // Also send to external logging service in production
    if (!__DEV__) {
      this.sendToExternalLogger('CRITICAL', category, message, errorData);
    }
  }

  // Performance tracking
  startTimer(label: string): { end: () => void } {
    const start = performance.now();
    this.debug('PERF', `Timer started: ${label}`);
    
    return {
      end: () => {
        const duration = performance.now() - start;
        this.info('PERF', `Timer ended: ${label}`, { duration: `${duration.toFixed(2)}ms` });
      }
    };
  }

  // Get logs for debugging
  getLogs(category?: string): typeof this.logs {
    if (category) {
      return this.logs.filter(log => log.category === category);
    }
    return [...this.logs];
  }

  // Export logs for support
  exportLogs(): string {
    return this.logs.map(log => {
      const dataStr = log.data ? `\n${JSON.stringify(log.data, null, 2)}` : '';
      return `[${log.timestamp}] [${log.level}] [${log.category}] ${log.message}${dataStr}`;
    }).join('\n\n');
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
    this.info('LOGGER', 'Logs cleared');
  }

  // Set log level dynamically
  setLogLevel(level: keyof LogLevel): void {
    this.currentLevel = LOG_LEVEL[level];
    this.info('LOGGER', `Log level set to ${level}`);
  }

  private async sendToExternalLogger(level: string, category: string, message: string, data: any): Promise<void> {
    try {
      // In production, send to external logging service (e.g., Sentry, LogRocket)
      // For now, just store locally
      if (typeof window !== 'undefined' && window.localStorage) {
        const existingLogs = localStorage.getItem('app_critical_logs') || '[]';
        const logs = JSON.parse(existingLogs);
        logs.push({ level, category, message, data, timestamp: new Date().toISOString() });
        
        // Keep only last 50 critical logs
        const recentLogs = logs.slice(-50);
        localStorage.setItem('app_critical_logs', JSON.stringify(recentLogs));
      }
    } catch (error) {
      console.error('Failed to send log to external service:', error);
    }
  }
}

// Create singleton instance
export const logger = new DebugLogger();

// Convenience exports for common categories
export const authLogger = {
  login: (data?: any) => logger.authEvent('Login attempt', data),
  loginSuccess: (data?: any) => logger.authEvent('Login successful', data),
  loginFailed: (error: any) => logger.criticalError('AUTH', 'Login failed', error),
  logout: () => logger.authEvent('Logout'),
  tokenRefresh: (data?: any) => logger.authEvent('Token refresh', data),
  permissionError: (error: any) => logger.criticalError('AUTH', 'Permission error', error),
};

export const firestoreLogger = {
  operationStart: (operation: string, data?: any) => logger.firestoreEvent(`${operation} started`, data),
  operationSuccess: (operation: string, data?: any) => logger.firestoreEvent(`${operation} successful`, data),
  operationFailed: (operation: string, error: any) => logger.criticalError('FIRESTORE', `${operation} failed`, error),
  permissionDenied: (operation: string, error: any) => logger.criticalError('FIRESTORE', `Permission denied: ${operation}`, error),
  timeout: (operation: string) => logger.error('FIRESTORE', `Operation timeout: ${operation}`),
};

export const networkLogger = {
  requestStart: (url: string, method: string) => logger.networkEvent(`${method} ${url} started`),
  requestSuccess: (url: string, method: string, data?: any) => logger.networkEvent(`${method} ${url} success`, data),
  requestFailed: (url: string, method: string, error: any) => logger.error('NETWORK', `${method} ${url} failed`, error),
  offline: () => logger.warn('NETWORK', 'Device went offline'),
  online: () => logger.info('NETWORK', 'Device came online'),
};

export const paymentLogger = {
  initiatePayment: (amount: number, orderId: string) => logger.paymentEvent('Payment initiated', { amount, orderId }),
  paymentSuccess: (data: any) => logger.paymentEvent('Payment successful', data),
  paymentFailed: (error: any) => logger.criticalError('PAYMENT', 'Payment failed', error),
  linkCreated: (data: any) => logger.paymentEvent('Payment link created', data),
}; 