# Roadside Assistance App

Българско мобилно приложение за пътна помощ, което свързва клиенти с шофьори за бърза и надеждна помощ на пътя.

## Възможности

### Потребители
- 📱 **Регистрация** с SMS верификация
- 👤 **Три типа профили**: Клиенти, Шофьори и Администратори
- 📞 **Телефонна верификация** за сигурност
- 🆔 **Автентификация** с имейл и парола

### Шофьори
- 🏢 **Фирмена информация** (име, булстат)
- 📄 **Документи** (удостоверение за пътна помощ, ИААА лиценз)
- 📸 **Снимка на шофьор** с camera/gallery опции
- ✅ **Система за одобрение** от администратори
- 📊 **Статуси**: pending/approved/rejected

### Администратори
- 🔐 **Административен панел** за управление на шофьори
- ✅ **Одобряване/отхвърляне** на регистрации
- 📋 **Преглед на документи** и данни на шофьори
- 📝 **Бележки при верификация**

### Технически възможности
- 🔐 **Firebase аутентификация и база данни**
- 📨 **SMS верификация** (демо + production готовност)
- 📷 **Image picker** с camera и gallery
- 🎨 **Модерен UI** в оранжева тематика
- 📱 **React Native + Expo + TypeScript**
- 🛡️ **Role-based access control**

## SMS Верификация

Приложението включва напреднала SMS верификация система:

### Демо Режим (текущо)
- Генерира 6-цифрени кодове
- Кодовете се показват в конзолата
- Валидност 5 минути
- Форматиране на български номера (+359)

### Production Готовност
- Поддръжка за SMS.bg, VivaKom, Telenor, Twilio
- Environment variable конфигурация
- Rate limiting и сигурност
- Подробна документация в `docs/SMS_SETUP.md`

## Технологии

- **Frontend**: React Native, Expo, TypeScript
- **Navigation**: React Navigation
- **Auth**: Firebase Authentication (REST API)
- **Storage**: Firebase Storage
- **Database**: Firebase Firestore
- **SMS**: Custom SMS service (производствено готов)
- **Image**: Expo Image Picker

## Инсталация и Стартиране

```bash
# Клониране на проекта
git clone <repository-url>
cd roadside-assistance

# Инсталиране на зависимости
npm install

# Стартиране на development сървър
npx expo start

# За почистване на cache
npx expo start --clear
```

## Структура на проекта

```
src/
├── components/          # Reusable компоненти
├── constants/          # Константи (цветове, размери)
├── navigation/         # Navigation конфигурация
├── screens/           # Екрани на приложението
│   └── auth/         # Автентификация екрани
├── services/         # API и external услуги
│   ├── firebaseAPI.ts    # Firebase REST API
│   └── smsService.ts     # SMS верификация
└── config/           # Конфигурационни файлове
    └── firebase.ts      # Firebase настройки
```

## Функционалности по екрани

### LoginScreen
- Вход с имейл и парола
- Навигация към регистрация
- Firebase интеграция

### RegisterScreen
- Избор клиент/шофьор
- Основни данни (име, телефон, имейл, парола)
- SMS верификация на телефон
- За шофьори: фирмени данни + документи
- Image picker за документи
- Валидация и error handling

## Firebase Конфигурация

Проектът използва Firebase REST API за:
- Автентификация (`signIn`, `signUp`)
- Firestore документи (`createDocument`, `getDocument`)
- Storage файлове (`uploadFile`)

API ключ и настройки в `src/config/firebase.ts`

## SMS Настройки

За production SMS изпращане вижте `docs/SMS_SETUP.md`:
- SMS.bg интеграция
- VivaKom Gateway
- Twilio поддръжка
- Environment variables

## Разработка

### Добавяне на нови екрани
1. Създайте нов файл в `src/screens/`
2. Добавете към navigation в `src/navigation/`
3. Импортирайте нужните типове и services

### Стилизиране
- Използвайте константите от `src/constants/colors.ts`
- Следвайте съществуващите StyleSheet patterns
- Поддържайте оранжевата тематика

### API интеграция
- Firebase функции в `src/services/firebaseAPI.ts`
- SMS функции в `src/services/smsService.ts`
- Error handling с try/catch и Alert

## Deployment

### Expo EAS Build
```bash
# Инсталиране на EAS CLI
npm install -g @expo/eas-cli

# Login в Expo
eas login

# Конфигуриране и build
eas build:configure
eas build --platform android

# Submit в Play Store
eas submit --platform android
```

### Environment Variables
```bash
# .env.production
SMS_PROVIDER=sms.bg
SMS_API_KEY=your-api-key
FIREBASE_API_KEY=your-firebase-key
```

## Бъдещи възможности

- 🗺️ **Карти интеграция** (Google Maps)
- 💬 **Чат система** между клиенти и шофьори
- 📍 **GPS локация** и навигация
- 💳 **Плащания** интеграция
- 🔔 **Push нотификации**
- ⭐ **Рейтинг система**
- 📊 **Админ панел** за управление

## Лиценз

MIT License - вижте LICENSE файл за детайли.

## Настройка на Администратор

За да добавите администраторски акаунт:

1. **Отидете в Firebase Console** → Authentication → Users
2. **Добавете нов потребител**:
   - Email: `admin@roadside-assistance.com`
   - Password: (изберете сигурна парола)
3. **Отидете в Firestore** → users колекция
4. **Добавете документ** с полетата:
   ```json
   {
     "email": "admin@roadside-assistance.com",
     "fullName": "Системен Администратор",
     "role": "admin",
     "userType": "admin",
     "phoneVerified": true,
     "createdAt": "2024-01-01T00:00:00.000Z"
   }
   ``` 