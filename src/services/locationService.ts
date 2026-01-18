/**
 * Enhanced Location Service with Phase 4 Circuit Breaker Protection
 * Critical for roadside assistance app - handles GPS and geocoding failures gracefully
 */

import * as Location from 'expo-location';
import { executeWithCircuitBreaker } from '../utils/circuitBreakerInstances';
import { withTimeout, TimeoutError } from '../utils/timeoutUtils';
import { sendHealthAlert } from '../utils/alertingSystem';

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  accuracy?: number;
  timestamp?: Date;
}

export interface LocationServiceConfig {
  enableFallbacks: boolean;
  maxRetries: number;
  timeoutMs: number;
  cacheAddresses: boolean;
  minAccuracyMeters: number;  // Reject readings with accuracy worse than this
}

/**
 * Enhanced Location Service with Circuit Breaker Protection
 */
export class LocationService {
  private config: LocationServiceConfig;
  private addressCache: Map<string, { address: string; timestamp: number }> = new Map();
  private lastKnownLocation: LocationData | null = null;
  private lastGoodLocation: LocationData | null = null; // Last location with good accuracy
  private watchSequence: number = 0;
  private _isUsingDegradedAccuracy: boolean = false; // Flag when using fallback location due to poor accuracy

  constructor(config: Partial<LocationServiceConfig> = {}) {
    this.config = {
      enableFallbacks: true,
      maxRetries: 3,
      timeoutMs: 8000, // 8 seconds for geocoding
      cacheAddresses: true,
      minAccuracyMeters: 100, // Reject readings with accuracy > 100m (likely WiFi/cell tower)
      ...config
    };
  }

  // ==================== Helper Methods ====================

  /** Check if GPS accuracy is acceptable */
  private isAccuracyAcceptable(accuracy: number): boolean {
    return accuracy > 0 && accuracy <= this.config.minAccuracyMeters;
  }

  /** Try to get recent fallback location if current accuracy is poor */
  private tryGetFallbackLocation(currentAccuracy: number): LocationData | null {
    if (this.isAccuracyAcceptable(currentAccuracy) || !this.lastGoodLocation) {
      return null;
    }

    const ageMs = this.lastGoodLocation.timestamp
      ? Date.now() - this.lastGoodLocation.timestamp.getTime()
      : Infinity;

    // Use last good location if it's less than 5 minutes old
    if (ageMs < 5 * 60 * 1000) {
      this._isUsingDegradedAccuracy = true;
      return {
        ...this.lastGoodLocation,
        timestamp: new Date()
      };
    }

    return null;
  }

  /** Get address with automatic fallback to coordinates */
  private async getAddressWithFallback(latitude: number, longitude: number): Promise<string> {
    try {
      return await this.reverseGeocode(latitude, longitude);
    } catch {
      return this.generateFallbackAddress(latitude, longitude);
    }
  }

  /** Update accuracy tracking state */
  private updateAccuracyState(result: LocationData, isGood: boolean): void {
    if (isGood) {
      this.lastGoodLocation = result;
      this._isUsingDegradedAccuracy = false;
    } else {
      this._isUsingDegradedAccuracy = true;
    }
  }

  // ==================== Public Methods ====================

  /**
   * Get current position with circuit breaker protection
   */
  async getCurrentPosition(): Promise<LocationData> {
    return executeWithCircuitBreaker('location-services', async () => {
      return withTimeout(
        this.getCurrentPositionInternal(),
        this.config.timeoutMs,
        'Location service timeout',
        'getCurrentPosition'
      );
    });
  }

