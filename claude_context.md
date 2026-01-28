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

### 2026-01-28 (Client Information & Driver Tracking Features)

Major update adding real-time driver tracking, nearby drivers visualization, ETA calculation, and improved client notifications.

#### Simple Fixes Implemented

1. **Removed emoji from payment success modal:**
   - Changed `'✅ Плащането е успешно!'` → `'Плащането е успешно!'`
   - File: `src/hooks/client/useClientPayments.ts` (lines 115, 192, 503)
   - Cleaner, more professional UI

2. **Order completion notification:**
   - Client sees "Поръчката е завършена" modal when driver taps Complete
   - Uses `checkmark-circle` icon with green color
   - File: `src/hooks/client/useClientOrders.ts`
   - Tracks previous status with `useRef` to detect `completed` transition

3. **Order cancellation notification:**
   - Client sees "Поръчката е отказана" modal when order is cancelled
   - Uses `information-circle-outline` icon with neutral color (clean design, no red X)
   - Same message regardless of who cancelled (driver or client)
   - File: `src/hooks/client/useClientOrders.ts`

#### Complex Features Implemented

##### 1. Driver Location Publishing System
**Purpose:** Enables drivers to broadcast their location so clients can see available drivers on the map.

**New file:** `src/hooks/driver/useDriverLocationPublisher.ts`
```typescript
// Usage in DriverHomeScreen:
useDriverLocationPublisher({
  driverId: user?.uid || null,
  isOnline,
  location,
  activeOrderId: acceptedOrder?.id || null
});
```

**Behavior:**
- Publishes location every 10 seconds when driver is online
- Stores in `driverLocations/{driverId}` collection with:
  - `location: { latitude, longitude, address }`
  - `isOnline: true/false`
  - `timestamp: Date`
  - `orderId` (if driver has active order)
- Marks driver as offline (`isOnline: false`) when going offline
- Handles app backgrounding gracefully
- Auto-publishes on app returning to foreground

**Files modified:**
- `src/types/firestore.ts` - Added `isOnline?: boolean` to `DriverLocation` interface
- `src/screens/driver/DriverHomeScreen.tsx` - Integrated the hook

##### 2. Nearby Drivers Map Display
**Purpose:** Shows clients all online drivers within 50km radius as orange tow truck markers.

**New files:**
- `src/hooks/client/useNearbyDrivers.ts` - Hook for subscribing to nearby drivers
- `src/services/firestore/locations.ts` - Added `subscribeToNearbyDrivers()` function

**Implementation details:**
```typescript
// In ClientHomeScreen:
const { nearbyDrivers } = useNearbyDrivers({
  clientLocation: location,
  radiusKm: 50,
  enabled: !activeOrder // Disabled when client has active order
});

// Pass to NativeMap:
<NativeMap nearbyDrivers={nearbyDrivers} ... />
```

**How it works:**
1. Queries Firestore for drivers where `isOnline === true`
2. Filters to only include drivers active in last 2 minutes (prevents stale data)
3. Calculates Haversine distance client-side to filter by 50km radius
4. Returns array of `DriverLocation` objects
5. NativeMap renders orange markers (car-sport icon) for each driver

**Files modified:**
- `src/components/shared/NativeMap.tsx` - Added `nearbyDrivers` prop and marker rendering
- `src/screens/client/ClientHomeScreen.tsx` - Integrated the hook

**Marker style (in NativeMap):**
```typescript
towTruckMarker: {
  width: 32, height: 32, borderRadius: 16,
  backgroundColor: '#FF9800', // Orange
  borderWidth: 2, borderColor: 'white'
}
```

##### 3. Real-time Driver Tracking During Orders
**Purpose:** Shows client the driver's live location on map when order is accepted.

**Files modified:**
- `src/hooks/client/useDriverTracking.ts` - Fixed to handle new location structure
- `src/screens/client/ClientHomeScreen.tsx` - Wired up the hook

**Implementation:**
```typescript
// In ClientHomeScreen:
const driverLocation = useDriverTracking(activeOrder);

<NativeMap
  driverLocation={driverLocation}
  showDriverMarker={!!driverLocation && (activeOrder?.status === 'accepted' || activeOrder?.status === 'in_progress')}
  ...
/>
```

**How it works:**
1. `useDriverTracking` subscribes to `driverLocations/{acceptedDriverId}`
2. Only tracks when order status is `accepted` or `in_progress`
3. Updates `driverLocation` state in real-time via `onSnapshot`
4. NativeMap shows green car marker at driver's position
5. Subscription cleans up when order completes/cancels

##### 4. ETA (Estimated Time of Arrival) Display
**Purpose:** Shows client how long until driver arrives.

**New files:**
- `src/services/directionsService.ts` - Google Directions API integration
- `src/hooks/client/useDriverETA.ts` - Hook for calculating and refreshing ETA

