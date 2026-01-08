# 🚨 Code Quality Issues & Action Plan

**Дата:** December 2024  
**Статус:** Pending Implementation  
**Общ брой проблеми:** 15  

## 📊 Обобщение по критичност

- 🔴 **Високо критични:** 4 проблема (Security, Race Conditions, Payment Safety)
- 🟡 **Средно критични:** 6 проблема (Performance, Memory, Battery)  
- 🟢 **Ниско критични:** 5 проблема (Optimizations, Error Handling)

---

## 🔴 ВИСОКО КРИТИЧНИ ПРОБЛЕМИ

### **Проблем #1: Потенциален Race Condition при приемане на Bids**

**Критичност:** 🔴 HIGH  
**Засегнати файлове:** `src/services/firestore.ts`  
**Риск:** Множество clients могат да приемат различни bids за същия order едновременно

#### TODO List - Детайлни стъпки:

- [ ] **Стъпка 1: Анализирай текущия код**
  - [ ] 1.1. Отвори `src/services/firestore.ts`
  - [ ] 1.2. Намери функцията `acceptBid` (около ред 610)
  - [ ] 1.3. Проучи как се използва `writeBatch` в момента
  - [ ] 1.4. Документирай текущия flow в коментар

- [ ] **Стъпка 2: Създай backup на текущия код**
  - [ ] 2.1. Копирай `acceptBid` функцията в нов файл `acceptBid.backup.ts`
  - [ ] 2.2. Добави дата и reason за backup-а в коментар

- [ ] **Стъпка 3: Имплементирай atomic transaction**
  - [ ] 3.1. Импортирай `runTransaction` от Firebase
    ```javascript
    import { runTransaction } from 'firebase/firestore';
    ```
  - [ ] 3.2. Замени `writeBatch` логиката с `runTransaction`
  - [ ] 3.3. Добави проверка в transaction-а че order статуса е 'bidding'
    ```javascript
    const acceptBid = async (orderId: string, bidId: string): Promise<void> => {
      await runTransaction(db, async (transaction) => {
        // Чети order в transaction
        const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
        const orderSnap = await transaction.get(orderRef);
        
        // Провери дали order е все още в bidding статус
        if (orderSnap.data()?.status !== 'bidding') {
          throw new Error('Order is no longer available for bidding');
        }
        
        // Продължи с останалата логика...
      });
    };
    ```

- [ ] **Стъпка 4: Обнови UI за handling на грешки**
  - [ ] 4.1. Отвори `src/hooks/client/useClientPayments.ts`
  - [ ] 4.2. Намери `confirmAcceptBid` функцията (около ред 259)
  - [ ] 4.3. Добави specific error handling за race condition
    ```javascript
    try {
      await acceptBid(activeOrder.id, bidId);
    } catch (error) {
      if (error.message.includes('no longer available')) {
        setCustomModal({
          title: 'Офертата вече е приета',
          message: 'Друг клиент е приел тази оферта преди вас. Моля изберете друга.',
          // ...
        });
        return;
      }
      // Handle other errors...
    }
    ```

- [ ] **Стъпка 5: Тестване**
  - [ ] 5.1. Създай test script за симулиране на concurrent bids
  - [ ] 5.2. Тествай с два browsers/devices едновременно
  - [ ] 5.3. Потвърди че само един bid може да бъде приет
  - [ ] 5.4. Тествай error messages в UI

- [ ] **Стъпка 6: Документация**
  - [ ] 6.1. Обнови коментарите в `acceptBid` функцията
  - [ ] 6.2. Добави в README security considerations секция
  - [ ] 6.3. Създай changelog entry

---

### **Проблем #2: Potential Double Payment Protection**

**Критичност:** 🔴 HIGH  
**Засегнати файлове:** `src/hooks/client/useClientPayments.ts`  
**Риск:** Потребител може да направи multiple payments за същия order

#### TODO List - Детайлни стъпки:

- [ ] **Стъпка 1: Анализ на текущия payment flow**
  - [ ] 1.1. Отвори `src/hooks/client/useClientPayments.ts`
  - [ ] 1.2. Намери `handlePaymentPress` функцията (около ред 381)
  - [ ] 1.3. Проследи всички места където се извиква
  - [ ] 1.4. Документирай current payment states

