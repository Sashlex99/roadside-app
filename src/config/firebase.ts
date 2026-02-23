import { initializeApp, getApps, getApp, SDK_VERSION } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { initializeFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { firebaseConfig } from './environment';

// ============================================================
// 🔥 FIREBASE SDK INITIALIZATION & STATUS LOGGING
// ============================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔥 [SDK] Firebase SDK Loading...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📦 [SDK] Firebase JS SDK Version: ${SDK_VERSION}`);
console.log('📦 [SDK] Mode: JavaScript SDK (NOT REST API)');
console.log('📦 [SDK] Modules loaded: firebase/app, firebase/auth, firebase/firestore, firebase/storage');

// Using secure environment-based configuration
console.log('🔧 [SDK] Firebase configuration loaded from environment variables');

// Prevent multiple Firebase app initialization
let app;
const existingApps = getApps();
console.log(`🔧 [SDK] Existing Firebase apps: ${existingApps.length}`);

if (existingApps.length === 0) {
  console.log('🔧 [SDK] Initializing new Firebase app...');
  app = initializeApp(firebaseConfig);
  console.log(`✅ [SDK] Firebase app initialized: ${app.name}`);
  console.log(`✅ [SDK] Project ID: ${app.options.projectId}`);
} else {
  app = getApps()[0];
  console.log(`♻️ [SDK] Reusing existing Firebase app: ${app.name}`);
}

// Initialize Firebase services
console.log('🔧 [SDK] Initializing Firebase Auth...');
export const auth = getAuth(app);
console.log(`✅ [SDK] Firebase Auth initialized - SDK Auth instance created`);
console.log(`✅ [SDK] Auth config: { appName: "${auth.app.name}", tenantId: ${auth.tenantId || 'null'} }`);

console.log('🔧 [SDK] Initializing Firebase Storage...');
export const storage = getStorage(app);
console.log(`✅ [SDK] Firebase Storage initialized - Bucket: ${storage.app.options.storageBucket}`);

// Initialize Firebase Functions (for Cloud Functions calls)
console.log('🔧 [SDK] Initializing Firebase Functions...');
export const functions = getFunctions(app, 'europe-west3'); // Match Cloud Functions region
console.log(`✅ [SDK] Firebase Functions initialized - Region: europe-west3`);

// ✅ ENHANCED: React Native Firebase handles persistence automatically through AsyncStorage
// No need to configure persistence manually in React Native environment
console.log('🔐 [SDK] React Native Firebase Auth persistence is handled automatically via AsyncStorage');

// ✅ ENHANCED: Optimized Firestore configuration for React Native
console.log('🔧 [SDK] Initializing Firestore SDK...');
const firestoreConfig = {
  // Force HTTP long-polling instead of WebSocket/gRPC (fixes React Native issues)
  experimentalForceLongPolling: true,
  // Disable fetch streams to avoid RN/Expo fetch stream issues
  useFetchStreams: false,
  // Increase cache size for better offline performance
  cacheSizeBytes: 40 * 1024 * 1024, // 40MB cache
};

console.log('📋 [SDK] Firestore config:', JSON.stringify({
  experimentalForceLongPolling: firestoreConfig.experimentalForceLongPolling,
  useFetchStreams: firestoreConfig.useFetchStreams,
  cacheSizeBytes: `${firestoreConfig.cacheSizeBytes / (1024 * 1024)}MB`,
  connectionMode: 'HTTP Long-Polling (NOT WebSocket/gRPC)',
  dataMode: 'SDK with real-time listeners (NOT REST API)',
}));

export const db = initializeFirestore(app, firestoreConfig);
console.log(`✅ [SDK] Firestore SDK initialized successfully`);
console.log(`✅ [SDK] Firestore type: ${db.type} | App: ${db.app.name}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔥 [SDK] SUMMARY: Using Firebase JavaScript SDK');
console.log('   • Auth: SDK (signInWithEmailAndPassword, onAuthStateChanged)');
console.log('   • Firestore: SDK (onSnapshot, real-time listeners)');
console.log('   • Storage: SDK (uploadBytes, getDownloadURL)');
console.log('   • NOT using REST API for core operations');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ✅ ENHANCED: Optimized auth state monitoring with proper cleanup tracking
const monitorAuthState = () => {
  let authStateCheckInterval: NodeJS.Timeout | null = null;
  let isMonitoringActive = true;
  
  const checkAuthState = async () => {
    try {
      if (!isMonitoringActive) {
        console.log('🔐 Auth state monitoring deactivated, skipping check');
        return;
      }
      
      if (auth.currentUser) {
        // Verify token is still valid (non-blocking, production-optimized)
        auth.currentUser.getIdToken(false).then(token => {
          // Only log in development mode
          if (__DEV__ && token) {
            console.log('🔐 Auth state healthy');
          }
        }).catch(error => {
          if (__DEV__) {
            console.warn('⚠️ Auth token check failed:', error);
          }
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Auth state check failed:', error);
      }
    }
  };
  
  // Check auth state every 10 minutes (reduced frequency for production)
  authStateCheckInterval = setInterval(checkAuthState, 10 * 60 * 1000);
  
  // Initial check
  checkAuthState();
  
  // Enhanced cleanup function
  return () => {
    console.log('🧹 [Firebase] Cleaning up auth state monitoring');
    isMonitoringActive = false;
    if (authStateCheckInterval) {
      clearInterval(authStateCheckInterval);
      authStateCheckInterval = null;
      console.log('✅ [Firebase] Auth state monitoring interval cleared');
    }
  };
};

// 🛠️ ENHANCED: Robust networking setup with retry logic and timeout management
const setupFirebaseNetworking = async () => {
  let retryCount = 0;
  const maxRetries = 3;
  let networkingTimeout: NodeJS.Timeout | null = null;
  
  const cleanup = () => {
    if (networkingTimeout) {
      clearTimeout(networkingTimeout);
      networkingTimeout = null;
    }
  };
  
  try {
    while (retryCount < maxRetries) {
      try {
        console.log(`🔧 Setting up Firebase networking (attempt ${retryCount + 1}/${maxRetries})...`);
        
        // Force clean reconnect with timeout protection
        await disableNetwork(db);
        
        // Create promise with timeout
        const delay = new Promise(resolve => {
          networkingTimeout = setTimeout(() => {
            resolve(undefined);
            networkingTimeout = null;
          }, 2000 + retryCount * 1000);
        });
        
        await delay;
        await enableNetwork(db);
        
        console.log('✅ Firebase networking reset completed successfully');
        cleanup();
        return; // Success, exit retry loop
        
      } catch (error) {
        retryCount++;
        console.warn(`⚠️ Firebase networking setup attempt ${retryCount} failed:`, error);
        
        if (retryCount >= maxRetries) {
          console.error('❌ Firebase networking setup failed after all retries');
          // Continue anyway - app might still work
        }
      }
    }
  } finally {
    cleanup(); // Always clean up timeouts
  }
};

// 🆕 CONNECTION MONITORING: Monitor and handle connection issues  
const monitorConnection = () => {
  // ✅ DISABLED: Aggressive connection monitoring causes crashes during network recovery
  console.log('⚠️ Connection monitoring disabled to prevent network recovery crashes');
  
  // 🔄 FUTURE: Could implement more gentle monitoring if needed
  // For now, let Firebase SDK handle connection management automatically
  
  /* DISABLED - CAUSES CRASHES:
  let connectionTimeout: NodeJS.Timeout;
  
  // Reset connection if it seems stuck
  const resetConnection = async () => {
    try {
      console.log('🔄 Resetting Firebase connection due to inactivity...');
      await disableNetwork(db);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await enableNetwork(db);
      console.log('✅ Connection reset completed');
    } catch (error) {
      console.error('❌ Connection reset failed:', error);
    }
  };
  
  // Set up periodic connection health check
  setInterval(() => {
    // Clear existing timeout
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
    }
    
    // Set timeout to reset connection if no activity
    connectionTimeout = setTimeout(resetConnection, 30000); // 30 seconds of inactivity
  }, 60000); // Check every minute
  */
};

// ✅ ENHANCED: Initialize Firebase with comprehensive monitoring and cleanup tracking
const initializeFirebaseWithMonitoring = async () => {
  console.log('🔧 [Firebase] Initializing Firebase with monitoring...');
  
  // Track all cleanup functions
  const cleanupFunctions: Array<() => void> = [];
  
  try {
    // Setup Auth state monitoring (React Native handles persistence automatically)
    const cleanupAuthMonitoring = monitorAuthState();
    cleanupFunctions.push(cleanupAuthMonitoring);
    
    console.log('✅ [Firebase] Auth state monitoring initialized');
    
    // Return comprehensive cleanup function
    return () => {
      console.log('🧹 [Firebase] Running comprehensive cleanup...');
      let cleanedCount = 0;
      
      cleanupFunctions.forEach((cleanup, index) => {
        try {
          cleanup();
          cleanedCount++;
          console.log(`✅ [Firebase] Cleanup function ${index + 1} executed successfully`);
        } catch (error) {
          console.error(`❌ [Firebase] Error in cleanup function ${index + 1}:`, error);
        }
      });
      
      console.log(`✅ [Firebase] Comprehensive cleanup completed - ${cleanedCount}/${cleanupFunctions.length} functions cleaned`);
    };
  } catch (error) {
    console.error('❌ [Firebase] Failed to initialize Firebase with monitoring:', error);
    
    // Return cleanup function even on error
    return () => {
      console.log('🧹 [Firebase] Running error-state cleanup...');
      cleanupFunctions.forEach((cleanup, index) => {
        try {
          cleanup();
        } catch (cleanupError) {
          console.error(`❌ [Firebase] Error in error-state cleanup function ${index + 1}:`, cleanupError);
        }
      });
    };
  }
};

// ✅ ENHANCED: Global Firebase cleanup tracking
let firebaseCleanupFunction: (() => void) | null = null;

// Export cleanup function for use in app lifecycle
export const cleanupFirebase = () => {
  if (firebaseCleanupFunction) {
    firebaseCleanupFunction();
    firebaseCleanupFunction = null;
  } else {
    console.log('🧹 [Firebase] No cleanup function available');
  }
};

// Run setup based on environment
if (__DEV__) {
  console.log('🔧 [SDK] Development mode: Enhanced Firebase setup with monitoring...');

  // Initialize with monitoring
  initializeFirebaseWithMonitoring().then((cleanup: () => void) => {
    firebaseCleanupFunction = cleanup;
    console.log('✅ [SDK] Firebase monitoring initialized in development mode');

    // Log SDK status summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔥 [SDK STATUS] Firebase SDK fully loaded and ready');
    console.log(`   • SDK Version: ${SDK_VERSION}`);
    console.log(`   • App Name: ${app.name}`);
    console.log(`   • Auth Ready: ${auth ? 'YES' : 'NO'}`);
    console.log(`   • Firestore Ready: ${db ? 'YES' : 'NO'}`);
    console.log(`   • Storage Ready: ${storage ? 'YES' : 'NO'}`);
    console.log(`   • Current User: ${auth.currentUser?.uid || 'None (not logged in yet)'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });

  // ✅ DISABLED: Aggressive networking setup causes crashes
  // setupFirebaseNetworking();
  // monitorConnection();

  // ✅ Let Firebase SDK handle connections automatically
  console.log('✅ [SDK] Using Firebase SDK auto-connection management (not REST)');
} else {
  // Production: run enhanced setup
  console.log('🔧 [SDK] Production mode: Enhanced Firebase setup with monitoring...');

  // Initialize with monitoring
  initializeFirebaseWithMonitoring().then((cleanup: () => void) => {
    firebaseCleanupFunction = cleanup;
    console.log('✅ [SDK] Firebase monitoring initialized in production mode');

    // Log SDK status summary
    console.log('🔥 [SDK STATUS] Firebase SDK fully loaded and ready');
  });
}

export default app; 
