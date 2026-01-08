# 🔍 Beta Testing Debug Guide

## Как да проверим логовете при SMS проблеми

### 📱 **1. Console Logs в Browser**

**Стъпка 1: Стартирай Expo Dev Server**
```bash
cd roadside-assistance
npx expo start --clear
```

**Стъпка 2: Отвори Browser Console**
- Отвори браузъра на адреса който Expo покаже (обикновено `http://localhost:8081`)
- Натисни F12 за да отвориш Developer Tools
- Отиди на таба "Console"

**Стъпка 3: Тестирай SMS**
- Отвори приложението на телефона
- Опитай се да се регистрираш
- Всички логове ще се покажат в browser console-ата

### 🔧 **2. Debug Information**

При опит за изпращане на SMS, ще видиш следните логове:

```
🔍 SMS DEBUG: {
  mode: "beta",
  provider: "twilio", 
  hasApiKey: true,
  fromName: "+12677541135"
}

🎯 DEBUG: Генериран код за +359XXXXXXXXX: 123456

📱 BETA: Изпращам реален SMS код за +359XXXXXXXXX: 123456

🔧 Twilio Debug: Изпращам SMS до +359XXXXXXXXX от +12677541135
```

### ❌ **3. Често срещани грешки**

**Grешка: "Неуспешно изпращане на SMS"**
- Проверете дали виждате error логове в конзолата
- Търсете "❌ Twilio API error details:"

**Twilio API грешки:**
- **401 Unauthorized**: Проблем с API credentials
- **400 Bad Request**: Невалиден номер или други параметри
- **21608**: Trial ограничения (не трябва да се случва вече)

### 🧪 **4. Manual Test Script**

Може да тестваш SMS API директно:

```bash
# Тест на SMS функционалност
node -e "
const { sendSMSVerificationCode } = require('./dist/src/services/smsService.js');
sendSMSVerificationCode('0899076791')
  .then(() => console.log('✅ SMS success'))
  .catch(err => console.error('❌ SMS error:', err));
"
```

### 📊 **5. Twilio Console Logs**

Можеш да провериш и в Twilio Console:
- https://console.twilio.com
- Отиди на "Monitor" → "Logs" → "Programmable SMS"
- Ще видиш всички SMS заявки и техния статус

### 🎯 **6. Debugging Checklist**

- [ ] Expo dev server стартиран
- [ ] Browser console отворен
- [ ] Телефонът е свързан към същата мрежа
- [ ] Приложението е рестартирано
- [ ] Опитай различни номера
- [ ] Провери Twilio Console за статус на SMS-ите

### 💡 **7. Quick Fixes**

**Ако SMS кодът не идва:**
1. Провери конзолата за грешки
2. Опитай друг номер
3. Провери Twilio Console за failed messages
4. Рестартирай приложението

**За debug на production APK:**
- Използвай `adb logcat` за Android логове
- Или стартирай Expo dev server и свърж телефона

### 📞 **8. Test Numbers**

Тествани номера:
- `0899076791` - работи ✅
- `0895169319` - работи ✅

### 🆘 **9. Emergency Debugging**

Ако нищо не работи, промени mode от 'beta' на 'demo':

```typescript
// В src/services/smsService.ts
const SMS_CONFIG = {
  mode: 'demo', // Променено временно за debug
  // ...
}
```

В demo режим кодът ще се покаже в конзолата вместо да се изпраща SMS. 