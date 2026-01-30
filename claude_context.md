# Claude Context - Roadside Assistance App

## Quick Start

```bash
npx expo start --dev-client --tunnel
```

## Project Overview

**What is this?** A Bulgarian mobile app for roadside assistance that connects clients with drivers for fast, reliable help on the road. Think of it as "Uber for tow trucks" - clients request help, drivers bid on jobs, and payments are handled seamlessly.

- **Type**: Expo React Native app (SDK 53)
- **Name**: roadside-assistance
- **React Native Version**: 0.79.4
- **Language**: Bulgarian UI (Българско приложение за пътна помощ)
- **Target Users**: Bulgarian drivers and clients needing roadside assistance

---

## Technology Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.79.4 | Cross-platform mobile framework |
| Expo SDK | 53 | Development platform with native modules |
| TypeScript | 5.x | Type-safe JavaScript |
| React | 18.x | UI component library |

### Navigation & State
| Technology | Purpose | Key Files |
|------------|---------|-----------|
| React Navigation (Stack) | Screen navigation | `src/navigation/` |
| React Context | Global state (Auth) | `src/contexts/AuthContext.tsx` |
| React Hooks | Local state & effects | All `src/hooks/` files |

### Backend & Database
| Service | Purpose | Region |
|---------|---------|--------|
| Firebase Firestore | Real-time NoSQL database | `europe-west3` (Frankfurt) |
| Firebase Auth | User authentication | - |
| Firebase Cloud Functions | Serverless backend | `europe-west3` |
| Firebase Storage | Image uploads | - |

### Payments
| Technology | Purpose | Key Files |
|------------|---------|-----------|
| Stripe Payment Sheet | Native payment UI | `src/hooks/usePaymentSheet.ts` |
| Apple Pay | iOS payments | Configured in `app.json` |
| Google Pay | Android payments | Configured in `app.json` |
| **Currency**: EUR | All transactions | `functions/src/payments.ts` |
| **Platform Fee**: 15% | Revenue model | `functions/src/payments.ts` |

### Maps & Location
| Technology | Purpose | Key Files |
|------------|---------|-----------|
| Google Maps SDK | Native maps | `src/components/shared/NativeMap.tsx` |
| react-native-maps | Map component | `NativeMap.tsx` |
| expo-location | GPS & geocoding | `src/services/locationService.ts` |
| Google Directions API | ETA calculation | `src/services/directionsService.ts` |

### Notifications
| Technology | Purpose |
|------------|---------|
| expo-notifications | Push notifications |
| Firebase Cloud Messaging | Notification delivery |

---

## Project Structure