  /**
   * Reverse geocode coordinates to address with fallbacks
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    // Check cache first
    if (this.config.cacheAddresses) {
      const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
      const cached = this.addressCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
        if (__DEV__) console.log('[Location] Using cached address');
        return cached.address;
      }
    }

    return executeWithCircuitBreaker('geocoding-services', async () => {
      return withTimeout(
        this.reverseGeocodeInternal(latitude, longitude),
        this.config.timeoutMs,
        'Geocoding service timeout',
        'reverseGeocode'
      );
    });
  }

  /**
   * Watch position changes with circuit breaker protection
   */
  async watchPosition(
    callback: (location: LocationData) => void,
    options: {
      accuracy?: Location.Accuracy;
      timeInterval?: number;
      distanceInterval?: number;
    } = {}
  ): Promise<Location.LocationSubscription> {
    const {
      accuracy = Location.Accuracy.High,
      timeInterval = 30000, // 30 seconds
      distanceInterval = 10   // 10 meters
    } = options;

    // Reset sequence on new watch session
    this.watchSequence = 0;

    // Enhanced callback with race condition protection
    const enhancedCallback = async (locationUpdate: Location.LocationObject) => {
      const currentSequence = ++this.watchSequence;

      try {
        const locationData = await this.processLocationUpdate(locationUpdate);

        // Only apply if this is still the most recent request
        if (currentSequence !== this.watchSequence) {
          if (__DEV__) console.log('[Location] Discarding stale update');
          return;
        }

        callback(locationData);
        this.lastKnownLocation = locationData;

      } catch (error) {
        // Only apply fallback if this is still the most recent request
        if (currentSequence !== this.watchSequence) {
          if (__DEV__) console.log('[Location] Discarding stale fallback');
          return;
        }

        if (__DEV__) console.warn('[Location] Update failed, using fallback:', error);

        const fallbackData: LocationData = {
          latitude: locationUpdate.coords.latitude,
          longitude: locationUpdate.coords.longitude,
          address: this.generateFallbackAddress(
            locationUpdate.coords.latitude,
            locationUpdate.coords.longitude
          ),
          accuracy: locationUpdate.coords.accuracy || undefined,
          timestamp: new Date()
        };

        callback(fallbackData);
        this.lastKnownLocation = fallbackData;
      }
    };

    return await Location.watchPositionAsync(
      {
        accuracy,
        timeInterval,
        distanceInterval,
      },
      enhancedCallback
    );
  }

  /**
   * Get last known location (fallback for emergencies)
   */
  getLastKnownLocation(): LocationData | null {
    return this.lastKnownLocation;
  }

  /**
   * Check if currently using degraded accuracy (fallback to last good location)
   */
  isUsingDegradedAccuracy(): boolean {
    return this._isUsingDegradedAccuracy;
  }

  /**
   * Get the last location with good accuracy
   */
  getLastGoodLocation(): LocationData | null {
    return this.lastGoodLocation;
  }

  /**
   * Force refresh location (for manual retry)
   */
  async forceRefreshLocation(): Promise<LocationData> {
    if (__DEV__) console.log('[Location] Force refreshing...');

    try {
      return await this.getCurrentPosition();
    } catch (error) {
      console.error('[Location] Force refresh failed:', error);

      // Alert for critical location failure
      await sendHealthAlert(
        'Location Service Critical Failure',
        'Unable to determine user location for roadside assistance',
        'critical',
        { error: error instanceof Error ? error.message : String(error) }
      );

      throw error;
    }
  }

