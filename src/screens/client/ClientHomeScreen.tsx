import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';

import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { subscribeToOnlineDriversCount } from '../../services/firestore';
import { auth } from '../../config/firebase';

// New shared components
import CustomModalComponent from '../../components/shared/CustomModal';
import Header from '../../components/shared/Header';
import NativeMap from '../../components/shared/NativeMap';
import RequestButton from '../../components/client/RequestButton';
import ActiveOrderPanel from '../../components/client/ActiveOrderPanel';
import RequestModal from '../../components/client/modals/RequestModal';
import BidsModal from '../../components/client/modals/BidsModal';
import PaymentModalComponent from '../../components/client/modals/PaymentModal';
import SettingsModal from '../../components/client/modals/SettingsModal';

// Shared types
import { LocationData, CustomModal as CustomModalType } from '../../types/shared';


// Hooks
import { useCurrentLocation } from '../../hooks/shared/useCurrentLocation';
import { useClientOrders } from '../../hooks/client/useClientOrders';
import { useClientPayments } from '../../hooks/client/useClientPayments';
import { useNearbyDriversOptimized as useNearbyDrivers } from '../../hooks/client/useNearbyDriversOptimized';
import { useDriverTracking } from '../../hooks/client/useDriverTracking';
import { useDriverETA } from '../../hooks/client/useDriverETA';
import { generateMapHTML, formatTimeRemaining, createCancelOrderHandler } from '../../utils/client/helpers';

