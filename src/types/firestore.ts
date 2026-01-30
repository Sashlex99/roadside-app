// Firestore Data Types for Roadside Assistance App
// Phase 1: Database Structure

import { Timestamp, FieldValue } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  userType: 'client' | 'driver';
  role: 'admin' | 'client' | 'driver';
  verificationStatus: 'pending' | 'approved' | 'rejected';
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Online status (mainly for drivers)
  isOnline?: boolean;
  lastSeen?: Date;
  
  // 🆕 Radius filter preferences (for drivers)
  preferredRadius?: number; // Default: 50km
  radiusFilterEnabled?: boolean; // Default: false (show all)
}

export interface ClientProfile extends User {
  userType: 'client';
  totalOrders: number;
  averageRating?: number;
}

export interface DriverProfile extends User {
  userType: 'driver';
  licenseNumber?: string;
  vehicleInfo?: {
    make: string;
    model: string;
    year: number;
    licensePlate: string;
  };
  isOnline: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address: string;
    timestamp: Date;
  };
  totalOrdersCompleted: number;
  averageRating?: number;
  earnings?: {
    total: number;
    thisMonth: number;
  };
}

export type OrderStatus = 
  | 'pending'         // Току-що създадена заявка
  | 'searching'       // Търсене на шофьори (активно в радиус)
  | 'bidding'         // Шофьори правят оферти
  | 'payment_pending' // Клиент е приел оферта, чака плащане
  | 'accepted'        // Плащането е успешно, поръчката е потвърдена
  | 'in_progress'     // Шофьор се движи към клиента/работи
  | 'completed'       // Приключена успешно
  | 'cancelled'       // Отменена
  | 'expired';        // Изтекъл таймер (5 минути)

export interface OrderLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface Order {
  id: string;
  clientId: string;
  clientInfo: {
    name: string;
    phone: string;
  };
  
  // Основни данни за заявката
  description: string;
  images: string[]; // Firebase Storage URLs
  location: OrderLocation;
  // Къде трябва да бъде откаран клиентът (optional)
  destinationLocation?: OrderLocation;
  
  // Статус и времеви ограничения
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date; // createdAt + 5 minutes
  completedAt?: Date; // When order was completed
  cancelledAt?: Date; // When order was cancelled
  
  // Търсене на шофьори
  searchRadius: number; // започва от 5км
  maxRadius: number; // максимален радиус (може да се увеличава)
  
  // Избрана оферта
  acceptedBidId?: string;
  acceptedDriverId?: string;
  finalPrice?: number;
  platformFee?: number; // 15% от finalPrice
  
  // 🆕 2-Phase Commit: Reservation fields (Phase 1)
  reservedBidId?: string;
  reservedDriverId?: string;
  reservedAt?: Date;
  acceptedAt?: Date;
  
  // Допълнителни данни
  estimatedCompletionTime?: Date;
  actualCompletionTime?: Date;
  clientRating?: number; // 1-5 звезди от клиента
  driverRating?: number; // 1-5 звезди от шофьора
  
  // Плащане
  paymentStatus?: 'pending' | 'paid' | 'failed';
  paymentMethod?: 'cash' | 'card';
}

export interface Bid {
  id: string;
  orderId: string;
  driverId: string;
  driverInfo: {
    name: string;
    phone: string;
    rating?: number;
    vehicleInfo?: {
      make: string;
      model: string;
      licensePlate: string;
    };
  };
  
  // Офертата
  proposedPrice: number;
  estimatedArrivalTime: number; // минути до пристигане
  driverLocation: OrderLocation;
  distanceToClient: number; // в километри
  
  // Допълнителна информация
  message?: string; // съобщение от шофьора
  
  // Статус
  status: 'active' | 'accepted' | 'rejected' | 'expired' | 'reserved';
  createdAt: Date;
  expiresAt: Date; // bid-овете също изтичат
  
  // 🆕 2-Phase Commit: Reservation tracking
  reservedAt?: Date;
  acceptedAt?: Date;
}

// Notifications за real-time updates
export interface Notification {
  id: string;
  userId: string;
  type: 'new_order' | 'bid_received' | 'bid_accepted' | 'order_update' | 'driver_arrived';
  title: string;
  message: string;
  data?: {
    orderId?: string;
    bidId?: string;
    driverId?: string;
  };
  isRead: boolean;
  createdAt: Date;
}

// Real-time driver tracking
export interface DriverLocation {
  driverId: string;
  orderId?: string; // ако шофьорът е в активна поръчка
  location: OrderLocation;
  heading?: number; // посока на движение
  speed?: number; // скорост км/ч
  isOnline?: boolean; // дали шофьорът е онлайн и може да получава поръчки
  timestamp: Date;
}

// Analytics and reporting
export interface OrderAnalytics {
  orderId: string;
  totalBids: number;
  averageBidPrice: number;
  timeToAcceptance: number; // минути от създаване до приемане
  timeToCompletion: number; // минути от създаване до завършване
  searchRadiusUsed: number;
  platformFeeAmount: number;
  createdAt: Date;
} 

// 🔒 NEW: Driver Lock interface for atomic locking system
export interface DriverLock {
  isLocked: boolean;
  orderId: string;
  lockedAt: Date | Timestamp | FieldValue;
  expiresAt: Date | Timestamp | FieldValue;
  lockReason: 'bid_reservation' | 'payment_processing' | 'order_completion';
  metadata?: {
    bidId?: string;
    clientId?: string;
    reservationStartTime?: Date | Timestamp | FieldValue;
    debugInfo?: string;
  };
}

// 🔒 Lock operation result interface
export interface LockResult {
  success: boolean;
  lockAcquired: boolean;
  error?: string;
  conflictOrderId?: string;
  expiresAt?: Date;
  duration?: number;
}

// 🔒 Lock cleanup result interface  
export interface LockCleanupResult {
  cleaned: number;
  errors: string[];
  expiredLocks: string[];
} 