import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { LocationData } from '../../types/shared';

interface ActiveOrder {
  id: string;
  status: string;
  acceptedDriverId?: string;
}

/**
 * Hook to track driver's real-time location during active orders
 *
 * Usage:
 * const driverLocation = useDriverTracking(activeOrder);
 *
 * Then pass driverLocation to NativeMap:
 * <NativeMap
 *   location={clientLocation}
 *   driverLocation={driverLocation}
 *   showDriverMarker={activeOrder?.status === 'accepted'}
 * />
 *
 * Note: Driver must be sending location updates to driverLocations/{driverId}
 * This requires implementing location publishing on the driver side
 */
export function useDriverTracking(activeOrder: ActiveOrder | null): LocationData | null {
  const [driverLocation, setDriverLocation] = useState<LocationData | null>(null);

  useEffect(() => {
    // Debug: Log order state for tracking diagnosis
    if (__DEV__) {
      console.log('🔍 [DriverTracking] Order state:', {
        hasOrder: !!activeOrder,
        orderId: activeOrder?.id,
        status: activeOrder?.status,
        acceptedDriverId: activeOrder?.acceptedDriverId || 'NOT SET'
      });
    }

    // Only track when order is accepted and we have a driver ID
    if (!activeOrder?.acceptedDriverId) {
      if (__DEV__ && activeOrder?.status === 'accepted') {
        console.warn('⚠️ [DriverTracking] Order is accepted but acceptedDriverId is missing!');
      }
      setDriverLocation(null);
      return;
    }

    // Only track during 'accepted' or 'in_progress' status
    const trackableStatuses = ['accepted', 'in_progress'];
    if (!trackableStatuses.includes(activeOrder.status)) {
      setDriverLocation(null);
      return;
    }

    console.log('🚗 Starting driver location tracking:', {
      orderId: activeOrder.id,
      driverId: activeOrder.acceptedDriverId,
      status: activeOrder.status
    });

    // Subscribe to driver's location document
    const driverLocationRef = doc(db, 'driverLocations', activeOrder.acceptedDriverId);

    const unsubscribe = onSnapshot(
      driverLocationRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          // Handle both old format (flat) and new format (nested location object)
          const latitude = data.location?.latitude ?? data.latitude;
          const longitude = data.location?.longitude ?? data.longitude;
          const address = data.location?.address ?? data.address ?? '';

          if (!latitude || !longitude) {
            console.log('⚠️ Driver location data incomplete');
            setDriverLocation(null);
            return;
          }

          const newLocation: LocationData = {
            latitude,
            longitude,
            address,
          };

          setDriverLocation(newLocation);
          console.log('📍 Driver location updated:', {
            lat: newLocation.latitude.toFixed(6),
            lng: newLocation.longitude.toFixed(6)
          });
        } else {
          console.log('⚠️ Driver location document not found');
          setDriverLocation(null);
        }
      },
      (error) => {
        console.error('❌ Error tracking driver location:', error);
        setDriverLocation(null);
      }
    );

    // Cleanup subscription on unmount or when order changes
    return () => {
      console.log('🔌 Stopping driver location tracking');
      unsubscribe();
    };
  }, [activeOrder?.acceptedDriverId, activeOrder?.status, activeOrder?.id]);

  return driverLocation;
}

/**
 * Future enhancement: Hook for driver to publish their location
 * This would be used in DriverHomeScreen when they have an accepted order
 */
export function useDriverLocationPublisher() {
  // TODO: Implement location publishing for drivers
  // This would:
  // 1. Start location updates when driver has an active order
  // 2. Publish to driverLocations/{driverId} every 10-30 seconds
  // 3. Stop publishing when order is completed

  return {
    startPublishing: () => console.log('TODO: Start location publishing'),
    stopPublishing: () => console.log('TODO: Stop location publishing'),
    isPublishing: false
  };
}
