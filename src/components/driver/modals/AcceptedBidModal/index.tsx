import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { getUser } from '../../../../services/firestore';

interface AcceptedBidModalProps {
  visible: boolean;
  onClose: () => void;
  acceptedBid: any;
  acceptedOrder: any;
}

export default function AcceptedBidModal({
  visible,
  onClose,
  acceptedBid,
  acceptedOrder,
}: AcceptedBidModalProps) {

  const openGoogleMaps = () => {
    // Use client location from accepted order, not driver location
    const lat = acceptedOrder?.location?.latitude;
    const lng = acceptedOrder?.location?.longitude;
    if (lat && lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Грешка', 'Не можахме да отворим Google Maps');
      });
    }
  };

  const makePhoneCall = () => {
    // Debug: Log the accepted order structure
    console.log('makePhoneCall - acceptedOrder:', acceptedOrder);
    console.log('makePhoneCall - acceptedBid:', acceptedBid);
    
    // Try different possible paths for the phone number
    const phoneFromOrder = acceptedOrder?.clientInfo?.phone;
    const phoneFromBid = acceptedBid?.orderInfo?.clientInfo?.phone;
    const phoneFromBidClient = acceptedBid?.clientInfo?.phone;
    
    console.log('Phone from order:', `"${phoneFromOrder}"`);
    console.log('Phone from bid (orderInfo):', `"${phoneFromBid}"`);
    console.log('Phone from bid (direct):', `"${phoneFromBidClient}"`);
    
    // Check if phone is just empty string
    console.log('Phone from order length:', phoneFromOrder?.length);
    console.log('Phone from order trimmed:', phoneFromOrder?.trim());
    
    // Find first non-empty phone number
    const phoneNumber = [phoneFromOrder, phoneFromBid, phoneFromBidClient]
      .find(phone => phone && phone.trim() !== '');
    
    if (!phoneNumber) {
      console.log('No valid phone number found, attempting to fetch user profile');
      if (acceptedOrder?.clientId) {
        getUser(acceptedOrder.clientId).then(profile => {
          if (profile?.phone) {
            Linking.openURL(`tel:${profile.phone}`).catch(() => {
              Alert.alert('Грешка', 'Не можахме да отворим приложението за телефон');
            });
          } else {
            Alert.alert('Грешка', 'Клиентът няма добавен телефонен номер');
          }
        });
      } else {
        Alert.alert('Грешка', 'Клиентът няма добавен телефонен номер или номерът е празен.');
      }
      return;
    }
    
    console.log('Making call to:', phoneNumber);
    Linking.openURL(`tel:${phoneNumber}`).catch((error) => {
      console.error('Failed to make call:', error);
      Alert.alert('Грешка', 'Не можахме да отворим приложението за телефон');
    });
  };

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
              name="checkmark-circle" 
              size={64} 
              color="#10B981" 
            />
          </View>
          
          <Text style={styles.title}>
            Офертата Ви е приета!
          </Text>
          
          <Text style={styles.message}>
            Клиентът одобри вашата оферта. Можете да започнете навигация към неговото местоположение.
          </Text>
          
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                onClose();
                openGoogleMaps();
              }}
            >
              <Ionicons name="navigate" size={24} color={colors.textOnPrimary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                onClose();
                makePhoneCall();
              }}
            >
              <Ionicons name="call" size={24} color={colors.textOnPrimary} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.textSecondary, marginTop: 16 }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>ПО-КЪСНО</Text>
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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