- [ ] **Стъпка 2: Добави payment cooldown protection**
  - [ ] 2.1. Добави нов state за tracking на последния payment attempt
    ```javascript
    const [lastPaymentAttempt, setLastPaymentAttempt] = useState(0);
    const [paymentCooldown, setPaymentCooldown] = useState(false);
    ```
  - [ ] 2.2. Имплементирай cooldown логика
    ```javascript
    const handlePaymentPress = async () => {
      const now = Date.now();
      const cooldownPeriod = 3000; // 3 секунди
      
      if (paymentCooldown || (now - lastPaymentAttempt < cooldownPeriod)) {
        console.log('Payment in cooldown, ignoring click');
        return;
      }
      
      setLastPaymentAttempt(now);
      setPaymentCooldown(true);
      
      try {
        // existing payment logic...
      } finally {
        setTimeout(() => setPaymentCooldown(false), cooldownPeriod);
      }
    };
    ```

- [ ] **Стъпка 3: Добави server-side validation**
  - [ ] 3.1. Отвори `functions/src/customPayments.ts`
  - [ ] 3.2. Намери `createPaymentLinkHTTP` функцията
  - [ ] 3.3. Добави проверка за existing pending payments
    ```javascript
    // Провери дали има активен payment за този order
    const existingPayments = await admin.firestore()
      .collection('paymentLinks')
      .where('orderId', '==', orderId)
      .where('status', 'in', ['created', 'pending'])
      .get();
    
    if (!existingPayments.empty) {
      throw new Error('Payment already in progress for this order');
    }
    ```

- [ ] **Стъпка 4: Добави visual feedback**
  - [ ] 4.1. Отвори `src/components/client/modals/PaymentModal/index.tsx`
  - [ ] 4.2. Добави disabled state when payment is in progress
  - [ ] 4.3. Добави loading indicator и countdown
    ```javascript
    <TouchableOpacity
      style={[
        styles.payButton,
        (paymentInProgress || paymentCooldown) && styles.payButtonDisabled
      ]}
      disabled={paymentInProgress || paymentCooldown}
      onPress={handlePaymentPress}
    >
      {paymentCooldown ? (
        <Text>Моля изчакайте ({cooldownSeconds}s)</Text>
      ) : (
        <Text>Плати сега</Text>
      )}
    </TouchableOpacity>
    ```

- [ ] **Стъпка 5: Тестване**
  - [ ] 5.1. Тествай rapid clicking на payment button
  - [ ] 5.2. Тествай network delays
  - [ ] 5.3. Тествай browser refresh по време на payment
  - [ ] 5.4. Валидирай че се създава само един payment link

---

### **Проблем #3: Sensitive Data Exposure в Logs**

**Критичност:** 🔴 HIGH  
**Засегнати файлове:** Multiple files  
**Риск:** Emails, user data, API keys могат да leak в production logs

#### TODO List - Детайлни стъпки:

- [ ] **Стъпка 1: Audit на всички console.log statements**
  - [ ] 1.1. Използвай find/replace за намиране на всички `console.log` в проекта
  - [ ] 1.2. Създай файл `CONSOLE_LOG_AUDIT.md` с всички намерени instances
  - [ ] 1.3. Категоризирай ги по риск: HIGH (sensitive data), MEDIUM (PII), LOW (safe)

- [ ] **Стъпка 2: Създай secure logging utility**
  - [ ] 2.1. Създай нов файл `src/utils/secureLogger.ts`
    ```javascript
    class SecureLogger {
      private static isProduction = !__DEV__;
      
      static debug(message: string, data?: any) {
        if (!this.isProduction) {
          console.log(`[DEBUG] ${message}`, this.sanitizeData(data));
        }
      }
      
      static info(message: string, data?: any) {
        console.log(`[INFO] ${message}`, this.sanitizeData(data));
      }
      
      static error(message: string, error?: any) {
        console.error(`[ERROR] ${message}`, this.sanitizeError(error));
      }
      
      private static sanitizeData(data: any): any {
        if (!data) return data;
        
        const sensitiveFields = ['email', 'phone', 'password', 'token', 'apiKey'];
        const sanitized = { ...data };
        
        sensitiveFields.forEach(field => {
          if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
          }
        });
        
        return sanitized;
      }
      
      private static sanitizeError(error: any): any {
        // Remove stack traces in production
        if (this.isProduction && error?.stack) {
          return { message: error.message, name: error.name };
        }
        return error;
      }
    }
    
    export { SecureLogger };
    ```

