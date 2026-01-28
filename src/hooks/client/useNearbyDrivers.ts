/**
 * Hook for subscribing to nearby online drivers
 * Used to display available drivers on the client's map
 */

import { useState, useEffect, useRef } from 'react';
import { subscribeToNearbyDrivers } from '../../services/firestore/locations';
import { DriverLocation } from '../../types/firestore';
import { LocationData } from '../../types/shared';

interface UseNearbyDriversParams {
  clientLocation: LocationData | null;
  radiusKm?: number;
  enabled?: boolean; // Allow disabling the subscription
}

interface UseNearbyDriversReturn {
  nearbyDrivers: DriverLocation[];
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_RADIUS_KM = 50;

export function useNearbyDrivers({
  clientLocation,
  radiusKm = DEFAULT_RADIUS_KM,
  enabled = true
}: UseNearbyDriversParams): UseNearbyDriversReturn {
  const [nearbyDrivers, setNearbyDrivers] = useState<DriverLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if this is the first load
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    // Don't subscribe if disabled or no client location
    if (!enabled || !clientLocation) {
      setNearbyDrivers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(isFirstLoadRef.current);
    setError(null);

    if (__DEV__) {
      console.log(`🚗 [useNearbyDrivers] Subscribing (${radiusKm}km radius)`);
    }

    const unsubscribe = subscribeToNearbyDrivers(
      { latitude: clientLocation.latitude, longitude: clientLocation.longitude },
      radiusKm,
      (drivers) => {
        setNearbyDrivers(drivers);
        setIsLoading(false);
        isFirstLoadRef.current = false;

        if (__DEV__ && drivers.length > 0) {
          console.log(`🚗 [useNearbyDrivers] ${drivers.length} drivers nearby`);
        }
      }
    );

    return () => {
      if (__DEV__) {
        console.log('🚗 [useNearbyDrivers] Unsubscribing');
      }
      unsubscribe();
    };
  }, [
    clientLocation?.latitude,
    clientLocation?.longitude,
    radiusKm,
    enabled
  ]);

  return {
    nearbyDrivers,
    isLoading,
    error
  };
}
