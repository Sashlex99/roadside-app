# 🔘 "Нова заявка" Button Fix - Test Guide

## 🎯 Цел
Тестване на поправката за бутона "Нова заявка" в order expiration modal.

## 🐛 Проблемът (преди fix-а)
- Когато времето за заявка изтече, modal показваше бутон "Нова заявка"
- Натискането на бутона затваряше modal-а но НЕ отваряше request panel-а
- Потребителят трябваше ръчно да натисне "Заяви помощ" бутона

## ✅ Решението (след fix-а)
- **File**: `src/hooks/client/useClientOrders.ts` + `src/screens/client/ClientHomeScreen.tsx`
- **Feature**: Директно отваряне на request modal от expiration modal
- **Technical**: Подадена `setShowRequestModal` функция към hook-а

## 🧪 Как да тествате

### 1. **Създайте заявка и изчакайте изтичане**
1. Отворете приложението като клиент
2. Натиснете "Заяви помощ" и създайте заявка
3. Изчакайте 2-минутният timer да стигне 0:00
4. ✅ Expiration modal се появява с "Времето изтече"

### 2. **Тествайте "Нова заявка" бутона**
1. В expiration modal натиснете **"Нова заявка"**
2. ✅ Expiration modal се затваря (300ms delay)
3. ✅ Request modal се отваря автоматично
4. ✅ Може веднага да попълните нова заявка

### 3. **Сравнете с "Разбрах" бутона**
1. Създайте друга заявка и изчакайте да изтече
2. Натиснете **"Разбрах"** 
3. ✅ Само expiration modal се затваря
4. ✅ Трябва ръчно да натиснете "Заяви помощ" за нова заявка

## 🎯 Очаквани резултати

### ✅ Успешен тест:
- [ ] "Нова заявка" затваря expiration modal
- [ ] Request modal се отваря автоматично след 300ms
- [ ] Формата е празна и готова за попълване
- [ ] Няма грешки в console
- [ ] User experience е smooth без "задръстване"

### 🔧 Технически детайли:
- **Delay**: 300ms между затваряне и отваряне за smooth UX
- **State Management**: `setShowRequestModal(true)` се извиква директно
- **Dependencies**: Правилна order на state declarations
- **Hook Integration**: `setShowRequestModal` се подава към `useClientOrders`

## 🐛 Troubleshooting

Ако "Нова заявка" НЕ отваря request modal:
1. Проверете console за грешки
2. Вижте дали `setShowRequestModal` е правилно подаден
3. Проверете дали има duplicate state declarations

Ако има lag между бутоните:
1. 300ms delay е нормален за smooth UX
2. Ако е твърде дълъг, може да се намали

## 📱 Edge Cases за тестване

1. **Бързо натискане**: Двойно натискане на "Нова заявка"
2. **Навигация**: Back button по време на modal transition
3. **Мрежа**: Offline/online по време на modal operations
4. **Concurrent modals**: Други modals отворени едновременно

## 🎉 Success Criteria

✅ **READY TO SHIP** когато:
- Expiration modal → "Нова заявка" → Request modal flow работи smooth
- Няма duplicate modals или stuck states
- Console е чист без грешки
- UX се чувства естествен и бърз

## 🚀 User Experience Impact

### **Before Fix:**
1. Timer изтича → Modal → "Нова заявка" → Modal се затваря
2. Потребителят се чуди "какво сега?"
3. Трябва да намери и натисне "Заяви помощ" ръчно

### **After Fix:**  
1. Timer изтича → Modal → "Нова заявка" → Request modal директно!
2. Seamless workflow без прекъсване
3. 50% по-малко clicks за нова заявка 