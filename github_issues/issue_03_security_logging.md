# 🔴 SECURITY: Sensitive data exposure в production logs

## Labels
`security`, `critical`, `data-protection`, `GDPR`, `P1`

## Milestone
Phase 1 - Critical Fixes

## Описание

Установено е **критично нарушение на сигурността** - sensitive данни като emails, user tokens, API keys се логват в console, което създава риск от:

- **Data breaches** при access до logs
- **GDPR violations** за европейски потребители
- **API key exposure** в client-side bundles
- **PII leak** в development и production environments
- **Compliance нарушения** при security audits

## 📍 Засегнати файлове

### Високо рискови файлове:
- `src/contexts/AuthContext.tsx` - User data logging
- `src/services/firebaseAPI.ts` - Hardcoded API keys
- `src/hooks/client/useClientPayments.ts` - Payment info logging
- `src/screens/auth/LoginScreen.tsx` - Email logging
- `admin-panel/src/lib/adminAPI.ts` - Admin token exposure

### Примери от кода:
```javascript
// ❌ ОПАСНИ LOGS:
console.log('MainNavigator - User:', user); // Full user object
console.log('🔐 Starting login process for:', email); // Email address
console.log('Payment data:', paymentInfo); // Financial data
const API_KEY = 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac'; // Hardcoded key
```

## 🔍 Security Risk Assessment

### **Critical Exposures:**

1. **Personal Data (GDPR Risk)**
   ```javascript
   // src/contexts/AuthContext.tsx:175
   console.log('MainNavigator - User:', user);
   // Logs: { email, phone, name, location, etc. }
   ```

2. **API Keys (Security Risk)**
   ```javascript
   // src/services/firebaseAPI.ts:12
   const API_KEY = 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac';
   // Exposed in client bundle
   ```

3. **Authentication Tokens**
   ```javascript
   // Multiple files
   console.log('Auth token:', token);
   // JWT tokens visible in dev tools
   ```

4. **Payment Information**
   ```javascript
   // src/hooks/client/useClientPayments.ts
   console.log('Payment processing:', { amount, cardInfo });
   // Financial data exposure
   ```

## ✅ Решение

### Стъпка 1: Secure Logger Implementation
```typescript
// src/utils/secureLogger.ts
interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
  CRITICAL: 'critical';
}

class SecureLogger {
  private static isProduction = !__DEV__;
  private static sensitiveFields = [
    'email', 'phone', 'password', 'token', 'apiKey', 'key',
    'secret', 'auth', 'credential', 'card', 'payment', 'ssn'
  ];

  static debug(category: string, message: string, data?: any) {
    if (!this.isProduction) {
      console.log(`[DEBUG][${category}] ${message}`, this.sanitizeData(data));
    }
  }

  static info(category: string, message: string, data?: any) {
    console.log(`[INFO][${category}] ${message}`, this.sanitizeData(data));
  }

  static warn(category: string, message: string, data?: any) {
    console.warn(`[WARN][${category}] ${message}`, this.sanitizeData(data));
  }

  static error(category: string, message: string, error?: any) {
    console.error(`[ERROR][${category}] ${message}`, this.sanitizeError(error));
  }

  static critical(category: string, message: string, data?: any) {
    console.error(`[CRITICAL][${category}] ${message}`, this.sanitizeData(data));
    // В production - изпрати към security monitoring
    if (this.isProduction) {
      this.reportCriticalIssue(category, message, data);
    }
  }

  private static sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    // Remove sensitive fields
    this.sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        const value = sanitized[field];
        if (typeof value === 'string') {
          // Show only first 2 and last 2 chars for emails
          if (field === 'email' && value.includes('@')) {
            const [username, domain] = value.split('@');
            sanitized[field] = `${username.substring(0, 2)}***@${domain}`;
          } else {
            sanitized[field] = '[REDACTED]';
          }
        } else {
          sanitized[field] = '[REDACTED]';
        }
      }
    });
    
    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    });
    
    return sanitized;
  }

  private static sanitizeError(error: any): any {
    if (!error) return error;
    
    // В production премахваме stack traces
    if (this.isProduction && error.stack) {
      return {
        name: error.name,
        message: error.message,
        code: error.code
      };
    }
    
    return error;
  }

  private static async reportCriticalIssue(category: string, message: string, data: any) {
    try {
      // Report to security monitoring service
      // Например Firebase Analytics, Sentry, или custom endpoint
      const report = {
        timestamp: new Date().toISOString(),
        category,
        message,
        sanitizedData: this.sanitizeData(data),
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      
      // Send to monitoring service
      // await fetch('/api/security-log', { method: 'POST', body: JSON.stringify(report) });
    } catch (reportError) {
      console.error('Failed to report security issue:', reportError);
    }
  }

  // Development utility за export на logs
  static exportLogs(): string {
    if (this.isProduction) {
      return 'Log export not available in production';
    }
    
    // Collect logs from console (development only)
    return 'Logs exported successfully';
  }
}

export { SecureLogger };
```

