import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { PaymentModal as PaymentModalType } from '../../../../types/client';

interface PaymentModalProps {
  paymentModal: PaymentModalType;
  paymentInProgress: boolean;
  onPaymentPress: () => void;
  onCancel: () => void;
}

export default function PaymentModal({
  paymentModal,
  paymentInProgress,
  onPaymentPress,
  onCancel,
}: PaymentModalProps) {
  return (
    <Modal
      visible={paymentModal.visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Потвърдете поръчката</Text>
          
          <View style={styles.priceBreakdown}>
            <Text style={styles.priceBreakdownTitle}>Разбивка на цената:</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Обща цена:</Text>
              <Text style={styles.priceValue}>{paymentModal.totalAmount.toFixed(2)} EUR</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Платформена такса (15%):</Text>
              <Text style={styles.priceValue}>{paymentModal.amount.toFixed(2)} EUR</Text>
            </View>
            <View style={styles.priceDivider} />
            <Text style={styles.paymentNote}>
              Останалите {(paymentModal.totalAmount - paymentModal.amount).toFixed(2)} EUR се плащат директно на {paymentModal.driverName}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.payButton, paymentInProgress && { opacity: 0.7 }]}
            onPress={onPaymentPress}
            disabled={paymentInProgress}
          >
            {paymentInProgress ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
                <Text style={[styles.payButtonText, { marginLeft: 8 }]}>
                  Отваря плащане...
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="card-outline" size={20} color={colors.textOnPrimary} />
                <Text style={styles.payButtonText}>
                  Плати {paymentModal.amount.toFixed(2)} EUR с карта
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <Text style={styles.secureText}>
            🔒 Сигурно плащане през Stripe
          </Text>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>Отказ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    padding: 24,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  priceBreakdown: {
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  priceBreakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  priceDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  paymentNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  payButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  payButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secureText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  cancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
}); 
