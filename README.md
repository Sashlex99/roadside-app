# Roadside App

Българско мобилно приложение за пътна помощ, което свързва клиенти с шофьори за бърза и надеждна помощ на пътя.

A Bulgarian mobile app for roadside assistance that connects clients with drivers for fast, reliable help on the road.

## Features

### Client Features
- Create assistance requests with GPS location
- Upload photos of the situation (compressed automatically)
- Real-time bids from nearby drivers
- Interactive map showing driver locations
- 20-minute countdown timer for requests
- Stripe payment integration
- Offline resilience - orders persist, bids sync when back online

### Driver Features
- Receive new requests in real-time
- Submit price offers (bids)
- GPS tracking with distance to client
- Auto-calculated arrival time
- Online/offline status toggle
- Multiple bids per order supported

### Admin Features
- Driver verification and approval
- Document review (license, company registration)
- Admin panel (separate React app in `/admin-panel`)

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native + Expo SDK 53 (dev-client) |
| React Native | 0.79.4 |
| Navigation | React Navigation (Stack) |
| Backend | Firebase (Firestore, Auth, Functions, Storage) |
| Payments | Stripe (15% platform fee) |
| Maps | Leaflet.js (in WebView) |
| Location | expo-location |
| Notifications | expo-notifications |
| Language | TypeScript |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/Sashlex99/roadside-app.git
cd roadside-app

# Install dependencies
npm install

# Start development server (requires dev-client build)
npx expo start --dev-client --tunnel

# For Firebase Functions
cd functions && npm install
```

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── client/         # Client-specific (RequestForm, BidsList)
│   ├── driver/         # Driver-specific (OrderCard, BidForm)
│   └── shared/         # Shared (Header, Map, Modal)
├── screens/            # Screen components
│   ├── auth/           # Login, Register
│   ├── client/         # ClientHomeScreen, MyOrdersScreen
│   └── driver/         # DriverHomeScreen
├── hooks/              # Custom React hooks
│   ├── client/         # useClientOrders, useClientPayments
│   ├── driver/         # useDriverOrders
│   └── shared/         # useCurrentLocation
├── services/           # API & external services
│   ├── firestore.ts    # Firestore operations
│   ├── firestoreREST.ts # REST API fallback
│   ├── locationService.ts # Location with circuit breaker
│   └── smsService.ts   # SMS verification
├── utils/              # Utility functions
│   ├── circuitBreakerInstances.ts
│   └── timeoutUtils.ts
├── contexts/           # React contexts
│   └── AuthContext.tsx
├── constants/          # Colors, sizes
└── config/             # Firebase config

admin-panel/            # Separate React admin dashboard
functions/              # Firebase Cloud Functions
```

## Database Structure (Firestore)

### Collections
1. **`users`** - Clients, Drivers, Admins
2. **`orders`** - Assistance requests
3. **`orders/{orderId}/bids`** - Driver bids (subcollection)
4. **`driverLocations`** - Real-time driver positions
5. **`notifications`** - Push notifications
6. **`driverLocks`** - Race condition prevention

### Order Statuses
```
pending → searching → bidding → accepted → in_progress → completed
```
Also: `cancelled`, `expired`, `payment_pending`

## Payment Flow

```
Client accepts bid → Stripe Payment Link created → Client pays →
Deep link returns to app → Order status updated to 'accepted'
```

Platform takes 15% fee, driver receives the rest directly via Stripe Connect.

## Architecture Highlights

### Circuit Breaker Pattern
Location and geocoding services use circuit breakers to handle transient failures gracefully. Falls back to coordinates when geocoding is unavailable.

### Firebase SDK Bug Workaround
The app includes a multi-layer fallback for the Firebase SDK Promise bug (addDoc hangs in RN 0.79):
1. SDK + 10s timeout with `Promise.race()`
2. Real-time listener detects document if SDK hangs
3. REST API fallback (direct HTTP to Firestore)
4. Duplicate prevention with `creationToken`

### Race Condition Prevention
Driver locking system prevents double-booking when multiple clients try to accept the same driver simultaneously.

### Offline Resilience
- Orders persist server-side when client goes offline
- Drivers can bid even if client is disconnected
- Bids sync automatically when client reconnects

## Available Scripts

| Command | Description |
|---------|-------------|
| `npx expo start --dev-client --tunnel` | **Primary dev command** |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run emulators` | Start Firebase emulators |
| `npm run lint` | Run ESLint |

## Building for Production

```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Login to Expo
eas login

# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production
```

## Environment Setup

Required environment variables (create `.env` file):
```bash
# Firebase (already in firebase.ts, but can override)
FIREBASE_API_KEY=your-key

# SMS Provider (for production)
SMS_PROVIDER=sms.bg
SMS_API_KEY=your-sms-key

# Stripe
STRIPE_PUBLISHABLE_KEY=your-stripe-key
STRIPE_SECRET_KEY=your-stripe-secret
```

## Admin Setup

To create an admin account:

1. Go to **Firebase Console** → Authentication → Users
2. Create user with email `admin@roadside-app.com`
3. Go to **Firestore** → `users` collection
4. Add document:
```json
{
  "email": "admin@roadside-app.com",
  "fullName": "System Administrator",
  "role": "admin",
  "userType": "admin",
  "phoneVerified": true,
  "createdAt": "2026-01-08T00:00:00.000Z"
}
```

## Testing Checklist

All scenarios verified:
- [x] Happy path - end-to-end flow
- [x] Payment cancellation restores bids
- [x] Multi-client race condition handling
- [x] Order expiration (20-min timer)
- [x] Driver online/offline toggle
- [x] Multiple bids from same driver
- [x] Network failure recovery
- [x] Firebase SDK bug recovery

## License

MIT License - see LICENSE file for details.