- [ ] **Стъпка 3: Замени опасни console.log statements**
  - [ ] 3.1. Отвори `src/contexts/AuthContext.tsx`
  - [ ] 3.2. Намери и замени:
    ```javascript
    // ПРЕДИ:
    console.log('MainNavigator - User:', user);
    
    // СЛЕД:
    SecureLogger.debug('User authenticated', { 
      uid: user.uid, 
      userType: user.userType 
    });
    ```
  - [ ] 3.3. Повтори за всички high-risk logging statements

- [ ] **Стъпка 4: Премахни hardcoded API keys**
  - [ ] 4.1. Отвори `src/services/firebaseAPI.ts`
  - [ ] 4.2. Замени hardcoded API key:
    ```javascript
    // ПРЕДИ:
    const API_KEY = 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac';
    
    // СЛЕД:
    import Constants from 'expo-constants';
    const API_KEY = Constants.expoConfig?.extra?.firebaseApiKey || 
                    process.env.FIREBASE_API_KEY ||
                    'fallback-key-for-dev';
    ```
  - [ ] 4.3. Обнови `app.json` да включва API key като environment variable

- [ ] **Стъпка 5: Настрой production logging**
  - [ ] 5.1. Инсталирай logging библиотека за production
    ```bash
    npm install @react-native-async-storage/async-storage
    ```
  - [ ] 5.2. Създай production log collector в `secureLogger.ts`
  - [ ] 5.3. Имплементирай log rotation и cleanup

- [ ] **Стъпка 6: Тестване и валидация**
  - [ ] 6.1. Тествай в development mode - всички logs видими
  - [ ] 6.2. Тествай в production build - sensitive data скрити
  - [ ] 6.3. Валидирай че API keys не са видими в bundle

---

### **Проблем #4: Admin Panel Security - localStorage vulnerability**

**Критичност:** 🔴 HIGH  
**Засегнати файлове:** `admin-panel/` directory  
**Риск:** XSS атаки могат да откраднат admin токени от localStorage

#### TODO List - Детайлни стъпки:

- [ ] **Стъпка 1: Анализ на текущия session management**
  - [ ] 1.1. Отвори `admin-panel/src/lib/adminAPI.ts`
  - [ ] 1.2. Намери къде се съхранява admin token
  - [ ] 1.3. Проследи как се използва в requests
  - [ ] 1.4. Документирай current security model

- [ ] **Стъпка 2: Имплементирай HttpOnly cookies**
  - [ ] 2.1. Инсталирай cookie handling библиотека
    ```bash
    cd admin-panel
    npm install js-cookie
    npm install @types/js-cookie --save-dev
    ```
  - [ ] 2.2. Създай server-side authentication endpoint
  - [ ] 2.3. Обнови login процеса да set HttpOnly cookie вместо localStorage

- [ ] **Стъпка 3: Обнови client-side authentication**
  - [ ] 3.1. Създай нов файл `admin-panel/src/lib/authManager.ts`
    ```javascript
    class AuthManager {
      static async login(email: string, password: string) {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include' // За cookies
        });
        
        if (!response.ok) {
          throw new Error('Login failed');
        }
        
        // Не съхраняваме token в localStorage
        return response.json();
      }
      
      static async logout() {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });
      }
      
      static async checkAuth() {
        const response = await fetch('/api/auth/verify', {
          credentials: 'include'
        });
        return response.ok;
      }
    }
    ```

- [ ] **Стъпка 4: Добави CSRF protection**
  - [ ] 4.1. Инсталирай CSRF middleware
  - [ ] 4.2. Генерирай CSRF tokens за form submissions
  - [ ] 4.3. Валидирай CSRF tokens на server-side

- [ ] **Стъпка 5: Обнови всички API calls**
  - [ ] 5.1. Премахни localStorage references от `adminAPI.ts`
  - [ ] 5.2. Обнови fetch calls да използват credentials: 'include'
  - [ ] 5.3. Добави automatic token refresh mechanism

- [ ] **Стъпка 6: Тестване на сигурността**
  - [ ] 6.1. Тествай XSS protection с malicious scripts
  - [ ] 6.2. Тествай CSRF protection с external forms
  - [ ] 6.3. Валидирай че tokens не са accessible от JavaScript

---

## 🟡 СРЕДНО КРИТИЧНИ ПРОБЛЕМИ

### **Проблем #5: Base64 Memory Explosion в Admin Panel**

**Критичност:** 🟡 MEDIUM  
**Засегнати файлове:** `admin-panel/src/app/dashboard/page.tsx`  
**Риск:** Loading много drivers наведнъж може да crash браузъра

#### TODO List - Детайлни стъпки:

