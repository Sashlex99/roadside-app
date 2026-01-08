#!/usr/bin/env node

/**
 * Environment Setup Script
 * This script helps configure secure environment variables and removes hardcoded API keys
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up secure environment configuration...');

// Files that contain hardcoded API keys that need to be updated
const filesToUpdate = [
  'test-admin-api.js',
  'simple-payment-test.js',
  'scripts/debug-driver-orders.js',
  'scripts/cleanup-expired-orders.js',
  'src/tests/security-validation.ts',
  'src/tests/simple-security-test.js'
];

// Environment variables template
const envTemplate = `# ========================================
#  SECURE ENVIRONMENT CONFIGURATION
# ========================================
# CRITICAL: This file should NEVER be committed to version control!

# ========================================
#  CLIENT-SIDE VARIABLES (Safe to expose)
# ========================================
# These variables are bundled into the client-side JavaScript
# Only put PUBLIC keys here that are meant to be seen by users

# Firebase Configuration (CLIENT-SIDE)
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac
EXPO_PUBLIC_FIREBASE_PROJECT_ID=roadside-assistance-app-aa0e8
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=roadside-assistance-app-aa0e8.firebaseapp.com
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=roadside-assistance-app-aa0e8.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=98397269310
EXPO_PUBLIC_FIREBASE_APP_ID=1:98397269310:web:c965f2361fd25ff328906f

# Stripe Configuration (CLIENT-SIDE)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51RYV6yD5cVwtJYS3QY2xcH1MgOWrT6hcQ3JHAOku2iYcuNe9235MCrwqvVDJ6Qri2gTzB94zNl9nUQ9mPgtgEOaJ0056EOSibN

# SMS Configuration (CLIENT-SIDE)
EXPO_PUBLIC_SMS_PROVIDER=sms.bg
EXPO_PUBLIC_SMS_MODE=demo

# ========================================
#  SERVER-SIDE VARIABLES (NEVER expose to client)
# ========================================
# These variables are only available on the server (Firebase Functions)
# NEVER use EXPO_PUBLIC_ or NEXT_PUBLIC_ prefix for these!

# Stripe Configuration (SERVER-SIDE ONLY)
STRIPE_SECRET_KEY=sk_test_51RYV6yD5cVwtJYS3QY2xcH1MgOWrT6hcQ3JHAOku2iYcuNe9235MCrwqvVDJ6Qri2gTzB94zNl9nUQ9mPgtgEOaJ0056EOSibN
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# SMS Configuration (SERVER-SIDE ONLY)
SMS_API_KEY=YOUR_SMS_API_KEY_HERE
SMS_USERNAME=YOUR_SMS_USERNAME_HERE
SMS_BACKUP_API_KEY=YOUR_BACKUP_SMS_API_KEY_HERE

# ========================================
#  NEXT.JS ADMIN PANEL VARIABLES
# ========================================
# For the admin panel only (separate from mobile app)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac
NEXT_PUBLIC_FIREBASE_PROJECT_ID=roadside-assistance-app-aa0e8

# Session Configuration (SERVER-SIDE ONLY)
SESSION_SECRET=your-super-secret-session-key-here-change-this-in-production

# ========================================
#  ENVIRONMENT SETTINGS
# ========================================
NODE_ENV=development
APP_ENV=development
PROJECT_ENV=dev
`;

// Function to update a file with environment variable usage
function updateFileWithEnvVars(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace hardcoded Firebase API key
    const oldKey = 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac';
    const newKey = "process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac'";
    
    if (content.includes(oldKey)) {
      content = content.replace(new RegExp(oldKey, 'g'), newKey);
      
      // Add environment variable import at the top if it's a JS file
      if (filePath.endsWith('.js') && !content.includes('require(') && !content.includes('dotenv')) {
        content = `require('dotenv').config();\n\n${content}`;
      }
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated ${filePath} to use environment variables`);
    } else {
      console.log(`✅ ${filePath} already uses environment variables`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
}

// Main setup function
function setupEnvironment() {
  console.log('\n📋 Step 1: Creating secure .env file...');
  
  // Create .env file if it doesn't exist
  const envPath = '.env';
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, envTemplate);
    console.log('✅ Created .env file with secure configuration');
  } else {
    console.log('✅ .env file already exists');
  }
  
  console.log('\n📋 Step 2: Updating test files to use environment variables...');
  
  // Update files to use environment variables
  filesToUpdate.forEach(updateFileWithEnvVars);
  
  console.log('\n📋 Step 3: Creating admin panel .env file...');
  
  // Create admin panel .env file
  const adminEnvPath = 'admin-panel/.env.local';
  const adminEnvContent = `# Admin Panel Environment Variables
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac
NEXT_PUBLIC_FIREBASE_PROJECT_ID=roadside-assistance-app-aa0e8
SESSION_SECRET=your-super-secret-session-key-here-change-this-in-production
`;
  
  if (!fs.existsSync(adminEnvPath)) {
    fs.writeFileSync(adminEnvPath, adminEnvContent);
    console.log('✅ Created admin-panel/.env.local file');
  } else {
    console.log('✅ admin-panel/.env.local already exists');
  }
  
  console.log('\n🎉 Environment setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Review the .env file and update any placeholder values');
  console.log('2. Get your real SMS API key from https://sms.bg');
  console.log('3. Set up your Stripe webhook secret');
  console.log('4. Test the app to ensure everything works');
  console.log('5. For production: rotate all API keys and use secure deployment');
  
  console.log('\n🔒 Security reminders:');
  console.log('- Never commit .env files to version control');
  console.log('- Use different API keys for development and production');
  console.log('- Rotate API keys regularly');
  console.log('- Monitor API key usage in your provider dashboards');
}

// Run the setup
setupEnvironment(); 