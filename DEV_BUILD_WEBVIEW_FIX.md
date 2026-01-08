# 🔧 WebView Fix за Development Build

## 🚨 Проблем
```
ERROR: 'RNCWebView' could not be found in the native binary
```

**Причина:** Development build-ът е създаден ПРЕДИ да се добави `react-native-webview`. Native модулите изискват rebuild на приложението.

## ✅ Решения (по ред на приоритет)

### 1. **Бърз fix - Rebuild приложението**
```bash
# Спрете Metro server (Ctrl+C)

# За Android:
npx expo run:android --clear-cache

# За iOS:
npx expo run:ios --clear-cache
```

### 2. **Пълен rebuild чрез EAS**
```bash
# Проверете EAS build конфигурацията
npx eas build:configure

# Направете нов development build
npx eas build --platform android --profile development
npx eas build --platform ios --profile development

# Инсталирайте новия build на устройството
```

### 3. **Local development build**
```bash
# Clear всички кешове
npx expo start --clear
rm -rf node_modules
npm install

# Rebuild локално
npx expo run:android --clear-cache
# или
npx expo run:ios --clear-cache
```

### 4. **Алтернативен approach - Изчистете installation**
```bash
# Деинсталирайте приложението от устройството
# Изтрийте приложението от Android/iOS

# Rebuild напълно
npx expo run:android --device
npx expo run:ios --device
```

## 🧪 Тест за success

След rebuild, в конзолата трябва да видите:
```
✅ Built and installed the app successfully
🗺️ Leaflet map loaded successfully
🗺️ Client map loaded
```

## 📋 Checklist

- [ ] Спрян Metro server
- [ ] Деинсталирано старо приложение
- [ ] Направен rebuild с `--clear-cache`
- [ ] Инсталирано ново приложение
- [ ] Тествана WebView карта функционалност

## 🎯 Ако все още не работи

### Проверете EAS Build configuration:
```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Проверете дали модулът е в dependencies:
```bash
npm ls react-native-webview
# Трябва да покаже версия 13.8.6
```

### Debug native modules:
```bash
npx react-native info
npx expo config --type introspect
```

## 🚀 Финален тест

След успешен rebuild:
1. Отворете приложението
2. Влезте като client/driver  
3. Трябва да видите Leaflet карта вместо placeholder
4. Проверете console за "🗺️ Leaflet map loaded"

---

**💡 ВАЖНО:** В development build native модули изискват rebuild, не са hot-reloadable! 