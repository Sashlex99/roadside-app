// Analytics Operations Module
// Split from firestore.ts for better maintainability

import { 
  collection, 
  doc, 
  addDoc, 
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
import { db } from '../../config/firebase';
import { OrderAnalytics } from '../../types/firestore';
import { COLLECTIONS } from './orders';

/**
 * Create analytics record for an order
 */
export const createOrderAnalytics = async (orderData: Omit<OrderAnalytics, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const analyticsRef = collection(db, COLLECTIONS.ANALYTICS);
    const docRef = await addDoc(analyticsRef, {
      ...orderData,
      createdAt: serverTimestamp()
    });
    
    console.log('✅ [FIRESTORE] Order analytics created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ [FIRESTORE] Error creating order analytics:', error);
    throw error;
  }
};

/**
 * Get analytics for a specific order
 */
export const getOrderAnalytics = async (orderId: string): Promise<OrderAnalytics | null> => {
  try {
    const analyticsRef = collection(db, COLLECTIONS.ANALYTICS);
    const q = query(
      analyticsRef,
      where('orderId', '==', orderId),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
      } as unknown as OrderAnalytics;
    }
    
    return null;
  } catch (error) {
    console.error('❌ [FIRESTORE] Error getting order analytics:', error);
    return null;
  }
};

/**
 * Get analytics summary for a date range
 */
export const getAnalyticsSummary = async (startDate: Date, endDate: Date): Promise<{
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageCompletionTime: number;
}> => {
  try {
    const analyticsRef = collection(db, COLLECTIONS.ANALYTICS);
    const q = query(
      analyticsRef,
      where('createdAt', '>=', startDate),
      where('createdAt', '<=', endDate),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const summary = {
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      averageCompletionTime: 0
    };
    
    let totalCompletionTime = 0;
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      summary.totalOrders++;
      
      if (data.status === 'completed') {
        summary.completedOrders++;
        if (data.completionTime) {
          totalCompletionTime += data.completionTime;
        }
      } else if (data.status === 'cancelled') {
        summary.cancelledOrders++;
      }
    });
    
    if (summary.completedOrders > 0) {
      summary.averageCompletionTime = totalCompletionTime / summary.completedOrders;
    }
    
    return summary;
  } catch (error) {
    console.error('❌ [FIRESTORE] Error getting analytics summary:', error);
    return {
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      averageCompletionTime: 0
    };
  }
}; 