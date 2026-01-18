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
| Payments | Stripe Payment Sheet (Apple Pay, Google Pay, Cards) |
| Maps | Google Maps SDK (react-native-maps) |
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

### EAS Build on Windows/WSL (IMPORTANT)
**Error**: `tar: Cannot mkdir: Permission denied` and `SCHILY.dev` header warnings when running `eas build`.

**Cause**: Windows file attributes and temp directory path issues cause corrupted tar archives when EAS uploads the project.

**Fix**: Run these commands in **PowerShell** BEFORE `eas build`:
```powershell
# Remove read-only attributes from all files
attrib -R /S /D

# Use a clean temp directory (avoids path issues)
$env:TEMP="C:\Temp\eas"
$env:TMP="C:\Temp\eas"
New-Item -ItemType Directory -Force $env:TEMP | Out-Null

# Now run the build
eas build --platform android --profile development
```

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

### Payment Flow (Native Payment Sheet)
```
Client accepts bid → Bid reserved + Driver locked →
Payment Sheet opens (Apple Pay / Google Pay / Card) →
Payment succeeds → processPayment() called →
Order status = 'accepted', acceptedDriverId set →
Driver sees active job UI
```

**Currency:** EUR (all payments)
**Platform fee:** 15% of bid amount
**Key files:**
- `src/hooks/usePaymentSheet.ts` - Payment Sheet initialization
- `src/hooks/client/useClientPayments.ts` - Payment flow orchestration
- `functions/src/payments.ts` - `createPaymentIntent`, `processPayment`

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

### 2026-01-09 (Apple Pay, Google Pay, Google Maps Implementation)
- **Apple Pay & Google Pay added:**
  - Stripe plugin configured in `app.json` with merchant ID
  - `StripeProvider` wrapping app in `App.tsx`
  - Cloud Function `createPaymentIntent` updated with ephemeralKey + customerId for Payment Sheet
  - `usePaymentSheet` hook updated with Apple Pay (iOS) and Google Pay (Android) configuration
  - `useClientPayments` now uses native Payment Sheet instead of browser redirect

- **Google Maps SDK replacing Leaflet:**
  - `app.json` configured with `GOOGLE_MAPS_API_KEY` for Android and iOS
  - New `NativeMap` component using `react-native-maps` with Google provider
  - Clean map style matching original Leaflet appearance
  - `ClientHomeScreen` and `DriverHomeScreen` updated to use `NativeMap`
  - `useDriverTracking` hook created for future real-time driver location

- **External setup required before testing:**
  1. Apple Developer: Create Merchant ID `merchant.com.roadside.assistance.bg`
  2. Stripe Dashboard: Enable Apple Pay and Google Pay
  3. Google Cloud Console: Enable Maps SDK, create API key
  4. EAS Secrets: Add `GOOGLE_MAPS_API_KEY`
  5. New dev-client build required (native dependencies changed)

### Firebase Functions Region - europe-west3
**Region**: All functions now use `europe-west3` (Frankfurt) to match Firestore database location.

**Why europe-west3:**
- Firestore database is in `europe-west3`
- Lowest latency for Bulgarian users (~30-50ms vs ~150-200ms for US)
- GDPR compliance - data stays in EU
- Avoids cross-region charges

**Files configured:**
- `functions/src/payments.ts` - All v2 functions use `{ region: 'europe-west3' }`
- `functions/src/customPayments.ts` - All v1 HTTP functions use `.region('europe-west3')`
- `functions/src/notifications.ts` - sendTestNotification uses `.region('europe-west3')`
- `src/services/stripeService.ts` - Client calls `getFunctions(auth.app, 'europe-west3')`

**Deployment:**
```bash
cd functions && npm run deploy
```

**Note**: If you see IAM permission errors, you need to grant Cloud Run permissions to the service agent. See Google Cloud Console → IAM.

### 2026-01-10 (EAS Build Success)
- **EAS Build issue resolved:**
  - Problem: `tar: Cannot mkdir: Permission denied` errors on EAS servers
  - Root cause: Windows file attributes + temp directory path issues
  - Solution: `attrib -R /S /D` + custom temp dir (see Known Issues section)
- **New dev-client APK built** with Apple Pay, Google Pay, and Google Maps SDK
- Ready for testing on physical device

### 2026-01-12 (Payment Flow Fixed & Functions Cleanup)
- **Currency fixed from BGN to EUR:**
  - All payment functions now use `currency: 'eur'`
  - Stripe account must have EUR enabled (was failing with "bgn not supported")
  - Deleted all old functions and redeployed fresh

- **Driver UI after payment fixed:**
  - **Bug:** `processPayment()` set `status: 'paid'` but driver app looked for `status: 'accepted'`
  - **Bug:** `processPayment()` didn't set `acceptedDriverId`
  - **Fix:** Now sets `status: 'accepted'` and `acceptedDriverId: driverId`
  - Driver now sees active job UI immediately after client pays

- **Firebase Functions region consistency:**
  - All functions now use `europe-west3` (Frankfurt)
  - Fixed Firestore triggers that were defaulting to `us-central1`:
    - `onOrderCreate` in `ordersOnCreate.ts`
    - `onBidCreateNotification` in `notifications.ts`
    - `onBidAcceptedNotification` in `notifications.ts`

- **Missing exports added to `index.ts`:**
  - Added `onBidAcceptedNotification` export

- **Payment Sheet working:**
  - Native Apple Pay / Google Pay integration complete
  - Uses Stripe Payment Sheet (not browser redirect)
  - Warning `No task registered for key StripeKeepJsAwakeTask` is harmless (can ignore)

### 2026-01-18 (Locate Me Button)
- **Added "Locate Me" button to map:**
  - Floating button in bottom-right corner of `NativeMap` component
  - White circular button (48x48px) with locate icon
  - Shows spinner while refreshing location

- **Fast location with background geocoding:**
  - `getQuickLocation()` added to `locationService.ts`
  - Uses `Location.Accuracy.Balanced` instead of `High` (faster GPS lock)
  - Returns coordinates immediately, geocodes address in background
  - Flow:
    1. Press button → instant map animation to current position
    2. GPS coordinates refresh (~300-500ms)
    3. Header shows "Координати: 42.xxx, 25.xxx" temporarily
    4. Background geocoding resolves address (~1-2s)
    5. Header updates to real address (e.g., "ул. Витоша 15, София")

- **New hook method `quickLocate()`:**
  - Added to `useCurrentLocation` hook
  - Calls `getQuickLocation()` with callback for address resolution
  - Used by both `ClientHomeScreen` and `DriverHomeScreen`

- **Key files changed:**
  - `src/services/locationService.ts` - Added `getQuickLocation()` method
  - `src/hooks/shared/useCurrentLocation.ts` - Added `quickLocate()` function
  - `src/components/shared/NativeMap.tsx` - Added locate button UI and `onLocatePress` prop

## Setup for New Machine

**Files needed (not in git):**
| File | Purpose | How to Get |
|------|---------|------------|
| `google-services.json` | Firebase Android config | Firebase Console → Project Settings → Android app |
| `functions/.runtimeconfig.json` | Cloud Functions secrets | `firebase functions:config:get > .runtimeconfig.json` |
| `.env` | Firebase API key | Copy from existing machine or create with `EXPO_PUBLIC_FIREBASE_API_KEY=...` |

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