- [ ] **Стъпка 1: Измери текущата memory consumption**
  - [ ] 1.1. Отвори Chrome DevTools в admin panel
  - [ ] 1.2. Go to Memory tab и направи heap snapshot
  - [ ] 1.3. Заеди 20+ drivers и измери memory увеличението
  - [ ] 1.4. Документирай baseline memory usage

- [ ] **Стъпка 2: Имплементирай lazy image loading**
  - [ ] 2.1. Създай нов component `LazyImage.tsx`
    ```javascript
    interface LazyImageProps {
      driverId: string;
      imageType: 'roadsideAssistanceCert' | 'iaalaLicense' | 'driverPhoto';
      alt: string;
      className?: string;
    }
    
    export default function LazyImage({ driverId, imageType, alt, className }: LazyImageProps) {
      const [imageData, setImageData] = useState<string | null>(null);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState(false);
      
      const loadImage = useCallback(async () => {
        if (imageData || loading) return;
        
        setLoading(true);
        try {
          // Fetch image data only when needed
          const data = await adminAPI.getDriverImage(driverId, imageType);
          setImageData(data);
        } catch (err) {
          setError(true);
        } finally {
          setLoading(false);
        }
      }, [driverId, imageType, imageData, loading]);
      
      return (
        <div className={className}>
          {!imageData && !loading && (
            <button onClick={loadImage} className="load-image-btn">
              Покажи {alt}
            </button>
          )}
          {loading && <div>Loading...</div>}
          {imageData && <img src={imageData} alt={alt} />}
          {error && <div>Грешка при зареждане</div>}
        </div>
      );
    }
    ```

- [ ] **Стъпка 3: Добави image caching с size limits**
  - [ ] 3.1. Създай `ImageCache` class
    ```javascript
    class ImageCache {
      private cache = new Map<string, string>();
      private maxSize = 50; // Max 50 images в cache
      private accessOrder = new Set<string>(); // LRU tracking
      
      set(key: string, value: string) {
        if (this.cache.size >= this.maxSize) {
          // Remove least recently used
          const lru = this.accessOrder.values().next().value;
          this.cache.delete(lru);
          this.accessOrder.delete(lru);
        }
        
        this.cache.set(key, value);
        this.accessOrder.add(key);
      }
      
      get(key: string): string | null {
        const value = this.cache.get(key);
        if (value) {
          // Update access order
          this.accessOrder.delete(key);
          this.accessOrder.add(key);
        }
        return value || null;
      }
    }
    ```

- [ ] **Стъпка 4: Имплементирай pagination за drivers list**
  - [ ] 4.1. Обнови `adminAPI.ts` да поддържа pagination
    ```javascript
    export async function getAllDrivers(options: {
      page?: number;
      limit?: number;
      status?: 'pending' | 'approved' | 'rejected';
    }) {
      const { page = 1, limit = 20, status } = options;
      
      let query = admin.firestore()
        .collection('users')
        .where('userType', '==', 'driver')
        .orderBy('createdAt', 'desc')
        .limit(limit);
      
      if (page > 1) {
        // Implement cursor-based pagination
        const offset = (page - 1) * limit;
        query = query.offset(offset);
      }
      
      if (status) {
        query = query.where('verificationStatus', '==', status);
      }
      
      return query.get();
    }
    ```

- [ ] **Стъпка 5: Обнови dashboard UI**
  - [ ] 5.1. Добави pagination controls
  - [ ] 5.2. Добави page size selector (10/20/50 drivers per page)
  - [ ] 5.3. Добави memory usage indicator в dev mode

- [ ] **Стъпка 6: Тестване на memory efficiency**
  - [ ] 6.1. Тествай с 100+ drivers dataset
  - [ ] 6.2. Провери memory usageostenва stable
  - [ ] 6.3. Тествай image loading performance

---

### **Проблем #6: Battery Drain от Continuous GPS Tracking**

**Критичност:** 🟡 MEDIUM  
**Засегнати файлове:** `src/hooks/shared/useCurrentLocation.ts`  
**Риск:** Приложението консумира твърде много батерия за drivers

#### TODO List - Детайлни стъпки:

- [ ] **Стъпка 1: Измери текущата battery consumption**
  - [ ] 1.1. Тествай с real device за 1 час continuous tracking
  - [ ] 1.2. Документирай battery drain rate
  - [ ] 1.3. Сравни с други navigation apps