```
roadside-assistance-travel/
├── src/
│   ├── components/                    # Reusable UI components
│   │   ├── client/                    # Client-specific components
│   │   │   ├── ActiveOrderPanel/      # Shows active order status & ETA
│   │   │   ├── RequestButton.tsx      # "Request Help" floating button
│   │   │   └── modals/
│   │   │       ├── BidsModal.tsx      # Shows driver bids
│   │   │       ├── PaymentModal.tsx   # Payment confirmation
│   │   │       ├── RequestModal.tsx   # New request form
│   │   │       └── SettingsModal.tsx  # Client settings
│   │   ├── driver/                    # Driver-specific components
│   │   │   ├── ActiveJobPanel/        # Shows accepted job details
│   │   │   ├── OrderCard.tsx          # Available order in list
│   │   │   └── modals/
│   │   │       ├── BidModal.tsx       # Submit bid form
│   │   │       └── JobDetailsModal.tsx
│   │   └── shared/                    # Shared components
│   │       ├── CustomModal.tsx        # Reusable modal wrapper
│   │       ├── Header.tsx             # App header with location
│   │       └── NativeMap.tsx          # Google Maps component
│   │
│   ├── screens/                       # Screen components
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   ├── client/
│   │   │   ├── ClientHomeScreen.tsx   # Main client screen
│   │   │   └── MyOrdersScreen.tsx     # Order history
│   │   └── driver/
│   │       └── DriverHomeScreen.tsx   # Main driver screen
│   │
│   ├── hooks/                         # Custom React hooks
│   │   ├── client/
│   │   │   ├── useClientOrders.ts     # Order subscription & status
│   │   │   ├── useClientPayments.ts   # Payment flow orchestration
│   │   │   ├── useDriverETA.ts        # ETA calculation
│   │   │   ├── useDriverTracking.ts   # Real-time driver location
│   │   │   └── useNearbyDrivers.ts    # Nearby drivers subscription
│   │   ├── driver/
│   │   │   ├── useDriverOrders.ts     # Available orders
│   │   │   └── useDriverLocationPublisher.ts  # Location broadcasting
│   │   └── shared/
│   │       └── useCurrentLocation.ts  # GPS location hook
│   │
│   ├── services/                      # External services & APIs
│   │   ├── firestore/                 # Firestore operations
│   │   │   ├── index.ts               # Main exports
│   │   │   ├── orders.ts              # Order CRUD
│   │   │   ├── bids.ts                # Bid operations
│   │   │   ├── locations.ts           # Driver locations
│   │   │   └── users.ts               # User operations
│   │   ├── directionsService.ts       # Google Directions API
│   │   ├── locationService.ts         # Location & geocoding
│   │   ├── stripeService.ts           # Stripe API calls
│   │   └── firestoreREST.ts           # REST API fallback
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx            # Authentication context
│   │
│   ├── types/                         # TypeScript definitions
│   │   ├── client.ts                  # Client types
│   │   ├── driver.ts                  # Driver types
│   │   ├── firestore.ts               # Firestore document types
│   │   └── shared.ts                  # Shared types
│   │
│   ├── constants/
│   │   └── colors.ts                  # App color palette
│   │
│   ├── config/
│   │   └── firebase.ts                # Firebase initialization
│   │
│   └── utils/                         # Utility functions
│       ├── circuitBreakerInstances.ts
│       ├── timeoutUtils.ts
│       └── alertingSystem.ts
│
├── functions/                         # Firebase Cloud Functions
│   └── src/
│       ├── index.ts                   # Function exports
│       ├── payments.ts                # Payment processing
│       ├── notifications.ts           # Push notifications
│       └── ordersOnCreate.ts          # Order triggers
│
├── admin-panel/                       # Separate React admin app
│
├── app.json                           # Expo configuration
├── eas.json                           # EAS Build configuration
└── claude_context.md                  # This file
```

---

## Core Features & Implementation

### 1. Client Flow

#### Creating a Request
```
Client opens app → Location detected → Press "Заявка" button →
Fill form (problem description, photos) → Submit →
Order created in Firestore → Drivers notified →
Wait for bids (20-min timer)
```

**Key Files:**
- `src/screens/client/ClientHomeScreen.tsx` - Main screen
- `src/components/client/modals/RequestModal.tsx` - Request form
- `src/services/firestore/orders.ts` - `createOrder()` function

**Code Example - Creating Order:**
```typescript
// src/services/firestore/orders.ts
export async function createOrder(orderData: CreateOrderData): Promise<string> {
  const orderRef = await addDoc(collection(db, 'orders'), {
    clientId: orderData.clientId,
    description: orderData.description,
    location: orderData.location,
    status: 'pending',
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes
  });
  return orderRef.id;
}
```

#### Viewing Bids
```
Bids arrive in real-time → Badge shows count →
Tap panel to see bids → Compare prices & driver ratings →
Accept bid → Payment Sheet opens
```

**Key Files:**
- `src/hooks/client/useClientOrders.ts` - Real-time order & bid subscription
- `src/components/client/modals/BidsModal.tsx` - Bid list UI

**Code Example - Bid Subscription:**
```typescript
// src/hooks/client/useClientOrders.ts
useEffect(() => {
  if (!activeOrder?.id) return;

  const unsub = subscribeToBidsForOrder(activeOrder.id, (bids) => {
    setBids(bids);
    // Find accepted driver name
    if (activeOrder.status === 'accepted' && activeOrder.acceptedBidId) {
      const acceptedBid = bids.find(b => b.id === activeOrder.acceptedBidId);
      setAcceptedDriverName(acceptedBid?.driverInfo?.name || '');
    }
  });

  return () => unsub();
}, [activeOrder?.id]);
```

#### Payment Flow
```
Accept bid → Bid reserved → Payment Sheet opens →
Apple Pay / Google Pay / Card → Payment succeeds →
processPayment() called → Order status = 'accepted' →
Driver sees job, client sees tracking
```

