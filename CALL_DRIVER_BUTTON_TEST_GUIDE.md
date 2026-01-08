# 📞 Call Driver Button - Test Guide

## 🎯 Цел
Тестване на новия бутон "Обади се" в панела "ОФЕРТА ПРИЕТА" който позволява на клиенти да се обаждат директно на шофьора.

## ✨ Новата функционалност
- **File**: `src/components/client/ActiveOrderPanel/index.tsx`
- **Feature**: Бутон "Обади се" в accepted order панела
- **Function**: Отваря phone dialer-а с телефонния номер на шофьора

## 🧪 Как да тествате

### 1. **Създайте заявка и приемете оферта**
1. Влезте като клиент и създайте заявка
2. Влезте като шофьор и изпратете оферта с валиден телефонен номер
3. Върнете се при клиента и приемете офертата
4. Минете през payment процеса
5. ✅ Вижте панела "ОФЕРТА ПРИЕТА!" с име на шофьора

### 2. **Проверете UI на call бутона**
1. В панела "ОФЕРТА ПРИЕТА!" трябва да видите:
   - ✅ Checkmark икона (зелена)
   - ✅ "Оферта приета!" заглавие
   - ✅ Име на шофьора
   - ✅ **НОВ**: Зелен бутон "Обади се" с телефон икона
   - ✅ "Чака да пристигне" подзаглавие

### 3. **Тествайте call функционалността**
1. Натиснете бутона "Обади се"
2. ✅ Трябва да се отвори phone dialer-а на устройството
3. ✅ Номерът на шофьора трябва да е автоматично попълнен
4. ✅ Можете да се обадите нормално

### 4. **Проверете console логовете**
Отворете console и търсете тези логове:
```
📞 [ActiveOrderPanel] Attempting to call driver: {
  acceptedBidId: "bid_123",
  foundBid: true,
  driverPhone: "+359887123456"
}
📞 Opening dialer with URL: tel:+359887123456
```

## 🎯 UI Дизайн

### Call Button Styling:
- **Background**: Зелен цвят `#10B981` (matching checkmark)
- **Shape**: Закръглен с `borderRadius: 20`
- **Content**: Call икона + "Обади се" текст
- **Size**: Medium padding, prominent but not overwhelming
- **Position**: Между името на шофьора и "Чака да пристигне"

### Layout Order:
1. ✅ Checkmark икона
2. ✅ "Оферта приета!" заглавие
3. ✅ Име на шофьора
4. ✅ **Call бутон**
5. ✅ "Чака да пристигне"

## 🔍 Error Handling Tests

### 1. **Няма телефонен номер**
1. Създайте bid без телефонен номер (само за dev тестване)
2. Приемете офертата
3. Натиснете "Обади се"
4. ✅ Трябва да видите Alert: "Телефонният номер на шофьора не е наличен."

### 2. **Device не поддържа обаждания**
1. На емулатор без tel: support
2. Натиснете "Обади се"
3. ✅ Трябва да видите Alert: "Не можете да се обадите от това устройство."

### 3. **General linking грешка**
1. При неочаквани грешки
2. ✅ Трябва да видите Alert: "Възникна проблем при отварянето на телефона."

## 🎛️ Data Flow

### Input Data:
- `activeOrder.acceptedBidId` → ID на приетата оферта
- `bids` array → съдържа bid с driverInfo
- `bid.driverInfo.phone` → телефонният номер на шофьора

### Function Logic:
1. `handleCallDriver()` се извиква при натискане
2. Намира bid с `acceptedBidId`
3. Извлича `driverInfo.phone`
4. Използва `Linking.openURL('tel:' + phone)`
5. Error handling за различни случаи

## 🧪 Test Scenarios

### ✅ Happy Path:
- [ ] Панелът показва call бутона правилно
- [ ] Бутонът отваря dialer-а с correct номер
- [ ] UI е красив и intuitive
- [ ] Console логовете са правилни

### ✅ Edge Cases:
- [ ] Работи когато няма driverInfo
- [ ] Работи когато няма phone в driverInfo
- [ ] Graceful error handling при linking проблеми
- [ ] Не показва бутона за не-accepted заявки

### ✅ Device Compatibility:
- [ ] Работи на Android устройства
- [ ] Работи на iOS устройства  
- [ ] Graceful degradation на емулатори
- [ ] Правилни error messages

## 📱 Platform Specifics

### Android:
- `tel:` protocol се поддържа нативно
- Dialer се отваря с попълнен номер
- Потребителят може да натисне dial бутона

### iOS:
- `tel:` protocol се поддържа нативно
- Phone app се отваря с номера
- Automatic dialing зависи от iOS настройките

### Emulators:
- Може да няма tel: support
- Graceful error handling чрез `Linking.canOpenURL()`

## 🎉 Success Criteria

✅ **READY TO SHIP** когато:
- Call бутонът се показва само за accepted orders
- Clicking отваря dialer-а с correct phone number
- Beautiful UI integration in accepted panel
- Proper error handling за all edge cases
- Console logging за debugging purposes
- No regression в existing functionality

## 📊 User Experience Impact

### **Before**:
- Приемаш оферта → знаеш името на шофьора
- За да се обадиш → трябва да търсиш номера другаде

### **After**:
- Приемаш оферта → знаеш името на шофьора
- За да се обадиш → натискаш "Обади се" бутона
- Директно се отваря dialer-а → instant communication

**Result**: Много по-smooth communication между клиент и шофьор! 📞✨

## 🛡️ Security Notes

- Phone номерата се взимат от verified bid data
- Linking API е safe - само отваря dialer
- Няма automatic dialing без потребителско съгласие
- Error handling предпазва от crashes 