- [ ] **Стъпка 2: Създай adaptive location tracking**
  - [ ] 2.1. Отвори `src/hooks/shared/useCurrentLocation.ts`
  - [ ] 2.2. Добави context-aware configuration
    ```javascript
    interface AdaptiveLocationOptions {
      userType: 'client' | 'driver';
      isOnline?: boolean;
      hasActiveOrder?: boolean;
      batteryOptimized?: boolean;
    }
    
    export function useCurrentLocation(options: AdaptiveLocationOptions) {
      const getTrackingConfig = useCallback(() => {
        const { userType, isOnline, hasActiveOrder, batteryOptimized } = options;
        
        // High accuracy when needed
        if (hasActiveOrder) {
          return {
            accuracy: Location.Accuracy.High,
            timeInterval: 15000, // 15 seconds
            distanceInterval: 5, // 5 meters
          };
        }
        
        // Medium accuracy for online drivers
        if (userType === 'driver' && isOnline) {
          return {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000, // 1 minute
            distanceInterval: 50, // 50 meters
          };
        }
        
        // Low frequency for offline drivers
        if (userType === 'driver' && !isOnline) {
          return {
            accuracy: Location.Accuracy.Low,
            timeInterval: 300000, // 5 minutes
            distanceInterval: 200, // 200 meters
          };
        }
        
        // Clients only when app is active
        return {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // 30 seconds
          distanceInterval: 25, // 25 meters
        };
      }, [options]);
    }
    ```

- [ ] **Стъпка 3: Добави battery monitoring**
  - [ ] 3.1. Инсталирай battery level library
    ```bash
    expo install expo-battery
    ```
  - [ ] 3.2. Имплементирай battery-aware tracking
    ```javascript
    import * as Battery from 'expo-battery';
    
    const [batteryLevel, setBatteryLevel] = useState(1);
    
    useEffect(() => {
      const checkBattery = async () => {
        const level = await Battery.getBatteryLevelAsync();
        setBatteryLevel(level);
        
        // Reduce tracking frequency if battery is low
        if (level < 0.2) { // Below 20%
          // Switch to power-saving mode
        }
      };
      
      checkBattery();
      const interval = setInterval(checkBattery, 60000); // Check every minute
      return () => clearInterval(interval);
    }, []);
    ```

- [ ] **Стъпка 4: Обнови driver dashboard**
  - [ ] 4.1. Отвори `src/screens/driver/DriverHomeScreen.tsx`
  - [ ] 4.2. Добави battery optimization toggle
  - [ ] 4.3. Покажи current tracking frequency в UI

- [ ] **Стъпка 5: Имплементирай background location**
  - [ ] 5.1. Добави background location permissions
    ```javascript
    // В app.json
    "ios": {
      "infoPlist": {
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Приложението използва локацията за намиране на клиенти наблизо.",
        "NSLocationWhenInUseUsageDescription": "Приложението използва локацията за намиране на клиенти наблизо."
      }
    }
    ```
  - [ ] 5.2. Request background permissions за drivers
  - [ ] 5.3. Имплементирай background task за location updates

- [ ] **Стъпка 6: Тестване на battery efficiency**
  - [ ] 6.1. A/B тествай old vs new tracking
  - [ ] 6.2. Измери battery consumption в различни режими
  - [ ] 6.3. Валидирай че location accuracy остава приемлива

---

### **Проблем #7: Exponential Retry без Maximum Backoff**

**Критичност:** 🟡 MEDIUM  
**Засегнати файлове:** `src/hooks/client/useClientOrders.ts`  
**Риск:** При network issues, retry interval може да стане твърде голям

#### TODO List - Детайлни стъпки:

- [ ] **Стъпка 1: Анализ на текущия retry mechanism**
  - [ ] 1.1. Отвори `src/hooks/client/useClientOrders.ts`
  - [ ] 1.2. Намери retry логиката (около ред 60-120)
  - [ ] 1.3. Документирай current retry intervals
  - [ ] 1.4. Симулирай network failures и измери retry behavior