**Key Files:**
- `src/hooks/client/useClientPayments.ts` - Payment orchestration
- `src/hooks/usePaymentSheet.ts` - Stripe Payment Sheet
- `functions/src/payments.ts` - Server-side processing

**Code Example - Payment Initialization:**
```typescript
// src/hooks/usePaymentSheet.ts
const { initPaymentSheet, presentPaymentSheet } = useStripe();

const initializePayment = async (bidId: string, amount: number) => {
  // Get payment intent from server
  const { clientSecret, ephemeralKey, customerId } = await createPaymentIntent({
    bidId,
    amount,
    currency: 'eur'
  });

  // Initialize native Payment Sheet
  await initPaymentSheet({
    merchantDisplayName: 'Пътна Помощ',
    paymentIntentClientSecret: clientSecret,
    customerEphemeralKeySecret: ephemeralKey,
    customerId,
    applePay: { merchantCountryCode: 'BG' },
    googlePay: { merchantCountryCode: 'BG', testEnv: __DEV__ }
  });
};
```

### 2. Driver Flow

#### Going Online
```
Driver opens app → Toggle "Online" switch →
Location publishing starts (every 10s) →
Available orders appear in list
```

**Key Files:**
- `src/screens/driver/DriverHomeScreen.tsx` - Main driver screen
- `src/hooks/driver/useDriverLocationPublisher.ts` - Location broadcasting

**Code Example - Location Publishing:**
```typescript
// src/hooks/driver/useDriverLocationPublisher.ts
export function useDriverLocationPublisher({
  driverId,
  isOnline,
  location,
  activeOrderId
}: UseDriverLocationPublisherParams) {
  useEffect(() => {
    if (!driverId || !isOnline || !location) return;

    // Publish immediately
    updateDriverLocation(driverId, location, true, activeOrderId);

    // Then every 10 seconds
    const interval = setInterval(() => {
      updateDriverLocation(driverId, location, true, activeOrderId);
    }, 10000);

    return () => {
      clearInterval(interval);
      // Mark offline when unmounting
      updateDriverLocation(driverId, location, false, null);
    };
  }, [driverId, isOnline, location?.latitude, location?.longitude]);
}
```

#### Bidding on Orders
```
See order card → View details → Enter price →
Submit bid → Wait for client response →
If accepted: Job appears in "Active Job" panel
```

**Key Files:**
- `src/hooks/driver/useDriverOrders.ts` - Available orders subscription
- `src/components/driver/modals/BidModal.tsx` - Bid submission form
- `src/services/firestore/bids.ts` - `createBid()` function

#### Completing Jobs
```
Navigate to client → Tap "Start Job" →
Perform service → Tap "Complete" →
Order status = 'completed' → Client notified
```

### 3. Real-time Tracking System

#### Nearby Drivers on Client Map
Shows all online drivers within 50km as orange tow truck markers.

**Data Flow:**
```
Driver goes online →
useDriverLocationPublisher publishes to driverLocations/{id} →
Client's useNearbyDrivers subscribes with onSnapshot →
Filter: isOnline=true, timestamp<2min, distance<50km →
NativeMap renders orange markers
```

**Key Files:**
- `src/hooks/client/useNearbyDrivers.ts`
- `src/services/firestore/locations.ts` - `subscribeToNearbyDrivers()`
- `src/components/shared/NativeMap.tsx`

