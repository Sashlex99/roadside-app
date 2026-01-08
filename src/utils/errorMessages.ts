export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  
  const message = error?.message || error?.code || 'Неизвестна грешка';
  
  // Map technical errors to user-friendly messages
  const errorMap: Record<string, string> = {
    // Firebase Auth errors
    'auth/user-not-found': 'Потребителят не съществува',
    'auth/wrong-password': 'Грешна парола',
    'auth/email-already-in-use': 'Този имейл вече се използва',
    'auth/weak-password': 'Паролата е твърде слаба',
    'auth/invalid-email': 'Невалиден имейл адрес',
    'auth/too-many-requests': 'Твърде много опити. Опитайте по-късно',
    'auth/network-request-failed': 'Проблем с мрежата. Проверете интернет връзката',
    'auth/requires-recent-login': 'Необходимо е да влезете отново',
    
    // Firestore errors
    'firestore/permission-denied': 'Нямате права за тази операция',
    'firestore/unavailable': 'Услугата временно не е достъпна',
    'firestore/deadline-exceeded': 'Операцията отне твърде много време',
    'firestore/resource-exhausted': 'Достигнат лимит на заявки',
    
    // Storage errors
    'storage/unknown': 'Проблем при качване на файла',
    'storage/object-not-found': 'Файлът не е намерен',
    'storage/quota-exceeded': 'Достигнат лимит за съхранение',
    'storage/unauthenticated': 'Необходимо е влизане в системата',
    'storage/unauthorized': 'Нямате права за тази операция',
    
    // Custom app errors
    'USER_DELETED': 'Профилът ви е изтрит',
    'USER_BANNED': 'Профилът ви е блокиран',
    'ORDER_EXPIRED': 'Заявката е изтекла',
    'ORDER_CANCELLED': 'Заявката е отменена',
    'PAYMENT_FAILED': 'Плащането не е успешно',
    'INVALID_LOCATION': 'Невалидна локация',
    'NO_NETWORK': 'Няма интернет връзка',
    
    // Generic network errors
    'Network Error': 'Проблем с мрежата. Проверете интернет връзката',
    'timeout': 'Операцията отне твърде много време',
    'offline': 'Няма интернет връзка',
  };
  
  return errorMap[message] || 'Възникна неочаквана грешка. Опитайте отново';
};

export const isNetworkError = (error: any): boolean => {
  const message = error?.message || error?.code || '';
  return message.includes('network') || 
         message.includes('timeout') || 
         message.includes('offline') ||
         message === 'auth/network-request-failed';
};

export const isPermissionError = (error: any): boolean => {
  const message = error?.message || error?.code || '';
  return message.includes('permission') || 
         message.includes('unauthorized') ||
         message.includes('unauthenticated');
};

export const isTemporaryError = (error: any): boolean => {
  const message = error?.message || error?.code || '';
  return message.includes('unavailable') || 
         message.includes('deadline-exceeded') ||
         message.includes('timeout') ||
         message.includes('too-many-requests');
}; 