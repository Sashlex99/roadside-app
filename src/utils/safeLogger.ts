/**
 * Safe Logger - Conditional logging for development/production
 * Prevents console pollution in production builds
 */

interface LogLevel {
  DEBUG: number;
  INFO: number;
  WARN: number;
  ERROR: number;
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class SafeLogger {
  private isDevelopment: boolean;
  private minLogLevel: number;

  constructor() {
    this.isDevelopment = __DEV__;
    this.minLogLevel = this.isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;
  }

  /**
   * Development-only debug logging
   */
  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment && this.minLogLevel <= LOG_LEVELS.DEBUG) {
      console.log(`🔧 [DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Development-only info logging
   */
  info(message: string, ...args: any[]): void {
    if (this.isDevelopment && this.minLogLevel <= LOG_LEVELS.INFO) {
      console.log(`ℹ️ [INFO] ${message}`, ...args);
    }
  }

  /**
   * Warning logs (shown in production)
   */
  warn(message: string, ...args: any[]): void {
    if (this.minLogLevel <= LOG_LEVELS.WARN) {
      console.warn(`⚠️ [WARN] ${message}`, ...args);
    }
  }

  /**
   * Error logs (always shown)
   */
  error(message: string, ...args: any[]): void {
    console.error(`❌ [ERROR] ${message}`, ...args);
  }

  /**
   * Production-safe success logging
   */
  success(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`✅ [SUCCESS] ${message}`, ...args);
    }
  }

  /**
   * Production-safe network logging
   */
  network(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`🌐 [NETWORK] ${message}`, ...args);
    }
  }

  /**
   * Production-safe auth logging
   */
  auth(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`🔐 [AUTH] ${message}`, ...args);
    }
  }

  /**
   * Force log in production (use sparingly)
   */
  critical(message: string, ...args: any[]): void {
    console.error(`🚨 [CRITICAL] ${message}`, ...args);
  }
}

export const safeLogger = new SafeLogger(); 