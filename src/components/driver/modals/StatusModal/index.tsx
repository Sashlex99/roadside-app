import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';

interface StatusModalProps {
  visible: boolean;
  onClose: () => void;
  isOnline: boolean;
  statusMessage: string;
}

export default function StatusModal({
  visible,
  onClose,
  isOnline,
  statusMessage,
}: StatusModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={isOnline ? "checkmark-circle" : "pause-circle"} 
              size={64} 
              color={isOnline ? '#10B981' : '#9CA3AF'} 
            />
          </View>
          
          <Text style={styles.title}>
            {isOnline ? 'Онлайн статус' : 'Офлайн статус'}
          </Text>
          
          <Text style={styles.message}>
            {statusMessage}
          </Text>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: isOnline ? '#10B981' : colors.primary }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Разбрах</Text>
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
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 