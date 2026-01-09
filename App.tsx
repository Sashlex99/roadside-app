import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { doc, updateDoc } from 'firebase/firestore';
import { StripeProvider } from '@stripe/stripe-react-native';
import { db } from './src/config/firebase';
import { AuthProvider } from './src/contexts/AuthContext';
import MainNavigator from './src/navigation/MainNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { safeLogger } from './src/utils/safeLogger';

// Stripe configuration
const stripePublishableKey = Constants.expoConfig?.extra?.stripe?.publishableKey || '';
const stripeMerchantIdentifier = 'merchant.com.roadside.assistance.bg';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldShowAlert: true,
  }),
});

// Configure global error handlers for React Native
const setupGlobalErrorHandlers = () => {
  // Handle unhandled promise rejections
  // In React Native, we'll use a process-level handler if available
  if (typeof process !== 'undefined' && process.on) {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('Unhandled promise rejection:', reason);
      // Log to our logger system
      import('./src/utils/debugLogger').then(({ logger }) => {
        logger.criticalError('UNHANDLED_PROMISE', 'Unhandled promise rejection', {
          reason: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack : undefined,
          timestamp: new Date().toISOString()
        });
      }).catch(() => {
        // Fallback if logger import fails
        console.error('Failed to log unhandled promise rejection');
      });
    });
  }

  // React Native global error handler
  // Use type assertion for ErrorUtils as it's not in standard types
  const errorUtils = (global as any).ErrorUtils;
  if (errorUtils && typeof errorUtils.setGlobalHandler === 'function') {
    const originalErrorHandler = errorUtils.getGlobalHandler?.();
    
    errorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
      console.error('Global JavaScript error:', error, 'Fatal:', isFatal);
      
      // Log to our logger system
      import('./src/utils/debugLogger').then(({ logger }) => {
        logger.criticalError('GLOBAL_ERROR', 'Global JavaScript error', {
          message: error.message,
          stack: error.stack,
          isFatal,
          timestamp: new Date().toISOString()
        });
      }).catch(() => {
        // Fallback if logger import fails
        console.error('Failed to log global error');
      });
      
      // Call original handler if it exists
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    });
  }

  // Fallback: Simple console override for development
  if (__DEV__) {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // Call original console.error
      originalConsoleError.apply(console, args);
      
      // Log to our system if it looks like an unhandled error
      if (args.length > 0 && (
        String(args[0]).includes('Unhandled') || 
        String(args[0]).includes('Uncaught') ||
        args[0] instanceof Error
      )) {
        import('./src/utils/debugLogger').then(({ logger }) => {
          logger.criticalError('CONSOLE_ERROR', 'Console error intercepted', {
            args: args.map(arg => String(arg)),
            timestamp: new Date().toISOString()
          });
        }).catch(() => {
          // Silent failure to avoid infinite loops
        });
      }
    };
  }
};

export default function App() {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  
  // App startup logging - safe for production
  safeLogger.info('APP STARTED - Console logging is working!', new Date().toISOString());

  useEffect(() => {
    // Setup global error handlers
    setupGlobalErrorHandlers();

    const initializeFirebase = async () => {
      try {
        // Wait for Firebase to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (__DEV__) {
          safeLogger.debug('Firebase initialized for development');
        } else {
          safeLogger.info('Firebase initialized for production');
        }
        
        setIsFirebaseReady(true);
      } catch (error) {
        safeLogger.error('Firebase initialization failed:', error);
        // Still set as ready to allow app to function with degraded capabilities
        setIsFirebaseReady(true);
      }
    };

    const initializeServices = async () => {
      await initializeFirebase();
      
      // Initialize app services
      const cleanupPushNotifications = await initializePushNotifications();
      const cleanupDeepLinking = initializeDeepLinking();
      
      // Start production health monitoring (only in production)
      let stopHealthMonitoring: (() => void) | null = null;
      if (!__DEV__) {
        const { startHealthMonitoring, runHealthCheck } = await import('./src/utils/productionHealthCheck');
        
        // Run initial health check
        try {
          const healthResult = await runHealthCheck();
          console.log(`🏥 Initial health check: ${healthResult.status} (${healthResult.overallScore}%)`);
        } catch (error) {
          console.warn('⚠️ Initial health check failed:', error);
        }
        
        // Start periodic monitoring every 10 minutes in production
        stopHealthMonitoring = startHealthMonitoring(10);
      }
      
      // Return cleanup function
      return () => {
        cleanupDeepLinking?.();
        cleanupPushNotifications?.();
        stopHealthMonitoring?.();
      };
    };

    initializeServices();
  }, []);

  const initializeDeepLinking = () => {
    // Handle deep links when app is already running (using static imports to avoid rebundle)
    const handleDeepLink = async (url: string) => {
      safeLogger.info('Deep link received:', url);

      if (url.includes('payment-success')) {
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const orderId = urlParams.get('orderId');

        if (orderId) {
          try {
            // Manually update order status since webhook might not work
            await updateDoc(doc(db, 'orders', orderId), {
              status: 'accepted',
              paymentStatus: 'paid',
              paidAt: new Date(),
              updatedAt: new Date(),
            });

            safeLogger.success('Order status manually updated to accepted:', orderId);
            safeLogger.success('Payment success handled - ClientHomeScreen will show success modal');
          } catch (error) {
            safeLogger.error('Error updating order status:', error);
          }
        }
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Handle deep link if app was opened from one
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    }).catch((error) => {
      safeLogger.error('Error getting initial URL:', error);
    });

    return () => {
      try {
        subscription?.remove();
      } catch (error) {
        safeLogger.error('Error removing deep link subscription:', error);
      }
    };
  };

  const initializePushNotifications = async () => {
    try {
      safeLogger.debug('Initializing push notifications...');
      
      // Dynamically import notification service
      const { registerForPushNotificationsAsync } = await import('./src/services/notifications');
      const token = await registerForPushNotificationsAsync();
      
      if (token) {
        safeLogger.success('Push token registered successfully:', token);
        safeLogger.debug('Copy this token for testing:', token);
      } else {
        safeLogger.warn('No push token received');
      }
      
      // Set up notification listeners
      const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        safeLogger.debug('Notification received:', notification);
        safeLogger.debug('Notification data:', notification.request.content.data);
      });

      const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        safeLogger.debug('Notification response:', response);
        safeLogger.debug('Response data:', response.notification.request.content.data);
      });

      // Cleanup function
      return () => {
        Notifications.removeNotificationSubscription(notificationListener);
        Notifications.removeNotificationSubscription(responseListener);
      };
    } catch (error) {
      safeLogger.error('Error initializing push notifications:', error);
    }
  };

  if (!isFirebaseReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color="#FF6B2C" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
          Инициализиране на Firebase...
        </Text>
      </View>
    );
  }

  if (firebaseError) {
    safeLogger.warn('Firebase има проблеми, но приложението ще работи в демо режим');
  }

  return (
    <StripeProvider
      publishableKey={stripePublishableKey}
      merchantIdentifier={stripeMerchantIdentifier}
      urlScheme="roadsideassistance"
    >
      <AuthProvider>
        <StatusBar style="auto" />
        <ErrorBoundary>
          <MainNavigator />
        </ErrorBoundary>
      </AuthProvider>
    </StripeProvider>
  );
}