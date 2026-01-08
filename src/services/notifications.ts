import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

// TypeScript типове
interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

interface MockDriver {
  id: string;
  pushToken: string;
  currentLocation: LocationCoordinates;
  name: string;
}

interface MockOrder {
  clientId: string;
  description: string;
  location: LocationCoordinates;
  status: string;
  createdAt: Date;
}

interface CloudFunctionTestResult {
  order: MockOrder;
  nearbyDrivers: number;
  message: string;
  driversInRange: MockDriver[];
}

// Constants
const NOTIFICATION_CHANNEL_ID = 'roadside-assistance-default';
const MAX_DISTANCE_KM = 15;
const NOTIFICATION_DELAY_SECONDS = 2;

// Enhanced notification channels for Android
const NOTIFICATION_CHANNELS = {
  ORDERS: 'roadside-assistance-orders',
  BIDS: 'roadside-assistance-bids',
  URGENT: 'roadside-assistance-urgent',
  DEFAULT: NOTIFICATION_CHANNEL_ID,
};

/**
 * Sets up enhanced notification channels for Android
 */
async function setupEnhancedNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  
  try {
    // Orders channel - high priority for new orders
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.ORDERS, {
      name: 'Нови поръчки',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B2C',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      description: 'Уведомления за нови заявки за пътна помощ',
    });
    
    // Bids channel - normal priority for bid updates
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.BIDS, {
      name: 'Оферти и заявки',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150, 150, 150],
      lightColor: '#4CAF50',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      description: 'Уведомления за нови оферти и актуализации на заявки',
    });
    
    // Urgent channel - maximum priority for critical updates
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.URGENT, {
      name: 'Спешни съобщения',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#F44336',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      description: 'Спешни уведомления и критични актуализации',
    });
    
    // Default channel - backwards compatibility
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.DEFAULT, {
      name: 'Общи уведомления',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B2C',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      description: 'Общи уведомления за приложението',
    });
    
    if (__DEV__) console.log('✅ Enhanced notification channels setup completed');
  } catch (error) {
    console.error('❌ Error setting up notification channels:', error);
    throw error;
  }
}

/**
 * Регистрира устройството за push notifications и запазва token-а в Firestore
 * @returns Promise<string | undefined> - Push token или undefined при грешка
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  try {
    // Enhanced Android notification channels setup
    if (Platform.OS === 'android') {
      await setupEnhancedNotificationChannels();
    }

    // Check if device supports push notifications
    if (!Device.isDevice) {
      if (__DEV__) console.log('⚠️ Push notifications require a physical device');
      return undefined;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      if (__DEV__) console.log('❌ Push notification permissions not granted');
      return undefined;
    }
    
    // Get push token
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: '0279cba4-55bd-4db9-acad-d0bbc458acfb', // From app.json
    });
    
    const token = tokenResponse.data;
    if (__DEV__) console.log('✅ Push token obtained:', token);
    
    // Save token to user document with error handling
    try {
      await savePushTokenToFirestore(token);
    } catch (saveError) {
      console.warn('⚠️ Failed to save push token to Firestore:', saveError);
      // Continue anyway - the token is still valid for local use
    }
    
    return token;
  } catch (error) {
    console.error('❌ Error in registerForPushNotificationsAsync:', error);
    return undefined;
  }
}

/**
 * Запазва push token в Firestore за текущия потребител
 * @param token - Push token за запазване
 * @param userId - Optional user ID, ако auth.currentUser не е готов
 */
async function savePushTokenToFirestore(token: string, userId?: string): Promise<void> {
  const targetUserId = userId || auth.currentUser?.uid;
  
  if (!targetUserId) {
    if (__DEV__) console.log('⚠️ No authenticated user - cannot save push token');
    return;
  }

  // 🔥 EMERGENCY: Ensure Firebase Auth is valid before Firestore operation (non-blocking)
  if (!auth.currentUser) {
    console.warn('⚠️ No Firebase Auth user - push token save may fail');
  } else {
    // Validate auth in background to avoid blocking
    auth.currentUser.getIdToken(true).then(() => {
      if (__DEV__) console.log('✅ Firebase Auth validated for push token save');
    }).catch(authError => {
      console.error('❌ Firebase Auth validation failed for push token save:', authError);
      // Continue anyway, but with warning
    });
  }

  try {
    await updateDoc(doc(db, 'users', targetUserId), {
      pushToken: token,
      pushTokenUpdatedAt: new Date(),
      pushTokenDevice: {
        platform: Platform.OS,
        deviceName: Device.deviceName || 'Unknown Device',
        modelName: Device.modelName || 'Unknown Model',
      }
    });
    if (__DEV__) console.log('✅ Push token saved to Firestore for user:', targetUserId);
  } catch (error) {
    console.error('❌ Error saving push token to Firestore:', error);
    
    // 🔥 EMERGENCY: If permission denied, log specific guidance
    if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
      console.error('❌ Permission denied - user needs to re-login or Firebase Auth is not synced');
    }
    
    throw error;
  }
}

/**
 * Запазва push token за конкретен потребител
 * @param token - Push token
 * @param userId - User ID
 */
export async function savePushTokenForUser(token: string, userId: string): Promise<void> {
  return savePushTokenToFirestore(token, userId);
}

/**
 * Изпраща локално известие с подходящия канал
 */
