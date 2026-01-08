# 🔴 CRITICAL: Race condition при acceptBid() - множество clients могат да приемат различни bids

## Labels
`critical`, `bug`, `security`, `P0`

## Milestone
Phase 1 - Critical Fixes

## Описание

Установен е **критичен race condition** при приемане на оферти. Множество клиенти могат едновременно да приемат различни bids за същия order, което води до:

- Data corruption в Firestore
- Объркани потребители 
- Потенциални финансови проблеми
- Нарушена бизнес логика

## 📍 Засегнати файлове

- **Главен файл**: `src/services/firestore.ts` (около ред 610)
- **Функция**: `acceptBid(orderId, bidId)`
- **UI файл**: `src/hooks/client/useClientPayments.ts` (ред 259)

## 🔍 Техническия проблем

```javascript
// ТЕКУЩ КОД (ПРОБЛЕМЕН):
export const acceptBid = async (orderId: string, bidId: string): Promise<void> => {
  const batch = writeBatch(db);
  
  // ❌ НЕ проверява дали order статуса все още е 'bidding'
  // ❌ Няма atomic transaction protection
  
  batch.update(orderRef, { status: 'accepted', acceptedBidId: bidId });
  batch.update(bidRef, { status: 'accepted' });
  
  await batch.commit(); // ❌ Race condition тук!
};
```

## ✅ Решение

### Стъпка 1: Atomic Transaction
```javascript
// НОВ КОД (БЕЗОПАСЕН):
export const acceptBid = async (orderId: string, bidId: string): Promise<void> => {
  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
    const orderSnap = await transaction.get(orderRef);
    
    // ✅ Атомична проверка на статуса
    if (orderSnap.data()?.status !== 'bidding') {
      throw new Error('Order is no longer available for bidding');
    }
    
    // ✅ Всички операции в една transaction
    transaction.update(orderRef, { 
      status: 'accepted', 
      acceptedBidId: bidId,
      acceptedAt: serverTimestamp()
    });
    
    const bidRef = doc(db, COLLECTIONS.BIDS, bidId);
    transaction.update(bidRef, { status: 'accepted' });
  });
};
```

### Стъпка 2: UI Error Handling
```javascript
// src/hooks/client/useClientPayments.ts
try {
  await acceptBid(activeOrder.id, bidId);
  // Success handling...
} catch (error) {
  if (error.message.includes('no longer available')) {
    setCustomModal({
      title: 'Офертата вече е приета',
      message: 'Друг клиент е приел тази оферта преди вас. Моля изберете друга.',
      onConfirm: () => refreshBids()
    });
    return;
  }
  // Handle other errors...
}
```

## 📋 Implementation Checklist

### Backend Changes
- [ ] Замяна на `writeBatch` с `runTransaction` в `acceptBid()`
- [ ] Добавяне на status validation в transaction
- [ ] Добавяне на `acceptedAt` timestamp
- [ ] Import на `runTransaction` от Firebase

### Frontend Changes  
- [ ] Обновяване на error handling в `useClientPayments.ts`
- [ ] Specific error messages за race condition
- [ ] UI feedback за "bid already accepted" scenarios
- [ ] Auto-refresh на bids list при грешка

### Testing
- [ ] Unit tests за race condition scenarios
- [ ] Integration tests с concurrent bid acceptance
- [ ] Manual testing с два devices едновременно
- [ ] Performance testing на transaction overhead

### Documentation
- [ ] Обновяване на код коментари
- [ ] README security considerations
- [ ] Changelog entry
- [ ] API documentation update

## 🧪 Test Scenarios

1. **Concurrent Bid Acceptance**
   - Двама клиенти приемат различни bids едновременно
   - Очакван резултат: Само един успешен, другия получава error

2. **Network Latency Test**
   - Slow network conditions
   - Очакван резултат: Transaction timeout handling

3. **Order Status Changes**
   - Order expired по време на bid acceptance
   - Очакван резултат: Подходящо error handling

## 🎯 Definition of Done

- [ ] `acceptBid()` използва `runTransaction` 
- [ ] Няма race conditions при concurrent access
- [ ] UI показва clear error messages
- [ ] Unit tests покриват edge cases
- [ ] Manual testing с multiple devices преминал успешно
- [ ] Performance impact е минимален
- [ ] Documentation е обновена

## 🚨 Priority Justification

**Priority: P0 (Highest)**

Този bug:
- ✅ Блокира production deployment
- ✅ Може да причини data corruption 
- ✅ Създава финансови рискове
- ✅ Нарушава core business logic

## ⏱️ Time Estimate

**3-4 дни** общо:
- День 1: Backend transaction implementation
- День 2: Frontend error handling 
- День 3: Testing и debugging
- День 4: Documentation и final validation

## 🔗 Related Issues

- Issue #2: Double Payment Protection (related payment flow)
- Issue #9: Generic Error Handling (improved error system)

---

**Created**: December 2024  
**Last Updated**: December 2024 