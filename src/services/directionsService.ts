/**
 * Google Directions API Service
 * Provides ETA (Estimated Time of Arrival) calculations between two points
 */

import Constants from 'expo-constants';

// Get Google Maps API key from config
const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.ios?.config?.googleMapsApiKey ||
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  '';

export interface ETAResult {
  durationMinutes: number;
  durationText: string;
  distanceKm: number;
  distanceText: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Get ETA between two coordinates using Google Directions API
 * @param origin Starting point coordinates
 * @param destination End point coordinates
 * @returns ETAResult with duration and distance, or null on error
 */
export const getETA = async (
  origin: Coordinates,
  destination: Coordinates
): Promise<ETAResult | null> => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[Directions] No Google Maps API key configured');
    return getEstimatedETA(origin, destination);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${origin.latitude},${origin.longitude}&` +
      `destination=${destination.latitude},${destination.longitude}&` +
      `mode=driving&` +
      `language=bg&` +
      `key=${GOOGLE_MAPS_API_KEY}`;

    if (__DEV__) {
      console.log('[Directions] Fetching ETA...');
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.routes.length > 0) {
      const leg = data.routes[0].legs[0];

      const result: ETAResult = {
        durationMinutes: Math.ceil(leg.duration.value / 60),
        durationText: leg.duration.text,
        distanceKm: leg.distance.value / 1000,
        distanceText: leg.distance.text
      };

      if (__DEV__) {
        console.log(`[Directions] ETA: ${result.durationText} (${result.distanceText})`);
      }

      return result;
    } else {
      console.warn('[Directions] API returned status:', data.status);
      // Fallback to estimated ETA
      return getEstimatedETA(origin, destination);
    }
  } catch (error) {
    console.error('[Directions] Error fetching ETA:', error);
    // Fallback to estimated ETA
    return getEstimatedETA(origin, destination);
  }
};

/**
 * Calculate estimated ETA based on straight-line distance
 * Used as fallback when Google Directions API is unavailable
 * Assumes average speed of 40 km/h in urban areas
 */
export const getEstimatedETA = (
  origin: Coordinates,
  destination: Coordinates
): ETAResult => {
  const distanceKm = calculateHaversineDistance(origin, destination);

  // Assume average speed of 40 km/h in urban areas
  // Multiply by 1.3 to account for non-straight routes
  const estimatedDistanceKm = distanceKm * 1.3;
  const averageSpeedKmh = 40;
  const durationMinutes = Math.ceil((estimatedDistanceKm / averageSpeedKmh) * 60);

  return {
    durationMinutes: Math.max(1, durationMinutes), // Minimum 1 minute
    durationText: formatDuration(durationMinutes),
    distanceKm: Math.round(estimatedDistanceKm * 10) / 10,
    distanceText: formatDistance(estimatedDistanceKm)
  };
};

/**
 * Calculate Haversine distance between two coordinates
 */
const calculateHaversineDistance = (
  point1: Coordinates,
  point2: Coordinates
): number => {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) *
    Math.cos(toRadians(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Format duration in minutes to human-readable Bulgarian text
 */
const formatDuration = (minutes: number): string => {
  if (minutes < 1) {
    return 'по-малко от 1 мин';
  } else if (minutes === 1) {
    return '1 мин';
  } else if (minutes < 60) {
    return `${minutes} мин`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return hours === 1 ? '1 час' : `${hours} часа`;
    }
    return `${hours} ч ${remainingMinutes} мин`;
  }
};

/**
 * Format distance in kilometers to human-readable text
 */
const formatDistance = (km: number): string => {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} м`;
  }
  return `${km.toFixed(1)} км`;
};
