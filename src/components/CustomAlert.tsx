import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { colors } from '../constants/colors';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  type?: 'success' | 'error' | 'info';
  confirmText?: string;
}

export default function CustomAlert({
  visible,
  title,
  message,
  onClose,
  type = 'info',
  confirmText = 'OK'
}: CustomAlertProps) {
  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return { icon: '✓', color: colors.success };
      case 'error':
        return { icon: '✕', color: colors.error };
      default:
        return { icon: 'ℹ', color: colors.primary };
    }
  };

  const { icon, color } = getIconAndColor();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.iconContainer, { backgroundColor: color }]}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: color }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 30,
    color: 'white',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
}); 