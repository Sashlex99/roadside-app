import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { LocationData } from '../../../../types/shared';

interface BidsModalProps {
  visible: boolean;
  onClose: () => void;
  activeOrder: any;
  bids: any[];
  location: LocationData | null;
  acceptingBid: boolean;
  acceptingBidId: string | null;
  onAcceptBid: (bidId: string) => void;
}

export default function BidsModal({
  visible,
  onClose,
  activeOrder,
  bids,
  location,
  acceptingBid,
  acceptingBidId,
  onAcceptBid
}: BidsModalProps) {
  
  // ✅ NEW: Prevent modal close during bid acceptance
  const handleClose = () => {
    if (acceptingBid) {
      console.log('⚠️ [BidsModal] Cannot close modal - bid acceptance in progress');
      return;
    }
    onClose();
  };

  // ✅ NEW: Prevent bid acceptance if already processing
  const handleAcceptBid = (bidId: string) => {
    if (acceptingBid) {
      console.log('⚠️ [BidsModal] Cannot accept bid - already processing another bid');
      return;
    }
    onAcceptBid(bidId);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Получени оферти</Text>
            <TouchableOpacity 
              onPress={handleClose} 
              style={[
                styles.closeButton,
                acceptingBid && styles.disabledButton
              ]}
              disabled={acceptingBid}
            >
              <Ionicons 
                name="close" 
                size={24} 
                color={acceptingBid ? colors.textSecondary : colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          {/* Content - SUPER SIMPLE VERSION THAT WORKS */}
          <View style={{ backgroundColor: 'white', height: 400 }}>
            
            <ScrollView 
              style={{ height: 385, paddingHorizontal: 6, paddingTop: 2 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEnabled={!acceptingBid} // ✅ NEW: Disable scrolling during processing
            >
              {bids.filter(bid => bid.status === 'active').map((bid, index) => {
                const isProcessingThisBid = acceptingBid && acceptingBidId === bid.id;
                const isDisabled = acceptingBid && acceptingBidId !== bid.id;
                
                return (
                  <View key={index} style={[
                    { 
                      backgroundColor: 'white', 
                      padding: 12, 
                      marginBottom: 10, 
                      marginHorizontal: 4,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                      elevation: 2,
                    },
                    isDisabled && styles.disabledCard
                  ]}>
                    {/* Центрирано име */}
                    <Text style={[
                      { fontSize: 16, color: '#1F2937', fontWeight: '600', textAlign: 'center', marginBottom: 4 },
                      isDisabled && styles.disabledText
                    ]}>
                      {bid.driverInfo?.name || 'Няма име'}
                    </Text>
                    
                    {/* Центрирано време */}
                    <Text style={[
                      { fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 8 },
                      isDisabled && styles.disabledText
                    ]}>
                      пристига за {bid.estimatedArrivalTime || 15} мин
                    </Text>
                    
                    {/* Центрирана цена */}
                    <View style={{ alignItems: 'center', marginBottom: 12 }}>
                      <Text style={[
                        { fontSize: 20, color: '#059669', fontWeight: '700' },
                        isDisabled && styles.disabledText
                      ]}>
                        {bid.proposedPrice || 'Няма цена'} лв
                      </Text>
                    </View>
                    
                    {/* Широк бутон с loading state */}
                    <TouchableOpacity 
                      style={[
                        { 
                          backgroundColor: '#F97316',
                          paddingVertical: 10,
                          paddingHorizontal: 8,
                          borderRadius: 8,
                          width: '100%',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                        isDisabled && styles.disabledButton,
                        isProcessingThisBid && styles.processingButton
                      ]}
                      onPress={() => handleAcceptBid(bid.id)}
                      disabled={acceptingBid}
                    >
                      {isProcessingThisBid && (
                        <ActivityIndicator 
                          size="small" 
                          color="white" 
                          style={{ marginRight: 8 }} 
                        />
                      )}
                      <Text style={[
                        { 
                          color: 'white', 
                          fontWeight: '600',
                          fontSize: 14,
                          textAlign: 'center',
                        },
                        isDisabled && styles.disabledButtonText
                      ]}>
                        {isProcessingThisBid ? 'ОБРАБОТВА СЕ...' : 'ПРИЕМИ'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              
              {bids.filter(bid => bid.status === 'active').length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="time-outline" size={64} color={colors.textSecondary} />
                  <Text style={styles.emptyStateText}>Чакат се оферти</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Шофьорите получават известия за вашата заявка.{'\n'}
                    Офертите ще се появят тук автоматично.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
          
          {/* ✅ NEW: Loading overlay during bid acceptance */}
          {acceptingBid && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Обработва се офертата...</Text>
                <Text style={styles.loadingSubtext}>
                  Моля, изчакайте да се създаде плащането
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    opacity: 0.7,
  },
  bidCard: {
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // ✅ NEW: Disabled states
  disabledCard: {
    opacity: 0.5,
    backgroundColor: '#F3F4F6',
  },
  disabledText: {
    color: colors.textSecondary,
  },
  disabledButton: {
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  disabledButtonText: {
    color: colors.textSecondary,
  },
  processingButton: {
    backgroundColor: colors.primary,
  },
  // ✅ NEW: Loading overlay - full size and solid
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});