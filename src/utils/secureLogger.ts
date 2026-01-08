import { isDevelopment, isProduction } from '../config/environment';

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

// Sensitive fields that should be sanitized
const SENSITIVE_FIELDS = [
  'password', 'token', 'apiKey', 'key', 'secret', 'credential', 'auth',
  'email', 'phone', 'ssn', 'card', 'payment', 'cvv', 'pin', 'otp',
  'code', 'verification', 'session', 'cookie', 'bearer', 'access_token',
  'refresh_token', 'id_token', 'firebase_token', 'stripe_key', 'sms_key'
];

// Patterns to detect sensitive data
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_]+/gi,        // Bearer tokens
  /AIza[0-9A-Za-z\-_]{35}/gi,          // Firebase API keys
  /sk_[a-z]+_[A-Za-z0-9]{24,}/gi,      // Stripe secret keys
  /pk_[a-z]+_[A-Za-z0-9]{24,}/gi,      // Stripe publishable keys
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/gi, // Email addresses
  /\+?[1-9]\d{1,14}/gi,                // Phone numbers
  /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/gi, // Credit card numbers
];

// Category colors for console output
const CATEGORY_COLORS = {
  AUTH: '#3b82f6',    // Blue
  PAYMENT: '#10b981',  // Green
  SMS: '#f59e0b',     // Amber
  API: '#8b5cf6',     // Purple
  UI: '#ef4444',      // Red
  NETWORK: '#06b6d4', // Cyan
  STORAGE: '#84cc16', // Lime
  SECURITY: '#dc2626', // Red
  SYSTEM: '#6b7280',  // Gray
  DEBUG: '#9ca3af',   // Light gray
} as const;

export type LogCategory = keyof typeof CATEGORY_COLORS;

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  sanitized?: boolean;
  environment: 'development' | 'production';
}

class SecureLogger {
  private static logs: LogEntry[] = [];
  private static maxLogEntries = 1000;
  
  /**
   * Sanitize sensitive data from objects and strings
   */
  public static sanitizeData(data: any): any {
    if (!data) return data;
    
    // Handle strings
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    
    // Handle objects
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        
        // Check if key is sensitive
        if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
          sanitized[key] = this.maskSensitiveValue(value);
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      
      return sanitized;
    }
    
    return data;
  }
  
  /**
   * Sanitize sensitive patterns from strings
   */
  private static sanitizeString(str: string): string {
    let sanitized = str;
    
    // Apply sensitive patterns
    SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, match => {
        if (match.length <= 4) return '***';
        return match.substring(0, 4) + '*'.repeat(match.length - 4);
      });
    });
    
    return sanitized;
  }
  
  /**
   * Mask sensitive values
   */
  private static maskSensitiveValue(value: any): string {
    if (typeof value === 'string') {
      if (value.length <= 4) return '***';
      return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    }
    return '[SENSITIVE_DATA]';
  }
  
  /**
   * Store log entry
   */
  private static storeLog(entry: LogEntry): void {
    this.logs.push(entry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }
  }
  
  /**
   * Format log message for console output
   */
  private static formatMessage(level: LogLevel, category: LogCategory, message: string): string {
    const timestamp = new Date().toISOString();
    const levelIcon = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      critical: '🚨'
    }[level];
    
    return `${levelIcon} [${timestamp}] [${level.toUpperCase()}] [${category}] ${message}`;
  }
  
  /**
   * Debug logging - only in development
   */
  static debug(category: LogCategory, message: string, data?: any): void {
    if (!isDevelopment) return;
    
    const sanitizedData = this.sanitizeData(data);
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'debug',
      category,
      message,
      data: sanitizedData,
      sanitized: true,
      environment: isDevelopment ? 'development' : 'production'
    };
    
    this.storeLog(entry);
    console.log(this.formatMessage('debug', category, message), sanitizedData);
  }
  
  /**
   * Info logging - always visible
   */
  static info(category: LogCategory, message: string, data?: any): void {
    const sanitizedData = this.sanitizeData(data);
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'info',
      category,
      message,
      data: sanitizedData,
      sanitized: true,
      environment: isDevelopment ? 'development' : 'production'
    };
    
    this.storeLog(entry);
    console.log(this.formatMessage('info', category, message), sanitizedData);
  }
  
  /**
   * Warning logging - always visible
   */
  static warn(category: LogCategory, message: string, data?: any): void {
    const sanitizedData = this.sanitizeData(data);
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'warn',
      category,
      message,
      data: sanitizedData,
      sanitized: true,
      environment: isDevelopment ? 'development' : 'production'
    };
    
    this.storeLog(entry);
    console.warn(this.formatMessage('warn', category, message), sanitizedData);
  }
  
  /**
   * Error logging - always visible
   */
  static error(category: LogCategory, message: string, error?: any): void {
    const sanitizedError = this.sanitizeData(error);
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'error',
      category,
      message,
      data: sanitizedError,
      sanitized: true,
      environment: isDevelopment ? 'development' : 'production'
    };
    
    this.storeLog(entry);
    console.error(this.formatMessage('error', category, message), sanitizedError);
  }
  
  /**
   * Critical logging - always visible and reported
   */
  static critical(category: LogCategory, message: string, data?: any): void {
    const sanitizedData = this.sanitizeData(data);
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'critical',
      category,
      message,
      data: sanitizedData,
      sanitized: true,
      environment: isDevelopment ? 'development' : 'production'
    };
    
    this.storeLog(entry);
    console.error(this.formatMessage('critical', category, message), sanitizedData);
    
    // In production, you might want to send this to a monitoring service
    if (isProduction) {
      this.reportCriticalIssue(entry);
    }
  }
  
  /**
   * Report critical issues to monitoring service
   */
  private static reportCriticalIssue(entry: LogEntry): void {
    // In production, implement reporting to services like:
    // - Sentry
    // - LogRocket
    // - Firebase Crashlytics
    // - Custom analytics endpoint
    
    // For now, just ensure it's logged
    console.error('🚨 CRITICAL ISSUE DETECTED:', entry);
  }
  
  /**
   * Get recent logs for debugging
   */
  static getLogs(filter?: Partial<LogEntry>): LogEntry[] {
    if (!filter) return [...this.logs];
    
    return this.logs.filter(log => {
      return Object.entries(filter).every(([key, value]) => {
        return log[key as keyof LogEntry] === value;
      });
    });
  }
  
  /**
   * Clear logs
   */
  static clearLogs(): void {
    this.logs = [];
  }
  
  /**
   * Export logs for support/debugging
   */
  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
  
  /**
   * Performance timing utility
   */
  static time(category: LogCategory, label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.debug(category, `${label} completed in ${duration.toFixed(2)}ms`);
    };
  }
  
  /**
   * Async operation wrapper with automatic error logging
   */
  static async withLogging<T>(
    category: LogCategory,
    operation: string,
    asyncFn: () => Promise<T>
  ): Promise<T> {
    const endTimer = this.time(category, operation);
    
    try {
      this.debug(category, `Starting ${operation}`);
      const result = await asyncFn();
      this.debug(category, `Completed ${operation} successfully`);
      return result;
    } catch (error) {
      this.error(category, `Failed ${operation}`, error);
      throw error;
    } finally {
      endTimer();
    }
  }
}

export default SecureLogger;

// Export convenient aliases
export const logger = SecureLogger;
export const log = SecureLogger; 