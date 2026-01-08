import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signIn } from '../services/firebaseAPI';
import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { logger } from '../utils/debugLogger';
import { User, FirestoreUserData } from '../types/User';
import { getValidIdToken, refreshTokenWithRetry, clearStoredToken } from '../utils/authToken';
import { checkNetworkConnectivity } from '../utils/networkUtils';

interface AuthContextData {
  user: User | null;
  token: string | null;
  loading: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  forceLogout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  validateOfflineSession: () => Promise<boolean>;
  isOfflineMode: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const authReady = !!token && !!authUserId && user?.uid === authUserId;

  // âœ… FIXED: Add refs to track all timers for proper cleanup
  const profileFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const profileCreateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // âœ… PERFORMANCE: Load cached user data immediately for faster startup
  useEffect(() => {
    const loadCachedUserData = async () => {
      try {
        const cachedUserData = await AsyncStorage.getItem('userProfile');
        if (cachedUserData) {
          const parsedUser = JSON.parse(cachedUserData);
          console.log('âš¡ Loaded cached user data for instant UI');
          setUser(parsedUser);
          // Don't set loading=false yet - let auth listener handle final state
        }
      } catch (error) {
        console.warn('Failed to load cached user data:', error);
      }
    };

    loadCachedUserData();
  }, []);

  // Initialise auth listener (single source of truth)
  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeToken: (() => void) | null = null;
    let isMounted = true;
    let logoutDebounceTimer: NodeJS.Timeout | undefined;
    let lastAuthState = false; // Track last auth state to prevent false logouts
    
    logger.info('AUTH', 'Setting up Firebase auth listeners');
    
