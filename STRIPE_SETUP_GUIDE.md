# 💳 STRIPE SETUP GUIDE - ФАЗА А ЗАВЪРШЕНА

## ✅ КАКВО БЕШЕ НАПРАВЕНО

### **1. Environment Setup**
- ✅ Created `stripe.env.example` с placeholder keys
- ✅ Добавени Stripe keys в `app.json` 
- ✅ Configured Firebase Functions за Stripe

### **2. Firebase Functions**
- ✅ Created `functions/src/payments.ts`
- ✅ Installed `stripe` package в functions
- ✅ Exported payment functions in `index.ts`
- ✅ Functions compile successfully

### **3. Frontend Service**
- ✅ Created `src/services/stripeService.ts`
- ✅ Payment calculation helpers
- ✅ Error handling utilities  
- ✅ Amount formatting functions

### **4. Package Dependencies**
- ✅ `stripe` (backend)
- ✅ `@stripe/stripe-react-native` (frontend)
- ✅ `react-native-stripe-sdk` (frontend)

---

## 🚀 СЛЕДВАЩИ СТЪПКИ ЗА АКТИВИРАНЕ

### **Стъпка 1: Stripe Account Setup**

1. **Отворете** https://dashboard.stripe.com/register
2. **Създайте акаунт** със:
   - Business email
   - Company name: "Roadside Assistance BG"
   - Country: Bulgaria
3. **Verify email** и login

### **Стъпка 2: Get API Keys**

1. **Dashboard → Developers → API keys**
2. **Copy Publishable key**: 
   ```
   pk_test_51xxxxxxxxxxxxxxx
   ```
3. **Copy Secret key**:
   ```
   sk_test_51xxxxxxxxxxxxxxx
   ```

### **Стъпка 3: Environment Configuration**

1. **Copy `stripe.env.example` to `.env`**:
   ```bash
   cp stripe.env.example .env
   ```

2. **Replace placeholder values** в `.env`:
   ```bash
   STRIPE_PUBLISHABLE_KEY=pk_test_51_YOUR_REAL_KEY_HERE
   STRIPE_SECRET_KEY=sk_test_51_YOUR_REAL_SECRET_HERE
   ```

3. **Update `app.json`**:
   ```json
   "extra": {
     "stripe": {
       "publishableKey": "pk_test_51_YOUR_REAL_KEY_HERE"
     }
   }
   ```

### **Стъпка 4: Firebase Functions Environment**

1. **Set environment variables**:
   ```bash
   firebase functions:config:set stripe.secret_key="sk_test_51_YOUR_REAL_SECRET"
   firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
   ```

2. **Deploy functions**:
   ```bash
   firebase deploy --only functions
   ```

### **Стъпка 5: Webhook Configuration**

1. **Dashboard → Developers → Webhooks**
2. **Add endpoint**: 
   ```
   https://us-central1-roadside-assistance-app-aa0e8.cloudfunctions.net/handleStripeWebhook
   ```
3. **Events to send**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. **Copy webhook secret** and add to environment

---

## 📊 TECHNICAL OVERVIEW

### **Payment Flow**
```
1. Client accepts bid (50 лв)
2. Calculate: 50 лв + 7.5 лв fee = 57.5 лв total
3. Create Payment Intent (5750 stotinki)
4. Client pays with card via Stripe
5. Webhook confirms payment
6. Order status → 'paid'
7. Driver notification
```

### **Platform Fee Structure**
- **Bid Amount**: Driver's offered price
- **Platform Fee**: 15% от bid amount
- **Total**: Client pays bid + fee
- **Driver Gets**: Full bid amount
- **Platform Keeps**: 15% fee

### **Security Features**
- ✅ User authentication required
- ✅ Order ownership validation
- ✅ Bid existence verification
- ✅ Webhook signature verification
- ✅ Amount validation limits

---

## 🧪 TESTING

### **Test Cards (Development)**
```bash
# Successful payment
4242 4242 4242 4242
Expiry: 12/34, CVC: 123

# Declined card
4000 0000 0000 0002

# Insufficient funds
4000 0000 0000 9995
```

### **Test Payment Flow**
1. **Create test order** в приложението
2. **Driver places bid** (например 50 лв)
3. **Client accepts bid**
4. **Payment screen** shows: 50 лв + 7.5 лв = 57.5 лв
5. **Enter test card** 4242 4242 4242 4242
6. **Payment succeeds** → Order status 'paid'

### **Test Commands**
```bash
# Test payment intent creation
firebase functions:shell
> createPaymentIntent({
    orderId: "test123",
    bidId: "bid456", 
    bidAmount: 50,
    clientId: "client789",
    driverId: "driver101"
  })

# Check Functions logs
firebase functions:log
```

---

## 🔧 FIREBASE FUNCTIONS

### **Created Functions**

#### **`createPaymentIntent`**
- **Purpose**: Creates Stripe Payment Intent
- **Input**: Order + Bid data  
- **Output**: Payment Intent + Client Secret
- **Security**: User auth + ownership validation

#### **`processPayment`**  
- **Purpose**: Confirms successful payment
- **Input**: Payment Intent ID
- **Output**: Payment confirmation
- **Action**: Updates order status to 'paid'

#### **`handleStripeWebhook`**
- **Purpose**: Handles Stripe events
- **Events**: payment_intent.succeeded/failed
- **Security**: Webhook signature verification

### **Functions URLs (After Deploy)**
```
https://us-central1-roadside-assistance-app-aa0e8.cloudfunctions.net/createPaymentIntent
https://us-central1-roadside-assistance-app-aa0e8.cloudfunctions.net/processPayment  
https://us-central1-roadside-assistance-app-aa0e8.cloudfunctions.net/handleStripeWebhook
```

---

## 📱 FRONTEND INTEGRATION

### **Services Created**
- `src/services/stripeService.ts` - Payment API calls
- Helper functions за calculations
- Error handling utilities
- Amount formatting

### **Ready for Phase B**
- Payment Intent creation ✅
- Error handling ✅  
- Amount calculations ✅
- Firebase Functions communication ✅

---

## 💡 PRODUCTION CHECKLIST

### **Before Going Live:**
- [ ] Replace test keys с live keys
- [ ] Configure live webhook endpoint
- [ ] Test real payments с real cards
- [ ] Set up payout schedule
- [ ] Configure business verification
- [ ] Add terms of service
- [ ] Test refund flow

### **Stripe Account Requirements:**
- Business verification
- Bank account for payouts
- Tax information  
- Business address
- Regulatory compliance

---

## 🎯 SUMMARY

**Фаза А е ЗАВЪРШЕНА успешно!** 🎉

### **Готово:**
- ✅ Firebase Functions за payments
- ✅ Stripe integration backend  
- ✅ Frontend payment service
- ✅ Error handling & validation
- ✅ Testing infrastructure
- ✅ Development environment

### **Готово за Фаза Б:**
- 💳 Payment Screen creation
- 🔄 Payment flow integration  
- 🎨 UI components
- 📱 Real device testing

**Time to get real Stripe keys and move to Phase B!** 🚀 