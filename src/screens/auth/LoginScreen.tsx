import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors } from '../../constants/colors';
import { AuthStackParamList } from '../../navigation/AuthStack';
import CustomAlert from '../../components/CustomAlert';
import { useAuth } from '../../contexts/AuthContext';

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true); // Default to true for better UX
  const [loading, setLoading] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const autoLoginInProgress = useRef(false);
  const { login, logout } = useAuth();

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');

  // Helper function to show custom alert
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  // Load saved credentials and attempt auto-login
  useEffect(() => {
    loadSavedCredentials();
  }, []);
  const loadSavedCredentials = async () => {
    if (autoLoginInProgress.current || autoLoginAttempted) return;
    autoLoginInProgress.current = true;
    try {
      // Use Promise.all to avoid blocking Firebase SDK
      const [savedCredentials, savedRememberMe] = await Promise.all([
        AsyncStorage.getItem('savedCredentials'),
        AsyncStorage.getItem('rememberMe')
      ]);

      if (savedCredentials && savedRememberMe === 'true') {
        const { email: savedEmail, password: savedPassword } = JSON.parse(savedCredentials);
        console.log('[LoginScreen] Found saved credentials for:', savedEmail);

        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);

        // Attempt auto-login if credentials are saved
        console.log('[LoginScreen] Attempting auto-login...');
        setAutoLoginAttempted(true);

        try {
          setLoading(true);
          const user = await login(savedEmail, savedPassword);
          console.log('[LoginScreen] Auto-login successful:', user.uid);
          // Navigation handled by AuthContext
        } catch (autoLoginError) {
          console.log('[LoginScreen] Auto-login failed, user needs to login manually:', autoLoginError);
          // Clear invalid saved credentials (non-blocking)
          AsyncStorage.removeItem('savedCredentials').catch(error => {
            console.error('[LoginScreen] Error clearing invalid credentials:', error);
          });
          setPassword(''); // Clear password for security
        } finally {
          setLoading(false);
        }
      } else {
        console.log('[LoginScreen] No saved credentials found');
        setAutoLoginAttempted(true);
      }
    } catch (error) {
      console.error('[LoginScreen] Error loading saved credentials:', error);
      setAutoLoginAttempted(true);
    } finally {
      autoLoginInProgress.current = false;
    }
  };

  const saveCredentials = async (email: string, password: string) => {
    try {
      if (rememberMe) {
        // Save credentials in background (non-blocking)
        AsyncStorage.setItem('savedCredentials', JSON.stringify({ email, password })).catch(error => {
          console.error('[LoginScreen] Error saving credentials:', error);
        });
        AsyncStorage.setItem('rememberMe', 'true').catch(error => {
          console.error('[LoginScreen] Error saving remember me:', error);
        });
        console.log('[LoginScreen] Credentials saved for future auto-login');
      } else {
        // Clear credentials in background (non-blocking)
        AsyncStorage.removeItem('savedCredentials').catch(error => {
          console.error('[LoginScreen] Error clearing credentials:', error);
        });
        AsyncStorage.setItem('rememberMe', 'false').catch(error => {
          console.error('[LoginScreen] Error saving remember me:', error);
        });
        console.log('[LoginScreen] Credentials cleared (remember me disabled)');
      }
    } catch (error) {
      console.error('[LoginScreen] Error in saveCredentials:', error);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Грешка', 'Моля, попълнете всички полета', 'error');
      return;
    }

    setLoading(true);

    try {
      const user = await login(email, password);

      // Check driver status AFTER successful login
      // For non-approved drivers, we need to logout immediately
      if (user.userType === 'driver' && user.verificationStatus !== 'approved') {
        // Logout the user since they shouldn't have access
        await logout();

        if (user.verificationStatus === 'pending') {
          showAlert(
            'Чака одобрение',
            'Вашата регистрация е получена и се проверява от администратор. Ще получите известие когато бъде одобрена.',
            'info'
          );
        } else if (user.verificationStatus === 'rejected') {
          showAlert(
            'Регистрацията е отхвърлена',
            'Вашата регистрация е отхвърлена. Моля, свържете се с поддръжката за повече информация.',
            'error'
          );
        }
        setLoading(false);
        return;
      }

      // Save credentials if remember me is enabled
      await saveCredentials(email, password);

      console.log('[LoginScreen] Manual login successful:', user.uid);
      console.log('[LoginScreen] User details:', {
        uid: user.uid,
        userType: user.userType,
        verificationStatus: user.verificationStatus
      });
      // Login successful - navigation will be handled automatically by AuthContext
      // The user state has been updated, so MainNavigator will show the appropriate screen

    } catch (error: any) {
      let message = 'Грешен имейл или парола';

      if (error.message === 'EMAIL_NOT_FOUND') {
        message = 'Не съществува потребител с този имейл';
      } else if (error.message === 'INVALID_PASSWORD') {
        message = 'Грешна парола';
      } else if (error.message === 'INVALID_EMAIL') {
        message = 'Невалиден имейл адрес';
      } else if (error.message === 'USER_DELETED') {
        message = 'Този акаунт е изтрит от системата. За въпроси се свържете с поддръжката.';
      } else if (error.message === 'USER_BANNED') {
        message = 'Вашият акаунт е блокиран. За повече информация се свържете с поддръжката.';
      }

      showAlert('Грешка', message, 'error');
      setLoading(false);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>Добре дошли!</Text>
        <Text style={styles.subtitle}>Влезте в профила си</Text>

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

        <TextInput
          style={styles.input}
          placeholder="Парола"
          placeholderTextColor={colors.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
        />

        {/* Remember Me Checkbox */}
        <TouchableOpacity
          style={styles.rememberMeContainer}
          onPress={() => setRememberMe(!rememberMe)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
            {rememberMe && (
              <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} />
            )}
          </View>
          <Text style={styles.rememberMeText}>Запомни ме</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading || !autoLoginAttempted}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color={colors.textOnPrimary} size="small" />
              <Text style={[styles.buttonText, { marginLeft: 8, fontSize: 14 }]}>
                {!autoLoginAttempted ? 'Влизам автоматично...' : 'Влизам...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Вход</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>Нямате профил?</Text>
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerButtonText}>Регистрирайте се</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 20,
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
    marginBottom: 40,
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
  registerButton: {
    marginTop: 10,
    paddingHorizontal: 30,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 20,
  },
  registerButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberMeText: {
    fontSize: 16,
    color: colors.text,
  },
});
