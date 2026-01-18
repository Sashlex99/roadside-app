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

      const locationData = await getCurrentLocation();

      setLocation(locationData);
      setIsDegradedAccuracy(isUsingDegradedAccuracy());

    } catch (err) {
      if (__DEV__) console.error('[useLocation] Error:', err);

      // Try to use last known location as fallback
      const lastKnown = locationService.getLastKnownLocation();

      if (lastKnown && lastKnown.timestamp) {
        const ageMs = Date.now() - lastKnown.timestamp.getTime();

        if (ageMs < MAX_FALLBACK_LOCATION_AGE_MS) {
          setLocation(lastKnown);
          setError('Използва се последна известна локация');
        } else {
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

      // Start watching with enhanced service
      watchSubscription.current = await watchUserLocation(
        (locationData: LocationData) => {
          setLocation(locationData);
          setIsDegradedAccuracy(isUsingDegradedAccuracy());
          setError(null);
        },
        {
          accuracy: Location.Accuracy.High,
          timeInterval,
          distanceInterval,
        }
      );

    } catch (err) {
      if (__DEV__) console.error('[useLocation] Watch error:', err);
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
    }
  };

  /**
   * Force refresh location (manual retry)
   */
  const forceRefreshLocation = async () => {
    try {
      setLoading(true);
      const locationData = await locationService.forceRefreshLocation();
      setLocation(locationData);
      setError(null);
    } catch (err) {
      if (__DEV__) console.error('[useLocation] Force refresh failed:', err);
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
    try {
      // Get coordinates fast, address will update via callback
      const locationData = await getQuickLocation((updatedLocation) => {
        setLocation(updatedLocation);
      });
      setLocation(locationData);
      setError(null);
      return locationData;
    } catch (err) {
      if (__DEV__) console.error('[useLocation] Quick locate failed:', err);
      throw err;
    }
  };

  /**
   * Get location service health status
   */
  const getLocationHealth = async () => {
    try {
      const health = await locationService.healthCheck();
      if (__DEV__) console.log('[useLocation] Health:', health);
      return health;
    } catch (error) {
      if (__DEV__) console.error('[useLocation] Health check failed:', error);
      return null;
    }
  };

  // Initialize location service
  useEffect(() => {
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