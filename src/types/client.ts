export interface PaymentModal {
  visible: boolean;
  amount: number;
  paymentUrl: string;
  driverName: string;
  totalAmount: number;
}

export interface BidInfo {
  id: string;
  driverId: string;
  driverInfo: {
    name: string;
    phone: string;
    rating: number;
  };
  proposedPrice: number;
  estimatedArrivalTime: number;
  driverLocation: {
    latitude: number;
    longitude: number;
  };
  distanceToClient: number;
  message: string;
  status: 'active' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface ActiveOrder {
  id: string;
  description: string;
  status: string;
  expiresAt?: Date;
  acceptedBidId?: string;
  clientId: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  destinationLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  images?: string[];
  createdAt?: Date;
} 