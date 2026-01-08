import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { subscribeToOnlineDriversCount } from '../../services/firestore';
import { auth } from '../../config/firebase';
import { checkNetworkConnectivity } from '../../utils/networkUtils';

// New shared components
import CustomModalComponent from '../../components/shared/CustomModal';
import Header from '../../components/shared/Header';
import LeafletMap from '../../components/shared/LeafletMap';
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
  const { location, loading, error: locationError } = useCurrentLocation();

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

  // 🐛 DEBUG: Enhanced logging for bids and modal state
  useEffect(() => {
    console.log('🔍 [ClientHomeScreen] Current state:', {
      activeOrderId: activeOrder?.id,
      activeOrderStatus: activeOrder?.status,
      bidsCount: bids.length,
      showBidsModal,
      bids: bids.map(bid => ({ 
        id: bid.id, 
        price: bid.proposedPrice, 
        driverName: bid.driverInfo?.name,
        status: bid.status,
        isValidBid: !!(bid.id && bid.proposedPrice && bid.driverInfo?.name)
      })),
      // Modal state
      modalProps: {
        visible: showBidsModal,
        activeOrderPassed: !!activeOrder,
        bidsArrayLength: (bids || []).length,
        locationPassed: !!location
      }
    });
  }, [activeOrder, bids, showBidsModal]);
  
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

  // ✅ NEW: Network recovery state
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);
  const [showNetworkBanner, setShowNetworkBanner] = useState(false);

  // ✅ NEW: Network monitoring function
  const initializeNetworkMonitoring = () => {
    let lastNetworkState = true;
    
    const checkNetwork = async () => {
      try {
        const networkStatus = await checkNetworkConnectivity();
        const currentNetworkState = networkStatus.isConnected;
        
        // ✅ FIXED: Only show banner when state actually changes
        if (currentNetworkState !== lastNetworkState) {
          console.log(`🔄 Network state changed: ${lastNetworkState} → ${currentNetworkState}`);
          
          setIsNetworkOnline(currentNetworkState);
          
          if (currentNetworkState) {
            // Network came back online
            console.log('🔗 Network recovered!');
            setShowNetworkBanner(true);
            
            // Hide banner after 3 seconds
      setTimeout(() => {
              setShowNetworkBanner(false);
            }, 3000);
            
            // Process any pending offline operations
            try {
              const { offlineQueue } = await import('../../utils/networkUtils');
              await offlineQueue.processQueue();
              console.log('✅ Offline queue processed');
            } catch (queueError) {
              console.warn('⚠️ Failed to process offline queue:', queueError);
            }
            
          } else {
            // Network went offline
            console.log('📴 Network went offline');
            setShowNetworkBanner(true);
            // ✅ FIXED: Don't auto-hide offline banner - keep it visible until online
          }
          
          lastNetworkState = currentNetworkState;
        }
      } catch (error) {
        console.error('Error checking network status:', error);
      }
    };
    
    // ✅ FIXED: Reduced interval to 5 seconds for faster detection
    const interval = setInterval(checkNetwork, 5000);
    
    // Initial check
    checkNetwork();
    
    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  };

  useEffect(() => {
    // ✅ TEMPORARILY DISABLED: Network monitoring conflicts with Firebase connection management
    // const cleanupNetworkMonitoring = initializeNetworkMonitoring();
    console.log('⚠️ Network monitoring disabled to prevent app crashes during network recovery');

    // 🔥 EMERGENCY DEBUG: Check Firebase Auth status on load
    const checkFirebaseAuth = () => {
      try {
        console.log('🔐 Firebase Auth Status Check:');
        console.log('  - Current User:', auth.currentUser ? {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          emailVerified: auth.currentUser.emailVerified
        } : 'NOT SIGNED IN');
        console.log('  - App User:', user ? {
          uid: user.uid,
          email: user.email,
          userType: user.userType
        } : 'NO APP USER');
        console.log('  - Token Available:', !!token);
        
        // If we have app user but no Firebase Auth user, try to sync
        if (user && !auth.currentUser) {
          console.log('🔄 App user exists but Firebase Auth missing - this may cause permission errors');
        }
      } catch (error) {
        console.error('❌ Firebase Auth status check failed:', error);
      }
    };

    checkFirebaseAuth();
    
    // ✅ DISABLED: Return cleanup function for network monitoring
    return () => {
      // if (cleanupNetworkMonitoring) {
      //   cleanupNetworkMonitoring();
      // }
      console.log('🧹 No network monitoring cleanup needed');
    };
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
        if (__DEV__) console.log('📊 Online drivers count updated:', count);
      });
      
      return () => unsubscribe();
    } catch (subscriptionError) {
      console.error('❌ Error setting up online drivers subscription:', subscriptionError);
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
        onSettingsPress={() => setShowSettingsPanel(true)}
      />

      {/* ✅ DISABLED: Network Status Banner - prevented crashes during network recovery */}
      {false && showNetworkBanner && (
            <View style={[
          styles.networkBanner,
          { backgroundColor: isNetworkOnline ? '#10B981' : '#EF4444' }
        ]}>
          <Ionicons 
            name={isNetworkOnline ? "wifi" : "wifi-outline"} 
            size={16} 
            color="white" 
          />
          <Text style={styles.networkBannerText}>
            {isNetworkOnline ? 'Връзката е възстановена' : 'Няма интернет връзка'}
            </Text>
          </View>
      )}

      {/* Active Order Panel */}
      {activeOrder && (
        <ActiveOrderPanel
          activeOrder={activeOrder}
          bids={bids}
          timeLeftMs={timeLeftMs}
          acceptedDriverName={acceptedDriverName}
          onShowBids={() => {
            console.log('🔍 [ClientHomeScreen] onShowBids called - setting showBidsModal to true');
            setShowBidsModal(true);
          }}
          onCancel={cancelOrder}
          acceptingBid={acceptingBid}
        />
      )}

      {/* Map Background */}
      <LeafletMap 
        location={location} 
        style={styles.mapContainer}
        onMapReady={() => console.log('🗺️ Client map loaded')} 
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
        onClose={() => {
          console.log('🔄 [ClientHomeScreen] Closing BidsModal');
          setShowBidsModal(false);
        }}
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







  networkBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  networkBannerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
}); 
