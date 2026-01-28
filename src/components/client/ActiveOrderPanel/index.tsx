import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { ActiveOrder } from '../../../types/client';
import { StyleSheet } from 'react-native';
import { ETAResult } from '../../../services/directionsService';

interface ActiveOrderPanelProps {
  activeOrder: ActiveOrder;
  bids: any[];
  timeLeftMs: number;
  acceptedDriverName: string;
  onShowBids: () => void;
  onCancel: () => void;
  acceptingBid?: boolean;
  eta?: ETAResult | null; // ETA from driver to client
}

// Format milliseconds to M:SS string
const formatTimeRemaining = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function ActiveOrderPanel({
  activeOrder,
  bids,
  timeLeftMs,
  acceptedDriverName,
  onShowBids,
  onCancel,
  acceptingBid = false,
  eta,
}: ActiveOrderPanelProps) {
  if (!activeOrder) return null;

  // ✅ NEW: Handle cancel with bid acceptance check
  const handleCancel = () => {
    if (acceptingBid) {
      console.log('⚠️ [ActiveOrderPanel] Cannot cancel order - bid acceptance in progress');
      return;
    }
    onCancel();
  };

  // Handle call driver function
  const handleCallDriver = () => {
    if (activeOrder.status === 'accepted' && activeOrder.acceptedBidId) {
      const acceptedBid = bids.find(bid => bid.id === activeOrder.acceptedBidId);
      const driverPhone = acceptedBid?.driverInfo?.phone;
      
      console.log('📞 [ActiveOrderPanel] Attempting to call driver:', {
        acceptedBidId: activeOrder.acceptedBidId,
        foundBid: !!acceptedBid,
        driverPhone: driverPhone
      });
      
      if (driverPhone) {
        const phoneUrl = `tel:${driverPhone}`;
        console.log('📞 Opening dialer with URL:', phoneUrl);
        
        Linking.canOpenURL(phoneUrl)
          .then((supported) => {
            if (supported) {
              Linking.openURL(phoneUrl);
            } else {
              Alert.alert('Грешка', 'Не можете да се обадите от това устройство.');
            }
          })
          .catch((err) => {
            console.error('Error opening phone dialer:', err);
            Alert.alert('Грешка', 'Възникна проблем при отварянето на телефона.');
          });
      } else {
        Alert.alert('Грешка', 'Телефонният номер на шофьора не е наличен.');
      }
    }
  };

  // 🐛 DEBUG: Enhanced logging for bids state
  React.useEffect(() => {
    const activeBids = bids.filter(bid => bid.status === 'active');
    console.log('🔍 [ActiveOrderPanel] State changed:', {
      orderId: activeOrder.id,
      orderStatus: activeOrder.status,
      acceptedBidId: activeOrder.acceptedBidId,
      acceptedDriverName: acceptedDriverName,
      totalBidsCount: bids.length,
      activeBidsCount: activeBids.length,
      bidsData: bids.map(bid => ({ 
        id: bid.id, 
        price: bid.proposedPrice, 
        driverName: bid.driverInfo?.name,
        status: bid.status,
        createdAt: bid.createdAt 
      }))
    });
    
    // Extra debug for accepted orders
    if (activeOrder.status === 'accepted') {
      console.log('🎉 [ActiveOrderPanel] Order is accepted - driver name debug:', {
        acceptedDriverName: `"${acceptedDriverName}"`,
        acceptedDriverNameLength: acceptedDriverName?.length,
        acceptedBidId: activeOrder.acceptedBidId,
        matchingBid: bids.find(bid => bid.id === activeOrder.acceptedBidId)
      });
    }
  }, [bids, activeOrder.id, activeOrder.status, activeOrder.acceptedBidId, acceptedDriverName]);

  return (
    <View style={localStyles.activeOrderPanel}>
      {activeOrder.status === 'accepted' ? (
        // Accepted order - show confirmation using driver panel style
        <View>
          <View style={localStyles.activeOrderHeader}>
            <View style={{ flex: 1 }}>
              <Text style={localStyles.activeOrderTitle}>Оферта приета</Text>
              <Text style={localStyles.activeOrderDescription}>
                {acceptedDriverName || (() => {
                  // Fallback: try to find driver name from accepted bid
                  const acceptedBid = bids.find(bid => bid.id === activeOrder.acceptedBidId);
                  const fallbackName = acceptedBid?.driverInfo?.name || 'Шофьор';
                  console.log('🔍 [ActiveOrderPanel] Using fallback driver name:', fallbackName);
                  return fallbackName;
                })()}
              </Text>
              <Text style={localStyles.activeOrderAddress}>📍 {activeOrder.destinationLocation?.address || 'Няма зададен адрес'}</Text>
              {eta && (
                <View style={localStyles.etaContainer}>
                  <Ionicons name="time-outline" size={14} color={colors.primary} />
                  <Text style={localStyles.etaText}>
                    Очаквано пристигане: {eta.durationText}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={localStyles.phoneButton} onPress={handleCallDriver}>
              <Ionicons name="call" size={20} color={colors.textOnPrimary} />
            </TouchableOpacity>
          </View>
          <View style={localStyles.activeOrderActions}>
            <TouchableOpacity 
              style={[
                localStyles.centeredCancelButton,
                acceptingBid && localStyles.disabledButton
              ]} 
              onPress={handleCancel}
              disabled={acceptingBid}
            >
              <Ionicons 
                name="close" 
                size={20} 
                color={acceptingBid ? colors.textSecondary : colors.textOnPrimary} 
              />
              <Text style={[
                localStyles.actionButtonText,
                acceptingBid && localStyles.disabledText
              ]}>
                Отказ
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Waiting for bids - show clickable panel with cancel button
        <View>
          <TouchableOpacity 
            onPress={() => {
              if (acceptingBid) {
                console.log('⚠️ [ActiveOrderPanel] Cannot show bids - bid acceptance in progress');
                return;
              }
              
              const activeBids = bids.filter(bid => bid.status === 'active');
              console.log('🔍 [ActiveOrderPanel] TouchableOpacity pressed:', {
                status: activeOrder.status,
                canShowBids: ['pending', 'searching', 'bidding', 'payment_pending'].includes(activeOrder.status),
                totalBidsCount: bids.length,
                activeBidsCount: activeBids.length,
                // 🐛 DEBUG: Enhanced bid details
                bidDetails: bids.map(bid => ({
                  id: bid.id,
                  price: bid.proposedPrice,
                  driverName: bid.driverInfo?.name,
                  status: bid.status,
                  isValid: !!bid.id && !!bid.proposedPrice
                }))
              });
              
              if (['pending', 'searching', 'bidding', 'payment_pending'].includes(activeOrder.status)) {
                console.log('✅ [ActiveOrderPanel] Calling onShowBids() with bids:', activeBids.length);
                onShowBids();
              } else {
                console.log('⚠️ [ActiveOrderPanel] Cannot show bids - status not in allowed list');
              }
            }}
            disabled={acceptingBid}
            style={[
              acceptingBid && { opacity: 0.6 }
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.activeOrderTitle}>{activeOrder.description}</Text>
                <Text style={localStyles.activeOrderCountdown}>⏱ Остават {formatTimeRemaining(timeLeftMs)}</Text>
              </View>
              <View style={localStyles.offersBadge}>
                <Text style={localStyles.offersBadgeText}>
                  {bids.filter(bid => bid.status === 'active').length}
                </Text>
              </View>
            </View>
            <Text style={localStyles.activeOrderSubtitle}>Чакат се оферти</Text>
          </TouchableOpacity>
          
          {/* Cancel button for waiting state */}
          <View style={localStyles.activeOrderActions}>
            <TouchableOpacity 
              style={[
                localStyles.centeredCancelButton,
                acceptingBid && localStyles.disabledButton
              ]} 
              onPress={handleCancel}
              disabled={acceptingBid}
            >
              <Ionicons 
                name="close" 
                size={20} 
                color={acceptingBid ? colors.textSecondary : colors.textOnPrimary} 
              />
              <Text style={[
                localStyles.actionButtonText,
                acceptingBid && localStyles.disabledText
              ]}>
                Отказ
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  activeOrderPanel: {
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  activeOrderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activeOrderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  activeOrderDescription: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  activeOrderAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  activeOrderDestination: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  phoneButton: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeOrderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  cancelActionButton: {
    backgroundColor: colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    marginLeft: 8,
  },
  centeredCancelButton: {
    backgroundColor: colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 35,
    paddingVertical: 8,
    borderRadius: 25,
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 4,
  },
  actionButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Keep styles for the waiting state
  activeOrderCountdown: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  activeOrderSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  offersBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 4,
  },
  offersBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textOnPrimary,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  cancelButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  disabledButton: {
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  disabledText: {
    color: colors.textSecondary,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  etaText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
}); 