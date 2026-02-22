/**
 * Driver Location Publisher Hook
 * Publishes driver's location to Firestore every 10 seconds when online
 * This enables clients to see nearby available drivers on the map
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { geohashForLocation } from 'geofire-common';
import { updateDriverLocation } from '../../services/firestore/locations';
import { DriverLocation } from '../../types/firestore';
import { LocationData } from '../../types/shared';

interface UseDriverLocationPublisherParams {
  driverId: string | null;
  isOnline: boolean;
  location: LocationData | null;
  activeOrderId?: string | null; // Optional: current order being serviced
}

interface UseDriverLocationPublisherReturn {
  isPublishing: boolean;
  lastPublished: Date | null;
  publishError: string | null;
}

const PUBLISH_INTERVAL_MS = 10000; // 10 seconds

export function useDriverLocationPublisher({
  driverId,
  isOnline,
  location,
  activeOrderId
}: UseDriverLocationPublisherParams): UseDriverLocationPublisherReturn {
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastPublished, setLastPublished] = useState<Date | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Publish location to Firestore
  const publishLocation = useCallback(async () => {
    if (!driverId || !location) {
      return;
    }

    try {
      // Compute geohash for efficient regional queries (N+1 optimization)
      const geohash = geohashForLocation([location.latitude, location.longitude], 9);
      const geohashPrefix = geohash.substring(0, 4); // ~20km cells for regional grouping

      const driverLocation: DriverLocation = {
        driverId,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address || '',
        },
        geohash,
        geohashPrefix,
        isOnline: true,
        timestamp: new Date(),
        ...(activeOrderId && { orderId: activeOrderId }),
      };

      await updateDriverLocation(driverId, driverLocation);

      setLastPublished(new Date());
      setPublishError(null);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📍 [DRIVER LOCATION] Published to Firestore');
      console.log(`   Driver ID: ${driverId}`);
      console.log(`   Location: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`);
      console.log(`   Geohash: ${geohash} (prefix: ${geohashPrefix})`);
      console.log(`   Time: ${new Date().toISOString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LocationPublisher] Failed to publish:', errorMessage);
      setPublishError(errorMessage);
    }
  }, [driverId, location, activeOrderId]);

  // Mark driver as offline when going offline
  const markOffline = useCallback(async () => {
    if (!driverId) return;

    try {
      // Compute geohash if location available
      const lat = location?.latitude || 0;
      const lng = location?.longitude || 0;
      const geohash = lat && lng ? geohashForLocation([lat, lng], 9) : undefined;
      const geohashPrefix = geohash?.substring(0, 4);

      const offlineLocation: DriverLocation = {
        driverId,
        location: {
          latitude: lat,
          longitude: lng,
          address: location?.address || '',
        },
        geohash,
        geohashPrefix,
        isOnline: false,
        timestamp: new Date(),
      };

      await updateDriverLocation(driverId, offlineLocation);

      if (__DEV__) {
        console.log('📍 [LocationPublisher] Marked driver as offline');
      }
    } catch (error) {
      console.error('[LocationPublisher] Failed to mark offline:', error);
    }
  }, [driverId, location]);

  // Start/stop publishing based on online status
  useEffect(() => {
    // Clean up existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't publish if conditions aren't met
    if (!driverId || !isOnline || !location) {
      if (isPublishing) {
        setIsPublishing(false);
        // Mark as offline when going offline
        if (driverId && !isOnline) {
          markOffline();
        }
      }
      return;
    }

    // Start publishing
    setIsPublishing(true);
    setPublishError(null);

    if (__DEV__) {
      console.log('📍 [LocationPublisher] Starting location publishing (every 10s)');
    }

    // Publish immediately
    publishLocation();

    // Then publish every 10 seconds
    intervalRef.current = setInterval(publishLocation, PUBLISH_INTERVAL_MS);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [driverId, isOnline, location?.latitude, location?.longitude, publishLocation, markOffline]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // App going to background - stop publishing but don't mark offline
        // (driver might just be switching apps briefly)
        if (__DEV__) {
          console.log('📍 [LocationPublisher] App going to background');
        }
      } else if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App coming to foreground - publish immediately if online
        if (isOnline && driverId && location) {
          if (__DEV__) {
            console.log('📍 [LocationPublisher] App returning to foreground, publishing...');
          }
          publishLocation();
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isOnline, driverId, location, publishLocation]);

  // Cleanup on unmount - mark driver as offline
  useEffect(() => {
    return () => {
      if (__DEV__) {
        console.log('📍 [LocationPublisher] Component unmounting, cleaning up...');
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Note: We don't mark offline here because unmount might happen during navigation
      // The markOffline is called explicitly when isOnline changes to false
    };
  }, []);

  return {
    isPublishing,
    lastPublished,
    publishError
  };
}
