import Constants from 'expo-constants';

// Environment configuration interface
export interface AppConfig {
  // Firebase Configuration
  FIREBASE_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_AUTH_DOMAIN: string;
  FIREBASE_STORAGE_BUCKET: string;
  FIREBASE_MESSAGING_SENDER_ID: string;
  FIREBASE_APP_ID: string;
  
  // Stripe Configuration
  STRIPE_PUBLISHABLE_KEY: string;
  
  // SMS Configuration
  SMS_API_KEY: string;
  SMS_USERNAME: string;
  SMS_PROVIDER: 'sms.bg' | 'vivakom' | 'twilio';
  SMS_MODE: 'demo' | 'beta' | 'production';
  
  // Development Configuration
  BYPASS_PHONE_VERIFICATION: boolean;
  
  // App Configuration
  APP_ENV: 'development' | 'production';
  PROJECT_ENV: 'dev' | 'staging' | 'prod';
  
  // API URLs
  FIRESTORE_REST_BASE_URL: string;
  FIREBASE_AUTH_URL: string;
  FIREBASE_STORAGE_URL: string;
}

// Default configuration values
const defaultConfig: AppConfig = {
  FIREBASE_API_KEY: '',
  FIREBASE_PROJECT_ID: 'roadside-assistance-app-aa0e8',
  FIREBASE_AUTH_DOMAIN: 'roadside-assistance-app-aa0e8.firebaseapp.com',
  FIREBASE_STORAGE_BUCKET: 'roadside-assistance-app-aa0e8.appspot.com',
  FIREBASE_MESSAGING_SENDER_ID: '98397269310',
  FIREBASE_APP_ID: '1:98397269310:web:c965f2361fd25ff328906f',
  
  STRIPE_PUBLISHABLE_KEY: '',
  
  SMS_API_KEY: '',
  SMS_USERNAME: '',
  SMS_PROVIDER: 'sms.bg',
  SMS_MODE: 'demo', // DEMO MODE: Only console output, no real SMS
  
  BYPASS_PHONE_VERIFICATION: __DEV__, // TRUE in development, FALSE in production
  
  APP_ENV: __DEV__ ? 'development' : 'production',
  PROJECT_ENV: 'dev',
  
  FIRESTORE_REST_BASE_URL: '',
  FIREBASE_AUTH_URL: 'https://identitytoolkit.googleapis.com/v1',
  FIREBASE_STORAGE_URL: '',
};

