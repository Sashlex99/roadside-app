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

// New shared components
import CustomModalComponent from '../../components/shared/CustomModal';
import Header from '../../components/shared/Header';
import NativeMap from '../../components/shared/NativeMap';
import FAB from '../../components/driver/FAB';
import DriverActiveOrderPanel from '../../components/driver/ActiveOrderPanel';

// Driver specific components
import OrdersModal from '../../components/driver/modals/OrdersModal';
import OrderDetailsModal from '../../components/driver/modals/OrderDetailsModal';
import AcceptedBidModal from '../../components/driver/modals/AcceptedBidModal';
import DriverSettingsModal from '../../components/driver/modals/DriverSettingsModal';
import StatusModal from '../../components/driver/modals/StatusModal';

// Shared types
import { CustomModal as CustomModalType } from '../../types/shared';
import { PendingOrder } from '../../types/driver';

// Hooks
import { useCurrentLocation } from '../../hooks/shared/useCurrentLocation';
import { useDriverOrders } from '../../hooks/driver/useDriverOrders';
import { useDriverStatus } from '../../hooks/driver/useDriverStatus';

// Helpers
import { shouldShowOrdersModal, makePhoneCall, openGoogleMaps } from '../../utils/driver/helpers';
import { cleanupExpiredOrders } from '../../utils/orderCleanup';

export default function DriverHomeScreen() {
  const { user, logout, authReady } = useAuth();
  const navigation = useNavigation();
  
  // UI state
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
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

  // Use driver orders hook
  const {
    pendingOrders,
    loadingOrders,
    refreshingOrders,
    acceptedBid,
    acceptedOrder,
    showAcceptedModal,
    setShowAcceptedModal,
    fetchPendingOrders,
    submitBid,
    completeOrder,
    calculateDistance
  } = useDriverOrders({ user, authReady, location, setCustomModal });

  // Use driver status hook
  const {
    isOnline,
    onlineStatusSyncing,
    statusMessage,
    showStatusModal,
    setShowStatusModal,
    selectedRadius,
    radiusOptions,
    showRadiusDropdown,
    setShowRadiusDropdown,
    handleToggleOnline,
    handleRadiusSelect,
    filterOrdersByRadius
  } = useDriverStatus({ user, authReady, location, setCustomModal });

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

  // Cleanup expired orders when driver app starts
  useEffect(() => {
    if (!authReady || !user?.uid) return;
    
    const performCleanup = async () => {
      try {
        console.log('🧹 [DriverHomeScreen] Starting order cleanup...');
        const result = await cleanupExpiredOrders();
        
        if (result.cleaned > 0) {
          console.log(`✅ [DriverHomeScreen] Cleaned up ${result.cleaned} expired orders`);
          
          // Optional: Show notification to driver about cleanup
          if (result.cleaned > 3) {
            setCustomModal({
              visible: true,
              title: 'Почистване на заявки',
              message: `Почистихме ${result.cleaned} стари заявки за по-добра производителност.`,
              icon: 'checkmark-circle-outline',
              iconColor: colors.success,
              buttons: [{
                text: 'Разбрах',
                onPress: () => setCustomModal((prev: CustomModalType) => ({ ...prev, visible: false }))
              }]
            });
          }
        }
        
        if (result.errors.length > 0) {
          console.warn(`⚠️ [DriverHomeScreen] ${result.errors.length} errors during cleanup:`, result.errors);
        }
      } catch (error) {
        console.error('❌ [DriverHomeScreen] Error during order cleanup:', error);
      }
    };
    
    // Run cleanup after a short delay to let the app initialize
    const cleanupTimer = setTimeout(performCleanup, 2000);
    
    return () => clearTimeout(cleanupTimer);
  }, [user?.uid]);

  // Handle showing orders modal
  const handleShowOrders = () => {
    if (!shouldShowOrdersModal(isOnline, setCustomModal, colors)) return;
    setShowOrdersModal(true);
    fetchPendingOrders();
  };

  // Handle order selection
  const handleOrderSelect = (order: PendingOrder) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  // Handle offer submission
  const handleSubmitOffer = async (order: PendingOrder, price: string) => {
    return await submitBid(order, price);
  };

  // Handle navigation and communication
  const handleNavigate = () => openGoogleMaps(acceptedOrder);
  const handleCall = () => makePhoneCall(acceptedOrder, acceptedBid);

  // Filter orders by radius
  const filteredOrders = filterOrdersByRadius(pendingOrders, calculateDistance);

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
      {/* Header with Status Toggle */}
      <Header
        user={user}
        location={location}
        isOnline={isOnline}
        onToggleOnline={handleToggleOnline}
        onlineStatusSyncing={onlineStatusSyncing}
        isDegradedAccuracy={isDegradedAccuracy}
        onSettingsPress={() => setShowSettingsPanel(true)}
      />

      {/* Active Order Panel */}
      {acceptedOrder && (
        <DriverActiveOrderPanel
          activeOrder={acceptedOrder}
          onNavigate={handleNavigate}
          onCall={handleCall}
          onComplete={completeOrder}
        />
      )}

      {/* Map Background - Google Maps */}
      <NativeMap
        location={location}
        style={styles.mapContainer}
        variant="driver"
        onMapReady={() => console.log('🗺️ Driver map loaded')}
        onLocatePress={quickLocate}
      />

      {/* Floating Action Button for Orders */}
      <FAB 
        isOnline={isOnline}
        pendingOrdersCount={pendingOrders.length}
        onPress={handleShowOrders}
      />

      {/* Orders Modal */}
      <OrdersModal
        visible={showOrdersModal}
        onClose={() => setShowOrdersModal(false)}
        pendingOrders={pendingOrders}
        filteredOrders={filteredOrders}
        loadingOrders={loadingOrders}
        refreshingOrders={refreshingOrders}
        selectedRadius={selectedRadius}
        radiusOptions={radiusOptions}
        showRadiusDropdown={showRadiusDropdown}
        onRefresh={() => fetchPendingOrders(true)}
        onRadiusToggle={() => setShowRadiusDropdown(!showRadiusDropdown)}
        onRadiusSelect={handleRadiusSelect}
        onOrderSelect={handleOrderSelect}
      />

      {/* Order Details Modal */}
      <OrderDetailsModal
        visible={showOrderDetails}
        onClose={() => setShowOrderDetails(false)}
        selectedOrder={selectedOrder}
        onSubmitOffer={handleSubmitOffer}
      />

      {/* Accepted Bid Modal */}
      <AcceptedBidModal
        visible={showAcceptedModal}
        onClose={() => setShowAcceptedModal(false)}
        acceptedBid={acceptedBid}
        acceptedOrder={acceptedOrder}
      />

      {/* Status Modal */}
      <StatusModal
        visible={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        isOnline={isOnline}
        statusMessage={statusMessage}
      />

      {/* Settings Modal */}
      <DriverSettingsModal
        visible={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        onNavigateToOrders={() => (navigation as any).navigate('MyOrders')}
        onLogout={logout}
        setCustomModal={setCustomModal}
      />

      {/* Custom Modal */}
      <CustomModalComponent
        modal={customModal}
        onRequestClose={() => setCustomModal((prev: CustomModalType) => ({ ...prev, visible: false }))}
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