### Стъпка 2: Environment Variables Setup
```typescript
// src/config/environment.ts
import Constants from 'expo-constants';

interface AppConfig {
  FIREBASE_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  STRIPE_PUBLISHABLE_KEY: string;
  APP_ENV: 'development' | 'staging' | 'production';
}

export const appConfig: AppConfig = {
  FIREBASE_API_KEY: Constants.expoConfig?.extra?.firebaseApiKey || 
                   process.env.FIREBASE_API_KEY || 
                   __DEV__ ? 'dev-fallback-key' : '',
  
  FIREBASE_PROJECT_ID: Constants.expoConfig?.extra?.firebaseProjectId || 
                      process.env.FIREBASE_PROJECT_ID || 
                      'roadside-assistance-dev',
  
  STRIPE_PUBLISHABLE_KEY: Constants.expoConfig?.extra?.stripePublishableKey || 
                         process.env.STRIPE_PUBLISHABLE_KEY || 
                         '',
  
  APP_ENV: (Constants.expoConfig?.extra?.environment as AppConfig['APP_ENV']) || 
           (__DEV__ ? 'development' : 'production')
};

// Validation
if (!appConfig.FIREBASE_API_KEY && appConfig.APP_ENV === 'production') {
  throw new Error('FIREBASE_API_KEY is required in production');
}

if (!appConfig.STRIPE_PUBLISHABLE_KEY && appConfig.APP_ENV === 'production') {
  throw new Error('STRIPE_PUBLISHABLE_KEY is required in production');
}
```

### Стъпка 3: Code Migration Examples
```typescript
// ПРЕДИ (ОПАСНО):
console.log('MainNavigator - User:', user);
console.log('🔐 Starting login process for:', email);
console.log('Payment data:', paymentInfo);

// СЛЕД (БЕЗОПАСНО):
import { SecureLogger } from '../utils/secureLogger';

SecureLogger.debug('AUTH', 'User authenticated', { 
  uid: user.uid, 
  userType: user.userType,
  lastLogin: user.lastLogin 
});

SecureLogger.info('AUTH', 'Login process started', { 
  emailDomain: email.split('@')[1] // Само domain, не пълния email
});

SecureLogger.debug('PAYMENT', 'Payment processing initiated', {
  orderId: paymentInfo.orderId,
  amount: paymentInfo.amount,
  currency: paymentInfo.currency
  // ❌ НЕ логваме: card info, personal data
});
```

### Стъпка 4: API Key Security
```typescript
// src/services/firebaseAPI.ts - ПРЕДИ:
const API_KEY = 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac';

// src/services/firebaseAPI.ts - СЛЕД:
import { appConfig } from '../config/environment';
const API_KEY = appConfig.FIREBASE_API_KEY;

// Validation
if (!API_KEY) {
  throw new Error('Firebase API key not configured');
}
```

## 📋 Implementation Checklist

### Security Infrastructure
- [ ] `SecureLogger` class implementation
- [ ] Environment variables setup в `app.json`
- [ ] API key extraction от hardcoded values
- [ ] Production log filtering mechanism
- [ ] Security incident reporting system

### Code Migration (High Priority)
- [ ] `AuthContext.tsx` - Remove user object logging
- [ ] `LoginScreen.tsx` - Remove email logging  
- [ ] `useClientPayments.ts` - Sanitize payment logs
- [ ] `firebaseAPI.ts` - Environment variable migration
- [ ] `adminAPI.ts` - Remove admin token exposure

### Code Migration (Medium Priority)
- [ ] All remaining `console.log` statements audit
- [ ] Error logging standardization
- [ ] Debug logging conditional compilation
- [ ] Analytics data sanitization
- [ ] Local storage security review

### Testing & Validation
- [ ] GDPR compliance verification
- [ ] Production bundle API key check
- [ ] Log sanitization testing
- [ ] Security audit simulation
- [ ] Penetration testing coordination

### Documentation & Compliance
- [ ] Security logging guidelines
- [ ] Developer training материали
- [ ] GDPR compliance documentation
- [ ] Incident response procedures
- [ ] Regular security review schedule

## 🧪 Security Test Scenarios

### 1. Log Sanitization Test
```javascript
// Test sensitive data filtering
const testData = {
  email: 'test@example.com',
  password: 'secret123',
  token: 'jwt-token-here',
  publicInfo: 'safe-to-log'
};

SecureLogger.debug('TEST', 'Testing sanitization', testData);
// Expected output: { email: 'te***@example.com', password: '[REDACTED]', token: '[REDACTED]', publicInfo: 'safe-to-log' }
```

### 2. Production Bundle Analysis
```bash
# Check for hardcoded secrets in bundle
npx expo export
grep -r "AIzaSy" dist/ # Should find no API keys
grep -r "sk_" dist/   # Should find no Stripe secret keys
```

### 3. GDPR Compliance Test
```javascript
// Verify no PII in production logs
// Enable production mode
// Perform user actions
// Analyze log output for PII exposure
```

## 🎯 Definition of Done

- [ ] No sensitive data в production logs
- [ ] All API keys използват environment variables
- [ ] `SecureLogger` заменя всички console.log statements
- [ ] GDPR compliance verified
- [ ] Security audit passes
- [ ] Documentation updated
- [ ] Developer guidelines established

## 🚨 Priority Justification

**Priority: P1 (High Security)**

Този issue:
- ✅ Нарушава GDPR compliance
- ✅ Експонира потребителски данни
- ✅ Създава security vulnerabilities
- ✅ Може да доведе до regulatory fines
- ✅ Влияе на company reputation

## ⏱️ Time Estimate

**2-3 дни** общо:
- День 1: SecureLogger implementation + environment setup
- День 2: Code migration за critical files
- День 3: Testing, validation, documentation

## 🔗 Related Issues

- Issue #4: Admin Panel Security (related localStorage vulnerability)
- Issue #9: Error Handling (structured error logging)

## 📊 Compliance Requirements

### GDPR Requirements:
- ✅ Data minimization в logs
- ✅ Right to be forgotten compliance
- ✅ Data breach prevention
- ✅ Privacy by design implementation

### Security Standards:
- ✅ No hardcoded credentials
- ✅ Secure development practices
- ✅ Incident logging и monitoring
- ✅ Regular security reviews

---

**Created**: December 2024  
**Last Updated**: December 2024 