**directionsService.ts features:**
- `getETA(origin, destination)` - Fetches real ETA from Google Directions API
- `getEstimatedETA(origin, destination)` - Fallback using Haversine distance + 40km/h average speed
- Returns `{ durationMinutes, durationText, distanceKm, distanceText }`
- Bulgarian text formatting: "5 мин", "1 час 15 мин", etc.
- Automatic fallback if API fails or no API key

**useDriverETA hook:**
```typescript
const { eta } = useDriverETA({
  driverLocation,
  clientLocation: location,
  enabled: !!driverLocation && (activeOrder?.status === 'accepted' || activeOrder?.status === 'in_progress')
});
```

**Behavior:**
- Fetches ETA immediately when driver location available
- Refreshes every 30 seconds
- Skips refresh if driver hasn't moved significantly (>50m)
- Uses Google Directions API with Bulgarian language

**Display in ActiveOrderPanel:**
```typescript
{eta && (
  <View style={localStyles.etaContainer}>
    <Ionicons name="time-outline" size={14} color={colors.primary} />
    <Text style={localStyles.etaText}>
      Очаквано пристигане: {eta.durationText}
    </Text>
  </View>
)}
```

**Files modified:**
- `src/components/client/ActiveOrderPanel/index.tsx` - Added `eta` prop and display
- `src/screens/client/ClientHomeScreen.tsx` - Integrated hook and passed to panel

##### 5. Enhanced Geocoding Error Handling
**Purpose:** Better handling of intermittent Android geocoding failures.

**File:** `src/services/locationService.ts`

**Changes to `reverseGeocodeInternal()`:**
- Added retry logic with exponential backoff (1s, 2s, 4s delays)
- Specifically catches `ijpe unavailable` and `java.io.IOException` errors
- Retries up to 3 times before falling back
- Non-retryable errors fallback immediately

**Enhanced fallback addresses:**
- Now provides Bulgarian regional hints based on coordinates:
  - Major cities: "София", "Пловдив", "Варна", "Бургас", "Русе", etc.
  - Regional areas: "Западна България", "Южна Централна България", etc.
- Format: "София (42.6977, 23.3219)" instead of just coordinates

#### New Files Created
| File | Purpose |
|------|---------|
| `src/hooks/driver/useDriverLocationPublisher.ts` | Driver location broadcasting |
| `src/hooks/client/useNearbyDrivers.ts` | Subscribe to nearby drivers |
| `src/hooks/client/useDriverETA.ts` | Calculate ETA from driver to client |
| `src/services/directionsService.ts` | Google Directions API wrapper |

#### Files Modified
| File | Changes |
|------|---------|
| `src/hooks/client/useClientPayments.ts` | Removed emoji from success title |
| `src/hooks/client/useClientOrders.ts` | Added completion/cancellation notifications |
| `src/hooks/client/useDriverTracking.ts` | Fixed location structure handling |
| `src/services/locationService.ts` | Added retry logic, enhanced fallbacks |
| `src/services/firestore/locations.ts` | Added `subscribeToNearbyDrivers()` |
| `src/types/firestore.ts` | Added `isOnline` to DriverLocation |
| `src/components/shared/NativeMap.tsx` | Added `nearbyDrivers` prop, tow truck markers |
| `src/components/client/ActiveOrderPanel/index.tsx` | Added `eta` prop and display |
| `src/screens/client/ClientHomeScreen.tsx` | Integrated all new hooks |
| `src/screens/driver/DriverHomeScreen.tsx` | Integrated location publisher |

#### Architecture Notes

**Data flow for nearby drivers:**
```
Driver goes online → useDriverLocationPublisher starts →
Location published to driverLocations/{id} every 10s →
Client's useNearbyDrivers subscribes with onSnapshot →
Filter by isOnline=true, timestamp<2min, distance<50km →
NativeMap renders orange markers
```

**Data flow for driver tracking during order:**
```
Client accepts bid → Order status = 'accepted' →
useDriverTracking subscribes to driverLocations/{acceptedDriverId} →
Driver publishes location every 10s →
useDriverETA calculates route time via Google Directions API →
ActiveOrderPanel shows "Очаквано пристигане: X мин" →
NativeMap shows green driver marker
```

#### Testing Notes
- **Nearby drivers:** Open client app, have a driver go online nearby - orange marker should appear
- **Driver tracking:** Accept a bid, driver should appear as green marker on client's map
- **ETA:** Check ActiveOrderPanel shows "Очаквано пристигане: X мин" after bid accepted
- **Notifications:** Complete/cancel order from driver - client should see modal
- **Geocoding:** Should work without crashes on Android, falls back gracefully

---

*This file tracks context for Claude Code sessions. Update as the project evolves.*
