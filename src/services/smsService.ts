// SMS Верификация със SMS Gateway
// За демо цели използваме симулация. За production ще трябва
// да се интегрира с истински SMS provider като SMS.bg, VivaKom, и др.

import { smsConfig } from '../config/environment';

// Configuration for different environments
const SMS_CONFIG = {
  // Environment mode: 'demo', 'beta', 'production'
  mode: smsConfig.mode,
  
  // SMS Provider settings
  provider: smsConfig.provider,
  apiKey: smsConfig.apiKey,
  username: smsConfig.username,
  fromName: process.env.SMS_FROM_NAME || 'PutnaPomosht',
  
  // Rate limiting
  maxSMSPerHour: parseInt(process.env.SMS_MAX_PER_HOUR || '10'),
  maxSMSPerDay: parseInt(process.env.SMS_MAX_PER_DAY || '50'),
};

interface VerificationData {
  phone: string;
  code: string;
  timestamp: number;
}

// Временно хранилище за кодове (в production използвайте Firebase/Database)
const verificationCodes: Map<string, VerificationData> = new Map();

// Генериране на 6-цифрен код
const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Изпращане на SMS код
export const sendSMSVerificationCode = async (phoneNumber: string): Promise<void> => {
  try {
    // Форматиране на телефонния номер
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const code = generateVerificationCode();
    
    // Запазване на кода с timestamp (валиден 5 минути)
    verificationCodes.set(formattedPhone, {
      phone: formattedPhone,
      code,
      timestamp: Date.now(),
    });

    // Environment-based SMS sending
    switch (SMS_CONFIG.mode) {
      case 'demo':
        // ДЕМО РЕЖИМ: За тестване просто логваме кода
        console.log(`📱 SMS код за ${formattedPhone}: ${code}`);
        console.log(`ℹ️  Режим: DEMO - SMS не се изпраща реално`);
        break;
        
      case 'beta':
        // BETA РЕЖИМ: Изпращаме реален SMS + логваме за debug
        console.log(`📱 BETA: Изпращам реален SMS код за ${formattedPhone}: ${code}`);
        await sendRealSMS(formattedPhone, code);
        break;
        
      case 'production':
        // PRODUCTION РЕЖИМ: Само реален SMS, никакво логване на кода
        console.log(`📱 Изпращам SMS код за ${formattedPhone}`);
        await sendRealSMS(formattedPhone, code);
        break;
        
      default:
        throw new Error(`Невалиден SMS режим: ${SMS_CONFIG.mode}`);
    }
    
    // Симулация на изпращане за demo режим
    if (SMS_CONFIG.mode === 'demo') {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('Грешка при изпращане на SMS:', error);
    throw new Error('Неуспешно изпращане на SMS');
  }
};

// Верификация на кода
export const verifySMSCode = async (phoneNumber: string, code: string): Promise<boolean> => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const verification = verificationCodes.get(formattedPhone);
    
    if (!verification) {
      throw new Error('Няма изпратен код за този номер');
    }
    
    // Проверка дали кодът не е изтекъл (5 минути)
    const isExpired = Date.now() - verification.timestamp > 5 * 60 * 1000;
    if (isExpired) {
      verificationCodes.delete(formattedPhone);
      throw new Error('Кодът е изтекъл');
    }
    
    // Проверка на кода
    if (verification.code !== code) {
      throw new Error('Невалиден код');
    }
    
    // Успешна верификация - премахваме кода
    verificationCodes.delete(formattedPhone);
    return true;
    
  } catch (error) {
    console.error('Грешка при верификация:', error);
    throw error;
  }
};

// ЗА PRODUCTION: Истинско изпращане на SMS
const sendRealSMS = async (phone: string, code: string): Promise<void> => {
  const message = `Вашият верификационен код за пътна помощ е: ${code}`;
  
  try {
    switch (SMS_CONFIG.provider) {
      case 'sms.bg':
        await sendSMSBgAPI(phone, message);
        break;
        
      case 'vivakom':
        await sendVivaKomAPI(phone, message);
        break;
        
      case 'twilio':
        await sendTwilioAPI(phone, message);
        break;
        
      default:
        throw new Error(`Неподдържан SMS провайдер: ${SMS_CONFIG.provider}`);
    }
    
    console.log(`✅ SMS изпратен успешно до ${phone} чрез ${SMS_CONFIG.provider}`);
    
  } catch (error) {
    console.error(`❌ Грешка при изпращане на SMS чрез ${SMS_CONFIG.provider}:`, error);
    throw new Error('SMS API грешка');
  }
};

// SMS.bg API Implementation
const sendSMSBgAPI = async (phone: string, message: string): Promise<void> => {
  if (!SMS_CONFIG.apiKey) {
    throw new Error('SMS.bg API ключ не е конфигуриран');
  }
  
  const apiUrl = 'https://api.sms.bg/send';
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SMS_CONFIG.apiKey}`
    },
    body: JSON.stringify({
      to: phone,
      message: message,
      from: SMS_CONFIG.fromName,
      username: SMS_CONFIG.username
    })
  });
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`SMS.bg API грешка: ${response.status} - ${errorData}`);
  }
};

// VivaKom API Implementation
const sendVivaKomAPI = async (phone: string, message: string): Promise<void> => {
  if (!SMS_CONFIG.username || !SMS_CONFIG.apiKey) {
    throw new Error('VivaKom credentials не са конфигурирани');
  }
  
  const apiUrl = 'https://ssl.vivakom.bg/partners/api/sms/send';
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: SMS_CONFIG.username,
      password: SMS_CONFIG.apiKey, // Password field in VivaKom
      to: phone,
      message: message,
      from: SMS_CONFIG.fromName
    })
  });
  
  if (!response.ok) {
    throw new Error(`VivaKom API грешка: ${response.status}`);
  }
};

// Twilio API Implementation
const sendTwilioAPI = async (phone: string, message: string): Promise<void> => {
  if (!SMS_CONFIG.username || !SMS_CONFIG.apiKey) {
    throw new Error('Twilio credentials не са конфигурирани');
  }
  
  const accountSid = SMS_CONFIG.username;
  const authToken = SMS_CONFIG.apiKey;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '+1234567890';
  
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`
    },
    body: new URLSearchParams({
      To: phone,
      From: twilioPhone,
      Body: message
    })
  });
  
  if (!response.ok) {
    throw new Error(`Twilio API грешка: ${response.status}`);
  }
};

// Форматиране на телефонния номер за България
const formatPhoneNumber = (phone: string): string => {
  // Премахваме всички нецифрови символи
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Ако започва с 0, заменяме с +359
  if (cleanPhone.startsWith('0')) {
    return '+359' + cleanPhone.substring(1);
  }
  
  // Ако вече има +359, връщаме както е
  if (phone.startsWith('+359')) {
    return phone;
  }
  
  // Ако започва с 359, добавяме +
  if (cleanPhone.startsWith('359')) {
    return '+' + cleanPhone;
  }
  
  // По подразбиране добавяме +359
  return '+359' + cleanPhone;
}; 