import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { LocationData } from '../../types/shared';
import { locationService, getCurrentLocation, watchUserLocation } from '../../services/locationService';

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
      console.log('✅ Location updated successfully:', locationData.address);
      
    } catch (err) {
      console.error('❌ Enhanced location error:', err);
      
      // Try to use last known location as fallback
      const lastKnown = locationService.getLastKnownLocation();
      if (lastKnown) {
        console.log('🔄 Using last known location as fallback');
        setLocation(lastKnown);
        setError('Използва се последна известна локация');
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
          console.log('📍 Enhanced location update:', locationData.address);
          setLocation(locationData);
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
    refreshLocation: getCurrentLocationEnhanced,
    forceRefreshLocation,
    startWatching: startWatchingEnhanced,
    stopWatching,
    isWatching: watchSubscription.current !== null,
    getLocationHealth,
  };
} 