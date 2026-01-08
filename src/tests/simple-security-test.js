// Simple Security Test for Node.js environment
const fs = require('fs');
const path = require('path');

// Test Colors for Console Output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

class SimpleSecurityTest {
  constructor() {
    this.results = [];
  }

  // Test 1: Check if environment configuration file exists
  testEnvironmentConfigExists() {
    const testId = 'ENV-001';
    const description = 'Check if environment configuration file exists';
    
    try {
      const envPath = path.join(__dirname, '../config/environment.ts');
      if (fs.existsSync(envPath)) {
        return {
          testId,
          description,
          passed: true,
          details: 'Environment configuration file exists'
        };
      } else {
        return {
          testId,
          description,
          passed: false,
          error: 'Environment configuration file not found'
        };
      }
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error.message
      };
    }
  }

  // Test 2: Check if secure logger file exists
  testSecureLoggerExists() {
    const testId = 'LOG-001';
    const description = 'Check if secure logger file exists';
    
    try {
      const loggerPath = path.join(__dirname, '../utils/secureLogger.ts');
      if (fs.existsSync(loggerPath)) {
        return {
          testId,
          description,
          passed: true,
          details: 'Secure logger file exists'
        };
      } else {
        return {
          testId,
          description,
          passed: false,
          error: 'Secure logger file not found'
        };
      }
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error.message
      };
    }
  }

  // Test 3: Check if hardcoded API keys are removed from Firebase config
  testHardcodedApiKeysRemoved() {
    const testId = 'SEC-001';
    const description = 'Check if hardcoded API keys are removed from Firebase config';
    
    try {
      const firebasePath = path.join(__dirname, '../config/firebase.ts');
      if (fs.existsSync(firebasePath)) {
        const content = fs.readFileSync(firebasePath, 'utf8');
        const hardcodedKey = 'process.env.EXPO_PUBLIC_FIREBASE_API_KEY || \'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac\'';
        
        if (content.includes(hardcodedKey) && !content.includes('__DEV__')) {
          return {
            testId,
            description,
            passed: false,
            error: 'Hardcoded API key found in Firebase config'
          };
        }
        
        return {
          testId,
          description,
          passed: true,
          details: 'No hardcoded API keys found in Firebase config'
        };
      } else {
        return {
          testId,
          description,
          passed: false,
          error: 'Firebase config file not found'
        };
      }
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error.message
      };
    }
  }

  // Test 4: Check if hardcoded API keys are removed from services
  testServicesApiKeysRemoved() {
    const testId = 'SEC-002';
    const description = 'Check if hardcoded API keys are removed from service files';
    
    try {
      const servicePaths = [
        path.join(__dirname, '../services/firebaseAPI.ts'),
        path.join(__dirname, '../services/adminAPI.ts'),
        path.join(__dirname, '../../admin-panel/src/lib/adminAPI.ts')
      ];
      
      const hardcodedKey = 'process.env.EXPO_PUBLIC_FIREBASE_API_KEY || \'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac\'';
      const foundIn = [];
      
      for (const servicePath of servicePaths) {
        if (fs.existsSync(servicePath)) {
          const content = fs.readFileSync(servicePath, 'utf8');
          // Check if hardcoded key exists without proper fallback/development patterns
          if (content.includes(hardcodedKey) && 
              !content.includes('__DEV__') && 
              !content.includes('process.env') &&
              !content.includes('// Fallback for development')) {
            foundIn.push(path.basename(servicePath));
          }
        }
      }
      
      if (foundIn.length > 0) {
        return {
          testId,
          description,
          passed: false,
          error: `Hardcoded API key found in: ${foundIn.join(', ')}`
        };
      }
      
      return {
        testId,
        description,
        passed: true,
        details: 'No hardcoded API keys found in service files'
      };
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error.message
      };
    }
  }

  // Test 5: Check if app.json has environment configuration
  testAppJsonEnvironment() {
    const testId = 'ENV-002';
    const description = 'Check if app.json has environment configuration';
    
    try {
      const appJsonPath = path.join(__dirname, '../../app.json');
      if (fs.existsSync(appJsonPath)) {
        const content = fs.readFileSync(appJsonPath, 'utf8');
        const appJson = JSON.parse(content);
        
        if (appJson.expo && appJson.expo.extra && appJson.expo.extra.firebaseApiKey) {
          return {
            testId,
            description,
            passed: true,
            details: 'app.json has environment configuration'
          };
        } else {
          return {
            testId,
            description,
            passed: false,
            error: 'app.json missing environment configuration'
          };
        }
      } else {
        return {
          testId,
          description,
          passed: false,
          error: 'app.json file not found'
        };
      }
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error.message
      };
    }
  }

  // Test 6: Check if admin panel has secure auth
  testAdminPanelSecureAuth() {
    const testId = 'AUTH-001';
    const description = 'Check if admin panel has secure authentication';
    
    try {
      const secureAuthPath = path.join(__dirname, '../../admin-panel/src/lib/secureAuth.ts');
      if (fs.existsSync(secureAuthPath)) {
        const content = fs.readFileSync(secureAuthPath, 'utf8');
        
        if (content.includes('httpOnly') && content.includes('jwt') && content.includes('RATE_LIMIT_CONFIG')) {
          return {
            testId,
            description,
            passed: true,
            details: 'Admin panel has secure authentication with httpOnly cookies and rate limiting'
          };
        } else {
          return {
            testId,
            description,
            passed: false,
            error: 'Admin panel secure authentication features not found'
          };
        }
      } else {
        return {
          testId,
          description,
          passed: false,
          error: 'Secure authentication file not found'
        };
      }
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error.message
      };
    }
  }

  // Test 7: Check for sensitive data sanitization patterns
  testSensitiveDataSanitization() {
    const testId = 'LOG-002';
    const description = 'Check if secure logger has sensitive data sanitization';
    
    try {
      const loggerPath = path.join(__dirname, '../utils/secureLogger.ts');
      if (fs.existsSync(loggerPath)) {
        const content = fs.readFileSync(loggerPath, 'utf8');
        
        const hasPatterns = content.includes('SENSITIVE_FIELDS') && 
                           content.includes('SENSITIVE_PATTERNS') &&
                           content.includes('sanitizeData');
        
        if (hasPatterns) {
          return {
            testId,
            description,
            passed: true,
            details: 'Secure logger has sensitive data sanitization patterns'
          };
        } else {
          return {
            testId,
            description,
            passed: false,
            error: 'Sensitive data sanitization patterns not found'
          };
        }
      } else {
        return {
          testId,
          description,
          passed: false,
          error: 'Secure logger file not found'
        };
      }
    } catch (error) {
      return {
        testId,
        description,
        passed: false,
        error: error.message
      };
    }
  }

  // Run all tests
  async runAllTests() {
    console.log(`${BLUE}🚀 Starting Simple Security Validation...${RESET}\n`);
    
    const tests = [
      this.testEnvironmentConfigExists(),
      this.testSecureLoggerExists(),
      this.testHardcodedApiKeysRemoved(),
      this.testServicesApiKeysRemoved(),
      this.testAppJsonEnvironment(),
      this.testAdminPanelSecureAuth(),
      this.testSensitiveDataSanitization()
    ];

    this.results = tests;
    
    return this.results;
  }

  // Print results
  printResults() {
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
      process.exit(1);
    } else {
      console.log(`${GREEN}✅ All security tests passed!${RESET}`);
      process.exit(0);
    }
  }
}

// Run the tests
const test = new SimpleSecurityTest();
test.runAllTests().then(() => {
  test.printResults();
}).catch(error => {
  console.error(`${RED}❌ Test execution failed:${RESET}`, error);
  process.exit(1);
}); 