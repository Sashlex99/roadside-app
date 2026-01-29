import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity, Image } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { LocationData } from '../../types/shared';
import { DriverLocation } from '../../types/firestore';
import { Coordinates } from '../../services/directionsService';
import towTruckGreen from '../../../assets/towtruck_green.png';
import towTruckOrange from '../../../assets/towtruck_orange.png';

interface NativeMapProps {
  location: LocationData | null;
  driverLocation?: LocationData | null;  // For real-time driver tracking during active order
  nearbyDrivers?: DriverLocation[];  // Array of nearby online drivers to display
  routeCoordinates?: Coordinates[] | null;  // Route polyline from driver to client
  connectedDriverId?: string | null;  // ID of the connected/accepted driver (renders green instead of orange)
  style?: any;
  onMapReady?: () => void;
  onLocatePress?: () => Promise<LocationData | void> | void;  // Callback for locate button press
  showUserLocation?: boolean;
  showDriverMarker?: boolean;
  showLocateButton?: boolean;  // Whether to show the locate button
  variant?: 'client' | 'driver';
}

// Clean map style - minimal, similar to Carto Positron
const cleanMapStyle = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#c9d1d9' }]
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f5f5f5' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e0e0e0' }]
  }
];

export default function NativeMap({
  location,
  driverLocation,
  nearbyDrivers,
  routeCoordinates,
  connectedDriverId,
  style,
  onMapReady,
  onLocatePress,
  showUserLocation = true,
  showDriverMarker = false,
  showLocateButton = true,
  variant = 'client'
}: NativeMapProps) {
  const mapRef = useRef<MapView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Debug: Log driver marker conditions
  useEffect(() => {
    if (__DEV__) {
      const connectedInNearby = nearbyDrivers?.find(d => d.driverId === connectedDriverId);
      const nearbyDriverIds = nearbyDrivers?.map(d => d.driverId) || [];
      console.log('🗺️ [NativeMap] Driver marker debug:', {
        connectedDriverId: connectedDriverId || 'NOT SET',
        nearbyDriversCount: nearbyDrivers?.length || 0,
        nearbyDriverIds,
        connectedDriverInNearby: !!connectedInNearby,
        showDriverMarker,
        hasDriverLocation: !!driverLocation
      });
    }
  }, [showDriverMarker, driverLocation, connectedDriverId, nearbyDrivers]);

  // Handle locate button press
  const handleLocatePress = async () => {
    // Immediately animate to current location (instant feedback)
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 300);
    }

    // Then refresh location in background
    if (onLocatePress) {
      setIsLocating(true);
      try {
        const newLocation = await onLocatePress();
        // Animate to new location if it changed
        if (newLocation && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: newLocation.latitude,
            longitude: newLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 300);
        }
      } catch (error) {
        // Silently fail - we already animated to current location
        if (__DEV__) console.log('[Map] Location refresh failed, using current position');
      } finally {
        setIsLocating(false);
      }
    }
  };

  // Animate to user location when it changes
  useEffect(() => {
    if (location && mapReady && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  }, [location?.latitude, location?.longitude, mapReady]);

  // Handle map ready event
  const handleMapReady = () => {
    setIsLoading(false);
    setMapReady(true);
    onMapReady?.();
    if (__DEV__) console.log('[Map] Google Maps loaded');
  };

  // Show loading placeholder if no location
  if (!location) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.placeholder}>
          <Ionicons name="location-outline" size={64} color="#ccc" />
          <Text style={styles.placeholderText}>Определяне на локация...</Text>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  }

  const initialRegion: Region = {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // Marker colors based on variant
  const userMarkerColor = variant === 'driver' ? '#2196F3' : colors.primary;

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        showsUserLocation={false}  // We use custom marker instead
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        customMapStyle={cleanMapStyle}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {/* User Location Marker */}
        {showUserLocation && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.userMarker, { backgroundColor: userMarkerColor }]}>
              <View style={styles.markerInner} />
            </View>
            <View style={[styles.markerPulse, { borderColor: userMarkerColor }]} />
          </Marker>
        )}

        {/* Driver Location Marker (for client view during active order) */}
        {showDriverMarker && driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <Image source={towTruckGreen} style={styles.towTruckIcon} />
          </Marker>
        )}

        {/* Nearby Online Drivers (tow truck icons) */}
        {/* When connected: only show the connected driver (green) */}
        {/* When not connected: show all nearby drivers (orange) */}
        {(() => {
          // Check if connected driver exists in nearby drivers list
          const connectedDriverInList = connectedDriverId
            ? nearbyDrivers?.some(d => d.driverId === connectedDriverId)
            : false;

          return nearbyDrivers?.map((driver) => {
            const isConnectedDriver = connectedDriverId && driver.driverId === connectedDriverId;

            // When we have a connected driver AND they're in the list, hide all OTHER drivers
            if (connectedDriverId && connectedDriverInList && !isConnectedDriver) {
              return null;
            }

            // Skip connected driver in nearbyDrivers if we have separate driverLocation tracking
            // This avoids duplicate markers
            if (isConnectedDriver && showDriverMarker && driverLocation) {
              return null;
            }

            return (
              <Marker
                key={driver.driverId}
                coordinate={{
                  latitude: driver.location.latitude,
                  longitude: driver.location.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <Image
                  source={isConnectedDriver ? towTruckGreen : towTruckOrange}
                  style={styles.towTruckIcon}
                />
              </Marker>
            );
          });
        })()}

        {/* Route polyline from driver to client */}
        {routeCoordinates && routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#FF9800"
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Locate Me Button */}
      {showLocateButton && (
        <TouchableOpacity
          style={styles.locateButton}
          onPress={handleLocatePress}
          activeOpacity={0.8}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="locate" size={24} color={colors.primary} />
          )}
        </TouchableOpacity>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Зареждане на карта...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  placeholderText: {
    color: '#666',
    marginTop: 8,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  markerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    opacity: 0.3,
    top: -8,
    left: -8,
  },
  towTruckIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  locateButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
