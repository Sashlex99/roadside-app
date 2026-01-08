// Migration Operations Module
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
import { ensureFirebaseAuth } from './users';
import { COLLECTIONS } from './orders';

/**
 * Analyze user document for image issues
 */
const analyzeUserDocument = (userData: any): any => {
  const analysis = {
    hasImages: false,
    imagesCount: 0,
    hasInvalidImages: false,
    invalidImagesCount: 0,
    hasFixableImages: false,
    fixableImagesCount: 0,
    imageFields: [] as string[],
    issues: [] as string[]
  };

  // Check for image fields
  const imageFields = ['profileImage', 'licenseImage', 'vehicleImage'];
  
  for (const field of imageFields) {
    if (userData[field]) {
      analysis.hasImages = true;
      analysis.imagesCount++;
      analysis.imageFields.push(field);
      
      const imageUrl = userData[field];
      
      // Check if it's a problematic image URL
      if (typeof imageUrl === 'string' && imageUrl.includes('file:///')) {
        analysis.hasInvalidImages = true;
        analysis.invalidImagesCount++;
        analysis.hasFixableImages = true;
        analysis.fixableImagesCount++;
        analysis.issues.push(`${field}: Invalid file:// URL`);
      }
    }
  }

  return analysis;
};

/**
 * Scan user documents for image issues
 */
export const scanUserDocumentsForImageIssues = async (): Promise<{
  totalDrivers: number;
  driversWithIssues: number;
  driversWithFixableIssues: number;
  detailedAnalysis: Array<{
    userId: string;
    fullName: string;
    analysis: any;
    hasFixableIssues: boolean;
  }>;
}> => {
  console.log('🔍 [FIRESTORE] Starting user documents scan for image issues...');
  
  // Check authentication
  if (!(await ensureFirebaseAuth())) {
    throw new Error('Authentication required for migration operations');
  }
  
  try {
    // Get all driver users
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(
      usersRef,
      where('role', '==', 'driver'),
      orderBy('createdAt', 'desc'),
      limit(100) // Limit to prevent overwhelming
    );
    
    const querySnapshot = await getDocs(q);
    
    const result = {
      totalDrivers: 0,
      driversWithIssues: 0,
      driversWithFixableIssues: 0,
      detailedAnalysis: [] as Array<{
        userId: string;
        fullName: string;
        analysis: any;
        hasFixableIssues: boolean;
      }>
    };
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const userData = doc.data();
      result.totalDrivers++;
      
      const analysis = analyzeUserDocument(userData);
      
      if (analysis.hasInvalidImages) {
        result.driversWithIssues++;
      }
      
      if (analysis.hasFixableImages) {
        result.driversWithFixableIssues++;
      }
      
      result.detailedAnalysis.push({
        userId: doc.id,
        fullName: userData.fullName || 'Unknown',
        analysis,
        hasFixableIssues: analysis.hasFixableImages
      });
    });
    
    console.log(`✅ [FIRESTORE] Scan complete: ${result.totalDrivers} drivers analyzed`);
    return result;
    
  } catch (error) {
    console.error('❌ [FIRESTORE] Error scanning user documents:', error);
    throw error;
  }
};

/**
 * Fix user document images
 */
export const fixUserDocumentImages = async (userId: string): Promise<boolean> => {
  console.log(`🔧 [FIRESTORE] Fixing user document images for user: ${userId}`);
  
  // Check authentication
  if (!(await ensureFirebaseAuth())) {
    throw new Error('Authentication required for migration operations');
  }
  
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.warn(`User ${userId} not found`);
      return false;
    }
    
    const userData = userDoc.data();
    const analysis = analyzeUserDocument(userData);
    
    if (!analysis.hasFixableImages) {
      console.log(`No fixable images found for user ${userId}`);
      return false;
    }
    
    // Prepare updates
    const updates: any = {
      updatedAt: serverTimestamp(),
      imagesMigrated: true,
      imagesMigratedAt: serverTimestamp()
    };
    
    // Remove problematic image fields
    const imageFields = ['profileImage', 'licenseImage', 'vehicleImage'];
    for (const field of imageFields) {
      if (userData[field] && typeof userData[field] === 'string' && userData[field].includes('file:///')) {
        updates[field] = null; // Remove the invalid URL
        console.log(`Removed invalid ${field} for user ${userId}`);
      }
    }
    
    await updateDoc(userRef, updates);
    
    console.log(`✅ [FIRESTORE] Successfully fixed images for user ${userId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ [FIRESTORE] Error fixing images for user ${userId}:`, error);
    return false;
  }
};

/**
 * Batch migrate user document images
 */
export const batchMigrateUserDocumentImages = async (dryRun: boolean = true): Promise<{
  totalProcessed: number;
  successfullyFixed: number;
  errors: Array<{ userId: string; error: string }>;
  summary: string;
}> => {
  console.log(`🚀 [FIRESTORE] Starting batch migration (dry run: ${dryRun})...`);
  
  // Check authentication
  if (!(await ensureFirebaseAuth())) {
    throw new Error('Authentication required for migration operations');
  }
  
  try {
    // First, scan for issues
    const scanResult = await scanUserDocumentsForImageIssues();
    
    const result = {
      totalProcessed: 0,
      successfullyFixed: 0,
      errors: [] as Array<{ userId: string; error: string }>,
      summary: ''
    };
    
    // Process users with fixable issues
    const usersToFix = scanResult.detailedAnalysis.filter(user => user.hasFixableIssues);
    
    console.log(`Found ${usersToFix.length} users with fixable image issues`);
    
    if (dryRun) {
      result.summary = `DRY RUN: Would fix ${usersToFix.length} users out of ${scanResult.totalDrivers} total drivers`;
      return result;
    }
    
    // Actually fix the issues
    for (const user of usersToFix) {
      try {
        result.totalProcessed++;
        const success = await fixUserDocumentImages(user.userId);
        
        if (success) {
          result.successfullyFixed++;
        } else {
          result.errors.push({
            userId: user.userId,
            error: 'Fix operation returned false'
          });
        }
        
        // Small delay to prevent overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        result.errors.push({
          userId: user.userId,
          error: String(error)
        });
      }
    }
    
    result.summary = `Successfully fixed ${result.successfullyFixed} out of ${result.totalProcessed} users. ${result.errors.length} errors occurred.`;
    
    console.log(`✅ [FIRESTORE] Batch migration complete: ${result.summary}`);
    return result;
    
  } catch (error) {
    console.error('❌ [FIRESTORE] Error in batch migration:', error);
    throw error;
  }
}; 