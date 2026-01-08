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
import { CustomModal as CustomModalType } from '../../../../types/shared';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToOrders: () => void;
  onLogout: () => void;
  setCustomModal: React.Dispatch<React.SetStateAction<CustomModalType>>;
  onNavigateToImageTest?: () => void; // Add optional navigation to image test
}

export default function SettingsModal({
  visible,
  onClose,
  onNavigateToOrders,
  onLogout,
  setCustomModal,
  onNavigateToImageTest,
}: SettingsModalProps) {
  
  const handleProfilePress = () => {
    onClose();
    setCustomModal({
      visible: true,
      title: 'Профил',
      message: 'Тук ще отваря профилния екран',
      icon: 'person-outline',
      iconColor: colors.primary,
      buttons: [{
        text: 'Добре',
        onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
      }]
    });
  };

  const handleOrdersPress = () => {
    onClose();
    onNavigateToOrders();
  };

  const handleHelpPress = () => {
    onClose();
    setCustomModal({
      visible: true,
      title: 'Помощ',
      message: 'Тук ще отваря помощния център',
      icon: 'help-circle-outline',
      iconColor: colors.primary,
      buttons: [{
        text: 'Добре',
        onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
      }]
    });
  };

  const handleImageTestPress = () => {
    onClose();
    if (onNavigateToImageTest) {
      onNavigateToImageTest();
    }
  };



  const handleLogoutPress = () => {
    onClose();
    setCustomModal({
      visible: true,
      title: 'Излизане',
      message: 'Сигурни ли сте, че искате да излезете от приложението?',
      icon: 'log-out-outline',
      iconColor: colors.error,
      buttons: [
        {
          text: 'Отказ',
          style: 'default',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        },
        {
          text: 'Излез',
          style: 'destructive',
          onPress: () => {
            setCustomModal(prev => ({ ...prev, visible: false }));
            onLogout();
          }
        }
      ]
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>Настройки</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <TouchableOpacity style={styles.item} onPress={handleProfilePress}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.itemText}>Профил</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.item} onPress={handleOrdersPress}>
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.itemText}>История на заявки</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.item} onPress={handleHelpPress}>
              <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.itemText}>Помощ</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            {onNavigateToImageTest && (
              <TouchableOpacity style={styles.item} onPress={handleImageTestPress}>
                <Ionicons name="camera-outline" size={20} color={colors.primary} />
                <Text style={styles.itemText}>Тест на снимки</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}



            <View style={styles.divider} />

            <TouchableOpacity style={[styles.item, styles.logoutItem]} onPress={handleLogoutPress}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={[styles.itemText, { color: colors.error }]}>Излизане</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  panel: {
    width: '75%',
    height: '100%',
    backgroundColor: colors.surface,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  itemText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  logoutItem: {
    backgroundColor: '#FEF2F2',
    borderColor: colors.error,
  },
}); 