import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { CustomModal as CustomModalType } from '../../types/shared';

interface CustomModalProps {
  modal: CustomModalType;
  onRequestClose: () => void;
}

export default function CustomModal({ modal, onRequestClose }: CustomModalProps) {
  return (
    <Modal
      visible={modal.visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={modal.icon as any} 
              size={64} 
              color={modal.iconColor} 
            />
          </View>
          
          <Text style={styles.title}>{modal.title}</Text>
          <Text style={styles.message}>{modal.message}</Text>
          
          <View style={styles.buttons}>
            {modal.buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  {
                    backgroundColor: button.style === 'destructive' 
                      ? colors.error 
                      : colors.primary,
                  }
                ]}
                onPress={button.onPress}
              >
                <Text style={styles.buttonText}>{button.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  buttons: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 