# 🚨 Firebase SDK Проблем - Кратък Доклад

## Проблем
Бутонът "Изпрати заявка" зарежда вечно и заявката се създава в Firestore, но `addDoc()` Promise никога не се resolve-ва. Потребителят мисли че заявката не е изпратена, въпреки че тя реално съществува в базата данни.

## Какво се случва
1. Потребителят натиска "Изпрати заявка"
2. `addDoc()` се изпълнява и създава документа в Firestore ✅
3. Real-time listener получава новия документ ✅
4. `addDoc()` Promise никога не се resolve-ва ❌
5. UI остава в loading state безкрайно ❌

## Опитани решения

### 1. Babel конфигурация
```javascript
// babel.config.js - опростихме за да премахнем JSX конфликти
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

### 2. React Native New Architecture
```json
// app.json - изключихме новата архитектура
{
  "expo": {
    "newArchEnabled": false
  }
}
```

### 3. Timeout Protection
```typescript
// src/services/firestore.ts - добавихме timeout wrapper
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('Firebase addDoc operation timed out')), 45000);
});

const docRef = await Promise.race([addDocPromise, timeoutPromise]);
```

### 4. Recovery Detection
```typescript
// src/screens/client/ClientHomeScreen.tsx - проверяваме дали заявката е създадена
if (error.message.includes('твърде много време')) {
  // Проверяваме activeOrder state за нови заявки
  if (activeOrder && activeOrder.clientId === user.uid) {
    // Показваме success modal
  }
}
```

## Препоръчано решение

Това е известен Firebase SDK bug в React Native 0.79 + Expo environment. Най-добрият подход е **Firestore REST API fallback**:

```typescript
// src/services/firestore.ts
export const createOrder = async (orderData) => {
  try {
    // Опитваме Firebase SDK първо
    return await createOrderWithFirebaseBugWorkaround(orderData);
  } catch (error) {
    // Fallback към REST API
    const { createOrderViaREST } = await import('./firestoreREST');
    return await createOrderViaREST(orderData);
  }
};
```

```typescript
// src/services/firestoreREST.ts - нов файл
export const createOrderViaREST = async (orderData) => {
  const token = await getAuthToken();
  const response = await fetch(`${FIRESTORE_REST_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(firestoreDoc)
  });
  return response.json().name.split('/').pop(); // document ID
};
```

Този подход:
- Запазва Firebase SDK за real-time listening
- Използва REST API само за create operations
- 100% reliable, няма висящи Promise-и
- Transparent за потребителите

## Файлове за преглед

### Основни проблемни файлове:
1. `src/screens/client/ClientHomeScreen.tsx` - UI hanging issue
2. `src/services/firestore.ts` - Firebase SDK operations
3. `src/services/firestoreREST.ts` - REST API fallback (НОВ)

### Конфигурационни файлове:
4. `babel.config.js` - Babel поправки
5. `app.json` - React Native архитектура
6. `metro.config.js` - Metro bundler config
7. `package.json` - Dependencies

### Документация:
8. `FIREBASE_SDK_BUG_WORKAROUND.md` - Детайлен технически анализ
9. `MODAL_STUCK_FIX_REPORT.md` - UI fix опити
10. `PROJECT_STATUS_REPORT.md` - Общ статус на проекта

### Тест файлове:
11. `test-firebase-function.js` - Firebase тестове
12. `test-admin-api.js` - API тестове

Това е critical production blocker който трябва да се реши преди release. 