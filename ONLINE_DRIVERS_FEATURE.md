# Online Drivers Indicator Feature

## Обзор
Добавена е нова функционалност, която показва на клиентите колко шофьори са активни (онлайн) в момента. Индикаторът се показва в горния десен ъгъл на клиентския екран.

## Техническа имплементация

### 1. Backend (Firestore)
Добавени са две нови функции в `src/services/firestore.ts`:

#### `getOnlineDriversCount()`
- Връща броя на активните шофьори
- Критерии за "активен шофьор":
  - `userType === 'driver'`
  - `verificationStatus === 'approved'`
  - `isOnline === true`
  - `lastSeen` е в последните 5 минути

#### `subscribeToOnlineDriversCount(callback)`
- Real-time subscription за промени в броя активни шофьори
- Автоматично обновява UI при промяна
- Включва error handling

### 2. Frontend (React Native)
Модификации в `src/screens/client/ClientHomeScreen.tsx`:

#### Нови елементи:
- **State**: `onlineDriversCount` - съхранява текущия брой
- **useEffect**: Subscribe към real-time промени
- **UI Component**: Индикатор в header-а с точка и текст

#### Визуален дизайн:
```jsx
<View style={styles.onlineDriversIndicator}>
  <View style={[
    styles.onlineDriversDot,
    { backgroundColor: onlineDriversCount > 0 ? colors.success : colors.textSecondary }
  ]} />
  <Text style={styles.onlineDriversText}>
    {onlineDriversCount > 0 
      ? `${onlineDriversCount} шофьор${onlineDriversCount === 1 ? '' : 'и'} онлайн`
      : 'Няма активни шофьори'
    }
  </Text>
</View>
```

## Визуални характеристики

### Позиция
- В header-а, под адреса на клиента
- В лявата част на екрана за по-добра видимост

### Цветове
- **Зелена точка** (colors.success): Когато има активни шофьори
- **Сива точка** (colors.textSecondary): Когато няма активни шофьори

### Текст
- **С активни шофьори**: "X шофьор онлайн" или "X шофьори онлайн"
- **Без активни шофьори**: "Няма активни шофьори"

## UX Benefits

### За клиентите:
1. **Увереност**: Виждат че има налични шофьори
2. **Прозрачност**: Реална информация за наличността
3. **Очаквания**: Могат да преценят дали да правят заявка

### За бизнеса:
1. **Trust Building**: Увеличава доверието към услугата
2. **Conversion**: Повече заявки когато има активни шофьори
3. **Engagement**: Клиентите се връщат когато виждат активност

## Тестване

### Manual Testing
1. Отворете клиентския екран
2. Проверете дали се показва индикаторът
3. Симулирайте промяна в онлайн шофьорите
4. Проверете дали се обновява автоматично

### Automated Testing
Използвайте `test-online-drivers.js`:
```bash
node test-online-drivers.js
```

Тестът включва:
- Проверка на текущия брой активни шофьори
- Създаване на mock шофьор
- Проверка на обновения брой
- Изчистване на test данни

## Performance Considerations

### Real-time Updates
- Използва Firestore snapshot listeners
- Автоматично cleanup при unmount на компонента
- Minimal network overhead (само при промени)

### Caching
- Firestore кешира резултатите автоматично
- Не блокира UI при мрежови проблеми

## Бъдещи подобрения

### V2 Features
1. **Geographic Distribution**: Показване на шофьори в района
2. **ETA Estimates**: Приблизително време за пристигане
3. **Driver Specialization**: Типове превозни средства
4. **Load Balancing**: Индикация за натовареност

### Analytics
1. **Peak Hours**: Анализ на най-активните часове
2. **Geographic Heat Map**: Карта с активност по райони
3. **Conversion Correlation**: Връзка между активни шофьори и заявки

## Конфигурация

### Timing Settings
Може да се настройват в `firestore.ts`:
```javascript
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 минути
```

### Text Localization
Съобщенията са на български в `ClientHomeScreen.tsx` и могат да се изнесат в отделен i18n файл при нужда.

## Troubleshooting

### Общи проблеми:
1. **Индикаторът не се показва**: Проверете дали са импортирани функциите
2. **Не се обновява**: Проверете internet connection и Firestore rules
3. **Грешен брой**: Проверете дали `lastSeen` се обновява при driver активност
4. **Шофьорът е онлайн, но не се показва**: Шофьорът трябва да включи онлайн статуса от своя екран

### Debug Mode
В development mode се логват промените:
```javascript
if (__DEV__) console.log('📊 Online drivers count updated:', count);
```

### Тестване на онлайн статус
Използвайте `test-driver-online-status.js` за тестване:
```bash
# Проверка на текущите онлайн шофьори
node test-driver-online-status.js check

# Създаване на тест шофьор
node test-driver-online-status.js create-test

# Почистване на тест данни
node test-driver-online-status.js cleanup
```

## Техническа имплементация - Driver Side

### DriverHomeScreen промени:
- **Нова функция**: `updateDriverOnlineStatus()` в firestore.ts
- **Обновен toggle**: `handleToggleOnline()` сега записва в базата данни
- **Автоматично обновяване**: `lastSeen` се обновява на всеки 2 минути
- **Persistence**: Онлайн статусът се зарежда при стартиране на приложението

### Полета в базата данни:
- `isOnline: boolean` - дали шофьорът е активен
- `lastSeen: timestamp` - последно виждане
- `userType: 'driver'` - тип потребител
- `verificationStatus: 'approved'` - статус на верификация 

## UX подобрения - Smooth Toggle

### Optimistic Updates
За по-добро потребителско изживяване, онлайн toggle-ът използва optimistic updates:

1. **Незабавен отговор**: UI се обновява веднага при натискане
2. **Haptic Feedback**: Тактилна обратна връзка на поддържани устройства
3. **Background Sync**: Firestore се обновява в background
4. **Error Handling**: При грешка, промяната се rollback-ва

### Визуални индикатори
- **Loading състояние**: Switch се деактивира по време на sync
- **Sync индикатор**: Малък ActivityIndicator показва синхронизацията
- **Smooth анимации**: React Native анимациите са оптимизирани

### Код структура
```javascript
const handleToggleOnline = async () => {
  // 1. Haptic feedback
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  
  // 2. Optimistic UI update
  setIsOnline(newStatus);
  setOnlineStatusSyncing(true);
  
  // 3. Background Firestore sync
  try {
    await updateDriverOnlineStatus(user.uid, newStatus);
  } catch (error) {
    // 4. Rollback on error
    setIsOnline(!newStatus);
  } finally {
    setOnlineStatusSyncing(false);
  }
};
``` 