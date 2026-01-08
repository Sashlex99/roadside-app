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
        console.log('dY"? [LoginScreen] Found saved credentials for:', savedEmail);
        
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
        
        // Attempt auto-login if credentials are saved
        console.log('dYs? [LoginScreen] Attempting auto-login...');
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
        console.log('dY"? [LoginScreen] No saved credentials found');
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
          console.error('âŒ [LoginScreen] Error saving credentials:', error);
        });
        AsyncStorage.setItem('rememberMe', 'true').catch(error => {
          console.error('âŒ [LoginScreen] Error saving remember me:', error);
        });
        console.log('ðŸ’¾ [LoginScreen] Credentials saved for future auto-login');
      } else {
        // Clear credentials in background (non-blocking)
        AsyncStorage.removeItem('savedCredentials').catch(error => {
          console.error('âŒ [LoginScreen] Error clearing credentials:', error);
        });
        AsyncStorage.setItem('rememberMe', 'false').catch(error => {
          console.error('âŒ [LoginScreen] Error saving remember me:', error);
        });
        console.log('ðŸ—‘ï¸ [LoginScreen] Credentials cleared (remember me disabled)');
      }
    } catch (error) {
      console.error('âŒ [LoginScreen] Error in saveCredentials:', error);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Ð“Ñ€ÐµÑˆÐºÐ°', 'ÐœÐ¾Ð»Ñ, Ð¿Ð¾Ð¿ÑŠÐ»Ð½ÐµÑ‚Ðµ Ð²ÑÐ¸Ñ‡ÐºÐ¸ Ð¿Ð¾Ð»ÐµÑ‚Ð°', 'error');
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
            'Ð§Ð°ÐºÐ° Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½Ð¸Ðµ', 
            'Ð’Ð°ÑˆÐ°Ñ‚Ð° Ñ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð°Ñ†Ð¸Ñ Ðµ Ð¿Ð¾Ð»ÑƒÑ‡ÐµÐ½Ð° Ð¸ ÑÐµ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÑÐ²Ð° Ð¾Ñ‚ Ð°Ð´Ð¼Ð¸Ð½Ð¸ÑÑ‚Ñ€Ð°Ñ‚Ð¾Ñ€. Ð©Ðµ Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚Ðµ Ð¸Ð·Ð²ÐµÑÑ‚Ð¸Ðµ ÐºÐ¾Ð³Ð°Ñ‚Ð¾ Ð±ÑŠÐ´Ðµ Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½.',
            'info'
          );
        } else if (user.verificationStatus === 'rejected') {
          showAlert(
            'Ð ÐµÐ³Ð¸ÑÑ‚Ñ€Ð°Ñ†Ð¸ÑÑ‚Ð° Ðµ Ð¾Ñ‚Ñ…Ð²ÑŠÑ€Ð»ÐµÐ½Ð°', 
            'Ð’Ð°ÑˆÐ°Ñ‚Ð° Ñ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð°Ñ†Ð¸Ñ Ðµ Ð¾Ñ‚Ñ…Ð²ÑŠÑ€Ð»ÐµÐ½Ð°. ÐœÐ¾Ð»Ñ, ÑÐ²ÑŠÑ€Ð¶ÐµÑ‚Ðµ ÑÐµ Ñ Ð¿Ð¾Ð´Ð´Ñ€ÑŠÐ¶ÐºÐ°Ñ‚Ð° Ð·Ð° Ð¿Ð¾Ð²ÐµÑ‡Ðµ Ð¸Ð½Ñ„Ð¾Ñ€Ð¼Ð°Ñ†Ð¸Ñ.',
            'error'
          );
        }
        setLoading(false);
        return;
      }
      
      // âœ… Save credentials if remember me is enabled
      await saveCredentials(email, password);
      
      console.log('âœ… [LoginScreen] Manual login successful:', user.uid);
      console.log('âœ… [LoginScreen] User details:', { 
        uid: user.uid, 
        userType: user.userType, 
        verificationStatus: user.verificationStatus 
      });
      // Login successful - navigation will be handled automatically by AuthContext
      // The user state has been updated, so MainNavigator will show the appropriate screen
      
    } catch (error: any) {
      let message = 'Ð“Ñ€ÐµÑˆÐµÐ½ Ð¸Ð¼ÐµÐ¹Ð» Ð¸Ð»Ð¸ Ð¿Ð°Ñ€Ð¾Ð»Ð°';
      
      if (error.message === 'EMAIL_NOT_FOUND') {
        message = 'ÐÐµ ÑÑŠÑ‰ÐµÑÑ‚Ð²ÑƒÐ²Ð° Ð¿Ð¾Ñ‚Ñ€ÐµÐ±Ð¸Ñ‚ÐµÐ» Ñ Ñ‚Ð¾Ð·Ð¸ Ð¸Ð¼ÐµÐ¹Ð»';
      } else if (error.message === 'INVALID_PASSWORD') {
        message = 'Ð“Ñ€ÐµÑˆÐ½Ð° Ð¿Ð°Ñ€Ð¾Ð»Ð°';
      } else if (error.message === 'INVALID_EMAIL') {
        message = 'ÐÐµÐ²Ð°Ð»Ð¸Ð´ÐµÐ½ Ð¸Ð¼ÐµÐ¹Ð» Ð°Ð´Ñ€ÐµÑ';
      } else if (error.message === 'USER_DELETED') {
        message = 'Ð¢Ð¾Ð·Ð¸ Ð°ÐºÐ°ÑƒÐ½Ñ‚ Ðµ Ð¸Ð·Ñ‚Ñ€Ð¸Ñ‚ Ð¾Ñ‚ ÑÐ¸ÑÑ‚ÐµÐ¼Ð°Ñ‚Ð°. Ð—Ð° Ð²ÑŠÐ¿Ñ€Ð¾ÑÐ¸ ÑÐµ ÑÐ²ÑŠÑ€Ð¶ÐµÑ‚Ðµ Ñ Ð¿Ð¾Ð´Ð´Ñ€ÑŠÐ¶ÐºÐ°Ñ‚Ð°.';
      } else if (error.message === 'USER_BANNED') {
        message = 'Ð’Ð°ÑˆÐ¸ÑÑ‚ Ð°ÐºÐ°ÑƒÐ½Ñ‚ Ðµ Ð±Ð»Ð¾ÐºÐ¸Ñ€Ð°Ð½. Ð—Ð° Ð¿Ð¾Ð²ÐµÑ‡Ðµ Ð¸Ð½Ñ„Ð¾Ñ€Ð¼Ð°Ñ†Ð¸Ñ ÑÐµ ÑÐ²ÑŠÑ€Ð¶ÐµÑ‚Ðµ Ñ Ð¿Ð¾Ð´Ð´Ñ€ÑŠÐ¶ÐºÐ°Ñ‚Ð°.';
      }
      
      showAlert('Ð“Ñ€ÐµÑˆÐºÐ°', message, 'error');
      setLoading(false);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>Ð”Ð¾Ð±Ñ€Ðµ Ð´Ð¾ÑˆÐ»Ð¸!</Text>
        <Text style={styles.subtitle}>Ð’Ð»ÐµÐ·Ñ‚Ðµ Ð² Ð¿Ñ€Ð¾Ñ„Ð¸Ð»Ð° ÑÐ¸</Text>

        <TextInput
          style={styles.input}
          placeholder="Ð˜Ð¼ÐµÐ¹Ð»"
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
          placeholder="ÐŸÐ°Ñ€Ð¾Ð»Ð°"
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
          <Text style={styles.rememberMeText}>Ð—Ð°Ð¿Ð¾Ð¼Ð½Ð¸ Ð¼Ðµ</Text>
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
                {!autoLoginAttempted ? 'Ð’Ð»Ð¸Ð·Ð°Ð¼ Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð¸Ñ‡Ð½Ð¾...' : 'Ð’Ð»Ð¸Ð·Ð°Ð¼...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Ð’Ñ…Ð¾Ð´</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>ÐÑÐ¼Ð°Ñ‚Ðµ Ð¿Ñ€Ð¾Ñ„Ð¸Ð»?</Text>
          <TouchableOpacity 
            style={styles.registerButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerButtonText}>Ð ÐµÐ³Ð¸ÑÑ‚Ñ€Ð¸Ñ€Ð°Ð¹Ñ‚Ðµ ÑÐµ</Text>
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




