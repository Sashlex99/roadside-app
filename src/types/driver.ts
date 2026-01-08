export interface PendingOrder {
  id: string;
  description: string;
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
  images: string[];
  distance: number;
  createdAt: Date;
  clientName: string;
  clientPhone: string;
}

export interface AcceptedBid {
  id: string;
  orderId: string;
  driverId: string;
  driverInfo: {
    name: string;
    phone: string;
    rating: number;
  };
  proposedPrice: number;
  estimatedArrivalTime: number;
  status: 'active' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface ActiveDriverOrder {
  id: string;
  description: string;
  status: string;
  acceptedDriverId?: string;
  acceptedBidId?: string;
  clientId?: string;
  clientInfo?: {
    name: string;
    phone: string;
  };
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
  updatedAt?: Date;
} 