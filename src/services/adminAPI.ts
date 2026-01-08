import { signIn, getDocument, createDocument } from './firebaseAPI';
import { appConfig } from '../config/environment';

// Use environment configuration
const API_KEY = appConfig.FIREBASE_API_KEY;
const PROJECT_ID = appConfig.FIREBASE_PROJECT_ID;
const FIRESTORE_URL = appConfig.FIRESTORE_REST_BASE_URL;

// Types
export interface DriverForAdmin {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  phoneVerified: boolean;
  userType: 'driver';
  role: 'driver';
  createdAt: Date;
  companyInfo: {
    name: string;
    bulstat: string;
  };
  documents: {
    roadsideAssistanceCert: string;
    iaalaLicense: string;
    driverPhoto: string;
  };
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verificationDate: Date | null;
  verificationNotes: string | null;
  verifiedBy: string | null;
  isActive: boolean;
  isDeleted: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: 'admin';
}

// Helper function to check if user is admin
export const checkAdminAccess = async (token: string): Promise<AdminUser> => {
  try {
    // Get user info from token
    const userInfoResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    
    const userInfo = await userInfoResponse.json();
    if (!userInfoResponse.ok) throw userInfo.error;
    
    const user = userInfo.users[0];
    
    // Get user document from Firestore to check role
    const userDoc = await getUserByEmail(user.email, token);
    
    if (userDoc.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }
    
    return {
      id: userDoc.id,
      email: userDoc.email,
      fullName: userDoc.fullName,
      role: userDoc.role
    };
  } catch (error) {
    throw new Error('Invalid admin token or insufficient privileges');
  }
};

// Get user by email (helper function)
const getUserByEmail = async (email: string, token: string) => {
  const response = await fetch(
    `${FIRESTORE_URL}/users?pageSize=1000`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw data.error;
  
  const users = data.documents?.map((doc: any) => ({
    id: doc.name.split('/').pop(),
    ...firestoreFieldsToObject(doc.fields)
  })) || [];
  
  const user = users.find((u: any) => u.email === email);
  if (!user) throw new Error('User not found');
  
  return user;
};

// Admin API Functions

/**
 * Get all pending drivers waiting for verification
 */
export const getPendingDrivers = async (token: string): Promise<DriverForAdmin[]> => {
  await checkAdminAccess(token);
  
  const response = await fetch(
    `${FIRESTORE_URL}/users?pageSize=1000`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw data.error;
  
  const users = data.documents?.map((doc: any) => ({
    id: doc.name.split('/').pop(),
    ...firestoreFieldsToObject(doc.fields)
  })) || [];
  
  return users.filter((user: any) => 
    user.userType === 'driver' && 
    user.verificationStatus === 'pending'
  );
};

/**
 * Get full driver details by ID
 */
export const getDriverDetails = async (driverId: string, token: string): Promise<DriverForAdmin> => {
  await checkAdminAccess(token);
  
  const response = await fetch(
    `${FIRESTORE_URL}/users/${driverId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw data.error;
  
  return {
    id: driverId,
    ...firestoreFieldsToObject(data.fields)
  };
};

/**
 * Approve a driver
 */
export const approveDriver = async (
  driverId: string, 
  adminId: string, 
  token: string,
  notes?: string
): Promise<void> => {
  await checkAdminAccess(token);
  
  const updateData = {
    verificationStatus: 'approved',
    verificationDate: new Date(),
    verificationNotes: notes || 'Одобрен от администратор',
    verifiedBy: adminId,
    isActive: true
  };
  
  await updateUserDocument(driverId, updateData, token);
};

/**
 * Reject a driver
 */
export const rejectDriver = async (
  driverId: string, 
  adminId: string, 
  token: string,
  reason: string
): Promise<void> => {
  await checkAdminAccess(token);
  
  const updateData = {
    verificationStatus: 'rejected',
    verificationDate: new Date(),
    verificationNotes: reason,
    verifiedBy: adminId,
    isActive: false
  };
  
  await updateUserDocument(driverId, updateData, token);
};

/**
 * Get all drivers with optional filtering
 */
export const getAllDrivers = async (
  token: string,
  filter?: {
    status?: 'pending' | 'approved' | 'rejected';
    page?: number;
    limit?: number;
  }
): Promise<{drivers: DriverForAdmin[], total: number}> => {
  await checkAdminAccess(token);
  
  const response = await fetch(
    `${FIRESTORE_URL}/users?pageSize=1000`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw data.error;
  
  let users = data.documents?.map((doc: any) => ({
    id: doc.name.split('/').pop(),
    ...firestoreFieldsToObject(doc.fields)
  })) || [];
  
  // Filter by userType = driver and exclude deleted users
  users = users.filter((user: any) => 
    user.userType === 'driver' && 
    !user.isDeleted  // Exclude deleted users from all listings
  );
  
  // Apply status filter if provided
  if (filter?.status) {
    users = users.filter((user: any) => user.verificationStatus === filter.status);
  }
  
  const total = users.length;
  
  // Apply pagination if provided
  if (filter?.page && filter?.limit) {
    const start = (filter.page - 1) * filter.limit;
    users = users.slice(start, start + filter.limit);
  }
  
  return { drivers: users, total };
};

/**
 * Admin login function
 */
export const adminLogin = async (email: string, password: string): Promise<{admin: AdminUser, token: string}> => {
  const authResult = await signIn(email, password);
  const admin = await checkAdminAccess(authResult.idToken);
  
  return {
    admin,
    token: authResult.idToken
  };
};

// Helper function to update user document
const updateUserDocument = async (userId: string, updates: any, token: string): Promise<void> => {
  const response = await fetch(
    `${FIRESTORE_URL}/users/${userId}?updateMask.fieldPaths=${Object.keys(updates).join('&updateMask.fieldPaths=')}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        fields: objectToFirestoreFields(updates)
      })
    }
  );
  
  const result = await response.json();
  if (!response.ok) throw result.error;
};

