// Client-side order cleanup utility
// This will automatically clean up expired orders when the driver app starts

import { collection, getDocs, doc, updateDoc, query, where, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order } from '../types/firestore';

/**
 * Clean up expired orders that are still showing as active
 * This function should be called when the driver app starts
 */
export const cleanupExpiredOrders = async (): Promise<{
  cleaned: number;
  remaining: number;
  errors: string[];
}> => {
  const errors: string[] = [];
  let cleanedCount = 0;
  let remainingCount = 0;
  
  try {
    console.log('🧹 [ORDER_CLEANUP] Starting cleanup of expired orders...');
    
    // Get all orders that should be visible to drivers
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('status', 'in', ['pending', 'searching', 'bidding']),
      orderBy('createdAt', 'desc'),
      limit(100) // Limit to prevent overwhelming the system
    );
    
    const querySnapshot = await getDocs(q);
    const orders: Order[] = [];
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      orders.push({
        id: docSnapshot.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        expiresAt: data.expiresAt?.toDate(),
      } as Order);
    });
    
    console.log(`📊 [ORDER_CLEANUP] Found ${orders.length} orders with active status`);
    
    const now = new Date();
    const expiredOrders: Order[] = [];
    const staleOrders: Order[] = [];
    
    // Analyze each order
    for (const order of orders) {
      // Check if order is expired
      if (order.expiresAt && order.expiresAt < now) {
        console.log(`❌ [ORDER_CLEANUP] Order ${order.id} is expired (${Math.round((now.getTime() - order.expiresAt.getTime()) / 1000 / 60)} minutes ago)`);
        expiredOrders.push(order);
      }
      // Check if order is more than 2 hours old and not updated recently
      else if (order.createdAt && (now.getTime() - order.createdAt.getTime()) > 2 * 60 * 60 * 1000 && 
               order.updatedAt && (now.getTime() - order.updatedAt.getTime()) > 2 * 60 * 60 * 1000) {
        console.log(`⚠️ [ORDER_CLEANUP] Order ${order.id} is stale (${Math.round((now.getTime() - order.createdAt.getTime()) / 1000 / 60 / 60)} hours old)`);
        staleOrders.push(order);
      }
      else {
        remainingCount++;
      }
    }
    
    console.log(`📊 [ORDER_CLEANUP] Analysis complete:`);
    console.log(`  - Expired orders: ${expiredOrders.length}`);
    console.log(`  - Stale orders: ${staleOrders.length}`);
    console.log(`  - Remaining active orders: ${remainingCount}`);
    
    // Clean up expired orders
    for (const order of expiredOrders) {
      try {
        const docRef = doc(db, 'orders', order.id);
        await updateDoc(docRef, {
          status: 'expired',
          updatedAt: serverTimestamp()
        });
        console.log(`✅ [ORDER_CLEANUP] Order ${order.id} marked as expired`);
        cleanedCount++;
      } catch (error) {
        const errorMessage = `Failed to update order ${order.id}: ${error}`;
        console.error(`❌ [ORDER_CLEANUP] ${errorMessage}`);
        errors.push(errorMessage);
      }
    }
    
    // Clean up stale orders
    for (const order of staleOrders) {
      try {
        const docRef = doc(db, 'orders', order.id);
        await updateDoc(docRef, {
          status: 'expired',
          updatedAt: serverTimestamp()
        });
        console.log(`✅ [ORDER_CLEANUP] Order ${order.id} marked as expired (was stale)`);
        cleanedCount++;
      } catch (error) {
        const errorMessage = `Failed to update order ${order.id}: ${error}`;
        console.error(`❌ [ORDER_CLEANUP] ${errorMessage}`);
        errors.push(errorMessage);
      }
    }
    
    console.log(`✅ [ORDER_CLEANUP] Cleanup complete! Cleaned ${cleanedCount} orders, ${remainingCount} remaining`);
    
    return {
      cleaned: cleanedCount,
      remaining: remainingCount,
      errors
    };
    
  } catch (error) {
    const errorMessage = `Error during cleanup: ${error}`;
    console.error(`❌ [ORDER_CLEANUP] ${errorMessage}`);
    errors.push(errorMessage);
    
    return {
      cleaned: cleanedCount,
      remaining: remainingCount,
      errors
    };
  }
};

/**
 * Check if an order should be considered expired based on various criteria
 */
export const isOrderExpired = (order: Order): boolean => {
  const now = new Date();
  
  // Check explicit expiration time
  if (order.expiresAt && order.expiresAt < now) {
    return true;
  }
  
  // Check if order is very old (more than 24 hours)
  if (order.createdAt && (now.getTime() - order.createdAt.getTime()) > 24 * 60 * 60 * 1000) {
    return true;
  }
  
  // Check if order hasn't been updated for more than 2 hours
  if (order.updatedAt && (now.getTime() - order.updatedAt.getTime()) > 2 * 60 * 60 * 1000) {
    return true;
  }
  
  return false;
};

/**
 * Get the reason why an order is considered expired
 */
export const getExpirationReason = (order: Order): string => {
  const now = new Date();
  
  if (order.expiresAt && order.expiresAt < now) {
    const minutesAgo = Math.round((now.getTime() - order.expiresAt.getTime()) / 1000 / 60);
    return `Expired ${minutesAgo} minutes ago`;
  }
  
  if (order.createdAt && (now.getTime() - order.createdAt.getTime()) > 24 * 60 * 60 * 1000) {
    const hoursAgo = Math.round((now.getTime() - order.createdAt.getTime()) / 1000 / 60 / 60);
    return `Created ${hoursAgo} hours ago`;
  }
  
  if (order.updatedAt && (now.getTime() - order.updatedAt.getTime()) > 2 * 60 * 60 * 1000) {
    const minutesAgo = Math.round((now.getTime() - order.updatedAt.getTime()) / 1000 / 60);
    return `Not updated for ${minutesAgo} minutes`;
  }
  
  return 'Unknown reason';
}; 