import { useState, useEffect, useRef } from 'react';
import { subscribeToClientOrders, subscribeToBidsForOrder, updateOrderStatus } from '../../services/firestore';
import { CustomModal as CustomModalType } from '../../types/shared';
import { colors } from '../../constants/colors';

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

  // ✅ FIXED: Cleanup request modal timeout on unmount
  useEffect(() => {
    return () => {
      if (requestModalTimeoutRef.current) {
        clearTimeout(requestModalTimeoutRef.current);
        requestModalTimeoutRef.current = null;
      }
    };
  }, []);

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
