import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/colors';
import { signUp, createDocument } from '../../services/firebaseAPI';
import { sendSMSVerificationCode, verifySMSCode } from '../../services/smsService';
import { convertImagesToBase64 } from '../../services/imageHelpers';
import { AuthStackParamList } from '../../navigation/AuthStack';
import CustomAlert from '../../components/CustomAlert';
import ImagePickerModal from '../../components/ImagePickerModal';
import { developmentConfig } from '../../config/environment';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;
type UserType = 'client' | 'driver';

interface Props {
  navigation: RegisterScreenNavigationProp;
}

export default function RegisterScreen({ navigation }: Props) {
  const [userType, setUserType] = useState<UserType>('client');
  const [loading, setLoading] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showVerificationCode, setShowVerificationCode] = useState(false);

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');

  // Image picker states
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [currentImageType, setCurrentImageType] = useState<'roadsideAssistance' | 'iaala' | 'driverPhoto'>('roadsideAssistance');

  // Основни полета
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Шофьорски полета
  const [companyName, setCompanyName] = useState('');
  const [companyBulstat, setCompanyBulstat] = useState('');
  const [roadsideAssistanceCert, setRoadsideAssistanceCert] = useState<string | null>(null);
  const [iaalaLicense, setIaalaLicense] = useState<string | null>(null);
  const [driverPhoto, setDriverPhoto] = useState<string | null>(null);

  // Helper function to show custom alert
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  const pickImage = async (type: 'roadsideAssistance' | 'iaala' | 'driverPhoto') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Грешка', 'Нужно е разрешение за достъп до галерията', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      switch (type) {
        case 'roadsideAssistance':
          setRoadsideAssistanceCert(imageUri);
          break;
        case 'iaala':
          setIaalaLicense(imageUri);
          break;
        case 'driverPhoto':
          setDriverPhoto(imageUri);
          break;
      }
    }
    setImagePickerVisible(false);
  };

  const takePhoto = async (type: 'roadsideAssistance' | 'iaala' | 'driverPhoto') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Грешка', 'Нужно е разрешение за достъп до камерата', 'error');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      switch (type) {
        case 'roadsideAssistance':
          setRoadsideAssistanceCert(imageUri);
          break;
        case 'iaala':
          setIaalaLicense(imageUri);
          break;
        case 'driverPhoto':
          setDriverPhoto(imageUri);
          break;
      }
    }
    setImagePickerVisible(false);
  };

  const showImagePicker = (type: 'roadsideAssistance' | 'iaala' | 'driverPhoto') => {
    setCurrentImageType(type);
    setImagePickerVisible(true);
  };

  const sendVerificationCode = async () => {
    if (!phone || phone.length < 9) {
      showAlert('Грешка', 'Моля, въведете валиден телефонен номер (поне 9 цифри)', 'error');
      return;
    }

    setVerifyingPhone(true);
    
    try {
      await sendSMSVerificationCode(phone);
      setShowVerificationCode(true);
      showAlert(
        'Код изпратен', 
        `Изпратихме верификационен код на ${phone}.\n\n📱 DEMO режим: Проверете терминала за кода.`,
        'success'
      );
    } catch (error: any) {
      showAlert('Грешка', error.message, 'error');
    }
    
    setVerifyingPhone(false);
  };

  const verifyPhoneCodeHandler = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showAlert('Грешка', 'Моля, въведете 6-цифрения код', 'error');
      return;
    }

    setVerifyingPhone(true);

    try {
      await verifySMSCode(phone, verificationCode);
      setPhoneVerified(true);
      setShowVerificationCode(false);
      showAlert('Успех', 'Телефонният номер е верифициран!', 'success');
    } catch (error: any) {
      showAlert('Грешка', error.message, 'error');
    }

    setVerifyingPhone(false);
  };

  const handleRegister = async () => {
    if (!email || !password || !fullName || !phone) {
      showAlert('Грешка', 'Моля, попълнете всички основни полета', 'error');
      return;
    }

    if (!phoneVerified && !developmentConfig.bypassPhoneVerification) {
      showAlert('Грешка', 'Моля, верифицирайте телефонния си номер', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Грешка', 'Паролите не съвпадат', 'error');
      return;
    }

    if (userType === 'driver') {
      if (!companyName || !companyBulstat) {
        showAlert('Грешка', 'Моля, попълнете данните за фирмата', 'error');
        return;
      }
      if (!roadsideAssistanceCert || !iaalaLicense || !driverPhoto) {
        showAlert('Грешка', 'Моля, качете всички документи и снимка', 'error');
        return;
      }
    }

    setLoading(true);

    try {
      console.log('Starting registration for:', userType);
      const userData = await signUp(email, password);
      console.log('User created successfully:', userData.localId);
      
      let userProfile: any = {
        uid: userData.localId, // 🔥 Add UID field
        email,
        fullName,
        phone,
        phoneVerified: phoneVerified || developmentConfig.bypassPhoneVerification,
        userType,
        role: userType === 'client' ? 'client' : 'driver',
        verificationStatus: userType === 'client' ? 'approved' : 'pending', // 🔥 Add verification status
        createdAt: new Date(),
        updatedAt: new Date(), // 🔥 Add updatedAt field
      };

      if (userType === 'driver') {
        console.log('Processing driver documents...');
        
        // Конвертираме всички изображения към компресирани base64 strings
        console.log('🔄 Converting images to compressed base64...');
        const base64Documents = await convertImagesToBase64({
          roadsideAssistanceCert: roadsideAssistanceCert!,
          iaalaLicense: iaalaLicense!,
          driverPhoto: driverPhoto!,
        });
        
        console.log('✅ All images converted successfully');

        userProfile = {
          ...userProfile,
          companyInfo: {
            name: companyName,
            bulstat: companyBulstat,
          },
          documents: base64Documents, // Сега са компресирани base64 strings
          status: 'pending',
          verificationStatus: 'pending',
          verificationDate: null,
          verificationNotes: null,
          verifiedBy: null,
        };
      }

      console.log('Complete user profile:', JSON.stringify(userProfile, null, 2));
      console.log('Creating user document in Firestore with UID:', userData.localId);
      
      // 🔥 CRITICAL FIX: Use Firebase Auth UID as document ID
      await createDocument('users', userProfile, userData.idToken, userData.localId);
      console.log('User document created successfully with ID:', userData.localId);
      
      showAlert(
        'Успех', 
        userType === 'driver' 
          ? 'Регистрацията е изпратена за проверка. Ще получите имейл когато бъде одобрена.'
          : 'Успешна регистрация! Можете да влезете в профила си.',
        'success'
      );
      
      // Navigate after a short delay to let user see the success message
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);
      
    } catch (error: any) {
      console.log('Registration error:', error);
      
      let message = 'Възникна грешка при регистрацията';
      
      // Firebase REST API връща грешките в error.error.message или error.message
      const errorCode = error?.error?.message || error?.message || error?.code;
      
      if (errorCode === 'EMAIL_EXISTS') {
        message = 'Потребител с този имейл вече съществува';
      } else if (errorCode === 'WEAK_PASSWORD') {
        message = 'Паролата трябва да е поне 6 символа';
      } else if (errorCode === 'INVALID_EMAIL') {
        message = 'Невалиден имейл адрес';
      } else if (error?.error?.details) {
        // Ако има по-детайлна информация за грешката
        console.log('Error details:', error.error.details);
        message = 'Грешка: ' + JSON.stringify(error.error.details);
      }
      
      showAlert('Грешка', message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderUserTypeSelector = () => (
    <View style={styles.userTypeContainer}>
      <TouchableOpacity
        style={[styles.userTypeButton, userType === 'client' && styles.userTypeButtonActive]}
        onPress={() => setUserType('client')}
      >
        <Text style={[styles.userTypeText, userType === 'client' && styles.userTypeTextActive]}>
          Клиент
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.userTypeButton, userType === 'driver' && styles.userTypeButtonActive]}
        onPress={() => setUserType('driver')}
      >
        <Text style={[styles.userTypeText, userType === 'driver' && styles.userTypeTextActive]}>
          Шофьор
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderImagePicker = (
    title: string, 
    imageUri: string | null, 
    type: 'roadsideAssistance' | 'iaala' | 'driverPhoto'
  ) => (
    <View style={styles.imagePickerContainer}>
      <Text style={styles.imagePickerLabel}>{title}</Text>
      <TouchableOpacity 
        style={styles.imagePickerButton}
        onPress={() => showImagePicker(type)}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.pickedImage} />
        ) : (
          <Text style={styles.imagePickerText}>Добави снимка</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderDriverFields = () => (
    <>
      <Text style={styles.sectionTitle}>Данни за фирмата</Text>
      <TextInput
        style={styles.input}
        placeholder="Име на фирма"
        placeholderTextColor={colors.placeholder}
        value={companyName}
        onChangeText={setCompanyName}
        autoCapitalize="words"
        textContentType="organizationName"
      />
      <TextInput
        style={styles.input}
        placeholder="Булстат на фирма"
        placeholderTextColor={colors.placeholder}
        value={companyBulstat}
        onChangeText={setCompanyBulstat}
        keyboardType="numeric"
        maxLength={13}
        textContentType="none"
      />

      <Text style={styles.sectionTitle}>Документи</Text>
      {renderImagePicker('Удостоверение за пътна помощ', roadsideAssistanceCert, 'roadsideAssistance')}
      {renderImagePicker('Лиценз от ИААА', iaalaLicense, 'iaala')}
      {renderImagePicker('Снимка на шофьор', driverPhoto, 'driverPhoto')}
    </>
  );

  const getImagePickerTitle = () => {
    switch (currentImageType) {
      case 'roadsideAssistance':
        return 'Удостоверение за пътна помощ';
      case 'iaala':
        return 'Лиценз от ИААА';
      case 'driverPhoto':
        return 'Снимка на шофьор';
      default:
        return 'Избор на снимка';
    }
  };

  const renderBasicFields = () => (
    <>
      <TextInput
        style={styles.input}
        placeholder="Пълно име"
        placeholderTextColor={colors.placeholder}
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
      />

      <TextInput
        style={styles.input}
        placeholder="Имейл"
        placeholderTextColor={colors.placeholder}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="emailAddress"
        autoComplete="email"
      />

      <View style={styles.phoneContainer}>
        <TextInput
          style={[styles.input, styles.phoneInput]}
          placeholder="Телефон"
          placeholderTextColor={colors.placeholder}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
        />
        <TouchableOpacity 
          style={[styles.verifyButton, phoneVerified && styles.verifyButtonSuccess]}
          onPress={sendVerificationCode}
          disabled={verifyingPhone || phoneVerified}
        >
          {verifyingPhone ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.verifyButtonText}>
              {phoneVerified ? '✓' : 'Провери'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      
      {developmentConfig.bypassPhoneVerification && !phoneVerified && (
        <TouchableOpacity 
          style={styles.bypassButton}
          onPress={() => {
            setPhoneVerified(true);
            showAlert('Bypass', 'Телефонната верификация е пропусната (развойна версия)', 'info');
          }}
        >
          <Text style={styles.bypassButtonText}>🔧 Пропусни верификацията (DEV)</Text>
        </TouchableOpacity>
      )}
      
      {!phoneVerified && (
        <Text style={styles.helperText}>
          Пример: 0888123456
          {developmentConfig.bypassPhoneVerification && ' (или използвайте bypass бутона)'}
        </Text>
      )}

      {showVerificationCode && (
        <View style={styles.verificationContainer}>
          <TextInput
            style={styles.input}
            placeholder="Въведете 6-цифрения код"
            placeholderTextColor={colors.placeholder}
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
          />
          <TouchableOpacity 
            style={styles.verifyCodeButton}
            onPress={verifyPhoneCodeHandler}
            disabled={verifyingPhone}
          >
            {verifyingPhone ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.verifyButtonText}>Потвърди код</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Парола"
        placeholderTextColor={colors.placeholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
      />

      <TextInput
        style={styles.input}
        placeholder="Потвърди парола"
        placeholderTextColor={colors.placeholder}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
      />
    </>
  );

  return (
    <>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={50}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <Text style={styles.title}>Регистрация</Text>
        <Text style={styles.subtitle}>Създайте нов профил</Text>

        {renderUserTypeSelector()}

        <Text style={styles.sectionTitle}>Основни данни</Text>
        {renderBasicFields()}

        {userType === 'driver' && renderDriverFields()}

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>Регистрирай се</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>Имате профил?</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Влезте тук</Text>
          </TouchableOpacity>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertVisible(false)}
      />

      <ImagePickerModal
        visible={imagePickerVisible}
        title={getImagePickerTitle()}
        onCamera={() => takePhoto(currentImageType)}
        onGallery={() => pickImage(currentImageType)}
        onCancel={() => setImagePickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  userTypeContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    marginBottom: 30,
    padding: 4,
  },
  userTypeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  userTypeButtonActive: {
    backgroundColor: colors.primary,
  },
  userTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  userTypeTextActive: {
    color: colors.textOnPrimary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 15,
    marginTop: 10,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 15,
  },
  inputVerified: {
    borderColor: colors.success,
    backgroundColor: '#F8FFF8',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  phoneInput: {
    flex: 1,
    marginRight: 10,
    marginBottom: 0,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 0,
  },
  verifyButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  verifiedIcon: {
    backgroundColor: colors.success,
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  verifiedText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  verificationContainer: {
    marginBottom: 15,
  },
  imagePickerContainer: {
    marginBottom: 20,
  },
  imagePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  imagePickerButton: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  pickedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  loginButton: {
    marginTop: 10,
    paddingHorizontal: 30,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 20,
  },
  loginButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  verifyButtonSuccess: {
    backgroundColor: colors.success,
  },
  verifyCodeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 15,
  },
  bypassButton: {
    backgroundColor: colors.warning || '#FFA500',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  bypassButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
}); 