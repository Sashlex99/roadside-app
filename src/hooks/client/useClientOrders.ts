import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToClientOrders, subscribeToBidsForOrder, updateOrderStatus, unlockDriver } from '../../services/firestore';
import { CustomModal as CustomModalType } from '../../types/shared';
import { colors } from '../../constants/colors';

// How long before payment_pending is considered orphaned (10 minutes)
const ORPHAN_THRESHOLD_MS = 10 * 60 * 1000;

interface UseClientOrdersParams {
  user: any;
  authReady?: boolean;
  refreshAuth?: () => Promise<void>;
  logout: () => void;
  setCustomModal: React.Dispatch<React.SetStateAction<CustomModalType>>;
  setShowRequestModal?: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useClientOrders({ user, authReady, refreshAuth, logout, setCustomModal, setShowRequestModal }: UseClientOrdersParams) {
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [acceptedDriverName, setAcceptedDriverName] = useState('');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  // ✅ FIXED: Add ref to track request modal timeout for proper cleanup
  const requestModalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track previous order status for detecting status transitions
  const prevOrderStatusRef = useRef<string | null>(null);

  // Track if we've already checked for orphaned orders this session
  const orphanCheckDoneRef = useRef(false);

  // ✅ FIXED: Cleanup request modal timeout on unmount
  useEffect(() => {
    return () => {
      if (requestModalTimeoutRef.current) {
        clearTimeout(requestModalTimeoutRef.current);
        requestModalTimeoutRef.current = null;
      }
    };
  }, []);

  // ✅ CRASH RECOVERY: Handler for orphaned payment_pending orders
  const handleOrphanedOrder = useCallback(async (order: any, action: 'cancel' | 'retry') => {
    console.log(`🔧 [Recovery] Handling orphaned order ${order.id} with action: ${action}`);

    try {
      if (action === 'cancel') {
        // Release the driver lock if any
        if (order.reservedDriverId) {
          try {
            await unlockDriver(order.reservedDriverId, order.id, 'orphan_recovery_cancel');
          } catch (unlockErr) {
            console.warn('[Recovery] Failed to unlock driver:', unlockErr);
          }
        }

        // Cancel the order
        await updateOrderStatus(order.id, 'cancelled');

        setCustomModal({
          visible: true,
          title: 'Поръчката е отменена',
          message: 'Незавършената поръчка беше отменена. Можете да създадете нова заявка.',
          icon: 'checkmark-circle',
          iconColor: '#10B981',
          buttons: [{
            text: 'Разбрах',
            onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
          }]
        });
      } else if (action === 'retry') {
        // For retry, we just close the modal - the payment flow will be triggered
        // when user taps on the order panel
        setCustomModal(prev => ({ ...prev, visible: false }));
      }
    } catch (error) {
      console.error('[Recovery] Failed to handle orphaned order:', error);
      setCustomModal({
        visible: true,
        title: 'Грешка',
        message: 'Възникна грешка при обработката. Моля опитайте отново.',
        icon: 'warning-outline',
        iconColor: colors.error,
        buttons: [{
          text: 'Затвори',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        }]
      });
    }
  }, [setCustomModal]);

  // ✅ CRASH RECOVERY: Check for orphaned payment_pending orders on startup
  useEffect(() => {
    // Only check once per session and when we have an active order
    if (orphanCheckDoneRef.current || !activeOrder) return;

    // Check if order is stuck in payment_pending
    if (activeOrder.status === 'payment_pending' && activeOrder.reservedAt) {
      const reservedTime = activeOrder.reservedAt instanceof Date
        ? activeOrder.reservedAt.getTime()
        : activeOrder.reservedAt?.toDate?.()?.getTime() || Date.now();

      const timeSinceReserved = Date.now() - reservedTime;

      if (timeSinceReserved > ORPHAN_THRESHOLD_MS) {
        orphanCheckDoneRef.current = true;
        const minutesAgo = Math.floor(timeSinceReserved / 60000);

        console.log(`⚠️ [Recovery] Found orphaned payment_pending order: ${activeOrder.id} (${minutesAgo} min ago)`);

        setCustomModal({
          visible: true,
          title: 'Незавършено плащане',
          message: `Имате поръчка, чакаща плащане от ${minutesAgo} минути. Какво искате да направите?`,
          icon: 'time-outline',
          iconColor: '#FF9500',
          buttons: [
            {
              text: 'Опитай отново',
              onPress: () => handleOrphanedOrder(activeOrder, 'retry')
            },
            {
              text: 'Отмени поръчката',
              style: 'destructive',
              onPress: () => handleOrphanedOrder(activeOrder, 'cancel')
            }
          ]
        });
      } else {
        orphanCheckDoneRef.current = true;
      }
    }
  }, [activeOrder?.id, activeOrder?.status, handleOrphanedOrder, setCustomModal]);

  // -------- Order Status Change Notifications (Completed & Cancelled) --------
  useEffect(() => {
    const prevStatus = prevOrderStatusRef.current;
    const currentStatus = activeOrder?.status;

    // Only process if there was a previous status (skip initial load)
    if (prevStatus && currentStatus && prevStatus !== currentStatus) {
      // Detect transition to 'completed'
      if (currentStatus === 'completed') {
        console.log('🎉 [Orders] Order completed! Showing notification to client');
        setCustomModal({
          visible: true,
          title: 'Поръчката е завършена',
          message: 'Благодарим ви, че използвахте нашите услуги! Надяваме се да сте доволни.',
          icon: 'checkmark-circle',
          iconColor: '#10B981',
          buttons: [{
            text: 'Благодаря!',
            onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
          }]
        });
      }

      // Detect transition to 'cancelled'
      if (currentStatus === 'cancelled') {
        console.log('[Orders] Order cancelled! Showing notification to client');
        setCustomModal({
          visible: true,
          title: 'Поръчката е отказана',
          message: 'Поръчката беше отменена. Можете да създадете нова заявка ако все още имате нужда от помощ.',
          icon: 'information-circle-outline',
          iconColor: colors.textSecondary,
          buttons: [{
            text: 'Разбрах',
            onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
          }]
        });
      }
    }

    // Update previous status ref (always, even on initial load)
    prevOrderStatusRef.current = currentStatus || null;
  }, [activeOrder?.status, setCustomModal]);

  // -------- Real-time order subscription --------
  useEffect(() => {
    if (!authReady || !user?.uid) {
      setActiveOrder(null);
      setBids([]);
      setAcceptedDriverName('');
      setLastOrderId(null);
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout | null = null;

    const setupSubscription = () => {
      try {
        const unsubscribe = subscribeToClientOrders(user.uid, (orders) => {
          // Exclude expired orders from active consideration
          const openOrder = orders.find((o) =>
            ['pending', 'searching', 'bidding', 'payment_pending', 'accepted'].includes(o.status) &&
            o.status !== 'expired'
          );
          
          setActiveOrder(openOrder || null);
          
          // Keep track of the most recent order (even if expired) for bids
          if (orders.length > 0) {
            const mostRecentOrder = orders[0]; // orders are sorted by creation date
            if (mostRecentOrder.id !== lastOrderId) {
              setLastOrderId(mostRecentOrder.id);
            }
          }
          
          // ✅ Reset retry count on successful subscription
          retryCount = 0;
        });
        
        return unsubscribe;
      } catch (subscriptionError: any) {
        if (__DEV__) console.error('[Orders] Subscription error:', subscriptionError);
        
        // ✅ IMPROVED: Handle permission errors more intelligently
        if (subscriptionError?.code === 'permission-denied') {
          retryCount++;
          
          // Don't immediately logout - try to refresh auth first
          if (retryCount <= maxRetries) {
            // Try auth refresh first
            if (typeof refreshAuth === 'function') {
              refreshAuth().catch(() => {});
            }
            
            // Exponential backoff retry
            // ✅ FIXED: Clear any existing retry timeout before setting new one
            if (retryTimeout) {
              clearTimeout(retryTimeout);
              retryTimeout = null;
            }
            retryTimeout = setTimeout(() => {
              const newUnsub = setupSubscription();
              if (newUnsub) {
                // Store the unsubscribe function for cleanup
                return newUnsub;
              }
            }, retryCount * 2000);
            
          } else {
            // Only logout after multiple failed retries
            if (__DEV__) console.error('[Orders] Max retries exceeded - forcing logout');
            setCustomModal({
              visible: true,
              title: '🔐 Проблем с достъпа',
              message: 'Възникна проблем с удостоверяването. Моля влезте отново в профила си.',
              icon: 'warning-outline',
              iconColor: colors.error,
              buttons: [
                {
                  text: 'Влез отново',
                  onPress: () => {
                    setCustomModal(prev => ({ ...prev, visible: false }));
                    logout();
                  }
                }
              ]
            });
          }
        } else {
          // Non-permission errors - retry with exponential backoff
          retryCount++;
          if (retryCount <= maxRetries) {
            // Clear any existing retry timeout before setting new one
            if (retryTimeout) {
              clearTimeout(retryTimeout);
              retryTimeout = null;
            }
            retryTimeout = setTimeout(() => {
              setupSubscription();
            }, retryCount * 2000);
          }
        }
        
        return () => {}; // Return empty cleanup function
      }
    };
    
    const unsubscribe = setupSubscription();
    
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [authReady, user?.uid]);

  // -------- Bids subscription for current order OR most recent order --------
  useEffect(() => {
    if (!authReady) {
      setBids([]);
      setAcceptedDriverName('');
      return;
    }
    const orderToSubscribeTo = activeOrder || (lastOrderId ? { id: lastOrderId } : null);
    
    if (!orderToSubscribeTo) {
      setBids([]);
      setAcceptedDriverName('');
      return;
    }

    const unsub = subscribeToBidsForOrder(orderToSubscribeTo.id, (b) => {
      setBids(b);

      // Set accepted driver name if order is accepted
      if (activeOrder?.status === 'accepted' && activeOrder.acceptedBidId) {
        const acceptedBid = b.find((x) => x.id === activeOrder.acceptedBidId);
        if (acceptedBid?.driverInfo?.name) {
          setAcceptedDriverName(acceptedBid.driverInfo.name);
        }
      }
    });
    return () => unsub();
  }, [authReady, activeOrder?.id, lastOrderId]); // Removed activeOrder?.status to prevent restart on status changes

  // -------- Handle accepted order driver name --------
  useEffect(() => {
    if (activeOrder?.status === 'accepted' && activeOrder.acceptedBidId && bids.length > 0) {
      const acceptedBid = bids.find(bid => bid.id === activeOrder.acceptedBidId);
      if (acceptedBid?.driverInfo?.name) {
        setAcceptedDriverName(acceptedBid.driverInfo.name);
      }
    } else if (activeOrder?.status !== 'accepted' && acceptedDriverName) {
      setAcceptedDriverName('');
    }
  }, [activeOrder?.status, activeOrder?.acceptedBidId, bids]);

  // -------- Expiration countdown --------
  useEffect(() => {
    if (!activeOrder?.expiresAt) return;

    const interval = setInterval(async () => {
      try {
        const diff = Math.max(0, activeOrder.expiresAt!.getTime() - Date.now());
        setTimeLeftMs(diff);

        // Only expire orders that are still waiting for bids/payment
        const canExpire = ['pending', 'searching', 'bidding'].includes(activeOrder.status);
        const isNotExpired = activeOrder.status !== 'expired';

        if (diff === 0 && isNotExpired && canExpire) {
          
          try {
            await updateOrderStatus(activeOrder.id, 'expired');
            
            // Show expiration modal to user
            setCustomModal({
              visible: true,
              title: 'Времето изтече',
              message: 'Времето за получаване на оферти изтече. Можете да пуснете нова заявка ако все още имате нужда от помощ.',
              icon: 'time-outline',
              iconColor: '#FF9500',
              buttons: [
                {
                  text: 'Разбрах',
                  onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
                },
                {
                  text: 'Нова заявка',
                  style: 'default',
                  onPress: () => {
                    setCustomModal(prev => ({ ...prev, visible: false }));
                    // ✅ FIXED: Open the request modal with proper timeout cleanup
                    if (setShowRequestModal) {
                      // Clear any existing timeout first
                      if (requestModalTimeoutRef.current) {
                        clearTimeout(requestModalTimeoutRef.current);
                        requestModalTimeoutRef.current = null;
                      }
                      requestModalTimeoutRef.current = setTimeout(() => {
                        setShowRequestModal(true);
                        requestModalTimeoutRef.current = null; // Clear ref after timeout fires
                      }, 300); // Small delay for smooth UX
                    }
                  }
                }
              ]
            });
          } catch (e) {
            if (__DEV__) console.error('[Orders] Failed to mark expired:', e);
          }
        }
      } catch (error) {
        if (__DEV__) console.error('[Orders] Expiration countdown error:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeOrder?.id, activeOrder?.expiresAt, activeOrder?.status, setCustomModal]);

  return { activeOrder, bids, timeLeftMs, acceptedDriverName };
} 
