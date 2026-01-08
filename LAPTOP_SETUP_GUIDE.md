# 💻 **LAPTOP SETUP GUIDE - 20-Day Travel Setup**

## 🚀 **Quick Start (5-10 minutes total)**

### **Step 1: Install Essential Software (2 minutes)**

#### **Required Downloads:**
```bash
# 1. Node.js (18+) - Download installer
https://nodejs.org/

# 2. Git - Download installer  
https://git-scm.com/downloads

# 3. VS Code (Optional but recommended)
https://code.visualstudio.com/

# 4. Firebase CLI (after Node.js installed)
npm install -g firebase-tools
```

### **Step 2: Clone Repository (1 minute)**

```bash
# Create working directory
mkdir C:\dev
cd C:\dev

# Clone repository (use updated URL)
git clone https://github.com/Sashlex99/roadside-assistance.git
cd roadside-assistance

# Switch to working branch
git checkout stable-fixed
```

### **Step 3: Install Dependencies (2 minutes)**

```bash
# Install main project dependencies
npm install

# Install Functions dependencies  
cd functions
npm install
cd ..
```

### **Step 4: Environment Setup (3 minutes)**

#### **Create Environment Files:**

Create `.env` file in project root:
```env
# Firebase Config
FIREBASE_API_KEY=your_firebase_api_key_here
FIREBASE_AUTH_DOMAIN=roadside-assistance-app-aa0e8.firebaseapp.com
FIREBASE_PROJECT_ID=roadside-assistance-app-aa0e8
FIREBASE_STORAGE_BUCKET=roadside-assistance-app-aa0e8.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
FIREBASE_APP_ID=your_app_id_here

# Stripe Keys (Use test keys for development)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# SMS Service (Optional for basic testing)
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_number_here

# Development Settings
NODE_ENV=development
DRIVER_LOCKING_ENABLED=true
```

Create `stripe.env.example`:
```env
# Stripe Test Keys - Replace with your actual test keys
STRIPE_PUBLISHABLE_KEY=pk_test_51234567890
STRIPE_SECRET_KEY=sk_test_51234567890
STRIPE_WEBHOOK_SECRET=whsec_1234567890
```

Create `sms.env.example`:
```env
# SMS Configuration - Replace with your actual Twilio credentials
TWILIO_ACCOUNT_SID=AC1234567890
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### **Step 5: Firebase Authentication (1 minute)**

```bash
# Login to Firebase
firebase login

# Set project
firebase use roadside-assistance-app-aa0e8
```

### **Step 6: Start Development (30 seconds)**

```bash
# Start the development server
npm start

# In another terminal, start Firebase emulators (optional)
firebase emulators:start
```

---

## 🛠️ **Troubleshooting Common Issues**

### **Issue 1: Git Push Blocked (Secret Scanning)**

If you encounter secret scanning blocks when pushing:

#### **Quick Solution - Bypass Protection:**
1. Go to: https://github.com/Sashlex99/roadside-assistance/settings/security_analysis
2. Enable "Secret Scanning" 
3. Use the provided URLs in the error message to allowlist the secrets
4. Or create new environment variables and remove hardcoded secrets

#### **Alternative - Force Push to New Branch:**
```bash
git checkout -b laptop-working-branch
git push origin laptop-working-branch --force
```

### **Issue 2: Firebase Functions Deployment**

```bash
# If functions fail to deploy
cd functions
npm run build
firebase deploy --only functions
```

### **Issue 3: Environment Variables Missing**

```bash
# Copy from your current PC before traveling
# Or set up new test keys on laptop
```

### **Issue 4: Placeholder Text Not Visible**

If input field placeholders are invisible:

```bash
# ✅ ALREADY FIXED in latest code
# Check LAPTOP_PLACEHOLDER_FIX.md for details

# Emergency fix if still not visible:
# Update src/constants/colors.ts
placeholder: '#333333'  // Darker color for maximum visibility
```

---

## 📋 **Pre-Travel Checklist**

### **✅ Before You Leave:**

1. **Backup Current Environment Files:**
   ```bash
   # Copy these files to a secure location (USB/cloud)
   .env
   stripe.env.example
   sms.env.example
   google-services.json
   ```

2. **Document API Keys:**
   - Firebase project settings
   - Stripe dashboard test keys
   - Twilio credentials (if used)

3. **Push Working Code:**
   ```bash
   # Option A: Fix secrets and push
   git push origin stable-fixed
   
   # Option B: Create clean branch
   git checkout -b travel-branch
   # Remove sensitive files from git tracking
   git rm --cached .env stripe.env.example sms.env.example
   git commit -m "Remove sensitive files for travel"
   git push origin travel-branch
   ```

4. **Test Remote Access:**
   - Verify GitHub repository access
   - Test Firebase project access
   - Confirm Stripe dashboard access

---

## 🚀 **Laptop Quick Commands Reference**

### **Daily Workflow:**
```bash
# Start development
cd C:\dev\roadside-assistance
npm start

# Check git status
git status
git pull origin stable-fixed

# Run tests
npm test

# Deploy functions (if needed)
cd functions && firebase deploy --only functions

# Check Firebase console
https://console.firebase.google.com/project/roadside-assistance-app-aa0e8
```

### **Emergency Commands:**
```bash
# Reset to working state
git checkout stable-fixed
git pull origin stable-fixed
npm install

# Check Firebase connection
firebase projects:list

# Verify app status
npm run build
```

---

## 🎯 **Current Implementation Status**

### **✅ What's Working:**
- Race condition fixes (100% complete)
- Driver locking system (100% complete)  
- Automatic cleanup (100% complete)
- Smart conflict resolution
- Bid restoration after payment cancellation
- Firebase Functions scheduled cleanup

### **📊 Development Priorities for Travel:**
1. **Phase 5: Monitoring & Observability** (0% complete)
2. **Phase 6: Load Testing** (10% complete)
3. **Phase 4: Advanced Failure Recovery** (60% complete)
4. **Phase 7: Production Deployment** (30% complete)

### **🎭 Key Files for Development:**
- `src/services/firestore/bids.ts` - Core bid logic
- `src/services/firestore/driverLocks.ts` - Locking system
- `functions/src/cleanupDriverLocks.ts` - Cleanup functions
- `99%productionready.md` - Implementation roadmap

---

## 🔒 **Security Notes**

1. **Never commit real API keys** - Use test keys only
2. **Use environment variables** for all sensitive data
3. **Keep `.env` files local** - Don't commit to git
4. **Use Firebase test project** for development
5. **Rotate keys periodically** for security

---

## 📞 **Emergency Contacts**

- **Firebase Console:** https://console.firebase.google.com/project/roadside-assistance-app-aa0e8
- **GitHub Repository:** https://github.com/Sashlex99/roadside-assistance
- **Stripe Dashboard:** https://dashboard.stripe.com/test
- **Documentation:** Check `99%productionready.md` for implementation details

---

## ⚡ **Super Quick Setup (If Everything Fails)**

```bash
# Emergency 3-minute setup
git clone https://github.com/Sashlex99/roadside-assistance.git
cd roadside-assistance
npm install
# Create minimal .env with Firebase config
npm start
```

**Happy coding on your travels! 🌍✈️** 