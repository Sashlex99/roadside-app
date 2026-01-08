# SMS Верификация - Настройка за Production

Приложението използва SMS верификация за потвърждаване на телефонни номера. В момента работи в демо режим, но може лесно да се конфигурира за истински SMS provider.

## Демо Режим (текущо)

В демо режим SMS кодовете се:
- Генерират и запазват локално
- Показват в конзолата (за разработчици)
- Валидни са 5 минути
- Не изпращат истински SMS

## Настройка за Production

### 1. SMS.bg Provider

SMS.bg е популярен български SMS provider:

```typescript
// В src/services/smsService.ts, uncomment и конфигурирайте:

const SMS_BG_API_KEY = 'your-api-key-here';
const SMS_BG_USERNAME = 'your-username';

const sendRealSMS = async (phone: string, code: string): Promise<void> => {
  const apiUrl = 'https://api.sms.bg/send';
  const message = `Вашият верификационен код за пътна помощ е: ${code}`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SMS_BG_API_KEY}`
    },
    body: JSON.stringify({
      to: phone,
      message: message,
      from: 'RoadsideApp',
      username: SMS_BG_USERNAME
    })
  });
  
  if (!response.ok) {
    throw new Error('SMS API грешка');
  }
};
```

### 2. VivaKom SMS Gateway

```typescript
const sendVivaKomSMS = async (phone: string, code: string): Promise<void> => {
  // VivaKom API конфигурация
  const apiUrl = 'https://ssl.vivakom.bg/partners/api/sms/send';
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: 'your-username',
      password: 'your-password',
      to: phone,
      message: `Код за верификация: ${code}`,
      from: 'RoadsideApp'
    })
  });
};
```

### 3. Telenor SMS API

```typescript
const sendTelenorSMS = async (phone: string, code: string): Promise<void> => {
  const apiUrl = 'https://api.telenorbusiness.bg/sms/send';
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TELENOR_API_KEY}`
    },
    body: JSON.stringify({
      recipients: [phone],
      message: `Вашият код: ${code}`,
      sender: 'RoadsideApp'
    })
  });
};
```

### 4. Twilio (международен)

```typescript
const sendTwilioSMS = async (phone: string, code: string): Promise<void> => {
  const accountSid = 'your-account-sid';
  const authToken = 'your-auth-token';
  
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`
    },
    body: new URLSearchParams({
      To: phone,
      From: '+1234567890', // Your Twilio number
      Body: `Вашият верификационен код: ${code}`
    })
  });
};
```

## Активиране на Production режим

За да активирате истински SMS:

1. **Регистрирайте се** при SMS provider
2. **Получете API ключовете**
3. **Добавете ключовете** в environment variables:

```bash
# .env file
SMS_PROVIDER=sms.bg
SMS_API_KEY=your-api-key
SMS_USERNAME=your-username
SMS_FROM_NAME=RoadsideApp
```

4. **Обновете** `sendSMSVerificationCode` функцията:

```typescript
export const sendSMSVerificationCode = async (phoneNumber: string): Promise<void> => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const code = generateVerificationCode();
    
    verificationCodes.set(formattedPhone, {
      phone: formattedPhone,
      code,
      timestamp: Date.now(),
    });

    // PRODUCTION: Истинско изпращане
    if (process.env.NODE_ENV === 'production') {
      await sendRealSMS(formattedPhone, code);
    } else {
      // DEMO: Логване в конзолата
      console.log(`SMS код за ${formattedPhone}: ${code}`);
    }
    
  } catch (error) {
    throw new Error('Неуспешно изпращане на SMS');
  }
};
```

## Цени и Ограничения

### SMS.bg
- **Цена**: ~0.06 лв на SMS
- **Ограничения**: Rate limiting
- **Особености**: Български език, добра поддръжка

### VivaKom
- **Цена**: Договорна
- **Ограничения**: Корпоративни клиенти
- **Особености**: Висока надеждност

### Twilio
- **Цена**: ~$0.075 на SMS
- **Ограничения**: Международни тарифи
- **Особености**: Глобално покритие, добро API

## Препоръки

1. **За малки приложения**: SMS.bg
2. **За корпоративни**: VivaKom
3. **За международни**: Twilio
4. **Backup**: Комбинация от 2+ провайдера

## Сигурност

- Запазвайте API ключовете в environment variables
- Използвайте HTTPS
- Ограничете броя заявки per IP/phone
- Логвайте всички SMS опити
- Добавете rate limiting 