// Helper functions (copy from firebaseAPI.ts)
const objectToFirestoreFields = (obj: any): any => {
  const fields: any = {};
  for (const key in obj) {
    const value = obj[key];
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(item => {
            if (typeof item === 'object') {
              return { mapValue: { fields: objectToFirestoreFields(item) } };
            } else {
              return objectToFirestoreFields({ temp: item }).temp;
            }
          })
        }
      };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: objectToFirestoreFields(value) } };
    }
  }
  return fields;
};

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
    } else if (field.arrayValue !== undefined) {
      obj[key] = field.arrayValue.values.map((item: any) => {
        if (item.mapValue) {
          return firestoreFieldsToObject(item.mapValue.fields);
        } else {
          return firestoreFieldsToObject({ temp: item }).temp;
        }
      });
    } else if (field.mapValue !== undefined) {
      obj[key] = firestoreFieldsToObject(field.mapValue.fields);
    }
  }
  return obj;
};

// Helper function to create document
const createDocumentLocal = async (collection: string, data: any, token: string): Promise<void> => {
  const response = await fetch(
    `${FIRESTORE_URL}/${collection}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        fields: objectToFirestoreFields(data)
      })
    }
  );
  
  const result = await response.json();
  if (!response.ok) throw result.error;
};

/**
 * Ban a user
 */
export const banUser = async (
  userId: string, 
  adminId: string, 
  reason: string, 
  token: string
): Promise<void> => {
  await checkAdminAccess(token);
  
  // Update user with ban information
  const updateData = {
    isBanned: true,
    bannedAt: new Date(),
    bannedBy: adminId,
    banReason: reason
  };
  
  await updateUserDocument(userId, updateData, token);
  
  // Try to record admin action, but don't fail if it doesn't work
  try {
    await createAdminAction({
      adminId,
      targetUserId: userId,
      action: 'ban',
      reason,
      token
    });
  } catch (error) {
    // Silently ignore admin action creation errors
    console.warn('Could not create admin action log:', error);
  }
};

/**
 * Remove ban from user
 */
export const unbanUser = async (
  userId: string, 
  adminId: string, 
  token: string
): Promise<void> => {
  await checkAdminAccess(token);
  
  const updateData = {
    isBanned: false,
    bannedAt: null,
    bannedBy: null,
    banReason: null
  };
  
  await updateUserDocument(userId, updateData, token);
  
  // Try to record admin action, but don't fail if it doesn't work
  try {
    await createAdminAction({
      adminId,
      targetUserId: userId,
      action: 'unban',
      reason: 'Бан премахнат от администратор',
      token
    });
  } catch (error) {
    // Silently ignore admin action creation errors
    console.warn('Could not create admin action log:', error);
  }
};

/**
 * Delete user (soft delete)
 */
export const deleteUser = async (
  userId: string, 
  adminId: string, 
  token: string
): Promise<void> => {
  await checkAdminAccess(token);
  
  const updateData = {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: adminId,
    // Anonymize personal data
    email: `deleted_${userId}@deleted.com`,
    phone: 'DELETED',
    fullName: 'DELETED USER'
  };
  
  await updateUserDocument(userId, updateData, token);
  
  // Try to record admin action, but don't fail if it doesn't work
  try {
    await createAdminAction({
      adminId,
      targetUserId: userId,
      action: 'delete',
      reason: 'Акаунт изтрит',
      token
    });
  } catch (error) {
    // Silently ignore admin action creation errors
    console.warn('Could not create admin action log:', error);
  }
};

/**
 * Create admin action record
 */
const createAdminAction = async (data: {
  adminId: string;
  targetUserId: string;
  action: string;
  reason: string;
  token: string;
}): Promise<void> => {
  const actionData = {
    adminId: data.adminId,
    targetUserId: data.targetUserId,
    action: data.action,
    reason: data.reason,
    timestamp: new Date()
  };
  
  try {
    await createDocumentLocal('adminActions', actionData, data.token);
  } catch (error) {
    // Don't throw errors for admin action logging failures
    console.warn('Failed to create admin action log:', error);
    // Silently fail - admin actions are for audit logging only
  }
};

/**
 * Get admin action history
 */
export const getAdminActionHistory = async (
  token: string,
  limit: number = 50
): Promise<AdminAction[]> => {
  await checkAdminAccess(token);
  
  const response = await fetch(
    `${FIRESTORE_URL}/adminActions?pageSize=${limit}&orderBy=timestamp desc`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw data.error;
  
  return data.documents?.map((doc: any) => ({
    id: doc.name.split('/').pop(),
    ...firestoreFieldsToObject(doc.fields)
  })) || [];
};

/**
 * Interface for admin actions
 */
export interface AdminAction {
  id: string;
  adminId: string;
  targetUserId: string;
  action: 'approve' | 'reject' | 'ban' | 'unban' | 'delete';
  reason: string | null;
  timestamp: Date;
} 