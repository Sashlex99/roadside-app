# 📱 Push Notifications Testing Guide

## 🎯 **Testing Strategy без Development Build**

### **Phase 1: Expo Go Testing**

#### 1.1 Local Notifications Testing ✅
```bash
# Стартирай приложението
npx expo start

# В Expo Go:
1. Login като client
2. Settings → Test Notifications
3. Виж notification след 2 секунди
```

#### 1.2 Cloud Functions Logic Testing ✅
```bash
# В приложението:
1. Settings → Test Cloud Logic
2. Виж console output:
   - Distance calculations
   - Driver filtering (15km radius)
   - Mock notification data
```

#### 1.3 Debug Panel Testing ✅
```bash
# В development mode:
1. Settings → Debug Panel
2. Виж push token status
3. Copy token за manual testing
```

### **Phase 2: Firebase Functions Testing**

#### 2.1 Functions Shell Testing
```bash
# Terminal 1: Start functions emulator
firebase functions:shell

# Terminal 2: Test commands
firebase > sendTestNotification({
  pushToken: 'ExponentPushToken[COPY_FROM_DEBUG_PANEL]',
  title: 'Test от Functions',
  body: 'Manual test notification'
})
```

#### 2.2 Production Functions Testing
```bash
# Създай test order в Firestore Console:
{
  "clientId": "test-client-123",
  "description": "Test order за notifications",
  "location": {
    "latitude": 42.6977,
    "longitude": 23.3219
  },
  "status": "pending",
  "createdAt": "2025-06-06T20:00:00Z"
}

# Провери Functions logs:
firebase functions:log
```

### **Phase 3: Real Device Testing**

#### 3.1 Push Token Collection
```typescript
// В Debug Panel, copy push token
// Format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

// Test с curl:
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[YOUR_TOKEN]",
    "title": "Manual Test",
    "body": "Testing push notifications",
    "data": {"type": "test"}
  }'
```

#### 3.2 Multi-Device Testing
```bash
# Device 1: Client (Expo Go)
1. Login като client1@test.com
2. Copy push token от Debug Panel
3. Създай заявка

# Device 2: Driver (Expo Go)  
1. Login като driver1@test.com
2. Set online status
3. Copy push token
4. Add token to Firestore manually

# Test notification flow:
1. Client създава order
2. Check Firebase Functions logs
3. Driver трябва да получи notification
```

### **Phase 4: Firestore Manual Testing**

#### 4.1 Setup Test Users
```javascript
// В Firestore Console, създай test users:

// Collection: users/driver1@test.com
{
  "userType": "driver",
  "isOnline": true,
  "currentLocation": {
    "latitude": 42.700,
    "longitude": 23.320
  },
  "pushToken": "ExponentPushToken[DRIVER_TOKEN]",
  "pushTokenUpdatedAt": "2025-06-06T20:00:00Z"
}

// Collection: users/client1@test.com  
{
  "userType": "client",
  "pushToken": "ExponentPushToken[CLIENT_TOKEN]",
  "pushTokenUpdatedAt": "2025-06-06T20:00:00Z"
}
```

#### 4.2 Test Order Creation
```javascript
// Collection: orders/test-order-123
{
  "clientId": "client1@test.com",
  "description": "Спукана гума на А1",
  "location": {
    "latitude": 42.6977,
    "longitude": 23.3219
  },
  "status": "pending",
  "createdAt": "2025-06-06T20:00:00Z",
  "clientInfo": {
    "name": "Test Client",
    "phone": "+359888123456"
  }
}
```

#### 4.3 Test Bid Creation
```javascript
// Collection: orders/test-order-123/bids/test-bid-123
{
  "driverId": "driver1@test.com",
  "proposedPrice": 120,
  "estimatedArrival": 15,
  "driverInfo": {
    "name": "Test Driver",
    "phone": "+359888654321",
    "rating": 4.8
  },
  "createdAt": "2025-06-06T20:05:00Z"
}
```

## 🔍 **Debug Checklist**

### ✅ **Local Testing (Expo Go)**
- [ ] Local notifications работят
- [ ] Cloud logic simulation работи  
- [ ] Debug panel показва push token
- [ ] Console logging работи правилно

### ✅ **Firebase Functions**
- [ ] Functions са deployed успешно
- [ ] Functions shell testing работи
- [ ] Production functions logs показват activity
- [ ] Error handling работи правилно

### ✅ **Push Token Management**
- [ ] Tokens се генерират в Expo Go
- [ ] Tokens се записват в Firestore
- [ ] Tokens са валидни format
- [ ] Device info се записва правилно

### ✅ **Notification Flow**
- [ ] Order creation trigger работи
- [ ] Distance calculation е точен
- [ ] Driver filtering работи (15km)
- [ ] Batch notifications се изпращат
- [ ] Analytics се записват

## 📊 **Expected Results**

### **Local Notifications**
```
✅ Notification appears after 2 seconds
✅ Title: "🚗 Test Notification"  
✅ Body: "Push notifications are working perfectly!"
✅ Data: {type: 'test', timestamp: ..., source: 'local_test'}
```

### **Cloud Functions Logs**
```
📱 New order created: test-order-123
🔍 Found X online drivers with push tokens
📍 Driver Test Driver: 2.8km away
✅ Would send notification to Test Driver
✅ Sent Y/X notifications for order test-order-123
```

### **Push Token Format**
```
ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
Length: ~50-60 characters
Starts with: ExponentPushToken[
Ends with: ]
```

## 🚀 **Success Criteria**

### **Phase 1 Success** ✅
- Local notifications работят в Expo Go
- Cloud logic simulation показва правилни резултати
- Debug panel показва push token

### **Phase 2 Success** ⏳
- Firebase Functions се задействат при order creation
- Distance calculation филтрира правилно
- Notifications се изпращат към Expo Push API

### **Phase 3 Success** 🎯
- Real devices получават push notifications
- Notification data е правилна
- UI се обновява при notification tap

## 📱 **Next Steps**

1. **Complete Phase 1 testing** в Expo Go
2. **Collect push tokens** от Debug Panel  
3. **Manual testing** с curl/Postman
4. **Firebase Functions validation**
5. **Multi-device testing** setup
6. **Production readiness** verification

**Status: Ready for comprehensive testing без development build dependency!** 