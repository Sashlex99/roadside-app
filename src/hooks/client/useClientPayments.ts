import React, { useState, useEffect, useRef } from 'react';
import { Linking, AppState } from 'react-native';
import { reserveBid, confirmBid, cancelBidReservation, updateOrderStatus } from '../../services/firestore';
import { createPaymentLinkWithToken } from '../../services/customStripeService';
import { ensureDriverNotification } from '../../utils/driverNotifications';
import { CustomModal as CustomModalType } from '../../types/shared';
import { PaymentModal } from '../../types/client';
import { colors } from '../../constants/colors';
import { usePaymentSheet } from '../usePaymentSheet';

interface UseClientPaymentsParams {
  user: any;
  token: string | null;
  activeOrder: any;
  bids: any[];
  setCustomModal: React.Dispatch<React.SetStateAction<CustomModalType>>;
  setShowBidsModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useClientPayments({
  user,
  token,
  activeOrder,
  bids,
  setCustomModal,
  setShowBidsModal
}: UseClientPaymentsParams) {
  const [paymentModal, setPaymentModal] = useState<PaymentModal>({
    visible: false,
    amount: 0,
    paymentUrl: '',
    driverName: '',
    totalAmount: 0
  });

  const [acceptingBid, setAcceptingBid] = useState(false);
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null);
  const [paymentInProgress, setPaymentInProgress] = useState(false);

  // Payment Sheet hook for Apple Pay / Google Pay / Card
  const { startPaymentSheet, loading: paymentSheetLoading } = usePaymentSheet();
  
  // ✅ FIXED: Use refs to track all timeout states and prevent memory leaks
  const paymentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPaymentModalActiveRef = useRef(false);
  const successModalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bidModalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ FIX: Refs to avoid stale closure in payment timeout callback
  // These refs always hold the current values, unlike state which gets captured at setTimeout creation
  const activeOrderRef = useRef(activeOrder);
  const paymentModalVisibleRef = useRef(paymentModal.visible);

