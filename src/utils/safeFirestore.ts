import { onSnapshot, Query, DocumentReference } from 'firebase/firestore';

/**
 * Handles auth-related Firestore errors globally
 */
const handleAuthError = async () => {
  console.warn('🔒 Firestore permission error – auth state may not be ready');
};

/**
 * Wrap any Firestore SDK Promise so that unauthenticated / permission errors trigger logout.
 */
export const safeFirestoreCall = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') {
      await handleAuthError();
    }
    throw error;
  }
};

/**
 * Safe wrapper around onSnapshot that auto-logs-out on permission issues.
 */
export const safeOnSnapshot = (
  reference: any,
  observer: (snapshot: any) => void,
  errorHandler?: (error: Error) => void
) => {
  const wrappedErrorHandler = async (err: Error) => {
    if ((err as any)?.code === 'permission-denied' || (err as any)?.code === 'unauthenticated') {
      await handleAuthError();
    }
    if (errorHandler) errorHandler(err);
  };
  
  return onSnapshot(reference, observer, wrappedErrorHandler);
}; 
