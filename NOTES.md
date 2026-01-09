Notes

Google Maps SDK migration (later)
- Install: npm install react-native-maps
- Add API keys in app.json (ios.config.googleMapsApiKey, android.config.googleMaps.apiKey)
- Replace Leaflet WebView map with native MapView in:
  - src/components/shared/LeafletMap.tsx (replace component)
  - src/screens/client/ClientHomeScreen.tsx
  - src/screens/driver/DriverHomeScreen.tsx
- Build with EAS: eas build --platform android/ios

Library quick reference
- AFNetworking: iOS Objective-C HTTP networking library (not used in RN).
- Godzippa: iOS gzip compression/decompression helper.
- Facebook SDK: Meta SDK for login/analytics/ads/sharing.
- MagicalRecord: Core Data helper for iOS.
- libphonenumber-ios: phone parsing/formatting/validation library for iOS.
- card.io: camera-based credit card scanning SDK (deprecated by many apps).
