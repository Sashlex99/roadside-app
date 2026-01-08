import { useState, useEffect } from 'react';
import { getActiveOrders, updateOrderStatus, createBid, getAcceptedOrdersForDriver } from '../../services/firestore';
import { getOrder, getBidsForOrder } from '../../services/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { clearDriverNotification } from '../../utils/driverNotifications';
import { colors } from '../../constants/colors';
import { CustomModal as CustomModalType } from '../../types/shared';
import { PendingOrder } from '../../types/driver';
import { LocationData } from '../../types/shared';

interface UseDriverOrdersParams {
  user: any;
  authReady?: boolean;
  location: LocationData | null;
  setCustomModal: React.Dispatch<React.SetStateAction<CustomModalType>>;
}

export function useDriverOrders({ user, authReady, location, setCustomModal }: UseDriverOrdersParams) {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [refreshingOrders, setRefreshingOrders] = useState(false);
  const [activeBids, setActiveBids] = useState<string[]>([]);
  const [acceptedBid, setAcceptedBid] = useState<any>(null);
  const [acceptedOrder, setAcceptedOrder] = useState<any>(null);
  const [showAcceptedModal, setShowAcceptedModal] = useState(false);

  // Helper function to calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const straightLineDistance = R * c;
    
    // Добавяме 35% за пътища, завои и реални условия
    return straightLineDistance * 1.35;
  };

  // Fetch pending orders
  const fetchPendingOrders = async (isRefresh = false) => {
    if (!authReady) {
      console.log('Auth not ready for fetching orders');
      return;
    }

    if (!location) {
      console.log('No location available for fetching orders');
      return;
    }
    
    if (isRefresh) {
      setRefreshingOrders(true);
    } else {
      setLoadingOrders(true);
    }
    
    try {
      console.log('Fetching orders (all active)');
      const orders = await getActiveOrders();
      
      console.log('Raw orders from Firestore:', orders);
      
      // Transform orders to PendingOrder format
      const pendingOrdersList = orders
        .filter(order => ['pending', 'searching', 'bidding'].includes(order.status))
        .map((order): PendingOrder | null => {
          console.log('Processing order:', order.id, order);
          
          // Safety checks for required data
          if (!order.location || !order.clientInfo) {
            console.warn('Order missing required data:', order.id);
            return null;
          }
          
          const distance = Math.round(calculateDistance(
            location.latitude,
            location.longitude,
            order.location.latitude,
            order.location.longitude
          ) * 10) / 10; // Round to 1 decimal
          
          const pendingOrder: PendingOrder = {
            id: order.id,
            description: order.description || 'Няма описание',
            location: order.location,
            destinationLocation: order.destinationLocation,
            images: order.images || [],
            distance: distance,
            createdAt: order.createdAt || new Date(),
            clientName: order.clientInfo?.name || 'Неизвестен клиент',
            clientPhone: order.clientInfo?.phone || 'Няма телефон'
          };
          
          return pendingOrder;
        })
        .filter((order): order is PendingOrder => order !== null) // Remove null orders with type guard
        .sort((a, b) => a.distance - b.distance); // Sort by distance
      
      console.log('Transformed pending orders:', pendingOrdersList);
      console.log(`Found ${pendingOrdersList.length} pending orders`);
      setPendingOrders(pendingOrdersList);
      console.log('Set pending orders to state, length:', pendingOrdersList.length);
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      setCustomModal({
        visible: true,
        title: 'Грешка',
        message: 'Не можахме да заредим поръчките',
        icon: 'warning-outline',
        iconColor: colors.error,
        buttons: [{
          text: 'Разбрах',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        }]
      });
    } finally {
      if (isRefresh) {
        setRefreshingOrders(false);
      } else {
        setLoadingOrders(false);
      }
    }
  };

  // Submit bid for order
  const submitBid = async (selectedOrder: PendingOrder, offerPrice: string) => {
    if (!authReady) {
      console.warn('Auth not ready for bid submission');
      return false;
    }

    if (!selectedOrder || !user || !location) {
      console.warn('Missing required data for bid submission');
      return false;
    }

    const priceNum = parseFloat(offerPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setCustomModal({
        visible: true,
        title: 'Грешка',
        message: 'Моля въведете валидна цена',
        icon: 'warning-outline',
        iconColor: colors.error,
        buttons: [{
          text: 'Разбрах',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        }]
      });
      return false;
    }

    try {
      const bidData = {
        orderId: selectedOrder.id,
        driverId: user.uid,
        driverInfo: {
          name: user.fullName || 'Неизвестен шофьор',
          phone: (user as any)?.phone || '',
          rating: 4.5, // TODO: real rating
        },
        proposedPrice: priceNum,
        estimatedArrivalTime: Math.max(5, Math.round(selectedOrder.distance / 0.5 + 5)), // 30km/h средна скорост + 5 мин подготовка
        driverLocation: location,
        distanceToClient: selectedOrder.distance,
        message: `Оферта от ${user.fullName}`,
        status: 'active' as const,
      };

      // Create bid with validation
      await createBid(bidData);

      // Обновяваме статуса на заявката на 'bidding', за да го види клиентът
      // Проверяваме първо дали заявката все още е в 'searching' статус
      const currentOrder = await getOrder(selectedOrder.id);
      console.log('🔄 [useDriverOrders] Order status before bid submission:', {
        orderId: selectedOrder.id,
        currentStatus: currentOrder?.status,
        willUpdate: currentOrder?.status === 'searching'
      });
      
      if (currentOrder && currentOrder.status === 'searching') {
        await updateOrderStatus(selectedOrder.id, 'bidding');
        console.log('✅ [useDriverOrders] Order status updated to bidding for order:', selectedOrder.id);
      } else {
        console.log('⚠️ [useDriverOrders] Order status not updated - current status:', currentOrder?.status);
      }
      
      // Track this order for bid updates (avoid duplicates)
      setActiveBids(prev => {
        if (prev.includes(selectedOrder.id)) {
          return prev;
        }
        return [...prev, selectedOrder.id];
      });
      
      setCustomModal({
        visible: true,
        title: 'Успех',
        message: 'Офертата е изпратена успешно! Можете да изпратите нова оферта с различна цена ако тази не бъде приета.',
        icon: 'checkmark-circle',
        iconColor: '#10B981',
        buttons: [{
          text: 'Разбрах',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        }]
      });

      return true;
    } catch (error) {
      console.error('Error submitting offer:', error);
      
      // Import error utility
      import('../../utils/errorMessages').then(({ getErrorMessage }) => {
        const errorMessage = getErrorMessage(error);
        
        setCustomModal({
          visible: true,
          title: 'Грешка',
          message: errorMessage,
          icon: 'warning-outline',
          iconColor: colors.error,
          buttons: [{
            text: 'Разбрах',
            onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
          }]
        });
      }).catch(() => {
        // Fallback if import fails
        setCustomModal({
          visible: true,
          title: 'Грешка',
          message: 'Не успяхме да изпратим офертата. Опитайте отново.',
          icon: 'warning-outline',
          iconColor: colors.error,
          buttons: [{
            text: 'Разбрах',
            onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
          }]
        });
      });

      return false;
    }
  };

  // ✅ ENHANCED: Check for accepted orders on app start
  useEffect(() => {
    if (!authReady || !user?.uid) return;
    
    console.log('🔄 [useDriverOrders] Checking for accepted orders for driver:', user.uid);
    
    const restoreAcceptedOrdersAndNotifications = async () => {
      try {
        // Check for accepted orders directly
        const acceptedOrders = await getAcceptedOrdersForDriver(user.uid);
        
        if (acceptedOrders.length > 0) {
          console.log('✅ [useDriverOrders] Found accepted orders to restore:', acceptedOrders.length);
          
          // Take the most recent accepted order
          const mostRecentOrder = acceptedOrders[0];
          
          // Get the accepted bid for this order
          const bids = await getBidsForOrder(mostRecentOrder.id);
          const acceptedBid = bids.find(bid => 
            bid.driverId === user.uid && 
            bid.status === 'accepted'
          );
          
          if (acceptedBid) {
            console.log('✅ [useDriverOrders] Restoring accepted order and bid:', {
              orderId: mostRecentOrder.id,
              bidId: acceptedBid.id,
              orderStatus: mostRecentOrder.status
            });
            
            setAcceptedOrder(mostRecentOrder);
            setAcceptedBid(acceptedBid);
            setShowAcceptedModal(true);
          } else {
            console.warn('⚠️ [useDriverOrders] Accepted order found but no matching accepted bid');
          }
        } else {
          console.log('ℹ️ [useDriverOrders] No accepted orders found for driver');
        }
      } catch (error) {
        console.error('❌ [useDriverOrders] Error restoring accepted orders:', error);
      }
    };
    
    restoreAcceptedOrdersAndNotifications();
  }, [authReady, user?.uid]);

  // Debug effect for pending orders
  useEffect(() => {
    if (__DEV__) {
      console.log('pendingOrders state changed:', pendingOrders.length, pendingOrders);
    }
  }, [pendingOrders]);

  // Listen for order status changes (handles: accepted, cancelled, payment_pending -> accepted)
  // NOTE: Previously had duplicate useEffect with bids subscription - removed to fix double listeners
  useEffect(() => {
    if (!authReady || !user || activeBids.length === 0) return;
    
    const unsubscribers = activeBids.map(orderId => {
      // Listen to specific order document changes
      const orderRef = doc(db, 'orders', orderId);
      return onSnapshot(orderRef, (docSnapshot) => {
        try {
          if (docSnapshot.exists()) {
            const orderData = docSnapshot.data();
            const order = {
              id: docSnapshot.id,
              ...orderData,
              createdAt: orderData.createdAt?.toDate(),
              updatedAt: orderData.updatedAt?.toDate(),
              expiresAt: orderData.expiresAt?.toDate()
            } as any;
            
            // Check if order status changed to accepted and driver is the accepted one
            if (order.status === 'accepted' && order.acceptedDriverId === user.uid) {
              console.log('🎉 Order payment completed! Order:', order.id);
              
              // Get the accepted bid details
              getBidsForOrder(orderId).then((bids: any[]) => {
                const myBid = bids.find((bid: any) => bid.driverId === user.uid && bid.status === 'accepted');
                if (myBid) {
                  console.log('✅ Showing confirmed order to driver after payment');
                  setAcceptedBid(myBid);
                  setAcceptedOrder(order);
                  setShowAcceptedModal(true);
                  
                  // Remove from active tracking
                  setActiveBids(prev => prev.filter(id => id !== orderId));
                }
              }).catch((error: any) => {
                console.error('Error fetching bids:', error);
              });
            }
            
            // ✅ IMPROVED: Check if order was cancelled - only notify if driver was engaged
            if (order.status === 'cancelled') {
              console.log('❌ Order was cancelled by client:', order.id);
              
              // Remove from active tracking
              setActiveBids(prev => prev.filter(id => id !== orderId));
              
              // ✅ FIXED: Only show notification if driver had an accepted bid or the order was specifically theirs
              const driverWasEngaged = order.acceptedDriverId === user.uid || 
                                     order.reservedDriverId === user.uid;
              
              if (driverWasEngaged) {
                console.log('⚠️ Driver was engaged with cancelled order, showing notification');
                setCustomModal({
                  visible: true,
                  title: '❌ Поръчката е отменена',
                  message: 'Клиентът отмени поръчката за която имахте приета оферта. Можете да продължите да търсите нови поръчки.',
                  icon: 'close-circle-outline',
                  iconColor: colors.error,
                  buttons: [{
                    text: 'Разбрах',
                    onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
                  }]
                });
              } else {
                console.log('ℹ️ Order cancelled but driver was not engaged, no notification needed');
              }
            }
          }
        } catch (error) {
          console.error('Error processing order snapshot:', error);
        }
      }, (error) => {
        console.error('Error in order listener:', error);
      });
    });
    
    return () => {
      console.log('🧹 Cleaning up order status subscriptions for activeBids:', activeBids.length);
      try {
        unsubscribers.forEach((unsub, index) => {
          if (typeof unsub === 'function') {
            unsub();
            console.log(`✅ [useDriverOrders] Cleaned up subscription ${index + 1}/${unsubscribers.length}`);
          } else {
            console.warn(`⚠️ [useDriverOrders] Invalid unsubscriber at index ${index}:`, typeof unsub);
          }
        });
      } catch (error) {
        console.error('❌ [useDriverOrders] Error cleaning up order status subscriptions:', error);
      }
    };
  }, [authReady, user, activeBids]);

  // ✅ NEW: Listen for driver notification triggers
  useEffect(() => {
    if (!authReady || !user?.uid) return;
    
    console.log('📡 [useDriverOrders] Setting up driver notification listener for:', user.uid);
    
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, async (docSnapshot) => {
      try {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const pendingNotification = userData.needsOrderNotification;
          
          if (pendingNotification && pendingNotification.orderId && pendingNotification.bidId) {
            console.log('🔔 [useDriverOrders] Received notification trigger:', {
              orderId: pendingNotification.orderId,
              bidId: pendingNotification.bidId
            });
            
            // Don't process if we already have an accepted order
            if (acceptedOrder && acceptedOrder.id === pendingNotification.orderId) {
              console.log('ℹ️ [useDriverOrders] Order already accepted and displayed');
              // Clear the notification since it's already processed
              await clearDriverNotification(user.uid, pendingNotification.orderId);
              return;
            }
            
            // Get the order details
            const order = await getOrder(pendingNotification.orderId);
            if (order && order.status === 'accepted' && order.acceptedDriverId === user.uid) {
              // Get the accepted bid
              const bids = await getBidsForOrder(pendingNotification.orderId);
              const acceptedBid = bids.find(bid => 
                bid.id === pendingNotification.bidId && 
                bid.driverId === user.uid &&
                bid.status === 'accepted'
              );
              
              if (acceptedBid) {
                console.log('✅ [useDriverOrders] Processing notification trigger - showing accepted order:', {
                  orderId: order.id,
                  bidId: acceptedBid.id
                });
                
                setAcceptedOrder(order);
                setAcceptedBid(acceptedBid);
                setShowAcceptedModal(true);

                // Clear the processed notification
                await clearDriverNotification(user.uid, pendingNotification.orderId);
              } else {
                console.warn('⚠️ [useDriverOrders] No matching accepted bid found for notification');
              }
            } else {
              console.warn('⚠️ [useDriverOrders] Order not found or not accepted by this driver');
              // Clear invalid notification
              await clearDriverNotification(user.uid, pendingNotification.orderId);
            }
          }
        }
      } catch (error) {
        console.error('❌ [useDriverOrders] Error processing driver notification:', error);
      }
    }, (error) => {
      console.error('❌ [useDriverOrders] Error in driver notification listener:', error);
    });
    
    return () => {
      console.log('🧹 [useDriverOrders] Cleaning up driver notification listener');
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
          console.log('✅ [useDriverOrders] Driver notification listener cleaned up successfully');
        } else {
          console.warn('⚠️ [useDriverOrders] Invalid unsubscribe function for driver notification listener:', typeof unsubscribe);
        }
      } catch (error) {
        console.error('❌ [useDriverOrders] Error cleaning up driver notification listener:', error);
      }
    };
  }, [authReady, user?.uid, acceptedOrder?.id]);

  // ✅ NEW: Listen for changes to the currently accepted order
  useEffect(() => {
    if (!authReady || !user?.uid || !acceptedOrder?.id) return;
    
    console.log('📡 Setting up listener for accepted order:', acceptedOrder.id);
    
    const orderRef = doc(db, 'orders', acceptedOrder.id);
    const unsubscribe = onSnapshot(orderRef, (docSnapshot) => {
      try {
        if (docSnapshot.exists()) {
          const orderData = docSnapshot.data();
          const order = {
            id: docSnapshot.id,
            ...orderData,
            createdAt: orderData.createdAt?.toDate(),
            updatedAt: orderData.updatedAt?.toDate(),
            expiresAt: orderData.expiresAt?.toDate()
          } as any;
          
          // Check if the accepted order was cancelled
          if (order.status === 'cancelled') {
            console.log('❌ Accepted order was cancelled by client:', order.id);
            
            // Clear accepted order state
            setAcceptedOrder(null);
            setAcceptedBid(null);
            setShowAcceptedModal(false);
            
            // Show cancellation notification
            setCustomModal({
              visible: true,
              title: '❌ Поръчката е отменена',
              message: 'Клиентът отмени приетата поръчка. Можете да продължите да търсите нови поръчки.',
              icon: 'close-circle-outline',
              iconColor: colors.error,
              buttons: [{
                text: 'Разбрах',
                onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
              }]
            });
          }
          // Update order data if still active
          else if (['accepted', 'in_progress', 'completed'].includes(order.status)) {
            console.log('🔄 Accepted order updated:', order.id, 'Status:', order.status);
            setAcceptedOrder(order);
          }
        } else {
          // Order document was deleted
          console.log('❌ Accepted order document was deleted:', acceptedOrder.id);
          
          // Clear accepted order state
          setAcceptedOrder(null);
          setAcceptedBid(null);
          setShowAcceptedModal(false);
          
          // Show deletion notification
          setCustomModal({
            visible: true,
            title: '❌ Поръчката е изтрита',
            message: 'Поръчката вече не съществува в системата.',
            icon: 'trash-outline',
            iconColor: colors.error,
            buttons: [{
              text: 'Разбрах',
              onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
            }]
          });
        }
      } catch (error) {
        console.error('Error processing accepted order snapshot:', error);
      }
    }, (error) => {
      console.error('Error in accepted order listener:', error);
    });
    
    return () => {
      console.log('🧹 [useDriverOrders] Cleaning up accepted order listener');
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
          console.log('✅ [useDriverOrders] Accepted order listener cleaned up successfully');
        } else {
          console.warn('⚠️ [useDriverOrders] Invalid unsubscribe function for accepted order listener:', typeof unsubscribe);
        }
      } catch (error) {
        console.error('❌ [useDriverOrders] Error cleaning up accepted order listener:', error);
      }
    };
  }, [authReady, user?.uid, acceptedOrder?.id]);

  // Complete order
  const completeOrder = async () => {
    if (!acceptedOrder) return;
    
    setCustomModal({
      visible: true,
      title: 'Приключване на поръчка',
      message: 'Сигурни ли сте, че искате да приключите тази поръчка? Действието е необратимо.',
      icon: 'checkmark-circle-outline',
      iconColor: colors.primary,
      buttons: [
        {
          text: 'Отказ',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        },
        {
          text: 'Приключи',
          onPress: async () => {
            setCustomModal(prev => ({ ...prev, visible: false }));
            try {
              await updateOrderStatus(acceptedOrder.id, 'completed', {
                actualCompletionTime: new Date()
              });
              
              // Clear the accepted order from local state
              setAcceptedOrder(null);
              setAcceptedBid(null);
              
              setCustomModal({
                visible: true,
                title: 'Успех',
                message: 'Поръчката е приключена успешно!',
                icon: 'checkmark-circle',
                iconColor: '#10B981',
                buttons: [{
                  text: 'Разбрах',
                  onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
                }]
              });
            } catch (error) {
              console.error('Failed to complete order:', error);
              setCustomModal({
                visible: true,
                title: 'Грешка',
                message: 'Не успяхме да приключим поръчката.',
                icon: 'warning-outline',
                iconColor: colors.error,
                buttons: [{
                  text: 'Разбрах',
                  onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
                }]
              });
            }
          }
        }
      ]
    });
  };

  return {
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
  };
} 