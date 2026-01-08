# Claude Context - Roadside Assistance App

## Quick Start

```bash
npx expo start --dev-client --tunnel
```

## Project Overview

**What is this?** A Bulgarian mobile app for roadside assistance that connects clients with drivers for fast, reliable help on the road.

- **Type**: Expo React Native app (SDK 53)
- **Name**: roadside-assistance
- **React Native Version**: 0.79.4
- **Language**: Bulgarian UI (Българско приложение за пътна помощ)

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native + Expo (dev-client) |
| Navigation | React Navigation (Stack) |
| Backend | Firebase (Firestore, Auth, Functions, Storage) |
| Payments | Stripe (15% platform fee) |
| Maps | Leaflet.js (in WebView) |
| Location | expo-location |
| Notifications | expo-notifications |
| Language | TypeScript |

## Core Features

### Client Features
- Create assistance requests with GPS location
- Upload photos (compressed)
- Real-time bids from drivers
- Interactive map
- 20-minute countdown timer for requests
- Stripe payment integration

### Driver Features
- Receive new requests in real-time
- Submit price offers (bids)
- GPS tracking of distance to client
- Auto-calculate arrival time
- Online/offline status toggle

### Admin Features
- Driver verification and approval
- Document review
- Admin panel (separate React app in `/admin-panel`)

## Database Structure (Firestore)

### Collections
1. **`users`** - Clients, Drivers, Admins
2. **`orders`** - Assistance requests
3. **`orders/{orderId}/bids`** - Driver bids (subcollection)
4. **`driverLocations`** - Real-time driver positions
5. **`notifications`** - Push notifications
6. **`driverLocks`** - Race condition prevention (Phase 4)

### Order Statuses
`pending` → `searching` → `bidding` → `accepted` → `in_progress` → `completed`

Also: `cancelled`, `expired`, `payment_pending`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npx expo start --dev-client --tunnel` | **Primary dev command** |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run web` | Run in web browser |
| `npm run emulators` | Start Firebase emulators |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── client/         # Client-specific components
│   ├── driver/         # Driver-specific components
│   └── shared/         # Shared components (Header, Map, Modal)
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
│   ├── locationService.ts # Enhanced location with circuit breaker
│   └── smsService.ts   # SMS verification
├── utils/              # Utility functions
│   ├── circuitBreakerInstances.ts
│   ├── timeoutUtils.ts
│   └── alertingSystem.ts
├── contexts/           # React contexts
│   └── AuthContext.tsx
├── constants/          # Colors, sizes
└── config/             # Firebase config
```

## Known Issues / Behaviors

### Geocoding Errors (Intermittent)
**Error**: `ExpoLocation.reverseGeocodeAsync: java.io.IOException: ijgj: UNAVAILABLE`

**Cause**: Intermittent - Google Play Services geocoding temporarily unavailable (network hiccup, service overload, etc.)

**Behavior**: Fails once, then usually works on subsequent attempts. The circuit breaker pattern handles this automatically.

**Impact**: None - the app falls back to showing coordinates instead of street address, then normal addresses resume on next successful geocode. See `src/services/locationService.ts:279-293` for fallback logic.

**Not a bug** - expected transient behavior, handled gracefully.

### Firebase SDK Promise Bug
**Issue**: `addDoc()` Promise sometimes doesn't resolve in React Native 0.79 + Expo. Document gets created but Promise hangs forever, leaving UI stuck in loading state.

**Workaround**: Multi-layer fallback system in `src/services/firestore/orders.ts`:

```
createOrder()
    ↓
createOrderWithFirebaseBugWorkaround()
    ↓ (starts real-time listener BEFORE addDoc)
createOrderWithRetry() [10s timeout, 2 retries]
    ↓ (if timeout but listener found order)
    ✅ Return order ID from listener
    ↓ (if complete failure)
createOrderViaREST() [direct HTTP to Firestore]
    ↓
    ✅ Return order ID
```

**Key Files**:
- `src/services/firestore/orders.ts` - Main workaround logic
- `src/services/firestoreREST.ts` - REST API fallback (bypasses SDK entirely)

**Layers**:
1. **SDK + Timeout**: `Promise.race()` with 10-second timeout
2. **Real-time Detection**: Listener catches document if SDK hangs but write succeeded
3. **REST API Fallback**: Direct HTTP calls to Firestore REST API
4. **Duplicate Prevention**: `creationToken` + `findMatchingRecentOrder()` prevents duplicates on retry

## Architecture Highlights

### Circuit Breaker Pattern
Location and geocoding services use circuit breakers to handle transient failures gracefully. See `src/utils/circuitBreakerInstances.ts`.

### Race Condition Prevention
Driver locking system prevents double-booking when multiple clients try to accept the same driver simultaneously. See `99%productionready.md` for the full implementation plan.

### Payment Flow
```
Client accepts bid → Create Stripe Payment Link → Client pays →
Deep link returns to app → Order status updated to 'accepted'
```

Platform takes 15% fee, driver receives rest directly.

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/screens/client/ClientHomeScreen.tsx` | Main client screen |
| `src/screens/driver/DriverHomeScreen.tsx` | Main driver screen |
| `src/services/firestore.ts` | All Firestore operations |
| `src/hooks/client/useClientOrders.ts` | Client order management |
| `src/hooks/client/useClientPayments.ts` | Payment handling |
| `functions/src/index.ts` | Firebase Cloud Functions |

## Session Notes

### 2026-01-08
- Project setup confirmed
- Dev command documented: `npx expo start --dev-client --tunnel`
- Investigated geocoding error - working as designed with fallback to coordinates
- Read all MD files to understand full project context

### 2026-01-08 (Testing Complete)
- **All 8 critical test scenarios passed:**
  1. ✅ Happy path - basic flow end-to-end
  2. ✅ Payment cancellation restores bids correctly
  3. ✅ Multi-client race condition handled (driver locking works)
  4. ✅ Order expiration (20-min timer)
  5. ✅ Driver online/offline toggle
  6. ✅ Multiple bids from same driver
  7. ✅ Network failure recovery
  8. ✅ Firebase SDK bug recovery (REST fallback)
- **Offline resilience verified**: Orders persist when client goes to airplane mode, drivers can still bid, bids sync when client reconnects
- Real-time updates working (<1 second latency)
- No duplicate orders created
- App is production-ready for core flows

---

*This file tracks context for Claude Code sessions. Update as the project evolves.*