// Get environment configuration with fallbacks
function getEnvironmentConfig(): AppConfig {
  const config: AppConfig = {
    // Firebase Configuration - from environment variables (secure)
    FIREBASE_API_KEY: 
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 
      Constants.expoConfig?.extra?.firebaseApiKey || 
      '', // No hardcoded fallback - must be set in environment
    
    FIREBASE_PROJECT_ID: 
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 
      Constants.expoConfig?.extra?.firebaseProjectId || 
      defaultConfig.FIREBASE_PROJECT_ID,
    
    FIREBASE_AUTH_DOMAIN: 
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 
      Constants.expoConfig?.extra?.firebaseAuthDomain || 
      defaultConfig.FIREBASE_AUTH_DOMAIN,
    
    FIREBASE_STORAGE_BUCKET: 
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 
      Constants.expoConfig?.extra?.firebaseStorageBucket || 
      defaultConfig.FIREBASE_STORAGE_BUCKET,
    
    FIREBASE_MESSAGING_SENDER_ID: 
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 
      Constants.expoConfig?.extra?.firebaseMessagingSenderId || 
      defaultConfig.FIREBASE_MESSAGING_SENDER_ID,
    
    FIREBASE_APP_ID: 
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 
      Constants.expoConfig?.extra?.firebaseAppId || 
      defaultConfig.FIREBASE_APP_ID,
    
    // Stripe Configuration
    STRIPE_PUBLISHABLE_KEY: 
      process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 
      Constants.expoConfig?.extra?.stripe?.publishableKey || 
      defaultConfig.STRIPE_PUBLISHABLE_KEY,
    
    // SMS Configuration
    SMS_API_KEY: 
      process.env.SMS_API_KEY || 
      Constants.expoConfig?.extra?.smsApiKey || 
      defaultConfig.SMS_API_KEY,
    
    SMS_USERNAME: 
      process.env.SMS_USERNAME || 
      Constants.expoConfig?.extra?.smsUsername || 
      defaultConfig.SMS_USERNAME,
    
    SMS_PROVIDER: 
      (process.env.EXPO_PUBLIC_SMS_PROVIDER as AppConfig['SMS_PROVIDER']) || 
      (Constants.expoConfig?.extra?.smsProvider as AppConfig['SMS_PROVIDER']) || 
      defaultConfig.SMS_PROVIDER,
    
        SMS_MODE:
      __DEV__ ? 'demo' : // FORCE demo mode in development
      (process.env.EXPO_PUBLIC_SMS_MODE as AppConfig['SMS_MODE']) ||
      (Constants.expoConfig?.extra?.smsMode as AppConfig['SMS_MODE']) ||
      defaultConfig.SMS_MODE,
    
    // Development Configuration
    BYPASS_PHONE_VERIFICATION: 
      __DEV__ || // ALWAYS true in development
      process.env.EXPO_PUBLIC_BYPASS_PHONE_VERIFICATION === 'true' || 
      (Constants.expoConfig?.extra?.bypassPhoneVerification as boolean) || 
      defaultConfig.BYPASS_PHONE_VERIFICATION,
    
    // App Configuration
    APP_ENV: 
      (Constants.expoConfig?.extra?.environment as AppConfig['APP_ENV']) || 
      (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    
    PROJECT_ENV: 
      (Constants.expoConfig?.extra?.projectEnv as AppConfig['PROJECT_ENV']) || 
      (process.env.PROJECT_ENV as AppConfig['PROJECT_ENV']) || 
      defaultConfig.PROJECT_ENV,
    
    // Computed URLs
    FIRESTORE_REST_BASE_URL: '',
    FIREBASE_AUTH_URL: defaultConfig.FIREBASE_AUTH_URL,
    FIREBASE_STORAGE_URL: '',
  };
  
  // Compute dependent URLs
  config.FIRESTORE_REST_BASE_URL = `https://firestore.googleapis.com/v1/projects/${config.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  config.FIREBASE_STORAGE_URL = `https://storage.googleapis.com/upload/storage/v1/b/${config.FIREBASE_PROJECT_ID}.appspot.com`;
  
  return config;
}

// Export the configuration
export const appConfig = getEnvironmentConfig();

// Validation functions
function validateConfig(): void {
  const errors: string[] = [];
  
  // Critical validations for production
  if (appConfig.APP_ENV === 'production') {
    if (!appConfig.FIREBASE_API_KEY) {
      errors.push('FIREBASE_API_KEY is required in production');
    }
    
    if (!appConfig.STRIPE_PUBLISHABLE_KEY) {
      errors.push('STRIPE_PUBLISHABLE_KEY is required in production');
    }
    
    if (appConfig.SMS_MODE === 'production' && !appConfig.SMS_API_KEY) {
      errors.push('SMS_API_KEY is required when SMS_MODE is production');
    }
    
    // Check for development API keys in production
    if (appConfig.FIREBASE_API_KEY === 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac') {
      console.warn('⚠️ Using development Firebase API key in production - consider rotating for security');
    }
  }
  
  // Validate Firebase project ID format
  if (!/^[a-z0-9-]+$/.test(appConfig.FIREBASE_PROJECT_ID)) {
    errors.push('Invalid Firebase project ID format');
  }
  
  // Validate SMS provider
  if (!['sms.bg', 'vivakom', 'twilio'].includes(appConfig.SMS_PROVIDER)) {
    errors.push('Invalid SMS provider');
  }
  
  // Validate SMS mode
  if (!['demo', 'beta', 'production'].includes(appConfig.SMS_MODE)) {
    errors.push('Invalid SMS mode');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Validate configuration on import
validateConfig();

// Export utilities
export const isDevelopment = appConfig.APP_ENV === 'development';
export const isProduction = appConfig.APP_ENV === 'production';
export const isDemo = appConfig.SMS_MODE === 'demo';

// Export configuration sections
export const firebaseConfig = {
  apiKey: appConfig.FIREBASE_API_KEY,
  authDomain: appConfig.FIREBASE_AUTH_DOMAIN,
  projectId: appConfig.FIREBASE_PROJECT_ID,
  storageBucket: appConfig.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: appConfig.FIREBASE_MESSAGING_SENDER_ID,
  appId: appConfig.FIREBASE_APP_ID,
};

export const stripeConfig = {
  publishableKey: appConfig.STRIPE_PUBLISHABLE_KEY,
};

export const smsConfig = {
  apiKey: appConfig.SMS_API_KEY,
  username: appConfig.SMS_USERNAME,
  provider: appConfig.SMS_PROVIDER,
  mode: appConfig.SMS_MODE,
};

export const developmentConfig = {
  bypassPhoneVerification: appConfig.BYPASS_PHONE_VERIFICATION,
};

// Debug logging (development only)
if (__DEV__) {
  console.log('🔧 Environment Configuration:', {
    APP_ENV: appConfig.APP_ENV,
    PROJECT_ENV: appConfig.PROJECT_ENV,
    FIREBASE_PROJECT_ID: appConfig.FIREBASE_PROJECT_ID,
    SMS_PROVIDER: appConfig.SMS_PROVIDER,
    SMS_MODE: appConfig.SMS_MODE,
    hasFirebaseApiKey: !!appConfig.FIREBASE_API_KEY,
    hasStripeKey: !!appConfig.STRIPE_PUBLISHABLE_KEY,
    hasSmsApiKey: !!appConfig.SMS_API_KEY,
  });
} 