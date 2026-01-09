import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { LocationData } from '../../types/shared';

interface NativeMapProps {
  location: LocationData | null;
  driverLocation?: LocationData | null;  // For real-time driver tracking
  style?: any;
  onMapReady?: () => void;
  showUserLocation?: boolean;
  showDriverMarker?: boolean;
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
  style,
  onMapReady,
  showUserLocation = true,
  showDriverMarker = false,
  variant = 'client'
}: NativeMapProps) {
  const mapRef = useRef<MapView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

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
    console.log('🗺️ Google Maps loaded successfully');
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
  const userMarkerColor = variant === 'driver' ? colors.secondary || '#2196F3' : colors.primary;

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
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={18} color="white" />
            </View>
          </Marker>
        )}
      </MapView>

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
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