**Code Example - Nearby Drivers Subscription:**
```typescript
// src/services/firestore/locations.ts
export function subscribeToNearbyDrivers(
  clientLocation: LocationData,
  radiusKm: number,
  callback: (drivers: DriverLocation[]) => void
): () => void {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const q = query(
    collection(db, 'driverLocations'),
    where('isOnline', '==', true),
    where('timestamp', '>=', twoMinutesAgo)
  );

  return onSnapshot(q, (snapshot) => {
    const drivers = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as DriverLocation))
      .filter(driver => {
        const distance = calculateDistance(
          clientLocation.latitude, clientLocation.longitude,
          driver.location.latitude, driver.location.longitude
        );
        return distance <= radiusKm;
      });
    callback(drivers);
  });
}

// Haversine distance formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

#### Driver Tracking During Active Order
Shows driver's real-time location as green marker when order is accepted.

**Data Flow:**
```
Client accepts bid → Order.acceptedDriverId set →
useDriverTracking subscribes to driverLocations/{acceptedDriverId} →
Driver publishes location every 10s →
useDriverETA calculates route via Google Directions API →
ActiveOrderPanel shows "Очаквано пристигане: X мин"
```

**Key Files:**
- `src/hooks/client/useDriverTracking.ts` - Driver location subscription
- `src/hooks/client/useDriverETA.ts` - ETA calculation
- `src/services/directionsService.ts` - Google Directions API

**Code Example - ETA Calculation:**
```typescript
// src/services/directionsService.ts
export async function getETA(
  origin: Coordinates,
  destination: Coordinates
): Promise<ETAResult | null> {
  const apiKey = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return getEstimatedETA(origin, destination); // Fallback

  const url = `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${origin.latitude},${origin.longitude}&` +
    `destination=${destination.latitude},${destination.longitude}&` +
    `language=bg&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'OK' && data.routes.length > 0) {
    const leg = data.routes[0].legs[0];
    return {
      durationMinutes: Math.ceil(leg.duration.value / 60),
      durationText: formatDurationBulgarian(leg.duration.value),
      distanceKm: leg.distance.value / 1000,
      distanceText: leg.distance.text
    };
  }
  return getEstimatedETA(origin, destination);
}

// Fallback using Haversine + average speed
export function getEstimatedETA(origin: Coordinates, destination: Coordinates): ETAResult {
  const distanceKm = calculateDistance(
    origin.latitude, origin.longitude,
    destination.latitude, destination.longitude
  );
  const avgSpeedKmh = 40; // City driving average
  const durationMinutes = Math.ceil((distanceKm / avgSpeedKmh) * 60);

  return {
    durationMinutes,
    durationText: formatDurationBulgarian(durationMinutes * 60),
    distanceKm,
    distanceText: `${distanceKm.toFixed(1)} км`
  };
}
```

### 4. Notification System

#### Client Notifications
- **Order completion:** "Поръчката е завършена" with green checkmark
- **Order cancellation:** "Поръчката е отказана" with neutral icon
- **Order expiration:** "Времето изтече" after 20 minutes
- **Payment success:** "Плащането е успешно!" (no emoji)

**Code Example - Status Change Detection:**
```typescript
// src/hooks/client/useClientOrders.ts
const prevOrderStatusRef = useRef<string | null>(null);

useEffect(() => {
  const prevStatus = prevOrderStatusRef.current;
  const currentStatus = activeOrder?.status;

  if (prevStatus && currentStatus && prevStatus !== currentStatus) {
    if (currentStatus === 'completed') {
      setCustomModal({
        visible: true,
        title: 'Поръчката е завършена',
        message: 'Благодарим ви, че използвахте нашите услуги!',
        icon: 'checkmark-circle',
        iconColor: '#10B981', // Green
        buttons: [{ text: 'Благодаря!', onPress: () => {...} }]
      });
    }

    if (currentStatus === 'cancelled') {
      setCustomModal({
        visible: true,
        title: 'Поръчката е отказана',
        message: 'Поръчката беше отменена.',
        icon: 'information-circle-outline',
        iconColor: colors.textSecondary, // Neutral
        buttons: [{ text: 'Разбрах', onPress: () => {...} }]
      });
    }
  }

  prevOrderStatusRef.current = currentStatus || null;
}, [activeOrder?.status]);
```

#### Push Notifications (Firebase)
- New bids for client
- Bid accepted for driver
- Order status changes

**Key Files:**
- `functions/src/notifications.ts` - Server-side notification triggers

---

## Database Structure (Firestore)

### Collections

#### 1. `users`
```typescript
interface User {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  role: 'client' | 'driver' | 'admin';
  createdAt: Timestamp;
  // Driver-specific fields
  isVerified?: boolean;
  vehicleInfo?: {
    make: string;
    model: string;
    year: number;
    licensePlate: string;
  };
}
```

#### 2. `orders`
```typescript
interface Order {
  id: string;
  clientId: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  destinationLocation?: LocationData;
  photos?: string[]; // Storage URLs
  status: OrderStatus;
  createdAt: Timestamp;
  expiresAt: Date;
  // After acceptance
  acceptedBidId?: string;
  acceptedDriverId?: string;
  acceptedAt?: Timestamp;
}

type OrderStatus =
  | 'pending'      // Just created
  | 'searching'    // Looking for drivers
  | 'bidding'      // Has bids
  | 'payment_pending' // Bid accepted, awaiting payment
  | 'accepted'     // Paid, driver assigned
  | 'in_progress'  // Driver en route or working
  | 'completed'    // Job done
  | 'cancelled'    // Cancelled by client/driver
  | 'expired';     // 20-min timer ran out
```

#### 3. `orders/{orderId}/bids` (Subcollection)
```typescript
interface Bid {
  id: string;
  orderId: string;
  driverId: string;
  driverInfo: {
    name: string;
    phone: string;
    rating?: number;
    vehicleInfo?: VehicleInfo;
  };
  proposedPrice: number; // EUR
  estimatedArrival: number; // minutes
  message?: string;
  status: 'active' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: Timestamp;
}
```

#### 4. `driverLocations`
```typescript
interface DriverLocation {
  id: string; // Same as driver's uid
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  isOnline: boolean;
  timestamp: Timestamp;
  orderId?: string; // If driver has active order
}
```

#### 5. `driverLocks` (Race Condition Prevention)
```typescript
interface DriverLock {
  driverId: string;
  lockedBy: string; // clientId
  orderId: string;
  createdAt: Timestamp;
  expiresAt: Timestamp; // 5 minutes
}
```

---

## Firebase Cloud Functions

### Payment Functions (`functions/src/payments.ts`)

```typescript
// Create payment intent for Stripe
export const createPaymentIntent = onCall(
  { region: 'europe-west3' },
  async (request) => {
    const { bidId, amount } = request.data;

    // Create Stripe customer if needed
    const customer = await stripe.customers.create({...});

    // Create ephemeral key for Payment Sheet
    const ephemeralKey = await stripe.ephemeralKeys.create({...});

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency: 'eur',
      customer: customer.id,
      metadata: { bidId }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customerId: customer.id
    };
  }
);

// Process successful payment
export const processPayment = onCall(
  { region: 'europe-west3' },
  async (request) => {
    const { bidId, paymentIntentId } = request.data;

    // Update order status
    await updateDoc(orderRef, {
      status: 'accepted',
      acceptedBidId: bidId,
      acceptedDriverId: bid.driverId,
      acceptedAt: serverTimestamp()
    });

    // Update bid status
    await updateDoc(bidRef, { status: 'accepted' });

    return { success: true };
  }
);
```

### Notification Functions (`functions/src/notifications.ts`)

```typescript
// Send push when new bid arrives
export const onBidCreateNotification = onDocumentCreated(
  {
    document: 'orders/{orderId}/bids/{bidId}',
    region: 'europe-west3'
  },
  async (event) => {
    const bid = event.data?.data();
    const order = await getDoc(doc(db, 'orders', event.params.orderId));

    // Send to client
    await sendPushNotification(order.data().clientId, {
      title: 'Нова оферта',
      body: `${bid.driverInfo.name} предлага ${bid.proposedPrice} EUR`
    });
  }
);
```

---

## Security Architecture

### Payment Security Model

The payment flow uses a **2-phase commit pattern** with driver locking to prevent race conditions:

```
Phase 1: Reservation
─────────────────────
Client accepts bid
    ↓
lockDriver(driverId, orderId) - 5 min timeout
    ↓
reserveBid() - marks bid as 'reserved'
    ↓
Order status → 'payment_pending'
    ↓
Payment Sheet opens

Phase 2: Confirmation (via Stripe Webhook)
──────────────────────────────────────────
Stripe webhook fires (checkout.session.completed)
    ↓
Check idempotency (webhookEvents collection)
    ↓
Verify order is in 'payment_pending' status
    ↓
Transaction: Order → 'accepted', Bid → 'accepted'
    ↓
unlockDriver() - releases lock
    ↓
Driver sees job, client sees tracking
```

**Key Security Checks:**
1. **Order Ownership:** Payment links only created for orders owned by requesting user
2. **Webhook Idempotency:** Duplicate webhooks (Stripe retries) are detected and skipped
3. **Lock Timeout:** 5-minute locks auto-expire to prevent deadlocks
4. **Crash Recovery:** Orphaned `payment_pending` orders detected on app startup

### Firestore Security Rules Summary

| Collection | Read | Write |
|------------|------|-------|
| `users` | Authenticated | Owner or Admin |
| `orders` | Owner, assigned driver, or any driver (for bidding) | Owner or assigned driver |
| `bids` | Authenticated | Owner (driver) only |
| `driverLocations` | Authenticated | Only the driver themselves |
| `driverLocks` | Authenticated | Authenticated (with ownership checks) |
| `webhookEvents` | None (server only) | None (server only) |
| `paymentLinks` | Owner only | None (server only) |

### Driver Lock System (`driverLocks` collection)

Prevents multiple clients from accepting the same driver simultaneously:

```typescript
interface DriverLock {
  isLocked: boolean;
  orderId: string;
  lockedAt: Timestamp;
  expiresAt: Timestamp;  // 5 minutes
  lockReason: 'bid_reservation' | 'payment_processing' | 'order_completion';
  metadata?: {
    bidId?: string;
    clientId?: string;
  };
}
```

**Key Functions:**
- `lockDriver(driverId, orderId)` - Acquire lock with transaction
- `unlockDriver(driverId, orderId)` - Release lock (idempotent, ownership-verified)
- `isDriverLocked(driverId)` - Check lock status
- `forceUnlockDriver(driverId)` - Emergency unlock (admin use)
- `cleanupExpiredDriverLocks()` - Scheduled cleanup

**Files:**
- `src/services/firestore/driverLocks.ts` - Client-side lock operations
- `functions/src/customPayments.ts` - Server-side unlock after payment

---

## Error Handling & Resilience

### Firebase SDK Promise Bug Workaround
The Firebase SDK sometimes hangs on `addDoc()` in React Native 0.79. We handle this with a multi-layer fallback:

```
createOrder()
    ↓
createOrderWithFirebaseBugWorkaround()
    ↓ (starts listener BEFORE addDoc)
createOrderWithRetry() [10s timeout, 2 retries]
    ↓ (if timeout but listener found order)
    ✅ Return order ID from listener
    ↓ (if complete failure)
createOrderViaREST() [direct HTTP]
    ↓
    ✅ Return order ID
```

**Key Files:**
- `src/services/firestore/orders.ts` - Main workaround
- `src/services/firestoreREST.ts` - REST API fallback

### Geocoding Retry Logic
Android geocoding can fail intermittently. We retry with exponential backoff:

```typescript
// src/services/locationService.ts
private async reverseGeocodeInternal(lat: number, lng: number): Promise<string> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        return formatAddress(results[0]);
      }
    } catch (error: any) {
      const isRetryable = error.message?.includes('ijpe') ||
                          error.message?.includes('IOException');

      if (isRetryable && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 1000)); // 1s, 2s, 4s
        continue;
      }
    }
  }

  // Fallback with Bulgarian regional hints
  return this.getFallbackAddress(lat, lng);
}
```

### Circuit Breaker Pattern
Location services use circuit breakers for transient failure handling.

**Key File:** `src/utils/circuitBreakerInstances.ts`

---

## Map Component (NativeMap)

The `NativeMap` component handles all map rendering with multiple marker types:

```typescript
// src/components/shared/NativeMap.tsx
interface NativeMapProps {
  location: LocationData | null;           // Client/driver location (blue marker)
  driverLocation?: LocationData | null;    // Accepted driver (green car marker)
  nearbyDrivers?: DriverLocation[];        // Online drivers (orange markers)
  showDriverMarker?: boolean;              // Toggle driver marker visibility
  onLocatePress?: () => void;              // "Locate Me" button callback
  variant?: 'client' | 'driver';           // Different styling per role
}

// Marker styles
const markerStyles = {
  userMarker: {
    backgroundColor: colors.primary,  // Blue
    // User's current location
  },
  driverMarker: {
    backgroundColor: '#10B981',  // Green
    // Accepted driver during tracking
  },
  towTruckMarker: {
    backgroundColor: '#FF9800',  // Orange
    // Nearby online drivers
  }
};
```

---

## Key Configuration Files

### `app.json` (Expo Config)
```json
{
  "expo": {
    "plugins": [
      ["expo-location", { "locationAlwaysAndWhenInUsePermission": "..." }],
      ["@stripe/stripe-react-native", {
        "merchantIdentifier": "merchant.com.roadside.assistance.bg",
        "enableGooglePay": true
      }],
      ["react-native-maps", { "googleMapsApiKey": "..." }]
    ],
    "android": {
      "config": {
        "googleMaps": { "apiKey": "${GOOGLE_MAPS_API_KEY}" }
      }
    },
    "ios": {
      "config": {
        "googleMapsApiKey": "${GOOGLE_MAPS_API_KEY}"
      }
    }
  }
}
```

### `eas.json` (EAS Build)
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npx expo start --dev-client --tunnel` | **Primary dev command** |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `eas build --platform android --profile development` | Build dev APK |
| `cd functions && npm run deploy` | Deploy Cloud Functions |

---

## Session History

### 2026-01-30 - System Robustness Review & Security Fixes

**Major security and reliability update** addressing critical vulnerabilities discovered during comprehensive system review.

#### Issues Identified & Fixed

| Severity | Issue | Fix Applied |
|----------|-------|-------------|
| **CRITICAL** | Payment validation disabled (any user could create payment for any order) | Enabled order ownership verification in `functions/src/customPayments.ts` |
| **CRITICAL** | Firestore rules too permissive (all authenticated users could read/write all orders) | Added proper ownership checks in `firestore.rules` |
| **CRITICAL** | No webhook idempotency (duplicate Stripe webhooks could process payments twice) | Added `webhookEvents` collection to track processed events |
| **HIGH** | App crash leaves orders stuck in `payment_pending` | Added crash recovery modal on app startup in `useClientOrders.ts` |

#### Security Fixes Implemented

**1. Payment Validation (`functions/src/customPayments.ts`)**
```typescript
// Before: DISABLED - Any user could create payment for any order
console.log('Skipping order validation for testing purposes');

// After: ENABLED - Verifies order ownership
const orderDoc = await admin.firestore().collection('orders').doc(orderId).get();
if (orderDoc.data()?.clientId !== userId) {
  res.status(403).json({ error: 'User not authorized for this order' });
  return;
}
```

**2. Webhook Idempotency (`functions/src/customPayments.ts`)**
```typescript
// Check if webhook already processed (prevents duplicate charges)
const webhookEventRef = admin.firestore().collection('webhookEvents').doc(session.id);
const existingEvent = await webhookEventRef.get();

if (existingEvent.exists) {
  console.log(`Webhook ${session.id} already processed, skipping`);
  return;
}

// Mark as processing before handling
await webhookEventRef.set({
  sessionId: session.id,
  orderId,
  type: 'checkout.session.completed',
  processedAt: new Date(),
  status: 'processing'
});
```

**3. Firestore Security Rules (`firestore.rules`)**
```javascript
// Orders - proper ownership checks
match /orders/{orderId} {
  allow read: if isAuthenticated() && (
    resource.data.clientId == request.auth.uid ||
    resource.data.acceptedDriverId == request.auth.uid ||
    isDriver() || isAdmin()
  );
  allow create: if request.resource.data.clientId == request.auth.uid;
  allow update: if resource.data.clientId == request.auth.uid ||
    resource.data.acceptedDriverId == request.auth.uid;
}

// Driver locations - only owner can write
match /driverLocations/{driverId} {
  allow read: if isAuthenticated();
  allow create, update: if request.auth.uid == driverId;
}

// Server-only collections
match /webhookEvents/{eventId} {
  allow read, write: if false; // Admin SDK only
}
```

**4. Crash Recovery (`src/hooks/client/useClientOrders.ts`)**
```typescript
// Detect orphaned payment_pending orders on app startup (>10 min old)
const ORPHAN_THRESHOLD_MS = 10 * 60 * 1000;

useEffect(() => {
  if (activeOrder?.status === 'payment_pending' && activeOrder.reservedAt) {
    const timeSinceReserved = Date.now() - activeOrder.reservedAt.getTime();

    if (timeSinceReserved > ORPHAN_THRESHOLD_MS) {
      setCustomModal({
        title: 'Незавършено плащане',
        message: `Имате поръчка, чакаща плащане от ${minutesAgo} минути.`,
        buttons: [
          { text: 'Опитай отново', onPress: () => handleOrphanedOrder(activeOrder, 'retry') },
          { text: 'Отмени поръчката', onPress: () => handleOrphanedOrder(activeOrder, 'cancel') }
        ]
      });
    }
  }
}, [activeOrder?.id, activeOrder?.status]);
```

#### Files Modified
| File | Changes |
|------|---------|
| `functions/src/customPayments.ts` | Enabled payment validation, added webhook idempotency |
| `firestore.rules` | Added ownership checks for orders, bids, driverLocations |
| `src/hooks/client/useClientOrders.ts` | Added orphan detection and recovery modal |
| `src/services/firestore/index.ts` | Exported driver lock functions |

#### Remaining P1/P2 Items (Future)
- Listener limits to prevent memory leaks (`useDriverOrders.ts`)
- Deep link payment verification via Stripe API
- Geohash queries for efficient nearby driver filtering
- Circuit breaker alerts/monitoring

---

### 2026-01-29 - Driver Lock & Green Truck Icon Fixes

**Fixed driver locking and map marker issues:**

| Issue | Fix |
|-------|-----|
| Green truck icon not appearing when driver connects | Modified `NativeMap.tsx` to use `connectedDriverId` prop |
| Driver lock not released after payment | Added `unlockDriver()` call in payment webhook |
| Order completion notification missing | Added status transition detection in `useClientOrders.ts` |

**Driver Lock Architecture:**
```
Client accepts bid → lockDriver() called (5 min timeout) →
Payment sheet opens → Payment succeeds →
Webhook fires → Order confirmed → unlockDriver() called →
Driver free to receive new orders
```

The lock is ONLY for the payment window (preventing race conditions), not for the entire order duration.

---

### 2026-01-28 - Client Information & Driver Tracking
**Major update** adding comprehensive real-time features:

| Feature | Implementation |
|---------|----------------|
| Remove emoji from payment success | `useClientPayments.ts` - 3 locations |
| Order completion notification | `useClientOrders.ts` - "Поръчката е завършена" |
| Order cancellation notification | `useClientOrders.ts` - "Поръчката е отказана" |
| Driver location publishing | NEW: `useDriverLocationPublisher.ts` |
| Nearby drivers on map (50km) | NEW: `useNearbyDrivers.ts`, orange markers |
| Driver tracking during order | Wired `useDriverTracking.ts` |
| ETA display | NEW: `directionsService.ts`, `useDriverETA.ts` |
| Geocoding retry logic | Enhanced `locationService.ts` |

**Files created:**
- `src/hooks/driver/useDriverLocationPublisher.ts`
- `src/hooks/client/useNearbyDrivers.ts`
- `src/hooks/client/useDriverETA.ts`
- `src/services/directionsService.ts`

### 2026-01-18 - Locate Me Button
- Added "Locate Me" floating button to map
- Fast location with background geocoding
- `getQuickLocation()` in `locationService.ts`

### 2026-01-12 - Payment Flow Fixed
- Currency changed from BGN to EUR
- Fixed driver UI after payment (status: 'accepted', acceptedDriverId)
- Firebase Functions region consistency (europe-west3)

### 2026-01-09 - Apple Pay, Google Pay, Google Maps
- Stripe Payment Sheet with native payments
- Google Maps SDK replacing Leaflet/WebView
- `useDriverTracking` hook created

### 2026-01-08 - Testing Complete
All 8 critical test scenarios passed:
1. ✅ Happy path end-to-end
2. ✅ Payment cancellation restores bids
3. ✅ Multi-client race condition (driver locking)
4. ✅ Order expiration (20-min timer)
5. ✅ Driver online/offline toggle
6. ✅ Multiple bids handling
7. ✅ Network failure recovery
8. ✅ Firebase SDK bug recovery (REST fallback)

---

## Setup for New Machine

**Required files (not in git):**
| File | Purpose | How to Get |
|------|---------|------------|
| `google-services.json` | Firebase Android | Firebase Console → Project Settings |
| `functions/.runtimeconfig.json` | Functions secrets | `firebase functions:config:get > .runtimeconfig.json` |
| `.env` | API keys | Create with `EXPO_PUBLIC_FIREBASE_API_KEY=...` |

**Quick setup:**
```bash
git clone https://github.com/Sashlex99/roadside-app.git
cd roadside-app
npm install
cd functions && npm install
firebase functions:config:get > .runtimeconfig.json
cd ..
# Copy google-services.json and .env from existing machine
npx expo start --dev-client --tunnel
```

---

*This file tracks context for Claude Code sessions. Update as the project evolves.*
