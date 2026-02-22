import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { PendingOrder } from '../../../../types/driver';

interface OrderDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  selectedOrder: PendingOrder | null;
  onSubmitOffer: (order: PendingOrder, price: string) => Promise<boolean>;
}

export default function OrderDetailsModal({
  visible,
  onClose,
  selectedOrder,
  onSubmitOffer,
}: OrderDetailsModalProps) {
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitOffer = async () => {
    // Prevent double-tap - if already submitting, ignore
    if (isSubmitting) {
      console.log('⚠️ [OrderDetailsModal] Already submitting, ignoring duplicate tap');
      return;
    }

    console.log('🔄 [OrderDetailsModal] handleSubmitOffer called - offerPrice:', offerPrice);

    // ✅ FIX: Dismiss keyboard first to prevent double-tap issue
    Keyboard.dismiss();

    if (!selectedOrder) {
      console.log('❌ [OrderDetailsModal] No selected order');
      return;
    }

    // Set submitting state to prevent duplicate submissions
    setIsSubmitting(true);

    try {
      console.log('🚀 [OrderDetailsModal] Calling onSubmitOffer...');
      const success = await onSubmitOffer(selectedOrder, offerPrice);
      console.log('✅ [OrderDetailsModal] onSubmitOffer result:', success);

      if (success) {
        setOfferPrice('');
        setShowOfferModal(false);
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOfferPress = () => {
    if (!selectedOrder) return;
    setOfferPrice('');
    setShowOfferModal(true);
  };

  return (
    <>
      {/* Order Details Modal */}
      <Modal
        visible={visible && !!selectedOrder}
        animationType="fade"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Детайли за поръчка</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedOrder && (
              <ScrollView style={{ flex: 1 }}>
                <Text style={styles.orderDescription}>{selectedOrder.description}</Text>
                {selectedOrder.images && selectedOrder.images.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
                    {selectedOrder.images.map((img, idx) => (
                      <Image 
                        key={idx} 
                        source={{ uri: img }} 
                        style={styles.orderImage}
                      />
                    ))}
                  </ScrollView>
                )}
                <View style={styles.locationContainer}>
                  <Ionicons name="pin-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.locationText}>От: {selectedOrder.location.address}</Text>
                </View>
                {selectedOrder.destinationLocation?.address && (
                  <View style={styles.locationContainer}>
                    <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                    <Text style={styles.locationText}>До: {selectedOrder.destinationLocation.address}</Text>
                  </View>
                )}
                <View style={styles.clientContainer}>
                  <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.clientText}>Клиент: {selectedOrder.clientName}</Text>
                </View>
                <View style={styles.distanceContainer}>
                  <Ionicons name="location-outline" size={16} color={colors.primary} />
                  <Text style={styles.distanceText}>Разстояние: {selectedOrder.distance}км</Text>
                </View>
              </ScrollView>
            )}
            {/* Offer button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleOfferPress}
            >
              <Ionicons name="cash-outline" size={20} color={colors.textOnPrimary} />
              <Text style={styles.submitButtonText}>ОФЕРТИРАЙ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Offer Modal */}
      <Modal
        visible={showOfferModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowOfferModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.offerOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.offerContent}>
            <View style={styles.offerIconContainer}>
              <Ionicons name="cash-outline" size={64} color={colors.primary} />
            </View>
            <Text style={styles.offerTitle}>Направи оферта</Text>
            <Text style={styles.offerMessage}>Въведи цена в лева за услугата</Text>
            <TextInput
              style={styles.offerPriceInput}
              placeholder="Цена в лева"
              value={offerPrice}
              onChangeText={setOfferPrice}
              keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <View style={styles.offerButtons}>
              <TouchableOpacity
                style={[styles.offerButton, { backgroundColor: colors.textSecondary }]}
                onPress={() => { 
                  console.log('🔄 [OrderDetailsModal] Cancel button pressed');
                  setShowOfferModal(false); 
                  setOfferPrice(''); 
                }}
              >
                <Text style={styles.offerButtonText}>ОТКАЗ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.offerButton,
                  { backgroundColor: isSubmitting ? colors.textSecondary : colors.primary }
                ]}
                onPress={handleSubmitOffer}
                activeOpacity={0.7}
                disabled={isSubmitting}
              >
                <Text style={styles.offerButtonText}>
                  {isSubmitting ? 'ИЗПРАЩАНЕ...' : 'ИЗПРАТИ'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    width: '90%',
    maxWidth: 450,
    height: '80%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  orderDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    lineHeight: 24,
  },
  orderImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginRight: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  clientContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  clientText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  distanceText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 8,
    flex: 1,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.primary,
    marginTop: 16,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Offer Modal Styles
  offerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  offerContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  offerIconContainer: {
    marginBottom: 20,
  },
  offerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  offerMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  offerPriceInput: {
    width: '100%',
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 20,
  },
  offerButtons: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  offerButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  offerButtonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 