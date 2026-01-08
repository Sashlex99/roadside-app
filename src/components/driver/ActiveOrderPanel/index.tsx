import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { ActiveDriverOrder } from '../../../types/driver';
import { styles } from './styles';

interface ActiveOrderPanelProps {
  activeOrder: ActiveDriverOrder;
  onNavigate: () => void;
  onCall: () => void;
  onComplete: () => void;
}

export default function ActiveOrderPanel({
  activeOrder,
  onNavigate,
  onCall,
  onComplete,
}: ActiveOrderPanelProps) {
  if (!activeOrder) return null;

  return (
    <View style={styles.activeOrderPanel}>
      <View style={styles.activeOrderHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.activeOrderTitle}>Активна поръчка</Text>
          <Text style={styles.activeOrderDescription}>{activeOrder.description}</Text>
          <Text style={styles.activeOrderAddress}>📍 {activeOrder.location.address}</Text>
          {activeOrder.destinationLocation?.address && (
            <Text style={styles.activeOrderDestination}>🏁 До: {activeOrder.destinationLocation.address}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.phoneButton} onPress={onCall}>
          <Ionicons name="call" size={20} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.activeOrderActions}>
        <TouchableOpacity style={styles.navigationButton} onPress={onNavigate}>
          <Ionicons name="navigate" size={20} color={colors.textOnPrimary} />
          <Text style={styles.actionButtonText}>Навигация</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.completeButton} onPress={onComplete}>
          <Ionicons name="checkmark-circle" size={20} color={colors.textOnPrimary} />
          <Text style={styles.actionButtonText}>Приключи</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
} 