/**
 * Hook for calculating ETA (Estimated Time of Arrival) from driver to client
 * Uses Google Directions API with fallback to distance-based estimation
 */

import { useState, useEffect, useRef } from 'react';
import { getETA, ETAResult } from '../../services/directionsService';
import { LocationData } from '../../types/shared';

interface UseDriverETAParams {
  driverLocation: LocationData | null;
  clientLocation: LocationData | null;
  enabled?: boolean;
  refreshIntervalMs?: number; // How often to refresh ETA (default: 30 seconds)
}

interface UseDriverETAReturn {
  eta: ETAResult | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const DEFAULT_REFRESH_INTERVAL_MS = 30000; // 30 seconds

export function useDriverETA({
  driverLocation,
  clientLocation,
  enabled = true,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS
}: UseDriverETAParams): UseDriverETAReturn {
  const [eta, setEta] = useState<ETAResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<{ driverLat: number; driverLng: number } | null>(null);

  useEffect(() => {
    // Clean up interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Clear interval when dependencies change
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't fetch if disabled or missing locations
    if (!enabled || !driverLocation || !clientLocation) {
      setEta(null);
      setIsLoading(false);
      return;
    }

    const fetchETA = async () => {
      // Skip if driver hasn't moved significantly (more than 50m)
      if (lastFetchRef.current) {
        const movedDistance = Math.abs(driverLocation.latitude - lastFetchRef.current.driverLat) +
          Math.abs(driverLocation.longitude - lastFetchRef.current.driverLng);
        // Approximately 0.0005 degrees = 50 meters
        if (movedDistance < 0.0005 && eta) {
          if (__DEV__) {
            console.log('[useDriverETA] Driver hasn\'t moved significantly, skipping fetch');
          }
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getETA(
          { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
          { latitude: clientLocation.latitude, longitude: clientLocation.longitude }
        );

        if (result) {
          setEta(result);
          setLastUpdated(new Date());
          lastFetchRef.current = {
            driverLat: driverLocation.latitude,
            driverLng: driverLocation.longitude
          };

          if (__DEV__) {
            console.log(`📍 [useDriverETA] Updated: ${result.durationText}`);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to calculate ETA';
        setError(errorMessage);
        console.error('[useDriverETA] Error:', errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchETA();

    // Then fetch periodically
    intervalRef.current = setInterval(fetchETA, refreshIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    driverLocation?.latitude,
    driverLocation?.longitude,
    clientLocation?.latitude,
    clientLocation?.longitude,
    enabled,
    refreshIntervalMs
  ]);

  return {
    eta,
    isLoading,
    error,
    lastUpdated
  };
}
