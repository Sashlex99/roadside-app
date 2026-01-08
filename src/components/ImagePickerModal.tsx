import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

interface ImagePickerModalProps {
  visible: boolean;
  title: string;
  onCamera: () => void;
  onGallery: () => void;
  onCancel: () => void;
}

export default function ImagePickerModal({
  visible,
  title,
  onCamera,
  onGallery,
  onCancel
}: ImagePickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Как искате да добавите снимката?</Text>
          
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[styles.option, styles.cameraOption]}
              onPress={onCamera}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="camera" size={40} color={colors.primary} />
              </View>
              <Text style={styles.optionText}>Камера</Text>
              <Text style={styles.optionSubtext}>Направи нова снимка</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.option, styles.galleryOption]}
              onPress={onGallery}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="images" size={40} color={colors.success} />
              </View>
              <Text style={styles.optionText}>Галерия</Text>
              <Text style={styles.optionSubtext}>Избери от телефона</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
          >
            <Text style={styles.cancelText}>Отказ</Text>
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
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 30,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 35,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 35,
    gap: 15,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    padding: 25,
    borderRadius: 20,
    borderWidth: 2,
    minHeight: 140,
    justifyContent: 'center',
  },
  cameraOption: {
    backgroundColor: `${colors.primary}08`,
    borderColor: colors.primary,
  },
  galleryOption: {
    backgroundColor: `${colors.success}08`,
    borderColor: colors.success,
  },
  iconContainer: {
    marginBottom: 15,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  optionSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  cancelButton: {
    backgroundColor: colors.border,
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
}); 