export async function sendLocalNotification(
  title: string, 
  body: string, 
  data: any = {},
  delaySeconds = NOTIFICATION_DELAY_SECONDS,
  type: 'orders' | 'bids' | 'urgent' | 'default' = 'default'
): Promise<void> {
  try {
    // Determine appropriate channel and priority
    const channelConfig = getNotificationChannelConfig(type);
    
    // Schedule the notification with a delay to ensure proper delivery
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          ...data,
          timestamp: Date.now(),
          type,
        },
        sound: 'default',
        priority: channelConfig.priority as any,
        categoryIdentifier: channelConfig.channel,
        ...(Platform.OS === 'android' && {
          channelId: channelConfig.channel,
        }),
      },
      trigger: {
        type: 'timeInterval',
        seconds: delaySeconds,
      } as Notifications.TimeIntervalTriggerInput,
    });

    if (__DEV__) console.log(`✅ Local notification scheduled (${type}): ${title}`);
  } catch (error) {
    console.error('❌ Error sending local notification:', error);
  }
}

/**
 * Gets notification channel configuration based on type
 */
function getNotificationChannelConfig(type: string) {
  switch (type) {
    case 'orders':
      return {
        channel: NOTIFICATION_CHANNELS.ORDERS,
        priority: Notifications.AndroidImportance.HIGH,
      };
    case 'bids':
      return {
        channel: NOTIFICATION_CHANNELS.BIDS,
        priority: Notifications.AndroidImportance.DEFAULT,
      };
    case 'urgent':
      return {
        channel: NOTIFICATION_CHANNELS.URGENT,
        priority: Notifications.AndroidImportance.MAX,
      };
    default:
      return {
        channel: NOTIFICATION_CHANNELS.DEFAULT,
        priority: Notifications.AndroidImportance.DEFAULT,
      };
  }
}

/**
 * Изпраща локален test notification
 */
export async function sendTestNotification(): Promise<void> {
  try {
    await sendLocalNotification(
      '🚗 Test Notification',
      'Push notifications are working perfectly!',
      { 
        type: 'test',
        source: 'local_test'
      },
      NOTIFICATION_DELAY_SECONDS,
      'default'
    );
    if (__DEV__) console.log('✅ Test notification scheduled');
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    throw error;
  }
}

/**
 * Тества логиката на cloud functions локално
 * @returns CloudFunctionTestResult
 */
export function testCloudFunctionLogic(): CloudFunctionTestResult {
  console.log('🧪 Testing Cloud Function Logic:');
  
  const mockOrder: MockOrder = {
    clientId: 'client-123',
    description: 'Спукана гума на магистрала А1 при км 15',
    location: {
      latitude: 42.6977,
      longitude: 23.3219
    },
    status: 'pending',
    createdAt: new Date()
  };
  
  const mockDrivers: MockDriver[] = [
    {
      id: 'driver-1',
      pushToken: 'ExponentPushToken[abc123]',
      currentLocation: { latitude: 42.700, longitude: 23.320 },
      name: 'Иван Петров'
    },
    {
      id: 'driver-2', 
      pushToken: 'ExponentPushToken[def456]',
      currentLocation: { latitude: 42.650, longitude: 23.300 },
      name: 'Георги Димитров'
    },
    {
      id: 'driver-3',
      pushToken: 'ExponentPushToken[ghi789]', 
      currentLocation: { latitude: 42.500, longitude: 23.200 }, // ~20km away
      name: 'Петър Стоянов'
    }
  ];
  
  const driversInRange: MockDriver[] = [];
  
  mockDrivers.forEach(driver => {
    const distance = calculateDistance(
      mockOrder.location.latitude,
      mockOrder.location.longitude,
      driver.currentLocation.latitude,
      driver.currentLocation.longitude
    );
    
    console.log(`📍 Driver ${driver.name}: ${distance.toFixed(1)}km away`);
    
    if (distance <= MAX_DISTANCE_KM) {
      driversInRange.push(driver);
      console.log(`✅ Would send notification to ${driver.name}:`);
      console.log(`   Title: "🚗 Нова заявка за пътна помощ"`);
      console.log(`   Body: "${mockOrder.description.substring(0, 50)}... - ${distance.toFixed(1)}км от вас"`);
      console.log(`   Data:`, {
        orderId: 'test-order-123',
        type: 'new_order',
        distance: distance.toFixed(1),
        priority: 'high'
      });
    } else {
      console.log(`❌ Driver ${driver.name} is too far (${distance.toFixed(1)}km > ${MAX_DISTANCE_KM}km)`);
    }
  });
  
  const result: CloudFunctionTestResult = {
    order: mockOrder,
    nearbyDrivers: driversInRange.length,
    driversInRange,
    message: `Cloud function logic test completed - ${driversInRange.length}/${mockDrivers.length} drivers in range`
  };
  
  console.log('🎯 Test Summary:', {
    totalDrivers: mockDrivers.length,
    driversInRange: driversInRange.length,
    maxDistance: `${MAX_DISTANCE_KM}km`
  });
  
  return result;
}

/**
 * Изчислява разстоянието между две GPS координати (Haversine formula)
 * @param lat1 - Latitude на първата точка
 * @param lon1 - Longitude на първата точка  
 * @param lat2 - Latitude на втората точка
 * @param lon2 - Longitude на втората точка
 * @returns Разстояние в километри
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
} 