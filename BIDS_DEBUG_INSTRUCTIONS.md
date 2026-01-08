# Инструкции за дебъгиране на проблема с bids

## Проблем
Модалът "Получени оферти" е празен - не се показват офертите от шофьорите.

## Направени поправки

### 1. Поправен bid submission в DriverHomeScreen ✅
- Добавена проверка на статуса преди обновяване на заявката
- Заявката се обновява на 'bidding' статус когато се получи bid

### 2. Поправен TouchableOpacity в ActiveOrderPanel ✅  
- Променено условието за показване на BidsModal
- Функцията `onShowBids()` сега се вика правилно

### 3. Добавен debug logging 🔍
- В `useClientOrders` hook
- В `useDriverOrders` hook  
- В `ClientHomeScreen`
- В `ActiveOrderPanel`
- В `BidsModal`
- В `subscribeToBidsForOrder` функция

## Стъпки за тестване

### 1. Стартиране на приложението
```bash
npx expo start --dev-client --clear
```

### 2. Тестване на bids flow
1. **Влезте като клиент** и създайте нова заявка
2. **Влезте като шофьор** и изпратете оферта  
3. **Върнете се при клиента** и натиснете на панела с активната заявка
4. **Проверете дали се показва BidsModal** с офертите

### 3. Проследяване на логовете
Следете тези ключови логове в Metro bundler:

#### При създаване на заявка (клиент):
```
🔍 [ClientHomeScreen] Current state: { activeOrderId: ..., activeOrderStatus: "searching", bidsCount: 0 }
🔄 [useClientOrders] Setting up bids subscription for order: ...
```

#### При изпращане на оферта (шофьор):
```
🔄 [useDriverOrders] Order status before bid submission: { orderId: ..., currentStatus: "searching", willUpdate: true }
✅ [useDriverOrders] Order status updated to bidding for order: ...
```

#### При получаване на bids (клиент):
```
📥 [subscribeToBidsForOrder] Bids snapshot received: { orderId: ..., snapshotSize: 1, isEmpty: false }
📄 [subscribeToBidsForOrder] Processing bid document: { bidId: ..., proposedPrice: 50, driverName: "...", status: "pending" }
✅ [subscribeToBidsForOrder] Calling callback with bids: { orderId: ..., bidsCount: 1, bids: [...] }
📥 [useClientOrders] Received bids update: { orderId: ..., bidsCount: 1, bids: [...] }
🔍 [ClientHomeScreen] Current state: { ..., bidsCount: 1, showBidsModal: false }
```

#### При натискане на панела (клиент):
```
🔍 [ActiveOrderPanel] TouchableOpacity pressed: { status: "bidding", canShowBids: true, bidsCount: 1 }
✅ [ActiveOrderPanel] Calling onShowBids()
🔍 [ClientHomeScreen] onShowBids called - setting showBidsModal to true
🔍 [ClientHomeScreen] Current state: { ..., showBidsModal: true }
🔍 [BidsModal] Render state: { visible: true, activeOrderStatus: "bidding", shouldShowModal: true, bidsCount: 1 }
```

## Възможни проблеми за проверка

### 1. Няма активна заявка
- Проверете дали заявката е създадена успешно
- Проверете дали заявката не е изтекла

### 2. Няма bid-ове в базата
- Проверете дали bid-ът е създаден успешно от шофьора
- Проверете Firestore правилата за достъп до bids колекцията

### 3. Проблем с bids subscription
- Проверете дали subscription-ът се създава правилно  
- Проверете дали callback-ът се вика с правилни данни

### 4. Проблем с UI состоянието
- Проверете дали `showBidsModal` се задава на true
- Проверете дали `BidsModal` получава правилните props

## Бързо решение ако проблемът продължава

Ако логовете показват че bids се получават правилно, но модалът остава празен, проверете:

1. **BidsModal shouldShowModal логика**:
```typescript
const shouldShowModal = visible && 
  !!activeOrder && 
  ['pending', 'searching', 'bidding'].includes(activeOrder.status);
```

2. **Bids данни формат**:
Уверете се че bid обектите имат правилния формат:
```typescript
{
  id: string,
  proposedPrice: number,
  driverInfo: { name: string },
  status: 'pending' | 'accepted' | 'rejected',
  createdAt: Date
}
```

3. **Тайминг проблем**:
Възможно е bids да пристигат след затваряне на модала - проверете редоследа на логовете. 