export default function ClientHomeScreen() {
  const { user, token, logout, refreshAuth, authReady } = useAuth();
  const navigation = useNavigation();
  // Form state moved to RequestModal component
  const [customModal, setCustomModal] = useState<CustomModalType>({
    visible: false,
    title: '',
    message: '',
    icon: '',
    iconColor: '',
    buttons: []
  });

  // Use shared location hook
  const { location, loading, error: locationError, isDegradedAccuracy, quickLocate } = useCurrentLocation();

  // UI state variables first
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showBidsModal, setShowBidsModal] = useState(false);
  const [onlineDriversCount, setOnlineDriversCount] = useState(0);

  // Use client orders hook
  const { activeOrder, bids, timeLeftMs, acceptedDriverName } = useClientOrders({
    user,
    authReady,
    refreshAuth,
    logout,
    setCustomModal,
    setShowRequestModal
  });

  // Use client payments hook
  const { 
    paymentModal, 
    acceptingBid, 
    acceptingBidId, 
    paymentInProgress,
    confirmAcceptBid,
    handlePaymentPress,
    handlePaymentCancel
  } = useClientPayments({
    user,
    token,
    activeOrder,
    bids,
    setCustomModal,
    setShowBidsModal
  });
  
  // UI state variables
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Subscribe to nearby online drivers (50km radius)
  // Keep subscription active even when connected - NativeMap will render connected driver as green
  const isDriverConnected = activeOrder?.status === 'accepted' || activeOrder?.status === 'in_progress';
  const { nearbyDrivers } = useNearbyDrivers({
    clientLocation: location,
    radiusKm: 50,
    enabled: true // Always enabled - connected driver shown as green, others as orange
  });

  // Track driver location in real-time when order is accepted
  const driverLocation = useDriverTracking(activeOrder);

  // Calculate ETA and route from driver to client
  const { eta, routeCoordinates } = useDriverETA({
    driverLocation,
    clientLocation: location,
    enabled: !!driverLocation && isDriverConnected
  });

  // Debug: Log driver tracking state
  useEffect(() => {
    if (__DEV__ && activeOrder?.status === 'accepted') {
      console.log('🚗 [ClientHome] Driver tracking state:', {
        isDriverConnected,
        hasDriverLocation: !!driverLocation,
        driverLocationData: driverLocation ? { lat: driverLocation.latitude, lng: driverLocation.longitude } : null,
        activeOrderStatus: activeOrder?.status,
        acceptedDriverId: activeOrder?.acceptedDriverId || 'NOT SET',
        showDriverMarker: !!driverLocation && isDriverConnected
      });
    }
  }, [isDriverConnected, driverLocation, activeOrder?.status, activeOrder?.acceptedDriverId]);

  // Debug: Check Firebase Auth status on load
  useEffect(() => {
    if (__DEV__) {
      const currentUser = auth.currentUser;
      console.log('[Auth] Status:', {
        firebaseUser: currentUser ? currentUser.uid : 'NOT SIGNED IN',
        appUser: user ? user.uid : 'NO APP USER',
        hasToken: !!token
      });
      if (user && !currentUser) {
        console.log('[Auth] Warning: App user exists but Firebase Auth missing');
      }
    }
  }, []);

  // Show location error if exists
  useEffect(() => {
    if (locationError) {
      setCustomModal({
        visible: true,
        title: 'Грешка',
        message: locationError,
        icon: 'location-outline',
        iconColor: colors.error,
        buttons: [{
          text: 'Разбрах',
          onPress: () => setCustomModal((prev: CustomModalType) => ({ ...prev, visible: false }))
        }]
      });
    }
  }, [locationError]);

  // Helper functions moved to utils/client/helpers.ts
  const cancelOrder = createCancelOrderHandler(activeOrder, setCustomModal);

  // Subscribe to online drivers count in real-time
  useEffect(() => {
    if (!authReady) {
      setOnlineDriversCount(0);
      return;
    }

    try {
      const unsubscribe = subscribeToOnlineDriversCount((count) => {
        setOnlineDriversCount(count);
        if (__DEV__) console.log('[Drivers] Online count:', count);
      });
      
      return () => unsubscribe();
    } catch (subscriptionError) {
      console.error('[Drivers] Subscription error:', subscriptionError);
      // Set count to 0 on error
      setOnlineDriversCount(0);
    }
  }, [authReady]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Определяне на локация...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Header
        user={user}
        location={location}
        onlineDriversCount={onlineDriversCount}
        isDegradedAccuracy={isDegradedAccuracy}
        onSettingsPress={() => setShowSettingsPanel(true)}
      />

      {/* Active Order Panel */}
      {activeOrder && (
        <ActiveOrderPanel
          activeOrder={activeOrder}
          bids={bids}
          timeLeftMs={timeLeftMs}
          acceptedDriverName={acceptedDriverName}
          onShowBids={() => setShowBidsModal(true)}
          onCancel={cancelOrder}
          acceptingBid={acceptingBid}
          eta={eta}
        />
      )}

      {/* Map Background - Google Maps */}
      <NativeMap
        location={location}
        driverLocation={driverLocation}
        nearbyDrivers={nearbyDrivers}
        routeCoordinates={routeCoordinates}
        connectedDriverId={activeOrder?.acceptedDriverId}
        showDriverMarker={!!driverLocation && isDriverConnected}
        style={styles.mapContainer}
        onMapReady={() => { if (__DEV__) console.log('[Map] Client map loaded'); }}
        onLocatePress={quickLocate}
        variant="client"
      />

      {/* Request Button */}
      <RequestButton 
        onPress={() => setShowRequestModal(true)} 
        disabled={acceptingBid}
      />

      {/* Request Modal */}
      <RequestModal
        visible={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        user={user}
        token={token}
        location={location}
        activeOrder={activeOrder}
        setCustomModal={setCustomModal}
      />

      {/* Bids Modal */}
      <BidsModal
        visible={showBidsModal}
        onClose={() => setShowBidsModal(false)}
        activeOrder={activeOrder}
        bids={bids || []} // ✅ FIXED: Show all bids - cancelled bids are now restored when payment is cancelled
        location={location}
        acceptingBid={acceptingBid}
        acceptingBidId={acceptingBidId}
        onAcceptBid={confirmAcceptBid}
      />

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        onNavigateToOrders={() => (navigation as any).navigate('MyOrders')}
        onNavigateToImageTest={() => (navigation as any).navigate('ImageTest')}
        onLogout={logout}
        setCustomModal={setCustomModal}
      />

      {/* Custom Modal */}
      <CustomModalComponent
        modal={customModal}
        onRequestClose={() => setCustomModal((prev: CustomModalType) => ({ ...prev, visible: false }))}
      />

      {/* Payment Modal */}
      <PaymentModalComponent
        paymentModal={paymentModal}
        paymentInProgress={paymentInProgress}
        onPaymentPress={handlePaymentPress}
        onCancel={handlePaymentCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },

  mapContainer: {
    flex: 1,
    position: 'relative',
  },







}); 
