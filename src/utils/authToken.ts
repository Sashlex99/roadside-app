import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import { logger } from './debugLogger';
import { checkNetworkConnectivity } from './networkUtils';

// Storage keys for token management
const TOKEN_STORAGE_KEY = 'firebase_id_token';
const TOKEN_METADATA_KEY = 'firebase_token_metadata';
const LAST_REFRESH_KEY = 'firebase_last_refresh';

interface TokenMetadata {
  expiresAt: number;
  refreshedAt: number;
  userId: string;
  isOfflineToken: boolean;
}

interface TokenRefreshConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  networkCheckInterval: number;
}

const DEFAULT_REFRESH_CONFIG: TokenRefreshConfig = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  networkCheckInterval: 2000, // 2 seconds
};

class EnhancedAuthTokenManager {
  private refreshPromise: Promise<string | null> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private config: TokenRefreshConfig;

  constructor(config: TokenRefreshConfig = DEFAULT_REFRESH_CONFIG) {
    this.config = config;
    this.setupAutoRefresh();
  }

  /**
   * Get valid ID token with automatic refresh and offline support
   */
  async getValidIdToken(): Promise<string | null> {
    try {
      // Check if we have a current Firebase user
      if (!auth.currentUser) {
        logger.warn('AUTH_TOKEN', 'No authenticated user found');
        return await this.getOfflineToken();
      }

      // Get current token first (don't block on metadata check)
      const token = await auth.currentUser.getIdToken(false);
      
      // Store token metadata in background (non-blocking)
      this.storeTokenWithMetadata(token);
      
      // Check if token needs refresh (async, non-blocking)
      this.shouldRefreshToken().then(needsRefresh => {
        if (needsRefresh) {
          logger.info('AUTH_TOKEN', 'Token needs refresh, scheduling refresh...');
          // Schedule refresh in background
          this.refreshTokenWithRetry().catch(error => {
            logger.error('AUTH_TOKEN', 'Background token refresh failed', error);
          });
        }
      }).catch(error => {
        logger.warn('AUTH_TOKEN', 'Error checking token expiry', error);
      });
      
      return token;
    } catch (error) {
      logger.error('AUTH_TOKEN', 'Failed to get valid ID token', error);
      return await this.getOfflineToken();
    }
  }

  /**
   * Force refresh token with exponential backoff retry
   */
  async refreshTokenWithRetry(): Promise<string | null> {
    // Return existing refresh promise if already refreshing
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform token refresh with retry logic
   */
  private async performTokenRefresh(): Promise<string | null> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Check network connectivity before attempting refresh
        const networkStatus = await checkNetworkConnectivity();
        if (!networkStatus.isConnected) {
          logger.warn('AUTH_TOKEN', 'Network offline, cannot refresh token');
          await this.waitForNetwork();
          continue;
        }

        // Check if user is still authenticated
        if (!auth.currentUser) {
          logger.warn('AUTH_TOKEN', 'User no longer authenticated');
          return null;
        }

        logger.info('AUTH_TOKEN', `Token refresh attempt ${attempt + 1}/${this.config.maxRetries}`);
        
        // Force refresh token
        const token = await auth.currentUser.getIdToken(true);
        
        // Store token and metadata
        await this.storeTokenWithMetadata(token);
        
        logger.info('AUTH_TOKEN', 'Token refreshed successfully');
        return token;
        
      } catch (error) {
        lastError = error as Error;
        logger.warn('AUTH_TOKEN', `Token refresh attempt ${attempt + 1} failed`, error);
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          logger.error('AUTH_TOKEN', 'Non-retryable error during token refresh', error);
          break;
        }
        