- [ ] **Стъпка 2: Създай robust retry utility**
  - [ ] 2.1. Създай нов файл `src/utils/retryManager.ts`
    ```javascript
    interface RetryOptions {
      maxRetries: number;
      baseDelay: number;
      maxDelay: number;
      jitter: boolean;
      backoffFactor: number;
    }
    
    class RetryManager {
      private static defaultOptions: RetryOptions = {
        maxRetries: 3,
        baseDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds max
        jitter: true,
        backoffFactor: 2,
      };
      
      static async withRetry<T>(
        operation: () => Promise<T>,
        options: Partial<RetryOptions> = {}
      ): Promise<T> {
        const config = { ...this.defaultOptions, ...options };
        let lastError: Error;
        
        for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
          try {
            return await operation();
          } catch (error) {
            lastError = error as Error;
            
            if (attempt > config.maxRetries) {
              break; // Final attempt failed
            }
            
            const delay = this.calculateDelay(attempt, config);
            console.log(`Retry attempt ${attempt} failed, waiting ${delay}ms`);
            await this.sleep(delay);
          }
        }
        
        throw lastError;
      }
      
      private static calculateDelay(attempt: number, config: RetryOptions): number {
        const exponentialDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
        const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
        
        if (config.jitter) {
          // Add ±25% random jitter to prevent thundering herd
          const jitterRange = cappedDelay * 0.25;
          const jitter = (Math.random() - 0.5) * 2 * jitterRange;
          return Math.max(0, cappedDelay + jitter);
        }
        
        return cappedDelay;
      }
      
      private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
    }
    
    export { RetryManager };
    ```

- [ ] **Стъпка 3: Обнови useClientOrders hook**
  - [ ] 3.1. Замени manual retry логиката с RetryManager
    ```javascript
    const setupSubscription = useCallback(async () => {
      try {
        await RetryManager.withRetry(
          async () => {
            return new Promise((resolve, reject) => {
              const unsubscribe = subscribeToClientOrders(user.uid, (orders) => {
                // Success - resolve immediately
                resolve(unsubscribe);
              }, (error) => {
                reject(error);
              });
            });
          },
          {
            maxRetries: 3,
            baseDelay: 2000,
            maxDelay: 30000,
          }
        );
      } catch (error) {
        // Final failure handling
        handleFinalRetryFailure(error);
      }
    }, [user?.uid]);
    ```

- [ ] **Стъпка 4: Добави connection quality detection**
  - [ ] 4.1. Създай network quality monitor
    ```javascript
    const useNetworkQuality = () => {
      const [quality, setQuality] = useState<'good' | 'poor' | 'offline'>('good');
      
      useEffect(() => {
        const checkQuality = async () => {
          try {
            const start = Date.now();
            await fetch('https://firestore.googleapis.com/ping', { 
              method: 'HEAD',
              cache: 'no-cache'
            });
            const latency = Date.now() - start;
            
            if (latency < 500) setQuality('good');
            else if (latency < 2000) setQuality('poor');
            else setQuality('offline');
          } catch {
            setQuality('offline');
          }
        };
        
        checkQuality();
        const interval = setInterval(checkQuality, 10000);
        return () => clearInterval(interval);
      }, []);
      
      return quality;
    };
    ```

- [ ] **Стъпка 5: Адаптивни retry стратегии**
  - [ ] 5.1. Различни retry options според network quality
  - [ ] 5.2. По-агресивен retry при good connection
  - [ ] 5.3. По-conservative при poor connection

- [ ] **Стъпка 6: Тестване на различни network условия**
  - [ ] 6.1. Симулирай intermittent connectivity
  - [ ] 6.2. Тествай high latency connections
  - [ ] 6.3. Валидирай che retry не block-ва UI

---

## 🟢 НИСКО КРИТИЧНИ ПРОБЛЕМИ

### **Проблем #8: React Rendering Performance - Missing Memoization**

**Критичност:** 🟢 LOW  
**Засегнати файлове:** Multiple components  
**Риск:** Ненужни re-renders забавят UI

#### TODO List - Детайлни стъпки:

- [ ] **Стъпка 1: Audit на rendering performance**
  - [ ] 1.1. Инсталирай React DevTools Profiler
  - [ ] 1.2. Профилирай главните екрани (ClientHome, DriverHome)
  - [ ] 1.3. Идентифицирай компоненти с frequent re-renders
  - [ ] 1.4. Документирай current render frequencies

- [ ] **Стъпка 2: Мемоизирай често използвани callback functions**
  - [ ] 2.1. Отвори `src/screens/client/ClientHomeScreen.tsx`
  - [ ] 2.2. Замени анонимни функции с useCallback
    ```javascript
    // ПРЕДИ:
    <ActiveOrderPanel
      onShowBids={() => {
        console.log('🔍 [ClientHomeScreen] onShowBids called');
        setShowBidsModal(true);
      }}
    />
    
    // СЛЕД:
    const handleShowBids = useCallback(() => {
      console.log('🔍 [ClientHomeScreen] onShowBids called');
      setShowBidsModal(true);
    }, []);
    
    <ActiveOrderPanel onShowBids={handleShowBids} />
    ```

