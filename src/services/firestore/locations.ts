// Location Operations Module
// Split from firestore.ts for better maintainability

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DriverLocation } from '../../types/firestore';
import { COLLECTIONS } from './orders';

/**
 * Update driver location
 */
export const updateDriverLocation = async (driverId: string, location: DriverLocation): Promise<void> => {
  try {
    const locationRef = doc(db, COLLECTIONS.DRIVER_LOCATIONS, driverId);
    await setDoc(locationRef, {
      ...location,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log(`✅ [FIRESTORE] Driver ${driverId} location updated`);
  } catch (error) {
    console.error("Error updating driver location:", error);
    throw error;
  }
};

/**
 * Get driver location
 */
export const getDriverLocation = async (driverId: string): Promise<DriverLocation | null> => {
  try {
    const locationDoc = await getDoc(doc(db, COLLECTIONS.DRIVER_LOCATIONS, driverId));
    
    if (locationDoc.exists()) {
      const data = locationDoc.data();
      return {
        ...data,
        updatedAt: data.updatedAt?.toDate(),
      } as unknown as DriverLocation;
    } else {
      console.log("Driver location not found:", driverId);
      return null;
    }
  } catch (error) {
    console.error("Error getting driver location:", error);
    return null;
  }
}; 