  // ✅ FIXED: Cleanup all timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      console.log('🧹 [CLEANUP] Cleaning up all timers in useClientPayments');
      if (paymentTimeoutRef.current) {
        clearTimeout(paymentTimeoutRef.current);
        paymentTimeoutRef.current = null;
      }
      if (successModalTimeoutRef.current) {
        clearTimeout(successModalTimeoutRef.current);
        successModalTimeoutRef.current = null;
      }
      if (appStateTimeoutRef.current) {
        clearTimeout(appStateTimeoutRef.current);
        appStateTimeoutRef.current = null;
      }
      if (bidModalTimeoutRef.current) {
        clearTimeout(bidModalTimeoutRef.current);
        bidModalTimeoutRef.current = null;
      }
    };
  }, []);

  // ✅ FIX: Keep refs in sync with state to avoid stale closures in setTimeout callbacks
  useEffect(() => {
    activeOrderRef.current = activeOrder;
  }, [activeOrder]);

  useEffect(() => {
    paymentModalVisibleRef.current = paymentModal.visible;
  }, [paymentModal.visible]);

  // ✅ FIXED: Handle payment success with proper timer cleanup
  useEffect(() => {
    if (activeOrder?.status === 'accepted' && paymentModal.visible) {
      console.log('🎉 Order accepted! Closing payment modal and showing success message');
      
      // ✅ FIXED: Clear payment timeout when order becomes accepted
      if (paymentTimeoutRef.current) {
        clearTimeout(paymentTimeoutRef.current);
        paymentTimeoutRef.current = null;
      }
      isPaymentModalActiveRef.current = false;
      
      // Close payment modal and reset all payment states
      setPaymentModal({ visible: false, amount: 0, paymentUrl: '', driverName: '', totalAmount: 0 });
      setPaymentInProgress(false);
      setAcceptingBid(false);
      setAcceptingBidId(null);
      
      // ✅ FIXED: Clear any existing success modal timeout before setting new one
      if (successModalTimeoutRef.current) {
        clearTimeout(successModalTimeoutRef.current);
        successModalTimeoutRef.current = null;
      }
      
      // Show success modal after a short delay with proper cleanup
      successModalTimeoutRef.current = setTimeout(() => {
        setCustomModal({
          visible: true,
          title: 'Плащането е успешно!',
          message: 'Поръчката е потвърдена. Шофьорът ще се свърже с вас скоро.',
          icon: 'checkmark-circle',
          iconColor: '#10B981',
          buttons: [{
            text: 'Отлично!',
            onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
          }]
        });
        successModalTimeoutRef.current = null; // Clear ref after timeout fires
      }, 300);
    }
  }, [activeOrder]);

  // Handle payment success deep link to close modal immediately
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      if (!url) return;
      
      if (url.includes('payment-success')) {
        console.log('🔗 Payment success deep link received:', url);
        
        // ✅ FIXED: Clear timeout when payment is successful
        if (paymentTimeoutRef.current) {
          clearTimeout(paymentTimeoutRef.current);
          paymentTimeoutRef.current = null;
        }
        isPaymentModalActiveRef.current = false;
        
        // Confirm the bid (Phase 2) - only if we have a reserved bid
        const reservedBidId = activeOrder?.reservedBidId;
        const reservedDriverId = activeOrder?.reservedDriverId;
        
        if (reservedBidId && reservedDriverId) {
          console.log('🔄 Confirming bid after payment success:', { orderId: activeOrder.id, bidId: reservedBidId });
          
          confirmBid(activeOrder.id, reservedBidId).then(() => {
            console.log('✅ Bid confirmed successfully');

            // ✅ Ensure driver notification as a fallback (using static import to avoid rebundle)
            ensureDriverNotification(reservedDriverId, activeOrder.id).then(result => {
              if (result.success) {
                console.log('✅ Driver notification ensured:', result.alreadyNotified ? 'already notified' : 'notification triggered');
              } else {
                console.log('ℹ️ Driver notification skipped (non-critical):', result.error);
              }
            });
          }).catch(error => {
            console.error('Error confirming bid after payment:', error);

            // ✅ ENHANCED: Even if bid confirmation fails, try to ensure driver notification
            console.log('🔄 Bid confirmation failed, trying fallback driver notification...');
            ensureDriverNotification(reservedDriverId, activeOrder.id).then(result => {
              if (result.success) {
                console.log('✅ Driver notification ensured via fallback:', result.alreadyNotified ? 'already notified' : 'notification triggered');
              } else {
                console.warn('⚠️ Fallback driver notification also failed:', result.error);
              }
            });
          });
        } else {
          console.log('⚠️ No reserved bid or driver found for payment success confirmation');
        }
        
        // Close payment modal - payment was successful
        setPaymentModal({ visible: false, amount: 0, paymentUrl: '', driverName: '', totalAmount: 0 });
        setPaymentInProgress(false);
        setAcceptingBid(false);
        setAcceptingBidId(null);

        // Show success modal with amount if available
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const amount = urlParams.get('amount');

        setCustomModal({
          visible: true,
          title: 'Плащането е успешно!',
          message: amount
            ? `Платихте ${parseFloat(amount).toFixed(2)} EUR платформена такса. Шофьорът ще се свърже с вас скоро.`
            : 'Поръчката е потвърдена. Шофьорът ще се свърже с вас скоро.',
          icon: 'checkmark-circle',
          iconColor: '#10B981',
          buttons: [{
            text: 'Добре',
            onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
          }]
        });
      }
      
      // Handle payment cancellation/failure
      if (url.includes('payment-cancelled') || url.includes('payment-failed')) {
        console.log('❌ Payment cancelled/failed deep link received:', url);
        
        // Cancel bid reservation BEFORE resetting states
        const reservedBidId = activeOrder?.reservedBidId;
        if (reservedBidId) {
          console.log('🔄 Cancelling bid reservation for:', { orderId: activeOrder.id, bidId: reservedBidId });
          cancelBidReservation(activeOrder.id, reservedBidId).catch(error => {
            console.error('Error cancelling bid reservation:', error);
          });
        }
        
        // Close payment modal and reset states
        setPaymentModal({ visible: false, amount: 0, paymentUrl: '', driverName: '', totalAmount: 0 });
        setPaymentInProgress(false);
        setAcceptingBid(false);
        setAcceptingBidId(null);

        // Show failure modal
        setCustomModal({
          visible: true,
          title: '❌ Плащането не е успешно',
          message: 'Плащането беше отменено или неуспешно. Можете да опитате отново с друга карта.',
          icon: 'close-circle',
          iconColor: '#EF4444',
          buttons: [
            {
              text: 'Затвори',
              style: 'default',
              onPress: () => {
                setCustomModal(prev => ({ ...prev, visible: false }));
                // ✅ FIXED: Auto-open bids modal with proper timer cleanup
                if (bidModalTimeoutRef.current) {
                  clearTimeout(bidModalTimeoutRef.current);
                  bidModalTimeoutRef.current = null;
                }
                bidModalTimeoutRef.current = setTimeout(() => {
                  setShowBidsModal(true);
                  bidModalTimeoutRef.current = null;
                }, 500);
              }
            },
            {
              text: 'Опитай отново',
              onPress: () => {
                setCustomModal(prev => ({ ...prev, visible: false }));
                // ✅ FIXED: Reopen bids modal with proper timer cleanup
                if (bidModalTimeoutRef.current) {
                  clearTimeout(bidModalTimeoutRef.current);
                  bidModalTimeoutRef.current = null;
                }
                bidModalTimeoutRef.current = setTimeout(() => {
                  setShowBidsModal(true);
                  bidModalTimeoutRef.current = null;
                }, 300);
              }
            }
          ]
        });
      }
    };

    // Subscribe to deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Cleanup
    return () => {
      try {
        (subscription as any)?.remove?.();
      } catch (error) {
        console.error('Error removing deep link listener:', error);
      }
    };
  }, [activeOrder]);

  // ✅ FIXED: Timeout starts when payment modal is shown, not just when payment button is clicked
  useEffect(() => {
    console.log('🔍 [TIMEOUT DEBUG] useEffect triggered with:', {
      paymentModalVisible: paymentModal.visible,
      paymentInProgress: paymentInProgress,
      shouldStartTimeout: paymentModal.visible, // ✅ CHANGED: Start timeout when modal is visible
      isPaymentModalActiveRef: isPaymentModalActiveRef.current,
      paymentTimeoutRef: !!paymentTimeoutRef.current
    });
    
    // ✅ CHANGED: Start timeout when payment modal is visible (not waiting for paymentInProgress)
    if (!paymentModal.visible) {
      console.log('⏹️ [TIMEOUT DEBUG] Clearing timeout - modal not visible');
      // Clear any existing timeout when modal is hidden
      if (paymentTimeoutRef.current) {
        clearTimeout(paymentTimeoutRef.current);
        paymentTimeoutRef.current = null;
        console.log('🧹 [TIMEOUT DEBUG] Timeout cleared');
      }
      isPaymentModalActiveRef.current = false;
      return;
    }
    
    // Set flag to track that payment modal is active
    isPaymentModalActiveRef.current = true;
    
    console.log('⏰ [TIMEOUT DEBUG] Starting payment modal timeout (15 seconds) - modal is visible');
    
    paymentTimeoutRef.current = setTimeout(() => {
      // ✅ FIX: Use refs to get CURRENT values, not stale closure values
      const currentActiveOrder = activeOrderRef.current;
      const currentPaymentModalVisible = paymentModalVisibleRef.current;

      console.log('⏰ [TIMEOUT DEBUG] Timeout fired! Checking conditions:', {
        isPaymentModalActiveRef: isPaymentModalActiveRef.current,
        paymentModalVisible: currentPaymentModalVisible,
        shouldClose: isPaymentModalActiveRef.current && currentPaymentModalVisible
      });

      // ✅ FIX: Use refs for current state (avoids stale closure)
      if (isPaymentModalActiveRef.current && currentPaymentModalVisible) {
        console.log('⏰ Payment modal timeout reached - auto-closing');

        // Cancel bid reservation if payment didn't complete
        // ✅ FIX: Use currentActiveOrder from ref, not stale activeOrder
        if (currentActiveOrder?.reservedBidId) {
          console.log('🔄 Cancelling bid reservation due to timeout:', {
            orderId: currentActiveOrder.id,
            bidId: currentActiveOrder.reservedBidId
          });
          cancelBidReservation(currentActiveOrder.id, currentActiveOrder.reservedBidId).catch(error => {
            console.error('Error cancelling bid reservation on timeout:', error);
          });
        }

        // Close payment modal and reset states
        setPaymentModal({ visible: false, amount: 0, paymentUrl: '', driverName: '', totalAmount: 0 });
        setPaymentInProgress(false);
        setAcceptingBid(false);
        setAcceptingBidId(null);
        isPaymentModalActiveRef.current = false;

        // Show timeout notification
        setCustomModal({
          visible: true,
          title: '⏰ Плащането приключи',
          message: 'Ако плащането е успешно, поръчката ще бъде потвърдена автоматично.',
          icon: 'time-outline',
          iconColor: '#FF9500',
          buttons: [{
            text: 'Разбрах',
            onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
          }]
        });
      } else {
        console.log('⏰ [TIMEOUT DEBUG] Timeout fired but conditions not met - not closing modal');
      }
    }, 15000); // 15 seconds
    
    console.log('✅ [TIMEOUT DEBUG] Timeout set successfully');
    
    return () => {
      console.log('🧹 [TIMEOUT DEBUG] Cleanup function called');
      if (paymentTimeoutRef.current) {
        clearTimeout(paymentTimeoutRef.current);
        paymentTimeoutRef.current = null;
        console.log('🧹 [TIMEOUT DEBUG] Timeout cleaned up');
      }
    };
  }, [paymentModal.visible, activeOrder?.reservedBidId]); // ✅ CHANGED: Removed paymentInProgress dependency

  // Handle app focus to detect when user returns from payment
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      // ✅ FIX: Use refs for current values in initial check too
      const currentPaymentModalVisible = paymentModalVisibleRef.current;
      const currentActiveOrder = activeOrderRef.current;

      if (nextAppState === 'active' && currentPaymentModalVisible && currentActiveOrder?.status === 'payment_pending') {
        console.log('📱 App became active while payment modal is visible - user might have cancelled payment');

        // ✅ FIXED: Clear any existing app state timeout before setting new one
        if (appStateTimeoutRef.current) {
          clearTimeout(appStateTimeoutRef.current);
          appStateTimeoutRef.current = null;
        }

        // Wait a bit to see if deep link comes through with proper cleanup
        appStateTimeoutRef.current = setTimeout(() => {
          // ✅ FIX: Use refs to get CURRENT values when timeout fires (avoid stale closure)
          const currentPaymentModalVisibleNow = paymentModalVisibleRef.current;
          const currentActiveOrderNow = activeOrderRef.current;

          if (currentPaymentModalVisibleNow && currentActiveOrderNow?.status === 'payment_pending') {
            console.log('❌ No deep link received - assuming payment was cancelled');

            // ✅ FIXED: Clear timeout when app state change cancels payment
            if (paymentTimeoutRef.current) {
              clearTimeout(paymentTimeoutRef.current);
              paymentTimeoutRef.current = null;
            }
            isPaymentModalActiveRef.current = false;

            // Cancel bid reservation BEFORE resetting states
            const reservedBidId = currentActiveOrderNow?.reservedBidId;
            if (reservedBidId) {
              console.log('🔄 Cancelling bid reservation for:', {
                orderId: currentActiveOrderNow.id,
                bidId: reservedBidId
              });
              cancelBidReservation(currentActiveOrderNow.id, reservedBidId).catch(error => {
                console.error('Error cancelling bid reservation:', error);
              });
            }

            // Close payment modal and reset states
            setPaymentModal({ visible: false, amount: 0, paymentUrl: '', driverName: '', totalAmount: 0 });
            setPaymentInProgress(false);
            setAcceptingBid(false);
            setAcceptingBidId(null);
          }
          appStateTimeoutRef.current = null; // Clear ref after timeout fires
        }, 2000); // Wait 2 seconds for deep link
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []); // ✅ FIX: Empty deps since we use refs for current values

  // Confirm and accept bid function - uses Payment Sheet (Apple Pay / Google Pay / Card)
  const confirmAcceptBid = async (bidId: string) => {
    if (!activeOrder) {
      console.error('❌ No active order found');
      return;
    }

    const selectedBid = bids.find(bid => bid.id === bidId);
    if (!selectedBid) {
      console.error('❌ Selected bid not found:', bidId);
      return;
    }

    if (!user) {
      setCustomModal({
        visible: true,
        title: 'Грешка',
        message: 'Моля, влезте отново в профила си',
        icon: 'warning-outline',
        iconColor: colors.error,
        buttons: [{
          text: 'Разбрах',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        }]
      });
      return;
    }

    // Start loading state
    setAcceptingBid(true);
    setAcceptingBidId(bidId);

    console.log('🔄 Starting bid acceptance process with Payment Sheet:', {
      orderId: activeOrder.id,
      bidId,
      proposedPrice: selectedBid.proposedPrice,
      driverName: selectedBid.driverInfo.name
    });

    try {
      // 1. Reserve bid в Firestore (Phase 1)
      console.log('📝 Step 1: Reserving bid in Firestore...');
      await reserveBid(activeOrder.id, bidId);
      console.log('✅ Step 1: Bid reserved successfully');

      // 2. Close bids modal before showing payment sheet
      setShowBidsModal(false);

      // 3. Show Payment Sheet (Apple Pay / Google Pay / Card)
      console.log('💳 Step 2: Starting Payment Sheet...');
      const paymentResult = await startPaymentSheet({
        orderId: activeOrder.id,
        bidId,
        bidAmount: selectedBid.proposedPrice,
        driverId: selectedBid.driverId,
        clientId: user.uid,
      });

      if (paymentResult.success) {
        console.log('✅ Payment completed successfully!');

        // Ensure driver notification
        ensureDriverNotification(selectedBid.driverId, activeOrder.id).then(result => {
          if (result.success) {
            console.log('✅ Driver notification ensured:', result.alreadyNotified ? 'already notified' : 'notification triggered');
          } else {
            console.log('ℹ️ Driver notification skipped (non-critical):', result.error);
          }
        });

        // Show success modal
        setCustomModal({
          visible: true,
          title: 'Плащането е успешно!',
          message: 'Поръчката е потвърдена. Шофьорът ще се свърже с вас скоро.',
          icon: 'checkmark-circle',
          iconColor: '#10B981',
          buttons: [{
            text: 'Отлично!',
            onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
          }]
        });
      } else if (paymentResult.cancelled) {
        console.log('ℹ️ Payment cancelled by user');

        // Cancel bid reservation
        await cancelBidReservation(activeOrder.id, bidId);

        // Show cancellation message and reopen bids
        setCustomModal({
          visible: true,
          title: 'Плащането е отменено',
          message: 'Можете да изберете друга оферта или да опитате отново.',
          icon: 'close-circle',
          iconColor: '#FF9500',
          buttons: [{
            text: 'Виж офертите',
            onPress: () => {
              setCustomModal(prev => ({ ...prev, visible: false }));
              setTimeout(() => setShowBidsModal(true), 300);
            }
          }]
        });
      } else {
        console.error('❌ Payment failed:', paymentResult.errorMessage);

        // Cancel bid reservation on payment failure
        await cancelBidReservation(activeOrder.id, bidId);

        setCustomModal({
          visible: true,
          title: '❌ Грешка при плащане',
          message: paymentResult.errorMessage || 'Плащането не беше успешно. Моля, опитайте отново.',
          icon: 'warning-outline',
          iconColor: colors.error,
          buttons: [
            {
              text: 'Опитай отново',
              onPress: () => {
                setCustomModal(prev => ({ ...prev, visible: false }));
                setTimeout(() => setShowBidsModal(true), 300);
              }
            }
          ]
        });
      }

    } catch (error: any) {
      console.error('❌ Error in confirmAcceptBid:', error);

      // Cancel bid reservation on error
      try {
        await cancelBidReservation(activeOrder.id, bidId);
      } catch (cancelError) {
        console.error('Error cancelling bid reservation:', cancelError);
      }

      // More specific error messages
      let errorMessage = 'Не успяхме да обработим офертата';
      if (error?.code === 'unauthenticated') {
        errorMessage = 'Моля, влезте отново в профила си';
      } else if (error?.code === 'permission-denied') {
        errorMessage = 'Нямате права за тази операция';
      } else if (error?.message?.includes('Driver is already reserved for another order')) {
        errorMessage = 'Този шофьор вече е зает с друга поръчка. Моля, изберете друг шофьор.';
      } else if (error?.message?.includes('Bid is not active')) {
        errorMessage = 'Тази оферта вече не е активна. Моля, изберете друга оферта.';
      } else if (error?.message?.includes('Another bid is already reserved')) {
        errorMessage = 'Вече има резервирана оферта за тази поръчка. Моля, опитайте отново.';
      } else if (error?.message?.includes('payment')) {
        errorMessage = 'Проблем с плащането. Моля, опитайте отново';
      } else if (error?.message?.includes('network')) {
        errorMessage = 'Проблем с мрежата. Проверете интернет връзката';
      }

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
    } finally {
      // Stop loading state
      setAcceptingBid(false);
      setAcceptingBidId(null);
    }
  };

  // Handle payment button press
  const handlePaymentPress = async () => {
    console.log('🔍 [PAYMENT PRESS DEBUG] Payment button pressed, current states:', {
      paymentModalVisible: paymentModal.visible,
      paymentInProgress: paymentInProgress,
      paymentUrl: paymentModal.paymentUrl
    });
    
    try {
      setPaymentInProgress(true);
      console.log('🔍 [PAYMENT PRESS DEBUG] Set paymentInProgress to true - timeout should start now');
      
      console.log('🔗 Opening payment URL:', paymentModal.paymentUrl);
      
      // Open Stripe payment page
      const supported = await Linking.canOpenURL(paymentModal.paymentUrl);
      if (supported) {
        await Linking.openURL(paymentModal.paymentUrl);
        console.log('✅ Payment URL opened successfully');
        console.log('🔍 [PAYMENT PRESS DEBUG] Payment URL opened, 15-second timeout should be running');
        
        // ✅ FIXED: Removed competing 1-second timer that was interfering with the 15-second timeout
        // The 15-second timeout will handle auto-closing if payment doesn't complete
        
      } else {
        throw new Error('Cannot open payment URL');
      }
    } catch (error) {
      console.error('❌ Error opening payment URL:', error);
      console.log('🔍 [PAYMENT PRESS DEBUG] Error occurred, setting paymentInProgress to false');
      setCustomModal({
        visible: true,
        title: 'Грешка',
        message: 'Не можахме да отворим страницата за плащане',
        icon: 'warning-outline',
        iconColor: colors.error,
        buttons: [{
          text: 'Опитай отново',
          onPress: () => {
            setCustomModal(prev => ({ ...prev, visible: false }));
            // Allow user to try again
          }
        }]
      });
      setPaymentInProgress(false);
    }
  };

  // Handle payment cancellation
  const handlePaymentCancel = () => {
    console.log('❌ Payment cancelled by user');
    
    // ✅ FIXED: Clear timeout when user manually cancels
    if (paymentTimeoutRef.current) {
      clearTimeout(paymentTimeoutRef.current);
      paymentTimeoutRef.current = null;
    }
    isPaymentModalActiveRef.current = false;
    
    // Cancel bid reservation
    if (activeOrder?.reservedBidId) {
      console.log('🔄 Cancelling bid reservation for:', { orderId: activeOrder.id, bidId: activeOrder.reservedBidId });
      cancelBidReservation(activeOrder.id, activeOrder.reservedBidId).catch(error => {
        console.error('Error cancelling bid reservation:', error);
      });
    }
    
    setPaymentModal({ visible: false, amount: 0, paymentUrl: '', driverName: '', totalAmount: 0 });
    setPaymentInProgress(false);
    setAcceptingBid(false);
    setAcceptingBidId(null);
  };

  return {
    paymentModal,
    acceptingBid,
    acceptingBidId,
    paymentInProgress,
    paymentSheetLoading,  // For Apple Pay / Google Pay loading state
    confirmAcceptBid,
    handlePaymentPress,   // Legacy - for Payment Link fallback
    handlePaymentCancel   // Legacy - for Payment Link fallback
  };
} 
