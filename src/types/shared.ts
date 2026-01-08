export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

export interface CustomModal {
  visible: boolean;
  title: string;
  message: string;
  icon: string;
  iconColor: string;
  buttons: Array<{
    text: string;
    style?: 'default' | 'destructive';
    onPress: () => void;
  }>;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  userType: 'client' | 'driver';
  role?: 'admin' | 'driver' | 'client';
  verificationStatus?: 'pending' | 'approved' | 'rejected';
} 