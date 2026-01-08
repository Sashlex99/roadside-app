import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

interface RequestButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export default function RequestButton({ onPress, disabled = false }: RequestButtonProps) {
  const handlePress = () => {
    if (disabled) {
      console.log('⚠️ [RequestButton] Button is disabled');
      return;
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.requestButton,
        disabled && styles.disabledButton
      ]}
      onPress={handlePress}
      disabled={disabled}
    >
      <Ionicons 
        name="help-circle" 
        size={28} 
        color={disabled ? colors.textSecondary : colors.textOnPrimary} 
      />
      <Text style={[
        styles.requestButtonText,
        disabled && styles.disabledText
      ]}>
        ЗАЯВИ
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  requestButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  requestButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  disabledText: {
    color: colors.textSecondary,
  },
}); 