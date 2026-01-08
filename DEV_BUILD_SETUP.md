# Development Build Setup за решаване на payment modal проблема

## Проблем
В Expo Go белият екран след плащане не се маха поради ограничения в deep linking.

## Решение: Development Build

### 1. Конфигурация на app.json
Добавихме custom scheme за deep linking:
```json
{
  "expo": {
    "scheme": "roadsideassistance",
    // ... останала конфигурация
  }
}
```

### 2. Обновяване на Cloud Function
Променихме redirect URL в `functions/src/customPayments.ts`:
```typescript
after_completion: {
  type: 'redirect',
  redirect: {
    url: `roadsideassistance://payment-success?orderId=${orderId}&amount=${amount}`
  }
}
```

### 3. Стъпки за build
```bash
# 1. Инсталиране на dependencies
npx expo install --fix

# 2. Генериране на native код
npx expo prebuild --clean

# 3. Deploy на обновените Cloud Functions
cd functions
firebase deploy --only functions

# 4. Стартиране на development build
npx expo run:android
```

### 4. Предимства на Development Build
- ✅ Правилно deep linking с custom schemes
- ✅ По-близо до production environment
- ✅ Пълна поддръжка на native features
- ✅ По-стабилно поведение при плащания

### 5. Тестване
1. Създайте заявка като клиент
2. Приемете оферта като шофьор
3. Направете плащане през Stripe
4. Проверете дали payment modal се затваря автоматично
5. Потвърдете, че се показва success съобщение

### 6. Очаквани резултати
- Payment modal се затваря веднага след връщане от Stripe
- Показва се ясно success съобщение
- Няма повече бял екран или висящи loading spinners

## Заключение
Development build трябва да реши проблема с payment modal-а, защото предоставя пълна поддръжка на custom URL schemes и deep linking, за разлика от Expo Go който има ограничения. 