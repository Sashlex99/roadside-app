import { getValidIdToken } from '../utils/authToken';
import { appConfig } from '../config/environment';

// Use environment configuration
const API_KEY = appConfig.FIREBASE_API_KEY;
const PROJECT_ID = appConfig.FIREBASE_PROJECT_ID;

// Base URLs
const AUTH_URL = appConfig.FIREBASE_AUTH_URL;
const FIRESTORE_URL = appConfig.FIRESTORE_REST_BASE_URL;
const STORAGE_URL = appConfig.FIREBASE_STORAGE_URL;

console.log('🔑 Using API key:', API_KEY.substring(0, 10) + '...');

// Auth функции
export const signIn = async (email: string, password: string) => {
  console.log('🔥 Attempting login with:', email);
  
  const response = await fetch(
    `${AUTH_URL}/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  
  const data = await response.json();
  console.log('🔥 Firebase signIn response:', response.status, data);
  
  if (!response.ok) {
    console.error('🔥 Firebase signIn error details:', data.error);
    throw data.error;
  }
  return data;
};

export const signUp = async (email: string, password: string) => {
  console.log('🔥 Attempting signup with:', email);
  
  const response = await fetch(
    `${AUTH_URL}/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  
  const data = await response.json();
  console.log('🔥 Firebase signUp response:', response.status, data);
  
  if (!response.ok) {
    console.error('🔥 Firebase signUp error details:', data.error);
    throw data.error;
  }
  return data;
};

// Firestore функции
export const createDocument = async (collection: string, data: any, tokenParam?: string, documentId?: string) => {
  const token = tokenParam || (await getValidIdToken());
  console.log('Creating document in collection:', collection);
  console.log('Document data:', data);
  console.log('Document ID:', documentId);
  
  const fields = objectToFirestoreFields(data);
  console.log('Converted fields:', JSON.stringify(fields, null, 2));
  
  // If documentId is provided, use POST with ?documentId= to create with custom ID
  const url = documentId
    ? `${FIRESTORE_URL}/${collection}?documentId=${documentId}`
    : `${FIRESTORE_URL}/${collection}`;

  const method = 'POST';
  
  const response = await fetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      fields: fields
    }),
  });
  
  const result = await response.json();
  console.log('Create document response:', response.ok, result);
  
  if (!response.ok) {
    console.error('Create document failed:', result);
    throw result.error || result;
  }
  
  return result;
};

export const getDocument = async (collection: string, docId: string, tokenParam?: string) => {
  const token = tokenParam || (await getValidIdToken());
  const response = await fetch(
    `${FIRESTORE_URL}/${collection}/${docId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw data.error;
  return firestoreFieldsToObject(data.fields);
};

// Помощни функции за конвертиране
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

// Storage функции (за качване на снимки)
export const uploadFile = async (uri: string, fileName: string, tokenParam?: string) => {
  const token = tokenParam || (await getValidIdToken());
  console.log('Uploading file:', fileName);
  
  const response = await fetch(uri);
  const blob = await response.blob();
  
  const uploadResponse = await fetch(
    `${STORAGE_URL}/o?uploadType=media&name=${fileName}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': blob.type,
      },
      body: blob,
    }
  );
  
  const data = await uploadResponse.json();
  console.log('Upload response:', uploadResponse.ok, data);
  
  if (!uploadResponse.ok) {
    console.error('Upload failed:', data);
    throw data.error || data;
  }
  
  return data;
};