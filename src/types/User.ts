export interface User {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  userType: 'client' | 'driver';
  role?: 'admin' | 'driver' | 'client';
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  phoneVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  phoneVerified?: boolean;
  userType: 'client' | 'driver';
  role?: 'admin' | 'driver' | 'client';
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FirestoreUserData {
  fullName?: string;
  phone?: string;
  userType?: 'client' | 'driver';
  role?: 'admin' | 'driver' | 'client';
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  phoneVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
} 