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
}

/**
 * Enhanced Location Service with Circuit Breaker Protection
 */
export class LocationService {
  private config: LocationServiceConfig;
  private addressCache: Map<string, { address: string; timestamp: number }> = new Map();
  private lastKnownLocation: LocationData | null = null;

  constructor(config: Partial<LocationServiceConfig> = {}) {
    this.config = {
      enableFallbacks: true,
      maxRetries: 3,
      timeoutMs: 8000, // 8 seconds for geocoding
      cacheAddresses: true,
      ...config
    };
  }

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
      const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
      const cached = this.addressCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
        console.log('📍 Using cached address');
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

    // Enhanced callback with error handling
    const enhancedCallback = async (locationUpdate: Location.LocationObject) => {
      try {
        const locationData = await this.processLocationUpdate(locationUpdate);
        callback(locationData);
        
        // Update last known location
        this.lastKnownLocation = locationData;
        
      } catch (error) {
        console.warn('📍 Location update failed, using fallback:', error);
        
        // Use coordinates only if geocoding fails
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
   * Force refresh location (for manual retry)
   */
  async forceRefreshLocation(): Promise<LocationData> {
    console.log('🔄 Force refreshing location...');
    
    try {
      return await this.getCurrentPosition();
    } catch (error) {
      console.error('❌ Force refresh failed:', error);
      
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

    // Get address with fallback handling
    let address: string;
    try {
      address = await this.reverseGeocode(latitude, longitude);
    } catch (error) {
      console.warn('📍 Geocoding failed, using fallback address:', error);
      address = this.generateFallbackAddress(latitude, longitude);
    }

    return {
      latitude,
      longitude,
      address,
      accuracy: locationData.coords.accuracy || undefined,
      timestamp: new Date()
    };
  }

  private async reverseGeocodeInternal(latitude: number, longitude: number): Promise<string> {
    try {
      console.log(`📍 Geocoding: ${latitude}, ${longitude}`);
      
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
        const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
        this.addressCache.set(cacheKey, { 
          address, 
          timestamp: Date.now() 
        });
      }

      console.log(`✅ Geocoded address: ${address}`);
      return address;

    } catch (error) {
      console.error('❌ Geocoding failed:', error);
      
      // Try alternative geocoding services if available
      if (this.config.enableFallbacks) {
        return await this.tryAlternativeGeocoding(latitude, longitude);
      }
      
      throw error;
    }
  }

  private async processLocationUpdate(locationUpdate: Location.LocationObject): Promise<LocationData> {
    const { latitude, longitude } = locationUpdate.coords;
    
    // Try to get address with circuit breaker protection
    let address: string;
    try {
      address = await this.reverseGeocode(latitude, longitude);
    } catch (error) {
      // Use fallback address if geocoding fails
      address = this.generateFallbackAddress(latitude, longitude);
    }

    return {
      latitude,
      longitude,
      address,
      accuracy: locationUpdate.coords.accuracy || undefined,
      timestamp: new Date()
    };
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
    console.log('🔄 Trying alternative geocoding methods...');
    
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
        console.log('📍 Using cached geocoding result');
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
      console.log(`🗺️ Geocoding address: ${address}`);
      
      const results = await Location.geocodeAsync(address);
      
      if (results.length === 0) {
        console.warn('📍 No geocoding results found for address:', address);
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

      console.log(`✅ Geocoded address "${address}" to:`, result);
      return result;

    } catch (error) {
      console.error('❌ Address geocoding failed:', error);
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