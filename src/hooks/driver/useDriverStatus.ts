import { useState, useEffect, useCallback } from 'react';
import { updateDriverOnlineStatus, getUser } from '../../services/firestore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { CustomModal as CustomModalType } from '../../types/shared';
import { PendingOrder } from '../../types/driver';
import { LocationData } from '../../types/shared';

interface UseDriverStatusParams {
  user: any;
  authReady?: boolean;
  location: LocationData | null;
  setCustomModal: React.Dispatch<React.SetStateAction<CustomModalType>>;
}

export function useDriverStatus({ user, authReady, location, setCustomModal }: UseDriverStatusParams) {
  const [isOnline, setIsOnline] = useState(false);
  const [onlineStatusSyncing, setOnlineStatusSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  
  // Radius filter states
  const [radiusFilterEnabled, setRadiusFilterEnabled] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(50); // Default 50km
  const [showRadiusDropdown, setShowRadiusDropdown] = useState(false);
  
  // Radius options
  const radiusOptions = [
    { label: 'Всички поръчки', value: 0 },
    { label: '10 км', value: 10 },
    { label: '25 км', value: 25 },
    { label: '50 км', value: 50 },
    { label: '75 км', value: 75 },
    { label: '100 км', value: 100 },
  ];

  // Load saved radius settings from Firestore
  const loadRadiusSettings = async () => {
    if (!authReady || !user?.uid) return;
    
    try {
      const userDoc = await getUser(user.uid);
      if (userDoc?.preferredRadius !== undefined) {
        setSelectedRadius(userDoc.preferredRadius);
      }
      if (userDoc?.radiusFilterEnabled !== undefined) {
        setRadiusFilterEnabled(userDoc.radiusFilterEnabled);
      }
    } catch (error) {
      console.error('Error loading radius settings:', error);
    }
  };

  // Load current online status from Firestore
  const loadCurrentOnlineStatus = async () => {
    if (!authReady || !user?.uid) return;
    
    try {
      const userDoc = await getUser(user.uid);
      if (userDoc?.isOnline !== undefined) {
        setIsOnline(userDoc.isOnline);
        if (__DEV__) console.log('📊 Loaded driver online status:', userDoc.isOnline);
      }
    } catch (error) {
      console.error('Error loading online status:', error);
    }
  };

  // Handle radius selection
  const handleRadiusSelect = (radius: number) => {
    setSelectedRadius(radius);
    setShowRadiusDropdown(false);
    
    // Save preference to Firestore
    if (authReady && user?.uid) {
      updateDoc(doc(db, 'users', user.uid), {
        preferredRadius: radius,
        radiusFilterEnabled: radius > 0
      }).catch(error => {
        console.error('Error saving radius preference:', error);
      });
    }
  };

  // Filter orders based on radius selection with performance optimization
  const filterOrdersByRadius = useCallback((pendingOrders: PendingOrder[], calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number) => {
    if (!location) {
      return []; // No location = no orders
    }
    
    if (selectedRadius === 0) {
      return pendingOrders; // Show all orders
    }
    
    return pendingOrders.filter(order => {
      try {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          order.location.latitude,
          order.location.longitude
        );
        return distance <= selectedRadius;
      } catch (error) {
        console.warn('Error calculating distance for order:', order.id, error);
        return false; // Exclude orders with invalid location data
      }
    });
  }, [selectedRadius, location?.latitude, location?.longitude]);

  // Toggle online status
  const handleToggleOnline = async () => {
    if (!authReady || !user?.uid) {
      console.warn('Auth not ready for online status update');
      return;
    }

    const newStatus = !isOnline;
    
    // 🎯 Haptic feedback for immediate response
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Haptics might not be available on all devices
      if (__DEV__) console.log('Haptic feedback not available');
    }
    
    // 🚀 Optimistic update - update UI immediately for smooth feel
    setIsOnline(newStatus);
    setOnlineStatusSyncing(true);
    
    if (newStatus) {
      setStatusMessage('Сега приемате поръчки и ще получавате известия за нови заявки в района.');
    } else {
      setStatusMessage('Спряхте да приемате поръчки. Няма да получавате нови заявки.');
    }
    
    setShowStatusModal(true);
    
    // 🔄 Quick Firestore update with shorter timeout
    setTimeout(() => setOnlineStatusSyncing(false), 500); // Max 500ms disable
    
    try {
      if (user?.uid) {
        await updateDriverOnlineStatus(user.uid, newStatus);
        if (__DEV__) console.log('✅ Online status synced to Firestore:', newStatus);
      }
    } catch (error) {
      console.error('❌ Error updating online status:', error);
      
      // 🔄 Rollback optimistic update on error
      setIsOnline(!newStatus);
      
      setCustomModal({
        visible: true,
        title: 'Грешка',
        message: 'Не можахме да обновим статуса. Проверете интернет връзката.',
        icon: 'warning-outline',
        iconColor: colors.error,
        buttons: [{
          text: 'Разбрах',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        }]
      });
    }
  };

  // Initialize settings on mount
  useEffect(() => {
    if (!authReady) return;
    loadRadiusSettings();
    loadCurrentOnlineStatus();
  }, [authReady]);

  // Periodic lastSeen updates when online
  useEffect(() => {
    if (!authReady || !isOnline || !user?.uid) return;
    
    console.log('🔄 [useDriverStatus] Setting up lastSeen update interval for driver:', user.uid);
    
    const updateLastSeen = async () => {
      try {
        await updateDriverOnlineStatus(user.uid, true); // This updates lastSeen too
      } catch (error) {
        console.error('Error updating lastSeen:', error);
      }
    };
    
    // Update immediately
    updateLastSeen();
    
    // Then update every 2 minutes while online
    const interval = setInterval(updateLastSeen, 2 * 60 * 1000);
    
    return () => {
      console.log('🧹 [useDriverStatus] Cleaning up lastSeen update interval for driver:', user?.uid);
      clearInterval(interval);
    };
  }, [authReady, isOnline, user?.uid]);

  return {
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
  };
} 