- [ ] **Стъпка 3: Добави React.memo за heavy components**
  - [ ] 3.1. Отвори `src/components/client/ActiveOrderPanel/index.tsx`
  - [ ] 3.2. Обвий с React.memo и custom comparison
    ```javascript
    import React, { memo } from 'react';
    
    const ActiveOrderPanel = memo(({ 
      activeOrder, 
      bids, 
      timeLeftMs, 
      acceptedDriverName,
      onShowBids,
      onCancel 
    }: ActiveOrderPanelProps) => {
      // component logic...
    }, (prevProps, nextProps) => {
      // Custom comparison function
      return (
        prevProps.activeOrder?.id === nextProps.activeOrder?.id &&
        prevProps.activeOrder?.status === nextProps.activeOrder?.status &&
        prevProps.bids.length === nextProps.bids.length &&
        prevProps.timeLeftMs === nextProps.timeLeftMs &&
        prevProps.acceptedDriverName === nextProps.acceptedDriverName
      );
    });
    
    export default ActiveOrderPanel;
    ```

- [ ] **Стъпка 4: Оптимизирай expensive computations**
  - [ ] 4.1. Идентифицирай computation-heavy operations
  - [ ] 4.2. Добави useMemo за тежки calculations
    ```javascript
    const expensiveValue = useMemo(() => {
      return heavyCalculation(data);
    }, [data]); // Само се пресмята при промяна на data
    ```

- [ ] **Стъпка 5: Lazy load heavy components**
  - [ ] 5.1. Идентифицирай рядко използвани компоненти
  - [ ] 5.2. Имплементирай React.lazy
    ```javascript
    const SettingsModal = lazy(() => import('./modals/SettingsModal'));
    
    // Използвай с Suspense
    <Suspense fallback={<ActivityIndicator />}>
      <SettingsModal visible={showSettings} />
    </Suspense>
    ```

- [ ] **Стъпка 6: Измери performance подобрения**
  - [ ] 6.1. Профилирай екранините след оптимизации
  - [ ] 6.2. Сравни render times преди/след
  - [ ] 6.3. Валидирай че UI responsiveness е подобрен

---

### **Проблем #9: Generic Error Handling - Lost Context**

**Критичност:** 🟢 LOW  
**Засегнати файлове:** Multiple service files  
**Риск:** Трудно debugging при production issues

#### TODO List - Детайлни стъпки:

- [ ] **Стъпка 1: Audit на всички catch blocks**
  - [ ] 1.1. Search за всички `catch (error)` в проекта
  - [ ] 1.2. Категоризирай ги по quality на error handling
  - [ ] 1.3. Създай списък с problematic catch blocks

- [ ] **Стъпка 2: Създай structured error types**
  - [ ] 2.1. Създай нов файл `src/types/errors.ts`
    ```javascript
    export class AppError extends Error {
      public readonly code: string;
      public readonly context: Record<string, any>;
      public readonly userMessage: string;
      public readonly originalError?: Error;
      public readonly timestamp: number;
      
      constructor(
        code: string,
        message: string,
        userMessage: string,
        context: Record<string, any> = {},
        originalError?: Error
      ) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.context = context;
        this.userMessage = userMessage;
        this.originalError = originalError;
        this.timestamp = Date.now();
      }
      
      toJSON() {
        return {
          name: this.name,
          code: this.code,
          message: this.message,
          userMessage: this.userMessage,
          context: this.context,
          timestamp: this.timestamp,
          stack: this.stack,
          originalError: this.originalError?.message,
        };
      }
    }
    
    export class NetworkError extends AppError {
      constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
        super(
          'NETWORK_ERROR',
          message,
          'Проблем с мрежовата връзка. Моля опитайте отново.',
          context,
          originalError
        );
      }
    }
    
    export class ValidationError extends AppError {
      constructor(field: string, value: any, rule: string) {
        super(
          'VALIDATION_ERROR',
          `Validation failed for field ${field}: ${rule}`,
          'Невалидни данни. Моля проверете въведената информация.',
          { field, value, rule }
        );
      }
    }
    ```