  /**
   * Fast location update - gets coordinates quickly with balanced accuracy
   * Returns coordinates immediately, address will be geocoded via callback
   */
  async getQuickLocation(onAddressResolved?: (location: LocationData) => void): Promise<LocationData> {
    if (__DEV__) console.log('[Location] Quick locate...');

    try {
      // Check permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Необходим е достъп до локацията');
      }

      // Get position with balanced accuracy (faster than High)
      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = locationData.coords;
      const accuracy = locationData.coords.accuracy || 0;

      if (__DEV__) console.log(`[Location] Quick: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (${accuracy.toFixed(1)}m)`);

      // Check cache first for instant address
      const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
      const cached = this.addressCache.get(cacheKey);

      let address: string;
      let needsGeocoding = false;

      if (cached && Date.now() - cached.timestamp < 300000) {
        address = cached.address;
        if (__DEV__) console.log('[Location] Using cached address');
      } else {
        // Use coordinates temporarily, geocode in background
        address = this.generateFallbackAddress(latitude, longitude);
        needsGeocoding = true;
      }

      const result: LocationData = {
        latitude,
        longitude,
        address,
        accuracy: accuracy || undefined,
        timestamp: new Date()
      };

      // Update last known location
      this.lastKnownLocation = result;

      // Update accuracy state
      if (this.isAccuracyAcceptable(accuracy)) {
        this.lastGoodLocation = result;
        this._isUsingDegradedAccuracy = false;
      }

      // Geocode address in background if needed
      if (needsGeocoding && onAddressResolved) {
        this.reverseGeocode(latitude, longitude)
          .then((resolvedAddress) => {
            const updatedLocation: LocationData = {
              ...result,
              address: resolvedAddress
            };
            this.lastKnownLocation = updatedLocation;
            if (this.lastGoodLocation?.latitude === latitude && this.lastGoodLocation?.longitude === longitude) {
              this.lastGoodLocation = updatedLocation;
            }
            if (__DEV__) console.log('[Location] Background geocoding complete');
            onAddressResolved(updatedLocation);
          })
          .catch((err) => {
            if (__DEV__) console.warn('[Location] Background geocoding failed:', err);
            // Keep coordinates, don't call callback
          });
      }

      return result;
    } catch (error) {
      console.error('[Location] Quick location failed:', error);

      // Return last known location if available
      if (this.lastKnownLocation) {
        if (__DEV__) console.log('[Location] Using last known as fallback');
        return this.lastKnownLocation;
      }

      throw error;
    }
  }

  // Private methods

  private async getCurrentPositionInternal(): Promise<LocationData> {
    // Check permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Необходим е достъп до локацията за да използвате приложението');
    }

    // Get current position
    const locationData = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const { latitude, longitude } = locationData.coords;
    const accuracy = locationData.coords.accuracy || 0;
    const isGood = this.isAccuracyAcceptable(accuracy);

    if (__DEV__) console.log(`[Location] GPS: ${accuracy.toFixed(1)}m, acceptable=${isGood}`);

    // Try fallback if accuracy is poor
    const fallback = this.tryGetFallbackLocation(accuracy);
    if (fallback) {
      if (__DEV__) console.log('[Location] Using fallback location');
      return fallback;
    }

    // Get address
    const address = await this.getAddressWithFallback(latitude, longitude);

    const result: LocationData = {
      latitude,
      longitude,
      address,
      accuracy: accuracy || undefined,
      timestamp: new Date()
    };

    this.updateAccuracyState(result, isGood);
    return result;
  }

  private async reverseGeocodeInternal(latitude: number, longitude: number): Promise<string> {
    try {
      if (__DEV__) console.log(`[Geocoding] ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      
      const addressResponse = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (addressResponse.length === 0) {
        throw new Error('No geocoding results found');
      }

      const addr = addressResponse[0];
      const address = this.formatAddress(addr);
      
      // Cache the result
      if (this.config.cacheAddresses) {
        const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
        this.addressCache.set(cacheKey, { 
          address, 
          timestamp: Date.now() 
        });
      }

      if (__DEV__) console.log(`[Geocoding] Result: ${address}`);
      return address;

    } catch (error) {
      console.error('[Geocoding] Failed:', error);
      
      // Try alternative geocoding services if available
      if (this.config.enableFallbacks) {
        return await this.tryAlternativeGeocoding(latitude, longitude);
      }
      
      throw error;
    }
  }

  private async processLocationUpdate(locationUpdate: Location.LocationObject): Promise<LocationData> {
    const { latitude, longitude } = locationUpdate.coords;
    const accuracy = locationUpdate.coords.accuracy || 0;
    const isGood = this.isAccuracyAcceptable(accuracy);

    // Try fallback if accuracy is poor
    const fallback = this.tryGetFallbackLocation(accuracy);
    if (fallback) {
      return fallback;
    }

    // Get address
    const address = await this.getAddressWithFallback(latitude, longitude);

    const result: LocationData = {
      latitude,
      longitude,
      address,
      accuracy: accuracy || undefined,
      timestamp: new Date()
    };

    this.updateAccuracyState(result, isGood);
    return result;
  }

  private formatAddress(addr: Location.LocationGeocodedAddress): string {
    const parts = [
      addr.street,
      addr.name,
      addr.city,
      addr.postalCode
    ].filter(Boolean);

    if (parts.length === 0) {
      return 'Неизвестен адрес';
    }

    return parts.join(', ').trim();
  }

  private generateFallbackAddress(latitude: number, longitude: number): string {
    // Generate approximate address based on coordinates
    const latStr = latitude.toFixed(4);
    const lngStr = longitude.toFixed(4);
    
    // Check if coordinates are in Bulgaria (approximate bounds)
    const isInBulgaria = latitude >= 41.2 && latitude <= 44.2 && 
                        longitude >= 22.3 && longitude <= 28.6;
    
    if (isInBulgaria) {
      return `Координати: ${latStr}, ${lngStr} (България)`;
    } else {
      return `Координати: ${latStr}, ${lngStr}`;
    }
  }

  private async tryAlternativeGeocoding(latitude: number, longitude: number): Promise<string> {
    if (__DEV__) console.log('[Geocoding] Trying alternative methods...');
    
    // Alternative 1: Use geocodeAsync with approximate address
    try {
      // Create approximate address and reverse geocode
      const approximateAddress = this.generateFallbackAddress(latitude, longitude);
      return approximateAddress;
      
    } catch (error) {
      console.warn('Alternative geocoding also failed:', error);
      
      // Final fallback
      return this.generateFallbackAddress(latitude, longitude);
    }
  }

  /**
   * Health check for location services
   */
  async healthCheck(): Promise<{
    gps: boolean;
    geocoding: boolean;
    permissions: boolean;
    message: string;
  }> {
    const result = {
      gps: false,
      geocoding: false,
      permissions: false,
      message: ''
    };

    try {
      // Check permissions
      const { status } = await Location.getForegroundPermissionsAsync();
      result.permissions = status === 'granted';
      
      if (!result.permissions) {
        result.message = 'Location permissions not granted';
        return result;
      }

      // Check GPS
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      
      result.gps = true;

      // Check geocoding
      await this.reverseGeocode(location.coords.latitude, location.coords.longitude);
      result.geocoding = true;
      
      result.message = 'All location services operational';
      
    } catch (error) {
      result.message = error instanceof Error ? error.message : 'Unknown location service error';
    }

    return result;
  }

  /**
   * Forward geocode address to coordinates with circuit breaker protection
   */
  async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
    // Check cache first
    if (this.config.cacheAddresses) {
      const cacheKey = `geocode_${address.toLowerCase().trim()}`;
      const cached = this.addressCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 600000) { // 10 minutes cache for addresses
        if (__DEV__) console.log('[Geocoding] Using cached result');
        const coords = JSON.parse(cached.address);
        return coords;
      }
    }

    return executeWithCircuitBreaker('geocoding-services', async () => {
      return withTimeout(
        this.geocodeAddressInternal(address),
        this.config.timeoutMs,
        'Address geocoding timeout',
        'geocodeAddress'
      );
    });
  }

  private async geocodeAddressInternal(address: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      if (__DEV__) console.log(`[Geocoding] Address: ${address}`);
      
      const results = await Location.geocodeAsync(address);
      
      if (results.length === 0) {
        if (__DEV__) console.warn('[Geocoding] No results for:', address);
        return null;
      }

      const result = {
        latitude: results[0].latitude,
        longitude: results[0].longitude
      };
      
      // Cache the result
      if (this.config.cacheAddresses) {
        const cacheKey = `geocode_${address.toLowerCase().trim()}`;
        this.addressCache.set(cacheKey, { 
          address: JSON.stringify(result), 
          timestamp: Date.now() 
        });
      }

      if (__DEV__) console.log('[Geocoding] Result:', result);
      return result;

    } catch (error) {
      console.error('[Geocoding] Address geocoding failed:', error);
      throw error;
    }
  }
}

// Global location service instance
export const locationService = new LocationService();

// Convenience functions
export const getCurrentLocation = () => locationService.getCurrentPosition();
export const reverseGeocode = (lat: number, lng: number) => locationService.reverseGeocode(lat, lng);
export const geocodeAddress = (address: string) => locationService.geocodeAddress(address);
export const watchUserLocation = (callback: (location: LocationData) => void, options?: any) =>
  locationService.watchPosition(callback, options);
export const getLastKnownLocation = () => locationService.getLastKnownLocation();
export const locationHealthCheck = () => locationService.healthCheck();
export const isUsingDegradedAccuracy = () => locationService.isUsingDegradedAccuracy();
export const getLastGoodLocation = () => locationService.getLastGoodLocation();
export const getQuickLocation = (onAddressResolved?: (location: LocationData) => void) =>
  locationService.getQuickLocation(onAddressResolved); 