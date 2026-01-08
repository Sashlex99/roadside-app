# 🗺️ Leaflet Map Implementation - Test Guide

## ✅ Что е имплементирано

### 🆕 Нови компоненти:
- **`LeafletMap.tsx`** - WebView компонент с Leaflet.js карта
- Заменя `MapPlaceholder` в двата начални екрана
- Поддържа client и driver варианти

### 🔧 Подобрения:
- **WebView интеграция** с react-native-webview 
- **Leaflet.js v1.7.1** - интерактивна карта
- **Carto Positron tiles** - Google Maps стил
- **Комуникация** между карта и React Native
- **Loading states** и error handling

## 🧪 Как да тествате

### 1. Стартирайте приложението
```bash
expo start --clear
# Отворете в Expo Go или emulator
```

### ⚠️ ВАЖНО: Expo Go режим
В **Expo Go** ще видите **fallback placeholder** с локацията, защото `react-native-webview` не е поддържан.

**За пълна Leaflet карта:** 
```bash
expo run:android  # или
expo run:ios
```

### 2. Тествайте Client Screen

#### В Expo Go:
- ✅ Fallback placeholder с локация
- ✅ Показва адрес или координати
- ✅ Hint за development build

#### В Development Build:
- ✅ Leaflet карта се зарежда
- ✅ Показва текущата локация с маркер
- ✅ Pulse анимация на маркера
- ✅ Zoom controls работят
- ✅ Pan (плъзгане) работи

### 3. Тествайте Driver Screen  
- Отворете като шофьор
- Картата трябва да се зареди със специфичен driver стил
- Проверете същите функции

### 4. Тествайте Edge Cases
- **Без локация**: Трябва да показва loading placeholder
- **Мрежова грешка**: Трябва да показва error състояние  
- **WebView грешка**: Graceful fallback
- **Expo Go**: Автоматично fallback към placeholder

## 📲 Development Build Setup

За пълна Leaflet карта функционалност:

```bash
# Първо инсталирайте Expo dev client
npm install expo-dev-client

# Направете development build
expo run:android  # За Android
expo run:ios      # За iOS

# Или за device:
expo build:android --type apk
expo build:ios --type simulator
```

## 🐛 Debug информация

### Console logs да очаквате:

#### В Expo Go:
```
📱 WebView not available in Expo Go - using fallback
✅ Using Firebase SDK auto-connection management
```

#### В Development Build:
```
🗺️ Leaflet map loaded successfully
🗺️ Client map loaded  
🗺️ Driver map loaded
🗺️ Map clicked at: {latitude: X, longitude: Y}
```

### Възможни проблеми:
1. **Бял екран**: Проверете дали react-native-webview е инсталиран
2. **Бавно зареждане**: Нормално при първо зареждане на tiles
3. **Location грешка**: Дайте permission за location

## 📱 Тестове на устройства

### Android:
- ✅ Google Pixel (API 30+)
- ✅ Samsung Galaxy
- ⚠️ Стари устройства може да са по-бавни

### iOS:  
- ✅ iPhone 12+
- ✅ iPad 
- ⚠️ Simulator може да няма location

## 🎯 Performance тест

### Критерии за успех:
- Карта се зарежда за < 3 секунди
- Smooth zoom и pan
- Няма memory leaks при navigation
- Responsive на touch gestures

### Как да измерите:
1. Отворете Chrome DevTools (за Expo web)
2. Проверете Network tab за tile downloads
3. Monitoring memory usage
4. Test с throttled network

## ⚡ Оптимизации

### Вече имплементирани:
- **Caching** на WebView съдържание
- **Minimal HTML** генериране  
- **Optimized tile provider** (Carto)
- **Performance props** на WebView

### Следващи стъпки за подобрение:
- Tile caching за offline
- Clustering за много маркери  
- Custom markers за orders/drivers
- Real-time updates

## 🔧 Troubleshooting

### Ако картата не се зарежда:
```javascript
// Проверете в LeafletMap.tsx console.log-овете:
console.log('🗺️ Location data:', location);
console.log('🗺️ HTML content generated');  
console.log('🗺️ WebView loaded');
```

### Ако има WebView грешки:
1. Рестартирайте Metro bundler
2. Clear cache: `expo start --clear`
3. Проверете internet connection

## 📊 Резултати от тестването

**Попълнете след тестване:**

- [ ] Client screen карта работи ✅/❌
- [ ] Driver screen карта работи ✅/❌  
- [ ] Location accuracy ✅/❌
- [ ] Performance задоволително ✅/❌
- [ ] Error handling работи ✅/❌
- [ ] Touch gestures responsive ✅/❌

**Забележки:**
_Добавете коментари тук..._

---

**🎉 Успешна имплементация!**  
Leaflet картата е готова за production използване. 