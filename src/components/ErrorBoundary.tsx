import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { logger } from '../utils/debugLogger';

interface Props {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string | null;
  isConnected: boolean;
  lastChecked: number;
}

/**
 * Error Boundary Component for React errors
 * Provides graceful fallback UI and error logging for production
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: null,
      isConnected: true,
      lastChecked: Date.now()
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastChecked: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Check network connectivity when error occurs
    this.checkNetworkConnectivity();

    // Log the error to our logging system
    logger.criticalError('REACT_ERROR_BOUNDARY', 'React component error caught', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location?.href : 'unknown'
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error details
    this.setState({
      error,
      errorInfo
    });
  }

  checkNetworkConnectivity = async () => {
    try {
      // Avoid too frequent checks
      if (Date.now() - this.state.lastChecked < 5000) {
        return;
      }

      const { checkNetworkConnectivity } = await import('../utils/networkUtils');
      const networkStatus = await checkNetworkConnectivity();
      
      this.setState({
        isConnected: networkStatus.isConnected,
        lastChecked: Date.now()
      });
    } catch (networkError) {
      // Assume disconnected if check fails
      this.setState({
        isConnected: false,
        lastChecked: Date.now()
      });
    }
  };

  handleRetry = async () => {
    // Check network connectivity before retry
    await this.checkNetworkConnectivity();
    
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: null
    });
  };

  handleReportError = () => {
    const errorReport = {
      errorId: this.state.errorId,
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString()
    };

    // In production, you could send this to an external service
    if (__DEV__) {
      console.log('Error Report:', errorReport);
    } else {
      // Store for later retrieval by support
      try {
        const existingReports = localStorage.getItem('app_error_reports') || '[]';
        const reports = JSON.parse(existingReports);
        reports.push(errorReport);
        // Keep only last 10 reports
        const recentReports = reports.slice(-10);
        localStorage.setItem('app_error_reports', JSON.stringify(recentReports));
      } catch (e) {
        console.warn('Could not store error report:', e);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback component if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>
              {!this.state.isConnected ? '📱' : '⚠️'}
            </Text>
            <Text style={styles.errorTitle}>
              {!this.state.isConnected ? 'Проблем с мрежата' : 'Възникна неочаквана грешка'}
            </Text>
            <Text style={styles.errorMessage}>
              {!this.state.isConnected 
                ? 'Приложението се натъкна на грешка, вероятно поради проблем с интернет връзката. Моля проверете връзката си и опитайте отново.'
                : 'Извиняваме се за неудобството. Приложението се натъкна на техническа грешка.'
              }
            </Text>
            
            {this.state.errorId && (
              <Text style={styles.errorId}>
                Код на грешката: {this.state.errorId}
              </Text>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.primaryButton} onPress={this.handleRetry}>
                <Text style={styles.primaryButtonText}>
                  {!this.state.isConnected ? 'Провери връзката и опитай отново' : 'Опитай отново'}
                </Text>
              </TouchableOpacity>
              
              {!this.state.isConnected && (
                <TouchableOpacity style={styles.networkButton} onPress={this.checkNetworkConnectivity}>
                  <Text style={styles.networkButtonText}>🔄 Провери мрежата</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={styles.secondaryButton} onPress={this.handleReportError}>
                <Text style={styles.secondaryButtonText}>Съобщи за грешката</Text>
              </TouchableOpacity>
            </View>

            {__DEV__ && this.state.error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>{this.state.error.message}</Text>
                {this.state.error.stack && (
                  <Text style={styles.debugStack}>{this.state.error.stack}</Text>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  errorId: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: 4,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  networkButton: {
    backgroundColor: colors.success,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 4,
  },
  networkButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  debugContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  debugStack: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 14,
  },
});

export default ErrorBoundary; 