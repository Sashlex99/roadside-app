# Phase 1: База Данни и Структура
## Roadside Assistance App - Backend Implementation

### 🗂 Firestore Колекции

Създадените колекции в Firebase Firestore:

#### 1. `users` - Потребители (Клиенти и Шофьори)
```typescript
interface User {
  uid: string;                    // Firebase Auth UID
  email: string;                  // Email адрес
  fullName: string;               // Пълно име
  phone?: string;                 // Телефонен номер
  userType: 'client' | 'driver';  // Тип потребител
  role: 'admin' | 'client' | 'driver'; // Роля в системата
  verificationStatus: 'pending' | 'approved' | 'rejected'; // Статус на верификация
  isDeleted?: boolean;            // Soft delete флаг
  createdAt: Date;                // Дата на създаване
  updatedAt: Date;                // Дата на последна промяна
}
```

**Допълнителни полета за шофьори:**
- `isOnline: boolean` - дали шофьорът приема поръчки
- `currentLocation` - текуща GPS локация
- `vehicleInfo` - информация за превозното средство
- `totalOrdersCompleted` - брой завършени поръчки
- `averageRating` - средна оценка от клиенти

#### 2. `orders` - Заявки за помощ
```typescript
interface Order {
  id: string;                     // Уникален идентификатор
  clientId: string;               // UID на клиента
  clientInfo: {                   // Информация за клиента
    name: string;
    phone: string;
  };
  
  // Основни данни
  description: string;            // Описание на проблема
  images: string[];               // URLs на снимки в Firebase Storage
  location: {                     // GPS координати и адрес
    latitude: number;
    longitude: number;
    address: string;
  };
  
  // Статус и времеви ограничения
  status: OrderStatus;            // Текущ статус на заявката
  createdAt: Date;                // Време на създаване
  updatedAt: Date;                // Последна промяна
  expiresAt: Date;                // Изтича след 5 минути
  
  // Търсене на шофьори
  searchRadius: number;           // Текущ радиус на търсене (започва от 5км)
  maxRadius: number;              // Максимален радиус (50км)
  
  // Избрана оферта
  acceptedBidId?: string;         // ID на приетата оферта
  acceptedDriverId?: string;      // ID на избрания шофьор
  finalPrice?: number;            // Финална цена
  platformFee?: number;           // 15% такса на платформата
}
```

**Статуси на заявка:**
- `pending` - Току-що създадена
- `searching` - Търсене на шофьори в радиус
- `bidding` - Шофьори правят оферти
- `accepted` - Клиент е приел оферта
- `in_progress` - Шофьор работи по заявката
- `completed` - Приключена успешно
- `cancelled` - Отменена
- `expired` - Изтекъл 5-минутния таймер

#### 3. `orders/{orderId}/bids` - Оферти (под-колекция)
```typescript
interface Bid {
  id: string;                     // Уникален идентификатор
  orderId: string;                // Връзка към заявката
  driverId: string;               // UID на шофьора
  driverInfo: {                   // Информация за шофьора
    name: string;
    phone: string;
    rating?: number;
    vehicleInfo?: object;
  };
  
  // Офертата
  proposedPrice: number;          // Предложена цена
  estimatedArrivalTime: number;   // Минути до пристигане
  driverLocation: object;         // Текуща локация на шофьора
  distanceToClient: number;       // Разстояние до клиента в км
  message?: string;               // Съобщение от шофьора
  
  // Статус и времеви данни
  status: 'active' | 'accepted' | 'rejected' | 'expired';
  createdAt: Date;
  expiresAt: Date;                // Bid-овете също изтичат
}
```

#### 4. `driverLocations` - Real-time локации на шофьори
```typescript
interface DriverLocation {
  driverId: string;               // UID на шофьора
  orderId?: string;               // Ако е в активна поръчка
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  heading?: number;               // Посока на движение
  speed?: number;                 // Скорост в км/ч
  timestamp: Date;                // Време на записа
}
```

#### 5. `notifications` - Push notifications
```typescript
interface Notification {
  id: string;
  userId: string;                 // Получател
  type: 'new_order' | 'bid_received' | 'bid_accepted' | 'order_update';
  title: string;
  message: string;
  data?: {                        // Допълнителни данни
    orderId?: string;
    bidId?: string;
    driverId?: string;
  };
  isRead: boolean;
  createdAt: Date;
}
```

### 🔐 Security Rules

Firestore Security Rules обезпечават:

- **Потребители** могат да четат/обновяват само собствените си данни
- **Клиенти** могат да създават заявки само за себе си
- **Шофьори** могат да виждат активни заявки и да правят оферти
- **Админи** имат пълен достъп до всички данни
- **Bid-ове** могат да се четат от всички (за сравнение на оферти)
- **Локации** на шофьори са видими само на клиенти с активна поръчка

### 🛠 Основни функции в Firestore Service

#### Order Operations
```typescript
// Създаване на заявка
createOrder(orderData): Promise<string>

// Получаване на заявка
getOrder(orderId): Promise<Order | null>

// Обновяване на статус
updateOrderStatus(orderId, status, additionalData?): Promise<void>

// Търсене в радиус
findOrdersInRadius(driverLocation, radiusKm): Promise<Order[]>

// Real-time listener за клиенти
subscribeToClientOrders(clientId, callback): Unsubscribe
```

#### Bid Operations
```typescript
// Създаване на оферта
createBid(bidData): Promise<string>

// Получаване на оферти за заявка
getBidsForOrder(orderId): Promise<Bid[]>

// Приемане на оферта
acceptBid(orderId, bidId): Promise<void>

// Real-time listener за оферти
subscribeToBidsForOrder(orderId, callback): Unsubscribe
```

#### Driver Location Tracking
```typescript
// Обновяване на локация
updateDriverLocation(driverId, location): Promise<void>

// Получаване на локация
getDriverLocation(driverId): Promise<DriverLocation | null>
```

### 📊 Workflow Схема

1. **Клиент създава заявка** → статус: `pending`
2. **Система търси шофьори в 5км** → статус: `searching`
3. **Шофьори правят оферти** → статус: `bidding`
4. **Клиент избира оферта** → статус: `accepted`
5. **Шофьор работи** → статус: `in_progress`
6. **Приключва работата** → статус: `completed`

### ⏰ Времеви ограничения

- **Заявки изтичат** след 5 минути от създаване
- **Bid-ове изтичат** след 10 минути от създаване
- **Радиусът се увеличава** автоматично ако няма шофьори в близост
- **Платформата взема 15% такса** от финалната цена

### 🔄 Next Steps

Phase 1 осигурява:
✅ Комплетна database структура  
✅ TypeScript типове за type safety  
✅ Security rules за защита на данните  
✅ Основни CRUD операции  
✅ Real-time listeners за live updates  

**Готови за Phase 2**: Real-time връзка клиент-шофьор с live данни! 