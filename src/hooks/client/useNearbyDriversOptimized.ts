/**
 * Optimized Hook for Nearby Drivers (N+1 Fix)
 *
 * Instead of subscribing to ALL online drivers and filtering client-side,
 * this hook subscribes to pre-aggregated regional cache documents.
 *
 * How it works:
 * 1. Calculate which ~20km regions cover the search radius
 * 2. Subscribe to nearbyDriversCache/{regionId} for each region (4-8 docs)
 * 3. Merge results and filter by exact distance
 * 4. FALLBACK: If cache is empty, query driverLocations directly
 *
 * Performance improvement:
 * - Before: 10,000 doc reads per client
 * - After: 4-8 doc reads per client (99.9% reduction)
 *
 * Fallback mechanism:
 * - Cache is updated every 60 seconds by Cloud Function
 * - If a driver just went online, they might not be in cache yet
 * - Fallback queries driverLocations directly to show drivers immediately
 * - Once cache populates, it takes over (more efficient)
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { geohashQueryBounds, geohashForLocation } from 'geofire-common';
import { db } from '../../config/firebase';
import { DriverLocation } from '../../types/firestore';
import { LocationData } from '../../types/shared';

interface UseNearbyDriversParams {
  clientLocation: LocationData | null;
  radiusKm?: number;
  enabled?: boolean;
}

interface UseNearbyDriversReturn {
  nearbyDrivers: DriverLocation[];
  isLoading: boolean;
  error: string | null;
  // Additional stats for debugging
  stats?: {
    regionCount: number;
    totalFromCache: number;
    afterDistanceFilter: number;
    usingFallback?: boolean;
  };
}

// Compact driver from cache
interface DriverSummary {
  id: string;
  lat: number;
  lng: number;
  heading?: number;
  ts: number;
}

const DEFAULT_RADIUS_KM = 50;

// Haversine distance calculation (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convert compact DriverSummary to full DriverLocation format
function summaryToDriverLocation(summary: DriverSummary): DriverLocation {
  return {
    driverId: summary.id,
    location: {
      latitude: summary.lat,
      longitude: summary.lng,
      address: '' // Not available in cache (not needed for map display)
    },
    heading: summary.heading,
    isOnline: true,
    timestamp: new Date(summary.ts * 1000)
  };
}

export function useNearbyDriversOptimized({
  clientLocation,
  radiusKm = DEFAULT_RADIUS_KM,
  enabled = true
}: UseNearbyDriversParams): UseNearbyDriversReturn {
  const [nearbyDrivers, setNearbyDrivers] = useState<DriverLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UseNearbyDriversReturn['stats']>();

  // Store drivers from each region
  const regionDriversRef = useRef(new Map<string, DriverSummary[]>());
  const isFirstLoadRef = useRef(true);
  const fallbackAttemptedRef = useRef(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // Calculate which regions to subscribe to based on client location
  const regionIds = useMemo(() => {
    if (!clientLocation || !enabled) return [];

    try {
      const center: [number, number] = [clientLocation.latitude, clientLocation.longitude];
      const radiusMeters = radiusKm * 1000;

      // Get geohash bounds for the search area
      const bounds = geohashQueryBounds(center, radiusMeters);

      // Extract unique 4-char prefixes that cover the search area
      const prefixes = new Set<string>();

      // CRITICAL: Always include the client's own geohash prefix first
      // This guarantees we find drivers very close to the client
      const clientGeohash = geohashForLocation(center, 9);
      const clientPrefix = clientGeohash.substring(0, 4);
      prefixes.add(clientPrefix);

      // Add prefixes from bounds
      // Note: geohashQueryBounds returns ranges like [start, end] where end uses ~ as boundary
      // We need to enumerate prefixes within each range, not just start/end
      bounds.forEach(([start, end]) => {
        if (start && start.length >= 4) {
          const startPrefix = start.substring(0, 4);
          prefixes.add(startPrefix);

          // If end prefix is different from start, we need intermediate prefixes
          if (end && end.length >= 4) {
            const endPrefix = end.substring(0, 4);
            // For geohashes, we can enumerate characters to find intermediate prefixes
            // The last character increments: 0-9, then b-h, then j-n, then p-z (no a, i, l, o)
            // For simplicity, we'll use a range-based approach
            if (startPrefix !== endPrefix && startPrefix.substring(0, 3) === endPrefix.substring(0, 3)) {
              // Same 3-char prefix, different 4th char - enumerate between them
              const base32Chars = '0123456789bcdefghjkmnpqrstuvwxyz';
              const startChar = startPrefix[3];
              const endChar = endPrefix[3] === '~' ? 'z' : endPrefix[3];
              const startIdx = base32Chars.indexOf(startChar);
              const endIdx = base32Chars.indexOf(endChar);

              if (startIdx !== -1 && endIdx !== -1) {
                for (let i = startIdx; i <= endIdx && i < base32Chars.length; i++) {
                  prefixes.add(startPrefix.substring(0, 3) + base32Chars[i]);
                }
              }
            }
          }
        }
      });

      const result = Array.from(prefixes);

      if (__DEV__) {
        console.log(`📍 [NearbyDriversOptimized] Client geohash: ${clientGeohash} (prefix: ${clientPrefix})`);
        console.log(`📍 [NearbyDriversOptimized] Calculated ${result.length} regions for ${radiusKm}km radius:`, result);
      }

      return result;
    } catch (err) {
      console.error('❌ [NearbyDriversOptimized] Error calculating regions:', err);
      return [];
    }
  }, [clientLocation?.latitude, clientLocation?.longitude, radiusKm, enabled]);

  // Subscribe to regional caches
  useEffect(() => {
    // Reset if disabled or no location
    if (!enabled || !clientLocation || regionIds.length === 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📍 [NEARBY DRIVERS] Not searching - missing requirements');
      console.log(`   enabled: ${enabled}`);
      console.log(`   clientLocation: ${clientLocation ? `${clientLocation.latitude.toFixed(4)}, ${clientLocation.longitude.toFixed(4)}` : 'NULL'}`);
      console.log(`   regionIds: ${regionIds.length}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      setNearbyDrivers([]);
      setIsLoading(false);
      setError(null);
      regionDriversRef.current.clear();
      return;
    }

    setIsLoading(isFirstLoadRef.current);
    setError(null);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 [NEARBY DRIVERS] Subscribing to regional caches');
    console.log(`   Client Location: ${clientLocation.latitude.toFixed(4)}, ${clientLocation.longitude.toFixed(4)}`);
    console.log(`   Search Radius: ${radiusKm}km`);
    console.log(`   Regions to check: ${regionIds.join(', ')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const unsubscribes: (() => void)[] = [];
    regionDriversRef.current = new Map();

    // Function to merge all regions and update state
    const updateDrivers = () => {
      try {
        // Merge all regional drivers
        const allDrivers: DriverSummary[] = [];
        regionDriversRef.current.forEach((drivers) => {
          allDrivers.push(...drivers);
        });

        // Filter by exact distance (regions are ~20km, we need exact radius)
        const filtered = allDrivers.filter(d => {
          const distance = calculateDistance(
            clientLocation.latitude,
            clientLocation.longitude,
            d.lat,
            d.lng
          );
          return distance <= radiusKm;
        });

        // Convert to DriverLocation format
        const driverLocations = filtered.map(summaryToDriverLocation);

        // Update stats
        setStats({
          regionCount: regionIds.length,
          totalFromCache: allDrivers.length,
          afterDistanceFilter: filtered.length,
          usingFallback: false
        });

        setNearbyDrivers(driverLocations);
        setIsLoading(false);
        isFirstLoadRef.current = false;

        // Reset fallback flag if cache now has drivers
        if (filtered.length > 0) {
          fallbackAttemptedRef.current = false;
          setUsingFallback(false);
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📍 [NEARBY DRIVERS] Update received');
        console.log(`   Total from cache: ${allDrivers.length}`);
        console.log(`   Within ${radiusKm}km: ${filtered.length}`);
        if (filtered.length > 0) {
          filtered.forEach((d, i) => {
            console.log(`   Driver ${i + 1}: ${d.id} at (${d.lat.toFixed(4)}, ${d.lng.toFixed(4)})`);
          });
        } else {
          console.log('   ⚠️ No drivers found in range!');
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } catch (err) {
        console.error('❌ [NearbyDriversOptimized] Error updating drivers:', err);
        setError(err instanceof Error ? err.message : 'Failed to update drivers');
      }
    };

    // Subscribe to each regional cache
    regionIds.forEach(regionId => {
      const cacheRef = doc(db, 'nearbyDriversCache', regionId);

      const unsubscribe = onSnapshot(
        cacheRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            regionDriversRef.current.set(regionId, data.drivers || []);

            if (__DEV__) {
              console.log(`📍 [NearbyDriversOptimized] Region ${regionId}: ${data.drivers?.length || 0} drivers`);
            }
          } else {
            // Region doesn't exist yet (no drivers in that area)
            regionDriversRef.current.set(regionId, []);
          }

          updateDrivers();
        },
        (err) => {
          console.error(`❌ [NearbyDriversOptimized] Error subscribing to region ${regionId}:`, err);
          // Don't fail completely - just mark this region as empty
          regionDriversRef.current.set(regionId, []);
          updateDrivers();
        }
      );

      unsubscribes.push(unsubscribe);
    });

    // Cleanup
    return () => {
      if (__DEV__) {
        console.log('📍 [NearbyDriversOptimized] Cleaning up subscriptions');
      }
      unsubscribes.forEach(fn => fn());
      regionDriversRef.current.clear();
      fallbackAttemptedRef.current = false;
      setUsingFallback(false);
    };
  }, [regionIds.join(','), enabled, clientLocation?.latitude, clientLocation?.longitude, radiusKm]);

  // Reset fallback flag when location changes significantly (allows retry)
  useEffect(() => {
    fallbackAttemptedRef.current = false;
  }, [clientLocation?.latitude?.toFixed(2), clientLocation?.longitude?.toFixed(2)]);

  // Fallback: If cache returns 0 drivers after loading, query driverLocations directly
  useEffect(() => {
    // Only fallback if:
    // 1. Enabled and has location
    // 2. Not loading anymore
    // 3. Cache returned 0 drivers
    // 4. Haven't attempted fallback yet (prevent infinite loops)
    if (!enabled || !clientLocation || isLoading || nearbyDrivers.length > 0 || fallbackAttemptedRef.current) {
      return;
    }

    fallbackAttemptedRef.current = true;

    const fetchDirectDrivers = async () => {
      try {
        if (__DEV__) {
          console.log('📍 [NearbyDriversOptimized] Cache empty, falling back to direct query');
        }
        setUsingFallback(true);

        // Query online drivers directly from driverLocations
        const twoMinutesAgo = Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 1000));
        const driversRef = collection(db, 'driverLocations');
        const q = query(
          driversRef,
          where('isOnline', '==', true)
        );

        const snapshot = await getDocs(q);

        // Filter by distance and timestamp client-side
        const filteredDrivers: DriverLocation[] = [];

        snapshot.forEach(doc => {
          const data = doc.data();

          // Check timestamp freshness
          const timestamp = data.timestamp?.toDate?.() || data.timestamp;
          if (!timestamp || timestamp < twoMinutesAgo.toDate()) {
            return; // Skip stale locations
          }

          // Check location exists
          if (!data.location?.latitude || !data.location?.longitude) {
            return;
          }

          // Check distance
          const distance = calculateDistance(
            clientLocation.latitude,
            clientLocation.longitude,
            data.location.latitude,
            data.location.longitude
          );

          if (distance <= radiusKm) {
            filteredDrivers.push({
              driverId: doc.id,
              location: {
                latitude: data.location.latitude,
                longitude: data.location.longitude,
                address: data.location.address || ''
              },
              heading: data.heading,
              isOnline: true,
              timestamp: timestamp
            });
          }
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📍 [NEARBY DRIVERS] FALLBACK query results');
        console.log(`   Total online drivers in DB: ${snapshot.size}`);
        console.log(`   Within ${radiusKm}km: ${filteredDrivers.length}`);
        if (filteredDrivers.length > 0) {
          filteredDrivers.forEach((d, i) => {
            console.log(`   Driver ${i + 1}: ${d.driverId} at (${d.location.latitude.toFixed(4)}, ${d.location.longitude.toFixed(4)})`);
          });
        } else {
          console.log('   ⚠️ No drivers found in range (check if locations match)!');
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (filteredDrivers.length > 0) {
          setNearbyDrivers(filteredDrivers);
          setStats({
            regionCount: regionIds.length,
            totalFromCache: 0,
            afterDistanceFilter: filteredDrivers.length,
            usingFallback: true
          });
        }
      } catch (err) {
        console.error('❌ [NearbyDriversOptimized] Fallback query failed:', err);
        // Don't set error - cache might still work eventually
      }
    };

    fetchDirectDrivers();
  }, [enabled, clientLocation, isLoading, nearbyDrivers.length, radiusKm, regionIds.length]);

  // Periodic retry if no drivers found (every 30 seconds)
  // This handles cases where cache is initially empty or drivers went offline
  useEffect(() => {
    // Don't retry if we have drivers, not enabled, or no location
    if (nearbyDrivers.length > 0 || !enabled || !clientLocation) {
      return;
    }

    if (__DEV__) {
      console.log('📍 [NearbyDriversOptimized] Starting periodic retry (no drivers found)');
    }

    const retryInterval = setInterval(() => {
      if (__DEV__) {
        console.log('📍 [NearbyDriversOptimized] Retry interval - allowing fallback');
      }
      fallbackAttemptedRef.current = false; // Allow fallback to run again
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(retryInterval);
    };
  }, [nearbyDrivers.length, enabled, clientLocation]);

  return {
    nearbyDrivers,
    isLoading,
    error,
    stats
  };
}

/**
 * Drop-in replacement for useNearbyDrivers
 * Use this when ready to switch to optimized version
 *
 * Usage:
 * // Before:
 * import { useNearbyDrivers } from './useNearbyDrivers';
 *
 * // After:
 * import { useNearbyDrivers } from './useNearbyDriversOptimized';
 */
export { useNearbyDriversOptimized as useNearbyDrivers };