- [ ] **Стъпка 3: Обнови service layer error handling**
  - [ ] 3.1. Отвори `src/services/firestore.ts`
  - [ ] 3.2. Замени generic catch blocks с structured errors
    ```javascript
    // ПРЕДИ:
    } catch (error) {
      console.error('Error creating order:', error);
      throw new Error('Не можахме да създадем заявката');
    }
    
    // СЛЕД:
    } catch (error) {
      const appError = new AppError(
        'ORDER_CREATE_FAILED',
        `Failed to create order: ${error.message}`,
        'Не можахме да създадем заявката. Моля опитайте отново.',
        {
          orderId: orderData.clientId,
          timestamp: Date.now(),
          orderData: { 
            clientId: orderData.clientId,
            hasImages: orderData.images.length > 0,
            hasLocation: !!orderData.location
          }
        },
        error instanceof Error ? error : new Error(String(error))
      );
      
      SecureLogger.error('Order creation failed', appError.toJSON());
      throw appError;
    }
    ```

- [ ] **Стъпка 4: Създай централен error reporter**
  - [ ] 4.1. Създай `src/utils/errorReporter.ts`
    ```javascript
    interface ErrorReport {
      error: AppError;
      userId?: string;
      userType?: string;
      device: {
        platform: string;
        version: string;
      };
      app: {
        version: string;
        buildNumber: string;
      };
    }
    
    class ErrorReporter {
      static async reportError(error: AppError, user?: any) {
        const report: ErrorReport = {
          error,
          userId: user?.uid,
          userType: user?.userType,
          device: {
            platform: Platform.OS,
            version: Platform.Version.toString(),
          },
          app: {
            version: Application.nativeApplicationVersion || 'unknown',
            buildNumber: Application.nativeBuildVersion || 'unknown',
          },
        };
        
        try {
          // Send to logging service
          await this.sendToLoggingService(report);
          
          // Store locally for retry if needed
          await this.storeLocallyForRetry(report);
        } catch (reportingError) {
          console.error('Failed to report error:', reportingError);
        }
      }
      
      private static async sendToLoggingService(report: ErrorReport) {
        // Implement sending to your preferred logging service
        // (Firebase Analytics, Sentry, custom endpoint, etc.)
      }
      
      private static async storeLocallyForRetry(report: ErrorReport) {
        // Store in AsyncStorage for later retry
      }
    }
    ```

- [ ] **Стъпка 5: Обнови UI error displays**
  - [ ] 5.1. Модифицирай `CustomModal` да показва structured errors
  - [ ] 5.2. Добави error code display за debugging
  - [ ] 5.3. Добави "Report Problem" бутон за users

- [ ] **Стъпка 6: Тестване на error scenarios**
  - [ ] 6.1. Симулирай различни типове грешки
  - [ ] 6.2. Валидирай че error context се запазва
  - [ ] 6.3. Тествай error reporting mechanism

---

## 📊 **Приоритизация и Timeline**

### **Фаза 1 (Критично - 2-3 седмици):**
1. Проблем #1: Race Condition при bids ⏱️ 3-4 дни
2. Проблем #2: Double payment protection ⏱️ 2-3 дни  
3. Проблем #3: Sensitive data в logs ⏱️ 2-3 дни
4. Проблем #4: Admin panel security ⏱️ 4-5 дни

### **Фаза 2 (Важно - 3-4 седмици):**
5. Проблем #5: Base64 memory optimization ⏱️ 5-7 дни
6. Проблем #6: Battery drain optimization ⏱️ 4-5 дни
7. Проблем #7: Retry mechanism improvement ⏱️ 2-3 дни

### **Фаза 3 (Оптимизации - 2-3 седмици):**
8. Проблем #8: React performance ⏱️ 3-4 дни
9. Проблем #9: Error handling ⏱️ 3-4 дни

## 🧪 **Testing Strategy**

За всеки проблем:
- [ ] Unit tests за нови функции
- [ ] Integration tests за критични flows  
- [ ] Manual testing на various devices
- [ ] Performance benchmarks преди/след
- [ ] Security audit за sensitive changes

## 📝 **Progress Tracking**

Създайте GitHub Issues за всеки проблем и update-вайте този файл с progress:

- [ ] Issue #1: Race Condition Fix - **Status: Not Started**
- [ ] Issue #2: Payment Protection - **Status: Not Started**  
- [ ] Issue #3: Secure Logging - **Status: Not Started**
- [ ] Issue #4: Admin Security - **Status: Not Started**
- [ ] Issue #5: Memory Optimization - **Status: Not Started**
- [ ] Issue #6: Battery Optimization - **Status: Not Started**
- [ ] Issue #7: Retry Improvement - **Status: Not Started**
- [ ] Issue #8: React Performance - **Status: Not Started**
- [ ] Issue #9: Error Handling - **Status: Not Started**

---

**Last Updated:** December 2024  
**Next Review:** След completion на Фаза 1 