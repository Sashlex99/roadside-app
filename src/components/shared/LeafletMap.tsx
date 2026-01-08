import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { LocationData } from '../../types/shared';
import { generateMapHTML as generateClientMapHTML } from '../../utils/client/helpers';
import { generateMapHTML as generateDriverMapHTML } from '../../utils/driver/helpers';

// Conditional import for WebView
let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (error) {
  console.log('📱 WebView not available in Expo Go - using fallback');
}

interface LeafletMapProps {
  location: LocationData | null;
  style?: any;
  onMapReady?: () => void;
  showUserLocation?: boolean;
  variant?: 'client' | 'driver';
}

export default function LeafletMap({ 
  location, 
  style, 
  onMapReady,
  showUserLocation = true,
  variant = 'client'
}: LeafletMapProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const webViewRef = useRef<any>(null);

  // Check if WebView is available
  const isWebViewAvailable = WebView !== null;

  // Update map location when location changes
  useEffect(() => {
    if (location && isMapReady && webViewRef.current) {
      const updateLocationCommand = `
        if (window.updateUserLocation) {
          window.updateUserLocation(${location.latitude}, ${location.longitude});
        }
      `;
      // Use injectJavaScript for direct execution
      webViewRef.current.injectJavaScript(updateLocationCommand);
    }
  }, [location, isMapReady]);

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

  // If WebView is not available (Expo Go), show fallback
  if (!isWebViewAvailable) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.placeholder}>
          <Ionicons name="map-outline" size={64} color="#ccc" />
          <Text style={styles.placeholderText}>Карта (Expo Go режим)</Text>
          <Text style={styles.subText}>
            {location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
          </Text>
          <Text style={styles.hintText}>
            За пълна карта: expo run:android или expo run:ios
          </Text>
        </View>
      </View>
    );
  }

  const htmlContent = variant === 'driver' 
    ? generateDriverMapHTML(location, colors)
    : generateClientMapHTML(location);

  const handleWebViewLoad = () => {
    setIsLoading(false);
    onMapReady?.();
  };

  const handleWebViewError = () => {
    setError('Грешка при зареждане на картата');
    setIsLoading(false);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapReady') {
        console.log('🗺️ Leaflet map loaded successfully');
        setIsMapReady(true);
        handleWebViewLoad();
      }
      
      if (data.type === 'mapClick') {
        console.log('🗺️ Map clicked at:', data.coordinates);
      }
    } catch (err) {
      console.warn('Failed to parse WebView message:', err);
    }
  };

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.placeholder}>
          <Ionicons name="warning-outline" size={64} color={colors.error} />
          <Text style={[styles.placeholderText, { color: colors.error }]}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onLoad={handleWebViewLoad}
        onError={handleWebViewError}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        // Performance optimizations
        cacheEnabled={true}
        incognito={false}
        // Security settings
        originWhitelist={['*']}
        allowsFullscreenVideo={false}
        allowsBackForwardNavigationGestures={false}
      />
      
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
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
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
  subText: {
    color: '#888',
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  hintText: {
    color: colors.primary,
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
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
}); 