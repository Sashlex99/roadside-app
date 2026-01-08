// User Operations Module
// Split from firestore.ts for better maintainability

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { safeOnSnapshot } from '../../utils/safeFirestore';
import { 
  User,
  DriverLocation
} from '../../types/firestore';
import { COLLECTIONS } from './orders';

/**
 * Get user by ID
 */
export const getUser = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        id: userDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as unknown as User;
    } else {
      console.log("User not found:", userId);
      return null;
    }
  } catch (error) {
    console.error("Error getting user:", error);
    return null;
  }
};

/**
 * Get count of online drivers
 */
export const getOnlineDriversCount = async (): Promise<number> => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const driversRef = collection(db, COLLECTIONS.USERS);
    const q = query(
      driversRef,
      where('role', '==', 'driver'),
      where('isOnline', '==', true),
      where('lastSeen', '>=', fiveMinutesAgo)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error("Error getting online drivers count:", error);
    return 0;
  }
};

/**
 * Subscribe to online drivers count
 * ✅ ENHANCED: Better error handling and resilience
 */
export const subscribeToOnlineDriversCount = (callback: (count: number) => void) => {
  console.log('📡 [FIRESTORE] Setting up online drivers count subscription');
  
  // Track subscription state
  let subscriptionActive = true;
  let errorCount = 0;
  const maxErrors = 3;
  
  const attemptSubscription = (): (() => void) => {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      const driversRef = collection(db, COLLECTIONS.USERS);
      const q = query(
        driversRef,
        where('role', '==', 'driver'),
        where('isOnline', '==', true),
        where('lastSeen', '>=', fiveMinutesAgo)
      );
      
      return safeOnSnapshot(q, 
        (querySnapshot) => {
          try {
            // Reset error count on successful callback
            errorCount = 0;
            
            if (!subscriptionActive) {
              console.log('📡 [FIRESTORE] Online drivers subscription deactivated, ignoring update');
              return;
            }
            
            const count = querySnapshot.size;
            console.log(`📡 [FIRESTORE] Online drivers count updated: ${count} drivers`);
            callback(count);
            
          } catch (callbackError) {
            console.error('❌ [FIRESTORE] Error in online drivers callback:', callbackError);
            errorCount++;
            
            if (errorCount >= maxErrors) {
              console.error(`❌ [FIRESTORE] Too many callback errors (${errorCount}), stopping online drivers subscription`);
              subscriptionActive = false;
              callback(0);
            }
          }
        },
        (error) => {
          console.error("❌ [FIRESTORE] Error in subscribeToOnlineDriversCount:", error);
          errorCount++;
          
          if (errorCount >= maxErrors) {
            console.error(`❌ [FIRESTORE] Too many subscription errors (${errorCount}), stopping online drivers subscription`);
            subscriptionActive = false;
          }
          
          // Always provide 0 count on error to prevent undefined states
          callback(0);
        }
      );
    } catch (error) {
      console.error("❌ [FIRESTORE] Error setting up online drivers subscription:", error);
      return () => {}; // Return empty unsubscribe function
    }
  };
  
  const unsubscribe = attemptSubscription();
  
  // Return enhanced unsubscribe function
  return () => {
    console.log('🧹 [FIRESTORE] Unsubscribing from online drivers count');
    subscriptionActive = false;
    try {
      unsubscribe();
    } catch (error) {
      console.error('❌ [FIRESTORE] Error during online drivers subscription cleanup:', error);
    }
  };
};

/**
 * Update driver online status
 */
export const updateDriverOnlineStatus = async (driverId: string, isOnline: boolean): Promise<void> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, driverId);
    await updateDoc(userRef, {
      isOnline,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`✅ [FIRESTORE] Driver ${driverId} online status updated to ${isOnline}`);
  } catch (error) {
    console.error("Error updating driver online status:", error);
    throw error;
  }
};

/**
 * Ensure Firebase auth is available
 */
const ensureFirebaseAuth = async (): Promise<boolean> => {
  try {
    if (!auth.currentUser) {
      console.log('⚠️ [FIRESTORE] No authenticated user found');
      return false;
    }
    
    const token = await auth.currentUser.getIdToken();
    if (!token) {
      console.log('⚠️ [FIRESTORE] No valid auth token found');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ [FIRESTORE] Firebase auth check failed:', error);
    return false;
  }
};

export { ensureFirebaseAuth }; 