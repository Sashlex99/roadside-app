/**
 * Firestore REST API Service
 * 
 * This service provides a fallback for Firebase SDK operations that hang.
 * Uses direct Firestore REST API calls to bypass SDK compatibility issues.
 * 
 * Context: Firebase JS SDK v11.9.0 has Promise hanging issues in React Native 0.79 + Expo
 * Solution: Use REST API for write operations, keep SDK for real-time listening
 */

import { auth } from '../config/firebase';
import { getValidIdToken } from '../utils/authToken';
import { appConfig } from '../config/environment';
import type { Order } from '../types/firestore';

// Firestore REST API configuration
const FIREBASE_PROJECT_ID = appConfig.FIREBASE_PROJECT_ID;
const FIRESTORE_REST_BASE_URL = appConfig.FIRESTORE_REST_BASE_URL;

/**
 * Get Firebase Auth token for REST API authentication
 */
const getAuthToken = async (): Promise<string> => {
  const token = await getValidIdToken();
  if (!token) {
    throw new Error('Unable to get valid authentication token');
  }
  return token;
};

/**
 * Convert JavaScript object to Firestore REST API format
 */
const toFirestoreDocument = (data: any): any => {
  const result: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      result[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      result[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      result[key] = { doubleValue: value };
    } else if (typeof value === 'boolean') {
      result[key] = { booleanValue: value };
    } else if (value instanceof Date) {
      result[key] = { timestampValue: value.toISOString() };
    } else if (Array.isArray(value)) {
      result[key] = {
        arrayValue: {
          values: value.map(item => toFirestoreDocument({ temp: item }).temp)
        }
      };
    } else if (typeof value === 'object') {
      result[key] = {
        mapValue: {
          fields: toFirestoreDocument(value)
        }
      };
    }
  }
  
  return result;
};

/**
 * Convert Firestore REST API format to JavaScript object
 */
const fromFirestoreDocument = (doc: any): any => {
  if (!doc.fields) return {};
  
  const result: any = {};
  
  for (const [key, value] of Object.entries(doc.fields)) {
    const fieldValue = value as any;
    
    if (fieldValue.stringValue !== undefined) {
      result[key] = fieldValue.stringValue;
    } else if (fieldValue.doubleValue !== undefined) {
      result[key] = fieldValue.doubleValue;
    } else if (fieldValue.booleanValue !== undefined) {
      result[key] = fieldValue.booleanValue;
    } else if (fieldValue.timestampValue !== undefined) {
      result[key] = new Date(fieldValue.timestampValue);
    } else if (fieldValue.nullValue !== undefined) {
      result[key] = null;
    } else if (fieldValue.arrayValue !== undefined) {
      result[key] = fieldValue.arrayValue.values?.map((item: any) => 
        fromFirestoreDocument({ fields: { temp: item } }).temp
      ) || [];
    } else if (fieldValue.mapValue !== undefined) {
      result[key] = fromFirestoreDocument(fieldValue.mapValue);
    }
  }
  
  return result;
};

/**
 * Create a new order using Firestore REST API
 * This bypasses the Firebase SDK hanging Promise issue
 */
export const createOrderViaREST = async (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'expiresAt'>): Promise<string> => {
  console.log('🌐 [FIRESTORE_REST] Starting REST API order creation...');
  
  try {
    // Get authentication token
    const token = await getAuthToken();
    console.log('🔑 [FIRESTORE_REST] Auth token obtained');
    
    // Prepare order data
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes from now
    
    const order: Omit<Order, 'id'> = {
      ...orderData,
      status: 'pending',
      searchRadius: 5,
      maxRadius: 50,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresAt
    };
    
    // Convert to Firestore format
    const firestoreDoc = {
      fields: toFirestoreDocument(order)
    };
    
    console.log('📝 [FIRESTORE_REST] Order data prepared');
    
    // Make REST API call
    const response = await fetch(`${FIRESTORE_REST_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(firestoreDoc)
    });
    
    console.log('📡 [FIRESTORE_REST] REST API call completed, status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ [FIRESTORE_REST] REST API error:', errorData);
      throw new Error(`Firestore REST API error: ${response.status} - ${errorData}`);
    }
    
    const responseData = await response.json();
    console.log('✅ [FIRESTORE_REST] Order created successfully');
    
    // Extract document ID from response
    // Response format: "projects/PROJECT_ID/databases/(default)/documents/orders/DOCUMENT_ID"
    const documentPath = responseData.name;
    const documentId = documentPath.split('/').pop();
    
    console.log('🆔 [FIRESTORE_REST] Order ID:', documentId);
    
    return documentId;
    
  } catch (error) {
    console.error('❌ [FIRESTORE_REST] Failed to create order via REST API:', error);
    throw error;
  }
};

/**
 * Update an existing order using Firestore REST API
 */
export const updateOrderViaREST = async (orderId: string, updateData: Partial<Order>): Promise<void> => {
  console.log('🌐 [FIRESTORE_REST] Starting REST API order update for:', orderId);
  
  try {
    const token = await getAuthToken();
    
    // Add updatedAt timestamp
    const dataWithTimestamp = {
      ...updateData,
      updatedAt: new Date()
    };
    
    // Convert to Firestore format
    const firestoreDoc = {
      fields: toFirestoreDocument(dataWithTimestamp)
    };
    
    // Create update mask (only update specified fields)
    const updateMask = Object.keys(dataWithTimestamp).join(',');
    
    const response = await fetch(`${FIRESTORE_REST_BASE_URL}/orders/${orderId}?updateMask.fieldPaths=${updateMask}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(firestoreDoc)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Firestore REST API update error: ${response.status} - ${errorData}`);
    }
    
    console.log('✅ [FIRESTORE_REST] Order updated successfully');
    
  } catch (error) {
    console.error('❌ [FIRESTORE_REST] Failed to update order via REST API:', error);
    throw error;
  }
};

/**
 * Health check for Firestore REST API
 */
export const testFirestoreRESTConnection = async (): Promise<boolean> => {
  try {
    const token = await getAuthToken();
    
    // Simple query to test connection
    const response = await fetch(`${FIRESTORE_REST_BASE_URL}/orders?pageSize=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('🔍 [FIRESTORE_REST] Connection test result:', response.status);
    return response.ok;
    
  } catch (error) {
    console.error('❌ [FIRESTORE_REST] Connection test failed:', error);
    return false;
  }
}; 