    (async () => {
      try {
        const { auth, db } = await import('../config/firebase');

        // Listen for auth state changes
        unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
          if (!isMounted) return; // Prevent state updates after unmount

          logger.authEvent('Auth state changed', { 
            hasUser: !!fbUser, 
            uid: fbUser?.uid,
            email: fbUser?.email
          });
          
          if (isMounted) {
            setAuthUserId(fbUser?.uid || null);
          }
          
          if (fbUser) {
            // âœ… Clear any pending logout timer since we have a valid user
            if (logoutDebounceTimer) {
              clearTimeout(logoutDebounceTimer);
              logoutDebounceTimer = undefined;
            }
            
            lastAuthState = true;
            
            // âœ… PERFORMANCE: Set loading=false immediately, fetch profile in background
            if (isMounted) {
              setLoading(false);
            }

            // Ensure token is available as soon as auth is established
            try {
              const idToken = await fbUser.getIdToken(false);
              if (isMounted && idToken) {
                setToken(idToken);
              }
            } catch (tokenError) {
              console.error('Failed to get ID token during auth change:', tokenError);
            }
            
            // âœ… FIXED: Fetch profile in background with proper cleanup
            profileFetchTimeoutRef.current = setTimeout(async () => {
              if (!isMounted) return;
              
              try {
                const { doc, getDoc } = await import('firebase/firestore');
                const userSnap = await getDoc(doc(db, 'users', fbUser.uid));
                
                if (userSnap.exists()) {
                  const profileData = userSnap.data() as FirestoreUserData;
                  
                  const userProfile: User = {
                    uid: fbUser.uid,
                    email: fbUser.email || '',
                    fullName: profileData?.fullName || '',
                    phone: profileData?.phone,
                    userType: profileData?.userType || 'client',
                    role: profileData?.role || profileData?.userType || 'client',
                    verificationStatus: profileData?.verificationStatus || 'pending',
                    phoneVerified: profileData?.phoneVerified,
                    createdAt: profileData?.createdAt,
                    updatedAt: profileData?.updatedAt,
                  };

                  if (isMounted) {
                    setUser(userProfile);
                  }
                  
                  // Store profile cache (non-blocking)
                  AsyncStorage.setItem('userProfile', JSON.stringify({
                    uid: userProfile.uid,
                    email: userProfile.email,
                    fullName: userProfile.fullName,
                    userType: userProfile.userType,
                  })).catch(error => {
                    console.warn('Failed to store user profile:', error);
                  });
                  
                  console.log('âœ… User profile updated in background');
                } else {
                  console.log('âš ï¸ User profile not found, will create in background');
                  
                  // âœ… FIXED: Create missing profile in background with proper cleanup
                  profileCreateTimeoutRef.current = setTimeout(async () => {
                    if (!isMounted) return;
                    
                    try {
                      const { setDoc } = await import('firebase/firestore');
                      const missingProfile: User = {
                        uid: fbUser.uid,
                        email: fbUser.email || '',
                        fullName: fbUser.displayName || '',
                        phone: '',
                        phoneVerified: false,
                        userType: 'client',
                        role: 'client',
                        verificationStatus: 'approved',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      };
                      
                      await setDoc(doc(db, 'users', fbUser.uid), missingProfile);
                      
                      if (isMounted) {
                        setUser(missingProfile);
                      }

                      // Store created profile (non-blocking)
                      AsyncStorage.setItem('userProfile', JSON.stringify({
                        uid: missingProfile.uid,
                        email: missingProfile.email,
                        fullName: missingProfile.fullName,
                        userType: missingProfile.userType,
                      })).catch(error => {
                        console.warn('Failed to store created profile:', error);
                      });
                      
                      console.log('âœ… Missing profile created in background');
                    } catch (createError) {
                      console.error('âŒ Background profile creation failed:', createError);
                    } finally {
                      // âœ… FIXED: Clear timeout ref after completion
                      profileCreateTimeoutRef.current = null;
                    }
                  }, 100); // Small delay to avoid blocking
                }
              } catch (error) {
                console.error('âŒ Background profile fetch failed:', error);
              } finally {
                // âœ… FIXED: Clear timeout ref after completion
                profileFetchTimeoutRef.current = null;
              }
            }, 50); // Small delay to let UI render first
            
          } else {
            // âœ… Only logout if we previously had a user (not initial load)
            if (lastAuthState) {
              // âœ… Add debouncing to prevent false logouts during network recovery
              console.log('ðŸ•’ Debouncing potential logout for 2 seconds...');
              
              if (logoutDebounceTimer) {
                clearTimeout(logoutDebounceTimer);
              }
              
              logoutDebounceTimer = setTimeout(async () => {
                if (!isMounted) return;
                
                try {
                  // âœ… Double-check network status before logout
                  const { checkNetworkConnectivity } = await import('../utils/networkUtils');
                  const networkStatus = await checkNetworkConnectivity();
                  
                  if (!networkStatus.isConnected) {
                    console.log('ðŸ“´ Network offline - preserving session');
                    return; // Don't logout if network is offline
                  }
                  
                  // âœ… Final check - is the user really gone?
                  const { auth: authCheck } = await import('../config/firebase');
                  if (authCheck.currentUser) {
                    console.log('âœ… User still exists - false alarm!');
                    return; // Don't logout if user exists
                  }
                  
                  // âœ… Perform logout
                  console.log('ðŸ‘‹ Confirmed logout');
                  
                  if (isMounted) {
                    setUser(null);
                    setToken(null);
                    lastAuthState = false;
                  }
                  
                  // Clear stored profile (non-blocking)
                  AsyncStorage.removeItem('userProfile').catch(error => {
                    console.warn('Failed to clear user profile:', error);
                  });
                  
                } catch (checkError) {
                  console.warn('âš ï¸ Error during logout validation:', checkError);
                  
                  // If check fails, proceed with logout anyway
                  if (isMounted) {
                    setUser(null);
                    setToken(null);
                    lastAuthState = false;
                  }
                  
                  // Clear stored profile (non-blocking)
                  AsyncStorage.removeItem('userProfile').catch(error => {
                    console.warn('Failed to clear user profile:', error);
                  });
                }
              }, 2000); // Reduced from 3 seconds to 2 seconds
              
            } else {
              // âœ… Initial load with no user - this is normal
              console.log('ðŸ“± Initial load with no user');
              
              if (isMounted) {
                setUser(null);
                setToken(null);
                setAuthUserId(null);
              }
            }
          }
          
          // âœ… PERFORMANCE: Set loading=false immediately when auth state is determined
          if (isMounted) {
            setLoading(false);
          }
        });

        // Keep ID token in sync for REST clients
        unsubscribeToken = onIdTokenChanged(auth, async (fbUser) => {
          if (!isMounted) return; // Prevent state updates after unmount

          if (fbUser) {
            try {
              // âœ… PERFORMANCE: Non-blocking token refresh
              const newToken = await fbUser.getIdToken(false);
              if (isMounted && newToken) {
                setToken(newToken);
              }
            } catch (tokenError) {
              console.error('Failed to get ID token:', tokenError);
              if (isMounted) {
                setToken(null);
              }
            }
          } else {
            // Token will be cleared by auth state change handler
            console.log('âš ï¸ Token listener received null user');
            if (isMounted) {
              setToken(null);
            }
          }
        });

      } catch (error) {
        console.error('âŒ Failed to setup auth listeners:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    // âœ… FIXED: Comprehensive cleanup function with all timers
    return () => {
      console.log('ðŸ§¹ [AuthContext] Cleaning up all timers and subscriptions');
      isMounted = false;
      
      // Clear logout debounce timer
      if (logoutDebounceTimer) {
        clearTimeout(logoutDebounceTimer);
        logoutDebounceTimer = undefined;
        console.log('âœ… [AuthContext] Logout debounce timer cleared');
      }
      
      // âœ… FIXED: Clear profile fetch timeout
      if (profileFetchTimeoutRef.current) {
        clearTimeout(profileFetchTimeoutRef.current);
        profileFetchTimeoutRef.current = null;
        console.log('âœ… [AuthContext] Profile fetch timeout cleared');
      }
      
      // âœ… FIXED: Clear profile create timeout
      if (profileCreateTimeoutRef.current) {
        clearTimeout(profileCreateTimeoutRef.current);
        profileCreateTimeoutRef.current = null;
        console.log('âœ… [AuthContext] Profile create timeout cleared');
      }
      
      if (unsubscribeAuth) {
        try {
          unsubscribeAuth();
          console.log('âœ… [AuthContext] Auth subscription cleaned up');
        } catch (error) {
          console.error('Error unsubscribing auth listener:', error);
        }
      }
      
      if (unsubscribeToken) {
        try {
          unsubscribeToken();
          console.log('âœ… [AuthContext] Token subscription cleaned up');
        } catch (error) {
          console.error('Error unsubscribing token listener:', error);
        }
      }
    };
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    logger.info('AUTH', 'Login attempt', { email });
    setLoading(true);
    try {
      console.log('ðŸ” Starting login process for:', email);
      
      // 1) Sign-in via Firebase SDK so Firestore gets authenticated
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { doc, getDoc } = await import('firebase/firestore');
      const { db, auth } = await import('../config/firebase');

      console.log('ðŸ” Signing in with Firebase Auth...');
      const fbUserCredential = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = fbUserCredential.user;
      console.log('âœ… Firebase Auth sign-in successful:', fbUser.uid);

      // 2) Get ID token immediately for REST calls
      console.log('ðŸ”‘ Getting ID token...');
      const idToken = await fbUser.getIdToken(/* forceRefresh */ true);
      console.log('âœ… ID token obtained');

      // 3) Fetch user profile from Firestore
      console.log('ðŸ“„ Fetching user profile from Firestore...');
      const userDocSnap = await getDoc(doc(db, 'users', fbUser.uid));
      if (!userDocSnap.exists()) {
        throw new Error('USER_PROFILE_NOT_FOUND');
      }
      const data = userDocSnap.data() as FirestoreUserData;
      console.log('âœ… User profile fetched:', data);

      const userProfile: User = {
        uid: fbUser.uid,
        email: fbUser.email || email,
        fullName: data.fullName || '',
        phone: data.phone,
        userType: data.userType || 'client',
        role: data.role || 'client',
        verificationStatus: data.verificationStatus || 'pending',
        phoneVerified: data.phoneVerified,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };

      // 4) Set user state immediately for instant navigation
      setUser(userProfile);
      setToken(idToken);
      console.log('ðŸš€ [AuthContext] User state set immediately for navigation');

      // 5) Optionally cache lightweight profile (no token) - non-blocking
      AsyncStorage.setItem('userData', JSON.stringify(userProfile)).catch(error => {
        console.warn('Failed to cache user profile:', error);
      });

      console.log('ðŸŽ‰ Login completed successfully!');
      logger.info('AUTH', 'Login successful', { 
        uid: userProfile.uid, 
        userType: userProfile.userType,
        hasStoredProfile: true 
      });
      return userProfile;
    } catch (sdkError: any) {
      console.error('âŒ Firebase SDK login failed:', sdkError);
      
      // SDK sign-in failed â†’ fallback to REST signIn (rare)
      console.warn('âš ï¸ Firebase SDK signIn failed, falling back to REST');
      try {
        const authData = await signIn(email, password);

        // Build minimal user object from REST response
        const userProfile: User = {
          uid: authData.localId,
          email: email,
          fullName: '',
          userType: 'client',
          role: 'client',
          verificationStatus: 'approved',
        };

        // Set user state immediately for navigation
        setUser(userProfile);
        console.log('ðŸš€ [AuthContext] REST fallback - User state set for navigation');

        AsyncStorage.setItem('userData', JSON.stringify(userProfile)).catch(error => {
          console.warn('Failed to cache user profile:', error);
        });

        logger.info('AUTH', 'Login successful', { 
          uid: userProfile.uid, 
          userType: userProfile.userType,
          hasStoredProfile: true 
        });
        return userProfile;
      } catch (restError) {
        console.error('âŒ REST login also failed:', restError);
        // Clear auth state on failure
        setToken(null);
        setUser(null);
        logger.criticalError('AUTH', 'Login failed', restError);
        throw restError;
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    logger.info('AUTH', 'Logout');
    try {
      console.log('ðŸšª Starting logout process...');
      
      // Clear Firebase Auth state
      try {
        const { signOut } = await import('firebase/auth');
        const { auth } = await import('../config/firebase');
        await signOut(auth);
        console.log('âœ… Firebase Auth signed out');
      } catch (firebaseError) {
        console.warn('âš ï¸ Firebase Auth sign out failed:', firebaseError);
        // Continue with logout anyway
      }
      
      // Clear enhanced token storage
      try {
        await clearStoredToken();
        console.log('âœ… Enhanced token storage cleared');
      } catch (tokenError) {
        console.warn('âš ï¸ Failed to clear enhanced token storage:', tokenError);
      }
      
      // Clear AsyncStorage (including saved credentials) - non-blocking
      AsyncStorage.removeItem('userData').catch(error => {
        console.warn('Failed to clear userData:', error);
      });
      AsyncStorage.removeItem('savedCredentials').catch(error => {
        console.warn('Failed to clear savedCredentials:', error);
      });
      AsyncStorage.removeItem('rememberMe').catch(error => {
        console.warn('Failed to clear rememberMe:', error);
      });
      console.log('ðŸ—‘ï¸ Cleared all stored credentials and preferences');
      
      // Clear app state
      setToken(null);
      setUser(null);
      setIsOfflineMode(false);
      
      console.log('âœ… Logout completed successfully');
      logger.debug('AUTH', 'Logout completed successfully');
    } catch (error) {
      console.error('Error during logout:', error);
      // Force clear state even if AsyncStorage fails
      setToken(null);
      setUser(null);
      setIsOfflineMode(false);
      logger.criticalError('AUTH', 'Error during logout', error);
    }
  };

  const forceLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during force logout:', error);
      // Ensure state is cleared regardless of errors
      setToken(null);
      setUser(null);
    }
  };

  const refreshAuth = async () => {
    try {
      console.log('ðŸ”„ Refreshing authentication...');
      
      if (!user) {
        console.log('âŒ No user to refresh');
        return;
      }
      
      const { auth } = await import('../config/firebase');
      
      // Simple token refresh
      if (auth.currentUser) {
        console.log('ðŸ”‘ Refreshing ID token...');
        const newToken = await auth.currentUser.getIdToken(true);
        
        setToken(newToken);
        
        console.log('âœ… Auth refreshed successfully');
      } else {
        console.log('âŒ No Firebase Auth user found - user needs to re-login');
        
        // Force logout to clear invalid state
        await forceLogout();
      }
    } catch (error) {
      console.error('âŒ Error refreshing auth:', error);
      
      // If refresh fails, force logout
      await forceLogout();
    }
  };

  const validateOfflineSession = async (): Promise<boolean> => {
    try {
      console.log('ðŸ” Validating offline session...');
      
      // Check network connectivity
      const networkStatus = await checkNetworkConnectivity();
      setIsOfflineMode(!networkStatus.isConnected);
      
      if (!networkStatus.isConnected) {
        console.log('ðŸ“´ Network offline - checking cached session');
        
        // Check if we have cached user data (non-blocking)
        try {
          const cachedUserData = await AsyncStorage.getItem('userData');
          if (cachedUserData && user) {
            console.log('âœ… Valid offline session found');
            return true;
          }
        } catch (error) {
          console.warn('Failed to check cached user data:', error);
        }
        
        console.log('âŒ No valid offline session');
        return false;
      }
      
      // Network is available - validate with server
      const validToken = await getValidIdToken();
      if (validToken) {
        setToken(validToken);
        console.log('âœ… Online session validated');
        return true;
      }
      
      console.log('âŒ Online session validation failed');
      return false;
    } catch (error) {
      console.error('âŒ Error validating offline session:', error);
      return false;
    }
  };

  // Helper function to convert Firestore fields
  const firestoreFieldsToObject = (fields: any): any => {
    const obj: any = {};
    for (const key in fields) {
      const field = fields[key];
      if (field.nullValue !== undefined) {
        obj[key] = null;
      } else if (field.stringValue !== undefined) {
        obj[key] = field.stringValue;
      } else if (field.integerValue !== undefined) {
        obj[key] = parseInt(field.integerValue);
      } else if (field.booleanValue !== undefined) {
        obj[key] = field.booleanValue;
      } else if (field.timestampValue !== undefined) {
        obj[key] = new Date(field.timestampValue);
      } else if (field.mapValue !== undefined) {
        obj[key] = firestoreFieldsToObject(field.mapValue.fields);
      }
    }
    return obj;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authReady,
        login,
        logout,
        forceLogout,
        refreshAuth,
        validateOfflineSession,
        isOfflineMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}; 

