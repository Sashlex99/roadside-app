import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Text,
  Alert,
  Keyboard,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { createOrder, updateOrderStatus, cancelOrder } from '../../../../services/firestore';
import { convertImageToBase64 } from '../../../../services/imageHelpers';
import { checkNetworkConnectivity } from '../../../../utils/networkUtils';
import { OrderStatus } from '../../../../types/firestore';
import { LocationData, CustomModal as CustomModalType } from '../../../../types/shared';
import { useManagedTimeout, useAbortController } from '../../../../hooks/shared/memoryManagement';

const { width } = Dimensions.get('window');

interface RequestModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  token: string | null;
  location: LocationData | null;
  activeOrder: any;
  setCustomModal: React.Dispatch<React.SetStateAction<CustomModalType>>;
}

export default function RequestModal({
  visible,
  onClose,
  user,
  token,
  location,
  activeOrder,
  setCustomModal
}: RequestModalProps) {
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationCoords, setDestinationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [buttonPressed, setButtonPressed] = useState(false);
  
  // Enhanced duplicate prevention
  const lastSubmissionRef = useRef<{ time: number; data: string } | null>(null);
  const submissionInProgressRef = useRef(false);

  // ✅ ENHANCED: Use utility hooks for better resource management
  const timeoutManager = useManagedTimeout();
  const abortControllerManager = useAbortController();

  // ✅ ENHANCED: No need for manual cleanup - utility hooks handle it automatically

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: false, // We'll process with helper function
    });

    if (!result.canceled && result.assets[0]) {
      try {
        // Use helper function for better compression
        const compressedBase64 = await convertImageToBase64(result.assets[0].uri);
        setSelectedImage(compressedBase64);
      } catch (error) {
        console.error('Error processing image:', error);
        // Fallback to direct URI if processing fails
        setSelectedImage(result.assets[0].uri);
      }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setCustomModal({
        visible: true,
        title: 'Грешка',
        message: 'Необходим е достъп до камерата',
        icon: 'camera-outline',
        iconColor: colors.error,
        buttons: [{
          text: 'Разбрах',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        }]
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.6,
      base64: false, // We'll process with helper function
    });

    if (!result.canceled && result.assets[0]) {
      try {
        // Use helper function for better compression
        const compressedBase64 = await convertImageToBase64(result.assets[0].uri);
        setSelectedImage(compressedBase64);
      } catch (error) {
        console.error('Error processing image:', error);
        // Fallback to direct URI if processing fails
        setSelectedImage(result.assets[0].uri);
      }
    }
  };

  const showImageOptions = () => {
    setCustomModal({
      visible: true,
      title: 'Изберете снимка',
      message: 'Как искате да добавите снимка?',
      icon: 'camera-outline',
      iconColor: colors.primary,
      buttons: [
        {
          text: 'Направи снимка',
          onPress: () => {
            setCustomModal(prev => ({ ...prev, visible: false }));
            // ✅ ENHANCED: Use managed timeout for automatic cleanup
            timeoutManager.setManagedTimeout(() => {
              takePhoto();
            }, 300, 'image-action-camera');
          }
        },
        {
          text: 'Избери от галерия',
          onPress: () => {
            setCustomModal(prev => ({ ...prev, visible: false }));
            // ✅ ENHANCED: Use managed timeout for automatic cleanup
            timeoutManager.setManagedTimeout(() => {
              pickImage();
            }, 300, 'image-action-gallery');
          }
        },
        {
          text: 'Отказ',
          style: 'default',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        }
      ]
    });
  };

  const handleSubmitRequest = async () => {
    console.log('🔄 [RequestModal] handleSubmitRequest called');
    
    // ✅ IMMEDIATE DUPLICATE PREVENTION - Use ref for instant protection
    if (submissionInProgressRef.current) {
      console.log('⚠️ [RequestModal] Submission already in progress - ignoring duplicate tap');
      return;
    }
    
    // Set immediate protection and visual feedback
    submissionInProgressRef.current = true;
    setButtonPressed(true);
    
    try {
      // ✅ Enhanced keyboard dismiss to prevent double-tap issue
      Keyboard.dismiss();
      
      // Add a small delay to ensure keyboard is fully dismissed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('✅ [RequestModal] Keyboard dismissed, proceeding with validation');
      
      if (!location || !description.trim()) {
        Alert.alert('Грешка', 'Моля попълнете всички задължителни полета');
        return;
      }

      // ✅ DATA-BASED DUPLICATE DETECTION
      const currentRequestData = JSON.stringify({
        description: description.trim(),
        location: {
          lat: Math.round(location.latitude * 10000) / 10000, // Round to avoid floating point issues
          lng: Math.round(location.longitude * 10000) / 10000
        },
        destination: destinationAddress.trim(),
        image: selectedImage ? 'has_image' : 'no_image'
      });
      
      const now = Date.now();
      const lastSubmission = lastSubmissionRef.current;
      
      // Check for duplicate within 10 seconds with same data
      if (lastSubmission && 
          (now - lastSubmission.time) < 10000 && 
          lastSubmission.data === currentRequestData) {
        console.log('⚠️ [RequestModal] Duplicate request detected - same data within 10 seconds');
        Alert.alert('Информация', 'Заявката вече е изпратена. Моля изчакайте обработката.');
        return;
      }
      
      // Record current submission
      lastSubmissionRef.current = { time: now, data: currentRequestData };

      // Check if user already has an active order
      if (activeOrder) {
        setCustomModal({
          visible: true,
          title: 'Активна заявка',
          message: 'Вече имате активна заявка. Искате ли да я отмените и да създадете нова?',
          icon: 'warning-outline',
          iconColor: colors.error,
          buttons: [
            {
              text: 'Не',
              onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
            },
            {
              text: 'Да, отмени старата',
              style: 'destructive',
              onPress: async () => {
                setCustomModal(prev => ({ ...prev, visible: false }));
                try {
                  // Cancel existing order first
                  await cancelOrder(activeOrder.id);
                  // ✅ ENHANCED: Then proceed with creating new order using managed timeout
                  timeoutManager.setManagedTimeout(() => {
                    proceedWithOrderCreation();
                  }, 500, 'order-creation-retry');
                } catch (error) {
                  console.error('Error cancelling existing order:', error);
                  Alert.alert('Грешка', 'Не успяхме да отменим старата заявка');
                }
              }
            }
          ]
        });
        return;
      }

      await proceedWithOrderCreation();
      
    } finally {
      // Always reset protection flags
      submissionInProgressRef.current = false;
      setButtonPressed(false);
    }
  };

  const proceedWithOrderCreation = async () => {
    if (!user || !location) return;

    setSubmitting(true);

    try {
      // Check network connectivity before attempting order creation
      console.log('🔍 [ORDER_CREATE] Checking network connectivity...');
      const networkStatus = await checkNetworkConnectivity();
      
      if (!networkStatus.isConnected) {
        console.log('❌ [ORDER_CREATE] No network connection detected');
        setCustomModal({
          visible: true,
          title: '🌐 Няма интернет връзка',
          message: 'Моля проверете интернет връзката си и опитайте отново.',
          icon: 'wifi-outline',
          iconColor: colors.error,
          buttons: [{
            text: 'Разбрах',
            onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
          }]
        });
        return;
      }
      
      console.log('✅ [ORDER_CREATE] Network connectivity confirmed');

      // Complete orderData with all required fields from Order type
      const baseOrderData = {
        clientId: user.uid,
        clientInfo: {
          name: user.fullName || 'Неизвестен клиент',
          phone: user.phone || ''
        },
        description: description.trim(),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
        },
        images: selectedImage ? [selectedImage] : [],
        // Add required search parameters
        status: 'pending' as OrderStatus,
        searchRadius: 5, // Start with 5km radius
        maxRadius: 50, // Maximum 50km radius
        // Dates will be set by service layer (createdAt, updatedAt, expiresAt)
      };

      // Add destinationLocation if address exists (with or without coordinates)
      const orderData = destinationAddress.trim() ? {
        ...baseOrderData,
        destinationLocation: {
          latitude: destinationCoords?.latitude || 0,
          longitude: destinationCoords?.longitude || 0,
          address: destinationAddress.trim()
        }
      } : baseOrderData;

      console.log('🚀 [ORDER_CREATE] Starting order creation process...');
      console.log('🚀 [ORDER_CREATE] Order data:', JSON.stringify(orderData, null, 2));
      console.log('🚀 [ORDER_CREATE] User ID:', user.uid);
      console.log('🚀 [ORDER_CREATE] Auth token available:', !!token);

      // ✅ ENHANCED: Use managed AbortController for proper cleanup
      const controllerId = abortControllerManager.createController('order-creation');
      const controller = abortControllerManager.getController(controllerId);
      
      if (!controller) {
        throw new Error('Failed to create abort controller');
      }

      const startTime = Date.now();
      console.log('🚀 [ORDER_CREATE] Calling createOrder at:', new Date().toISOString());
      
      let orderId: string;
      
      try {
        // Create order promise with abort support
        const createOrderPromise = createOrder(orderData, { signal: controller.signal }).then(id => {
          const elapsed = Date.now() - startTime;
          console.log('✅ [ORDER_CREATE] SUCCESS after', elapsed, 'ms, Order ID:', id);
          return id;
        }).catch(error => {
          const elapsed = Date.now() - startTime;
          console.log('❌ [ORDER_CREATE] FAILED after', elapsed, 'ms, Error:', error);
          throw error;
        });

        // Timeout promise that aborts the operation
        // Store timeoutId outside promise so we can clear it after success
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            if (!controller.signal.aborted) {
              controller.abort(); // Cancel the createOrder operation
              const elapsed = Date.now() - startTime;
              console.log('⏰ [ORDER_CREATE] TIMEOUT after', elapsed, 'ms - operation aborted');
              reject(new Error(`Заявката отне твърде много време (${Math.round(elapsed/1000)}s). Операцията е прекъсната.`));
            }
          }, 45000); // 45 seconds timeout

          // Listen for abort signal to cleanup timeout
          controller.signal.addEventListener('abort', () => {
            if (timeoutId) clearTimeout(timeoutId);
          });
        });

        // Check if operation was aborted before starting
        if (controller.signal.aborted) {
          throw new Error('Operation was aborted');
        }

        try {
          orderId = await Promise.race([
            createOrderPromise,
            timeoutPromise
          ]);
        } finally {
          // Always clear timeout after Promise.race completes (success or failure)
          if (timeoutId) {
            clearTimeout(timeoutId);
            console.log('🧹 [ORDER_CREATE] Timeout cleared after race completed');
          }
        }

      } catch (error) {
        const elapsed = Date.now() - startTime;
        console.log('❌ [ORDER_CREATE] Final error after', elapsed, 'ms:', error);
        
        // Simplified fallback detection
        if (error instanceof Error && error.message.includes('твърде много време')) {
          console.log('⏰ [ORDER_CREATE] Timeout occurred, waiting for potential order creation...');
          
          // Wait a bit for real-time listener to pick up the order
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check if order was created via real-time listener
          if (activeOrder && activeOrder.clientId === user.uid) {
            const orderAge = Date.now() - (activeOrder.createdAt?.getTime() || 0);
            
            if (orderAge < 120000) { // Created in last 2 minutes
              console.log('✅ [ORDER_CREATE] Order was created despite timeout!', activeOrder.id);
              
              // Success! Close modal and show success
              resetForm();
              onClose();
              
              setCustomModal({
                visible: true,
                title: '✅ Заявката е създадена!',
                message: 'Заявката е създадена успешно, въпреки забавянето.',
                icon: 'checkmark-circle',
                iconColor: '#10B981',
                buttons: [{
                  text: 'Добре',
                  onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
                }]
              });
              return; // Don't throw error
            }
          }
        }
        
        throw error;
      }

      // Verify order was actually created in Firebase before showing success
      console.log('🔍 [ORDER_CREATE] Verifying order creation in Firebase...');
      let orderCreated = false;
      let verificationAttempts = 0;
      const maxVerificationAttempts = 3;

      while (!orderCreated && verificationAttempts < maxVerificationAttempts) {
        verificationAttempts++;
        console.log(`🔍 [ORDER_CREATE] Verification attempt ${verificationAttempts}/${maxVerificationAttempts}...`);
        
        try {
          // Check via real-time listener first (fastest)
          if (activeOrder && activeOrder.id === orderId) {
            console.log('✅ [ORDER_CREATE] Order verified via real-time listener');
            orderCreated = true;
            break;
          }
          
          // Fallback: Direct Firebase query
          const { getOrder } = await import('../../../../services/firestore');
          const orderFromFirebase = await getOrder(orderId);
          
          if (orderFromFirebase && orderFromFirebase.id === orderId) {
            console.log('✅ [ORDER_CREATE] Order verified via direct Firebase query');
            orderCreated = true;
            break;
          }
          
          // Wait before retry
          if (verificationAttempts < maxVerificationAttempts) {
            console.log('⏳ [ORDER_CREATE] Order not yet visible, waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (verificationError) {
          console.warn(`❌ [ORDER_CREATE] Verification attempt ${verificationAttempts} failed:`, verificationError);
          
          if (verificationAttempts < maxVerificationAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      if (!orderCreated) {
        console.error('❌ [ORDER_CREATE] Could not verify order creation in Firebase after', maxVerificationAttempts, 'attempts');
        throw new Error('Заявката е създадена, но не можем да я потвърдим. Моля проверете вашите заявки.');
      }

      // Success - order verified in Firebase
      console.log('🎉 [ORDER_CREATE] Order successfully created and verified!');
      setCustomModal({
        visible: true,
        title: 'Успех',
        message: 'Вашата заявка е изпратена успешно!',
        icon: 'checkmark-circle',
        iconColor: '#10B981',
        buttons: [{
          text: 'Добре',
          onPress: () => {
            setCustomModal(prev => ({ ...prev, visible: false }));
            resetForm();
            onClose();
            console.log('Order created with ID:', orderId);
          }
        }]
      });

    } catch (error) {
      console.error('Failed to create order:', error);
      
      // Force close request modal in case of error
      onClose();
      
      // Better error messages based on error type
      let errorMessage = 'Не можахме да изпратим заявката. Моля опитайте отново.';
      let errorTitle = 'Грешка';
      
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('connectivity')) {
          errorTitle = '🌐 Проблем с мрежата';
          errorMessage = 'Има проблем с интернет връзката. Моля проверете връзката си и опитайте отново.';
        } else if (error.message.includes('timeout') || error.message.includes('твърде много време')) {
          errorTitle = '⏰ Заявката отне твърде много време';
          errorMessage = 'Заявката отне повече време от очакваното. Моля проверете дали не се е създала в секцията "Активни заявки".';
        } else if (error.message.includes('потвърдим')) {
          errorTitle = '⚠️ Потвърждение на заявката';
          errorMessage = error.message;
        }
      }
      
      setCustomModal({
        visible: true,
        title: errorTitle,
        message: errorMessage,
        icon: 'warning-outline',
        iconColor: colors.error,
        buttons: [{
          text: 'Разбрах',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        }]
      });
    } finally {
      setSubmitting(false);
      // ✅ ENHANCED: Cleanup handled automatically by abortControllerManager
      console.log('🧹 [RequestModal] Order creation cleanup completed');
    }
  };

  const resetForm = () => {
    setDescription('');
    setDestinationAddress('');
    setDestinationCoords(null);
    setSelectedImage(null);
    
    // ✅ Reset duplicate prevention on form reset
    lastSubmissionRef.current = null;
    submissionInProgressRef.current = false;
    setButtonPressed(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Нова заявка за помощ</Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Location Info */}
            <View style={styles.modalLocationInfo}>
              <Ionicons name="location" size={20} color={colors.primary} />
              <View style={styles.locationTexts}>
                <Text style={styles.modalLocationAddress}>{location?.address || 'Неизвестен адрес'}</Text>
                <Text style={styles.modalLocationCoords}>
                  {location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'Няма координати'}
                </Text>
              </View>
            </View>

            {/* Description Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Опишете проблема</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Например: Спукана гума, изтощен акумулатор, заключени ключове..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
              />
            </View>

            {/* Destination Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Краен адрес</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Напр. бул. Витоша 1, София или до дома"
                placeholderTextColor={colors.textSecondary}
                value={destinationAddress}
                onChangeText={(text) => {
                  setDestinationAddress(text);
                  setDestinationCoords(null);
                }}
                returnKeyType="done"
                onSubmitEditing={async () => {
                  if (!destinationAddress.trim()) return;
                  
                  try {
                    // Use enhanced geocoding service with circuit breaker protection
                    const { geocodeAddress } = await import('../../../../services/locationService');
                    const result = await geocodeAddress(destinationAddress);
                    
                    if (result) {
                      setDestinationCoords({ latitude: result.latitude, longitude: result.longitude });
                      if (__DEV__) console.log('✅ Enhanced auto-geocoded:', destinationAddress);
                    } else {
                      if (__DEV__) console.log('ℹ️ No geocoding results found for:', destinationAddress);
                    }
                  } catch (e) {
                    if (__DEV__) console.log('ℹ️ Enhanced auto-geocoding failed gracefully:', e);
                    // Graceful fallback - user can still manually enter coordinates if needed
                  }
                }}
              />
              {destinationCoords && (
                <View style={styles.destinationSuccess}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.destinationCoordsText}>
                    ✓ Адресът е разпознат автоматично
                  </Text>
                </View>
              )}
            </View>

            {/* Image Section */}
            <View style={styles.imageSection}>
              <Text style={styles.inputLabel}>Снимка (по желание)</Text>
              {selectedImage ? (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setSelectedImage(null)}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.addImageButton} onPress={showImageOptions}>
                  <Ionicons name="camera-outline" size={32} color={colors.primary} />
                  <Text style={styles.addImageText}>Добави снимка</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* Submit Button - Outside ScrollView for better accessibility */}
          <TouchableOpacity
            style={[
              styles.submitButton, 
              (submitting || buttonPressed) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmitRequest}
            disabled={submitting || buttonPressed}
            activeOpacity={0.7}
          >
            {(submitting || buttonPressed) ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="send" size={20} color={colors.textOnPrimary} />
                <Text style={styles.submitButtonText}>ИЗПРАТИ ЗАЯВКА</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    maxHeight: '85%',
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  modalLocationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  locationTexts: {
    flex: 1,
    marginLeft: 12,
  },
  modalLocationAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  modalLocationCoords: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  destinationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  destinationCoordsText: {
    fontSize: 12,
    color: colors.success,
    marginLeft: 4,
    fontWeight: '500',
  },
  imageSection: {
    marginBottom: 24,
  },
  addImageButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    marginTop: 8,
    fontSize: 16,
    color: colors.primary,
  },
  imagePreview: {
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  submitButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 