        // Wait before retry with exponential backoff
        if (attempt < this.config.maxRetries - 1) {
          const delay = Math.min(
            this.config.baseDelay * Math.pow(2, attempt),
            this.config.maxDelay
          );
          logger.info('AUTH_TOKEN', `Waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error('AUTH_TOKEN', 'Token refresh failed after all retries', lastError);
    return null;
  }

  /**
   * Check if token needs refresh (safe, non-blocking)
   */
  private async shouldRefreshToken(): Promise<boolean> {
    try {
      const metadata = await this.getTokenMetadata();
      if (!metadata) {
        logger.debug('AUTH_TOKEN', 'No token metadata found, assuming refresh needed');
        return true;
      }
      
      const now = Date.now();
      const expiresAt = metadata.expiresAt;
      const refreshBuffer = 5 * 60 * 1000; // 5 minutes before expiry
      
      const needsRefresh = now >= (expiresAt - refreshBuffer);
      logger.debug('AUTH_TOKEN', 'Token refresh check', {
        needsRefresh,
        expiresAt: new Date(expiresAt).toISOString(),
        timeUntilExpiry: Math.max(0, expiresAt - now)
      });
      
      return needsRefresh;
    } catch (error) {
      logger.warn('AUTH_TOKEN', 'Error checking token expiry', error);
      return false; // Don't assume refresh needed on error to avoid blocking
    }
  }

  /**
   * Store token with metadata (non-blocking)
   */
  private async storeTokenWithMetadata(token: string): Promise<void> {
    try {
      // Decode token to get expiry (simplified)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000; // Convert to milliseconds
      
      const metadata: TokenMetadata = {
        expiresAt,
        refreshedAt: Date.now(),
        userId: auth.currentUser?.uid || '',
        isOfflineToken: false,
      };
      
      // Store in background to avoid blocking login
      AsyncStorage.multiSet([
        [TOKEN_STORAGE_KEY, token],
        [TOKEN_METADATA_KEY, JSON.stringify(metadata)],
        [LAST_REFRESH_KEY, Date.now().toString()],
      ]).then(() => {
        logger.debug('AUTH_TOKEN', 'Token stored with metadata', {
          expiresAt: new Date(expiresAt).toISOString(),
          userId: metadata.userId,
        });
      }).catch((error) => {
        logger.error('AUTH_TOKEN', 'Failed to store token metadata', error);
      });
    } catch (error) {
      logger.error('AUTH_TOKEN', 'Failed to prepare token metadata', error);
    }
  }

  /**
   * Get token metadata (safe)
   */
  private async getTokenMetadata(): Promise<TokenMetadata | null> {
    try {
      const metadataJson = await AsyncStorage.getItem(TOKEN_METADATA_KEY);
      if (!metadataJson) {
        logger.debug('AUTH_TOKEN', 'No token metadata found in storage');
        return null;
      }
      
      const metadata = JSON.parse(metadataJson) as TokenMetadata;
      logger.debug('AUTH_TOKEN', 'Token metadata retrieved', {
        expiresAt: new Date(metadata.expiresAt).toISOString(),
        userId: metadata.userId
      });
      
      return metadata;
    } catch (error) {
      logger.error('AUTH_TOKEN', 'Failed to get token metadata', error);
      return null;
    }
  }

  /**
   * Get offline token if available (safe fallback)
   */
  private async getOfflineToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        logger.warn('AUTH_TOKEN', 'No offline token available');
        return null;
      }
      
      // Try to get metadata, but don't fail if it's not available
      const metadata = await this.getTokenMetadata();
      
      if (metadata) {
        // Check if offline token is still valid (with extended buffer for offline use)
        const now = Date.now();
        const offlineBuffer = 24 * 60 * 60 * 1000; // 24 hours buffer for offline
        
        if (now >= (metadata.expiresAt + offlineBuffer)) {
          logger.warn('AUTH_TOKEN', 'Offline token expired');
          // Clear in background to avoid blocking
          this.clearStoredToken().catch(error => {
            logger.error('AUTH_TOKEN', 'Failed to clear expired token', error);
          });
          return null;
        }
      }
      
      logger.info('AUTH_TOKEN', 'Using offline token');
      return token;
    } catch (error) {
      logger.error('AUTH_TOKEN', 'Failed to get offline token', error);
      return null;
    }
  }

  /**
   * Clear stored token and metadata
   */
  async clearStoredToken(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        TOKEN_STORAGE_KEY,
        TOKEN_METADATA_KEY,
        LAST_REFRESH_KEY,
      ]);
      logger.info('AUTH_TOKEN', 'Stored token cleared');
    } catch (error) {
      logger.error('AUTH_TOKEN', 'Failed to clear stored token', error);
    }
  }

  /**
   * Setup automatic token refresh
   */
  private setupAutoRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    // Check token every 10 minutes
    this.refreshTimer = setInterval(async () => {
      try {
        if (auth.currentUser && !this.isRefreshing) {
          const needsRefresh = await this.shouldRefreshToken();
          if (needsRefresh) {
            logger.info('AUTH_TOKEN', 'Auto-refreshing token');
            await this.refreshTokenWithRetry();
          }
        }
      } catch (error) {
        logger.error('AUTH_TOKEN', 'Auto-refresh failed', error);
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  /**
   * Wait for network connectivity
   */
  private async waitForNetwork(): Promise<void> {
    return new Promise((resolve) => {
      const checkNetwork = async () => {
        const networkStatus = await checkNetworkConnectivity();
        if (networkStatus.isConnected) {
          resolve();
        } else {
          setTimeout(checkNetwork, this.config.networkCheckInterval);
        }
      };
      checkNetwork();
    });
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorCode = error.code || error.message || '';
    
    // Don't retry on these errors
    const nonRetryableErrors = [
      'auth/user-not-found',
      'auth/user-disabled',
      'auth/invalid-user-token',
      'auth/user-token-expired',
      'auth/requires-recent-login',
    ];
    
    return nonRetryableErrors.some(code => errorCode.includes(code));
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    if (this.refreshPromise) {
      this.refreshPromise = null;
    }
  }
}

// Create singleton instance
const authTokenManager = new EnhancedAuthTokenManager();

// Export the enhanced functions
export const getValidIdToken = async (): Promise<string | null> => {
  try {
    // Simple fallback: just get the token from Firebase Auth
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken(false);
      return token;
    }
    return null;
  } catch (error) {
    logger.error('AUTH_TOKEN', 'Fallback token retrieval failed', error);
    return null;
  }
};

export const refreshTokenWithRetry = () => authTokenManager.refreshTokenWithRetry();
export const clearStoredToken = () => authTokenManager.clearStoredToken();

// Export for cleanup
export const cleanupAuthTokenManager = () => authTokenManager.cleanup();

// Legacy export for backward compatibility
export { getValidIdToken as default }; 