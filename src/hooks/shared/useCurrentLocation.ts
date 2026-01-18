import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { LocationData } from '../../types/shared';
import { locationService, getCurrentLocation, watchUserLocation, isUsingDegradedAccuracy, getQuickLocation } from '../../services/locationService';

// Maximum age for last known location fallback (in milliseconds)
const MAX_FALLBACK_LOCATION_AGE_MS = 2 * 60 * 1000; // 2 minutes

interface UseCurrentLocationOptions {
  enableWatching?: boolean;
  distanceInterval?: number; // meters
  timeInterval?: number; // milliseconds
}

export function useCurrentLocation(options: UseCurrentLocationOptions = {}) {
  const {
    enableWatching = true,
    distanceInterval = 10, // Update every 10 meters
    timeInterval = 30000, // Update every 30 seconds
  } = options;

  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDegradedAccuracy, setIsDegradedAccuracy] = useState(false);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);

  /**
   * Get current location using enhanced service with circuit breaker protection
   */
  const getCurrentLocationEnhanced = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📍 Getting current location with enhanced service...');
      const locationData = await getCurrentLocation();

      setLocation(locationData);
      setIsDegradedAccuracy(isUsingDegradedAccuracy());
      console.log('✅ Location updated successfully:', locationData.address, isDegradedAccuracy ? '(degraded accuracy)' : '');

    } catch (err) {
      console.error('❌ Enhanced location error:', err);

      // Try to use last known location as fallback
      const lastKnown = locationService.getLastKnownLocation();

      if (lastKnown && lastKnown.timestamp) {
        const ageMs = Date.now() - lastKnown.timestamp.getTime();

        if (ageMs < MAX_FALLBACK_LOCATION_AGE_MS) {
          console.log(`🔄 Using last known location as fallback (${Math.round(ageMs / 60000)}m old)`);
          setLocation(lastKnown);
          setError('Използва се последна известна локация');
        } else {
          console.warn(`⚠️ Last known location too old (${Math.round(ageMs / 60000)}m), not using`);
          setError('Не можахме да определим вашата локация');
        }
      } else {
        setError('Не можахме да определим вашата локация');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start watching location with enhanced service
   */
  const startWatchingEnhanced = async () => {
    try {
      // Check permissions first
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Необходим е достъп до локацията за да използвате приложението');
        return;
      }

      // Stop existing subscription
      if (watchSubscription.current) {
        watchSubscription.current.remove();
      }

      console.log('🗺️ Starting enhanced location watching...');

      // Start watching with enhanced service
      watchSubscription.current = await watchUserLocation(
        (locationData: LocationData) => {
          const degraded = isUsingDegradedAccuracy();
          console.log('📍 Enhanced location update:', locationData.address, degraded ? '(degraded accuracy)' : '');
          setLocation(locationData);
          setIsDegradedAccuracy(degraded);
          setError(null); // Clear any previous errors on successful update
        },
        {
          accuracy: Location.Accuracy.High,
          timeInterval,
          distanceInterval,
        }
      );

      console.log('✅ Enhanced location watching started');
      
    } catch (err) {
      console.error('❌ Enhanced location watching error:', err);
      setError('Не можахме да следим вашата локация');
    }
  };

  /**
   * Stop watching location
   */
  const stopWatching = () => {
    if (watchSubscription.current) {
      watchSubscription.current.remove();
      watchSubscription.current = null;
      console.log('🗺️ Enhanced location watching stopped');
    }
  };

  /**
   * Force refresh location (manual retry)
   */
  const forceRefreshLocation = async () => {
    console.log('🔄 Force refreshing location...');
    try {
      setLoading(true);
      const locationData = await locationService.forceRefreshLocation();
      setLocation(locationData);
      setError(null);
      console.log('✅ Force refresh successful');
    } catch (err) {
      console.error('❌ Force refresh failed:', err);
      setError('Не можахме да обновим локацията');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Quick locate - fast coordinates, then geocode address in background
   * Ideal for "locate me" button
   */
  const quickLocate = async () => {
    console.log('⚡ Quick locate...');
    try {
      // Get coordinates fast, address will update via callback
      const locationData = await getQuickLocation((updatedLocation) => {
        // Background geocoding completed - update with real address
        console.log('⚡ Address resolved, updating location');
        setLocation(updatedLocation);
      });
      setLocation(locationData);
      setError(null);
      return locationData;
    } catch (err) {
      console.error('❌ Quick locate failed:', err);
      // Don't set error for quick locate - it's non-critical
      throw err;
    }
  };

  /**
   * Get location service health status
   */
  const getLocationHealth = async () => {
    try {
      const health = await locationService.healthCheck();
      console.log('🏥 Location service health:', health);
      return health;
    } catch (error) {
      console.error('❌ Location health check failed:', error);
      return null;
    }
  };

  // Initialize location service
  useEffect(() => {
    console.log('🚀 Initializing enhanced location service...');
    
    // Get initial location
    getCurrentLocationEnhanced();

    // Start watching if enabled
    if (enableWatching) {
      startWatchingEnhanced();
    }

    // Cleanup on unmount
    return () => {
      stopWatching();
    };
  }, [enableWatching, timeInterval, distanceInterval]);

  return {
    location,
    loading,
    error,
    isDegradedAccuracy, // True when using fallback location due to poor GPS accuracy
    refreshLocation: getCurrentLocationEnhanced,
    forceRefreshLocation,
    quickLocate, // Fast location without geocoding - ideal for "locate me" button
    startWatching: startWatchingEnhanced,
    stopWatching,
    isWatching: watchSubscription.current !== null,
    getLocationHealth,
  };
} 