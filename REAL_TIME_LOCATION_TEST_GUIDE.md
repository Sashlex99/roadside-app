# 📍 Real-Time Location Tracking - Testing Guide

## 🎯 Цел
Тестване на автоматичното обновяване на локацията в картата когато потребителят се движи.

## ✅ Какво беше добавено

### 1. Enhanced Location Hook
- **File**: `src/hooks/shared/useCurrentLocation.ts`
- **Functionality**: Real-time GPS tracking с `watchPositionAsync`
- **Updates**: Всеки 10 метра или на всеки 30 секунди

### 2. Dynamic Map Updates
- **File**: `src/components/shared/LeafletMap.tsx`
- **Functionality**: Автоматично обновяване на маркера когато локацията се промени
- **Animation**: Smooth pan animation към новата позиция

### 3. JavaScript Bridge
- **Files**: `src/utils/client/helpers.ts`, `src/utils/driver/helpers.ts`
- **Function**: `window.updateUserLocation(lat, lng)`
- **Purpose**: Позволява на React Native да обновява картата в реално време

## 🧪 Как да тествате

### Стъпка 1: Билд и инсталиране
```bash
# Вземете latest build от EAS
npx eas build:list --limit=1

# Инсталирайте APK на устройството
```

### Стъпка 2: Основен тест
1. **Отворете приложението**
2. **Логирайте се** като client или driver
3. **Проверете първоначалната локация** - трябва да видите картата с вашия маркер

### Стъпка 3: Location Permission тест
- При първо стартиране трябва да се покаже permission prompt
- Изберете **"Allow"** или **"Разреши"**
- Картата трябва да се зареди с вашата текуща позиция

### Стъпка 4: Real-time tracking тест

#### 🚶‍♂️ Walking Test (Препоръчително)
1. **Започнете ходене** навън на разстояние > 10-15 метра
2. **Проверявайте Console logs** за updates:
   ```
   📍 Location updated: [new coordinates]
   🗺️ Map location updated: [lat, lng]
   ```
3. **Наблюдавайте картата** - маркерът трябва да се движи плавно
4. **Проверете animation** - картата трябва да прави smooth pan

#### 🚗 Car Test (За по-бързи промени)
1. **Започнете движение с кола**
2. **Картата трябва да обновява** позицията на всеки 10+ метра
3. **Маркерът трябва да следва** движението ви

### Стъпка 5: Проверка на настройките

#### Актуални settings:
- **Distance interval**: 10 метра (минимална дистанция за update)
- **Time interval**: 30 секунди (максимално време между updates)
- **GPS accuracy**: High (най-точно позициониране)

## 📱 Expected Behavior

### ✅ Правилно поведение:
1. **Initial load**: Картата се зарежда с текущата локация
2. **Location permission**: Работи при първо стартиране
3. **Real-time updates**: Маркерът се движи когато се движите
4. **Smooth animation**: Плавно преминаване към новата позиция
5. **Console logs**: Показват координатите при всеки update

### ❌ Проблемни ситуации:
1. **Статичен маркер** - локацията не се обновява
2. **No animation** - картата скача вместо да прави pan
3. **Console errors** - грешки при updateUserLocation
4. **Performance issues** - приложението забавя при updates

## 🔧 Debugging Tips

### Console команди за проверка:
```javascript
// В WebView console (Chrome DevTools)
window.updateUserLocation(42.6977, 23.3219); // Test координати за София
```

### Logs за проследяване:
```
📍 Location updated: [coordinates]    // От useCurrentLocation hook
🗺️ Location watching started          // При стартиране на tracking
🗺️ Map location updated: [lat, lng]   // От Leaflet JavaScript
```

### React Native logs:
```bash
# При development
npx react-native log-android  # За Android
npx react-native log-ios      # За iOS
```

## 🎛️ Customization Options

### Промяна на update intervals:
```typescript
// В ClientHomeScreen.tsx или DriverHomeScreen.tsx
const { location } = useCurrentLocation({
  enableWatching: true,
  distanceInterval: 5,    // По-често (5 метра)
  timeInterval: 15000,    // По-често (15 секунди)
});
```

### Спиране на real-time tracking:
```typescript
const { location, stopWatching } = useCurrentLocation({
  enableWatching: false  // Само initial location
});
```

## 🚀 Success Criteria

### Успешен тест означава:
- [x] Картата се зарежда с начална локация
- [x] При движение > 10м маркерът се обновява
- [x] Animation е smooth и приятна
- [x] Console logs показват правилни координати
- [x] Performance остава добра при движение
- [x] Battery usage е разумна (не drain-ва батерията)

## 📊 Performance Monitoring

### На какво да обърнете внимание:
1. **Battery usage** - не трябва да drain-ва батерията
2. **Memory leaks** - long-running sessions не трябва да консумират памет
3. **Network calls** - address lookup calls трябва да са оптимизирани
4. **UI responsiveness** - UI трябва да остане responsive

---

**📍 Real-time Location Tracking е активно!**  
**🗺️ Картата ще следва вашето движение автоматично**  
**⚡ Updates: всеки 10 метра или 30 секунди** 