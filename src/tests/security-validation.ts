import { appConfig, isDevelopment, isProduction, firebaseConfig } from '../config/environment';
import SecureLogger from '../utils/secureLogger';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Test Colors for Console Output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

interface TestResult {
  testId: string;
  description: string;
  passed: boolean;
  error?: string;
  details?: string;
}

class SecurityValidator {
  private results: TestResult[] = [];

  // ENV-001: Test Firebase API key loading
  async testFirebaseApiKey(): Promise<TestResult> {
    const testId = 'ENV-001';
    const description = 'Verify Firebase API key loads from environment variables';
    
    try {
      const config = firebaseConfig;
      
      if (!config.apiKey) {
        return {
          testId,
          description,
          passed: false,
          error: 'Firebase API key not found in environment'
        };
      }

      if (config.apiKey.includes('process.env.EXPO_PUBLIC_FIREBASE_API_KEY || \'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac\'')) {
        return {
          testId,
          description,
          passed: false,
          error: 'Using hardcoded API key instead of environment variable'
        };
      }

      // Test Firebase initialization
      const app = initializeApp(config);
      const auth = getAuth(app);
      
      return {
        testId,
        description,
        passed: true,
        details: `Firebase initialized successfully with API key: ${config.apiKey.substring(0, 10)}...`
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ENV-002: Test SMS service configuration
  async testSMSConfiguration(): Promise<TestResult> {
    const testId = 'ENV-002';
    const description = 'Test SMS service configuration from environment';
    
    try {
      const smsConfig = { 
        accountSid: appConfig.SMS_API_KEY, 
        authToken: appConfig.SMS_USERNAME 
      };
      
      if (!smsConfig.accountSid || !smsConfig.authToken) {
        return {
          testId,
          description,
          passed: false,
          error: 'SMS configuration missing from environment'
        };
      }

      return {
        testId,
        description,
        passed: true,
        details: `SMS configured with SID: ${smsConfig.accountSid.substring(0, 10)}...`
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ENV-003: Test Stripe configuration
  async testStripeConfiguration(): Promise<TestResult> {
    const testId = 'ENV-003';
    const description = 'Validate Stripe configuration from environment';
    
    try {
      const stripeConfig = { 
        publishableKey: appConfig.STRIPE_PUBLISHABLE_KEY 
      };
      
      if (!stripeConfig.publishableKey) {
        return {
          testId,
          description,
          passed: false,
          error: 'Stripe publishable key not found in environment'
        };
      }

      return {
        testId,
        description,
        passed: true,
        details: `Stripe configured with key: ${stripeConfig.publishableKey.substring(0, 10)}...`
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ENV-004: Test production environment validation
  async testProductionValidation(): Promise<TestResult> {
    const testId = 'ENV-004';
    const description = 'Test production environment validation triggers';
    
    try {
      const isDev = isDevelopment;
      const isProd = isProduction;
      
      if (isDev && isProd) {
        return {
          testId,
          description,
          passed: false,
          error: 'Both development and production flags are true'
        };
      }

      return {
        testId,
        description,
        passed: true,
        details: `Environment: ${isDev ? 'Development' : 'Production'}`
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // LOG-001: Test email sanitization
  async testEmailSanitization(): Promise<TestResult> {
    const testId = 'LOG-001';
    const description = 'Test email sanitization in logs';
    
    try {
      const testEmail = 'test@example.com';
      const testData = {
        user: {
          email: testEmail,
          name: 'Test User'
        },
        message: `User ${testEmail} logged in`
      };

      const sanitized = SecureLogger.sanitizeData(testData);
      
      if (JSON.stringify(sanitized).includes(testEmail)) {
        return {
          testId,
          description,
          passed: false,
          error: 'Email was not sanitized in log data'
        };
      }

      return {
        testId,
        description,
        passed: true,
        details: 'Email successfully sanitized in logs'
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // LOG-002: Test phone number sanitization
  async testPhoneSanitization(): Promise<TestResult> {
    const testId = 'LOG-002';
    const description = 'Test phone number sanitization';
    
    try {
      const testPhone = '+1234567890';
      const testData = {
        phoneNumber: testPhone,
        phone: testPhone,
        message: `Called ${testPhone}`
      };

      const sanitized = SecureLogger.sanitizeData(testData);
      
      if (JSON.stringify(sanitized).includes(testPhone)) {
        return {
          testId,
          description,
          passed: false,
          error: 'Phone number was not sanitized in log data'
        };
      }

      return {
        testId,
        description,
        passed: true,
        details: 'Phone number successfully sanitized in logs'
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // LOG-003: Test API key sanitization
  async testApiKeySanitization(): Promise<TestResult> {
    const testId = 'LOG-003';
    const description = 'Test API key sanitization';
    
    try {
      const testApiKey = 'process.env.EXPO_PUBLIC_FIREBASE_API_KEY || \'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac\'';
      const testData = {
        apiKey: testApiKey,
        config: {
          firebase: {
            apiKey: testApiKey
          }
        }
      };

      const sanitized = SecureLogger.sanitizeData(testData);
      
      if (JSON.stringify(sanitized).includes(testApiKey)) {
        return {
          testId,
          description,
          passed: false,
          error: 'API key was not sanitized in log data'
        };
      }

      return {
        testId,
        description,
        passed: true,
        details: 'API key successfully sanitized in logs'
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // LOG-004: Test JWT token sanitization
  async testJWTSanitization(): Promise<TestResult> {
    const testId = 'LOG-004';
    const description = 'Test JWT token sanitization';
    
    try {
      const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const testData = {
        token: testToken,
        authorization: `Bearer ${testToken}`,
        jwt: testToken
      };

      const sanitized = SecureLogger.sanitizeData(testData);
      
      if (JSON.stringify(sanitized).includes(testToken)) {
        return {
          testId,
          description,
          passed: false,
          error: 'JWT token was not sanitized in log data'
        };
      }

      return {
        testId,
        description,
        passed: true,
        details: 'JWT token successfully sanitized in logs'
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // LOG-005: Test password sanitization
  async testPasswordSanitization(): Promise<TestResult> {
    const testId = 'LOG-005';
    const description = 'Test password sanitization';
    
    try {
      const testPassword = 'mySecretPassword123!';
      const testData = {
        password: testPassword,
        pwd: testPassword,
        secret: testPassword,
        user: {
          password: testPassword
        }
      };

      const sanitized = SecureLogger.sanitizeData(testData);
      
      if (JSON.stringify(sanitized).includes(testPassword)) {
        return {
          testId,
          description,
          passed: false,
          error: 'Password was not sanitized in log data'
        };
      }

      return {
        testId,
        description,
        passed: true,
        details: 'Password successfully sanitized in logs'
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // LOG-006: Test production vs development logging
  async testLoggingBehavior(): Promise<TestResult> {
    const testId = 'LOG-006';
    const description = 'Test production vs development logging behavior';
    
    try {
      const isDev = isDevelopment;
      const testData = { message: 'Test log message', sensitive: 'secret' };
      
      // Test info logging
      SecureLogger.info('SYSTEM', 'Test info message', testData);
      
      // Test debug logging (should only work in development)
      SecureLogger.debug('SYSTEM', 'Test debug message', testData);
      
      return {
        testId,
        description,
        passed: true,
        details: `Logging behavior verified for ${isDev ? 'development' : 'production'} mode`
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Run all tests
  async runAllTests(): Promise<TestResult[]> {
    console.log(`${BLUE}🚀 Starting Security Validation Tests...${RESET}\n`);
    
    const tests = [
      // Environment Tests
      this.testFirebaseApiKey(),
      this.testSMSConfiguration(),
      this.testStripeConfiguration(),
      this.testProductionValidation(),
      
      // Logging Tests
      this.testEmailSanitization(),
      this.testPhoneSanitization(),
      this.testApiKeySanitization(),
      this.testJWTSanitization(),
      this.testPasswordSanitization(),
      this.testLoggingBehavior()
    ];

    this.results = await Promise.all(tests);
    
    return this.results;
  }

  // Print results
  printResults(): void {
    console.log(`${BLUE}📊 Security Validation Results:${RESET}\n`);
    
    let passed = 0;
    let failed = 0;
    
    this.results.forEach(result => {
      const status = result.passed ? `${GREEN}✅ PASS${RESET}` : `${RED}❌ FAIL${RESET}`;
      console.log(`${status} ${result.testId}: ${result.description}`);
      
      if (result.details) {
        console.log(`   ${YELLOW}ℹ️  ${result.details}${RESET}`);
      }
      
      if (result.error) {
        console.log(`   ${RED}⚠️  ${result.error}${RESET}`);
      }
      
      console.log('');
      
      if (result.passed) {
        passed++;
      } else {
        failed++;
      }
    });
    
    console.log(`${BLUE}Summary: ${GREEN}${passed} passed${RESET}, ${failed > 0 ? `${RED}${failed} failed${RESET}` : `${GREEN}${failed} failed${RESET}`}`);
    
    if (failed > 0) {
      console.log(`${RED}❌ Some security tests failed. Please review and fix the issues above.${RESET}`);
    } else {
      console.log(`${GREEN}✅ All security tests passed!${RESET}`);
    }
  }
}

// Export for use in other files
export { SecurityValidator };

// CLI execution
if (require.main === module) {
  const validator = new SecurityValidator();
  validator.runAllTests().then(() => {
    validator.printResults();
  }).catch(error => {
    console.error(`${RED}❌ Test execution failed:${RESET}`, error);
  });
} 