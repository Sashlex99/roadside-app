import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

interface FABProps {
  isOnline: boolean;
  pendingOrdersCount: number;
  onPress: () => void;
}

export default function FAB({ isOnline, pendingOrdersCount, onPress }: FABProps) {
  return (
    <TouchableOpacity
      style={[styles.fab, !isOnline && styles.fabDisabled]}
      onPress={onPress}
    >
      <Ionicons name="list" size={24} color={colors.textOnPrimary} />
      {pendingOrdersCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingOrdersCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  fabDisabled: {
    opacity: 0.6,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.textOnPrimary,
    padding: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },
}); 