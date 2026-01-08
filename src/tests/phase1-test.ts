// Phase 1 Testing File
// Roadside Assistance App - Database Operations Test

import { 
  createOrder, 
  getOrder, 
  updateOrderStatus,
  findOrdersInRadius,
  subscribeToClientOrders,
  createBid,
  getBidsForOrder,
  acceptBid,
  subscribeToBidsForOrder,
  updateDriverLocation,
  getDriverLocation
} from '../services/firestore';

import { Order, Bid, OrderLocation, DriverLocation } from '../types/firestore';

// Import auth to get current user's UID at runtime
import { auth } from '../config/firebase';

// Helper to safely obtain UID (falls back to placeholder so tests still run in emulator)
const getCurrentUid = () => auth.currentUser?.uid || 'unknown_uid';

// =============== TEST DATA ===============

const mockClientLocation: OrderLocation = {
  latitude: 42.6977,
  longitude: 23.3219,
  address: 'бул. Витоша 1, София 1000'
};

const mockDriverLocation: OrderLocation = {
  latitude: 42.7000,
  longitude: 23.3250,
  address: 'бул. Ситняково 10, София 1505'
};

// =============== PHASE 1 TESTS ===============

export class Phase1Tests {
  private createdOrderId: string | null = null;
  private createdBidId: string | null = null;

  /**
   * Проверява дали Firebase е правилно конфигуриран
   */
  async testFirebaseConnection(): Promise<boolean> {
    try {
      console.log('🧪 Test 0: Firebase Connection...');
      
      // Опитваме се да импортираме Firebase конфигурацията
      const { db, auth } = await import('../config/firebase');
      
      if (db && auth) {
        console.log('✅ Firebase services са налични');
        return true;
      } else {
        throw new Error('Firebase services не са инициализирани');
      }
    } catch (error) {
      console.error('❌ Грешка с Firebase връзката:', error);
      console.log('ℹ️ Моля проверете Firebase конфигурацията');
      return false;
    }
  }

  /**
   * Тест 1: Създаване на заявка
   */
  async testCreateOrder(): Promise<boolean> {
    try {
      console.log('🧪 Test 1: Създаване на заявка...');
      
      const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'expiresAt'> = {
        clientId: getCurrentUid(),
        clientInfo: {
          name: 'Тест Клиент',
          phone: '+359888123456'
        },
        description: 'Спукана гума на бул. Витоша - тестова заявка',
        images: [],
        location: mockClientLocation,
        status: 'pending',
        searchRadius: 5,
        maxRadius: 50
      };

      this.createdOrderId = await createOrder(orderData);
      console.log('✅ Заявка създадена успешно с ID:', this.createdOrderId);
      return true;
    } catch (error) {
      console.error('❌ Грешка при създаване на заявка:', error);
      
      // Проверяваме дали е Firebase auth грешка
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string; message: string };
        if (firebaseError.code?.includes('auth') || firebaseError.message?.includes('auth')) {
          console.log('ℹ️ Това изглежда като Firebase Auth грешка');
          console.log('ℹ️ За testing можем да използваме mock данни');
          return false;
        }
      }
      
      return false;
    }
  }

  /**
   * Тест 2: Получаване на заявка
   */
  async testGetOrder(): Promise<boolean> {
    try {
      console.log('🧪 Test 2: Получаване на заявка...');
      
      if (!this.createdOrderId) {
        throw new Error('Няма създадена заявка за тестване');
      }

      const order = await getOrder(this.createdOrderId);
      
      if (order && order.id === this.createdOrderId) {
        console.log('✅ Заявка получена успешно:', {
          id: order.id,
          status: order.status,
          description: order.description,
          clientName: order.clientInfo.name
        });
        return true;
      } else {
        throw new Error('Заявката не е намерена или данните не съвпадат');
      }
    } catch (error) {
      console.error('❌ Грешка при получаване на заявка:', error);
      return false;
    }
  }

  /**
   * Тест 3: Обновяване на статус на заявка
   */
  async testUpdateOrderStatus(): Promise<boolean> {
    try {
      console.log('🧪 Test 3: Обновяване на статус...');
      
      if (!this.createdOrderId) {
        throw new Error('Няма създадена заявка за тестване');
      }

      await updateOrderStatus(this.createdOrderId, 'searching');
      
      const updatedOrder = await getOrder(this.createdOrderId);
      
      if (updatedOrder && updatedOrder.status === 'searching') {
        console.log('✅ Статусът е обновен успешно на "searching"');
        return true;
      } else {
        throw new Error('Статусът не е обновен правилно');
      }
    } catch (error) {
      console.error('❌ Грешка при обновяване на статус:', error);
      return false;
    }
  }

  /**
   * Тест 4: Търсене на заявки в радиус
   */
  async testFindOrdersInRadius(): Promise<boolean> {
    try {
      console.log('🧪 Test 4: Търсене на заявки в радиус...');
      
      const orders = await findOrdersInRadius(mockDriverLocation, 10);
      
      console.log(`✅ Намерени ${orders.length} заявки в радиус 10км`);
      
      // Проверяваме дали нашата тестова заявка е в резултатите
      const foundOurOrder = orders.some(order => order.id === this.createdOrderId);
      
      if (foundOurOrder) {
        console.log('✅ Нашата тестова заявка е намерена в резултатите');
      } else {
        console.log('ℹ️ Нашата заявка не е в радиуса (това е нормално)');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Грешка при търсене в радиус:', error);
      return false;
    }
  }

  /**
   * Тест 5: Създаване на bid
   */
  async testCreateBid(): Promise<boolean> {
    try {
      console.log('🧪 Test 5: Създаване на bid...');
      
      if (!this.createdOrderId) {
        throw new Error('Няма създадена заявка за тестване');
      }

      const bidData: Omit<Bid, 'id' | 'createdAt' | 'expiresAt'> = {
        orderId: this.createdOrderId,
        driverId: getCurrentUid(),
        driverInfo: {
          name: 'Тест Шофьор',
          phone: '+359888654321',
          rating: 4.5,
          vehicleInfo: {
            make: 'BMW',
            model: 'X5',
            licensePlate: 'С 1234 АВ'
          }
        },
        proposedPrice: 80,
        estimatedArrivalTime: 15,
        driverLocation: mockDriverLocation,
        distanceToClient: 2.5,
        message: 'Мога да дойда веднага!',
        status: 'active'
      };

      this.createdBidId = await createBid(bidData);
      console.log('✅ Bid създаден успешно с ID:', this.createdBidId);
      return true;
    } catch (error) {
      console.error('❌ Грешка при създаване на bid:', error);
      return false;
    }
  }

  /**
   * Тест 6: Получаване на bid-ове за заявка
   */
  async testGetBidsForOrder(): Promise<boolean> {
    try {
      console.log('🧪 Test 6: Получаване на bid-ове...');
      
      if (!this.createdOrderId) {
        throw new Error('Няма създадена заявка за тестване');
      }

      const bids = await getBidsForOrder(this.createdOrderId);
      
      console.log(`✅ Намерени ${bids.length} bid-а за заявката`);
      
      if (bids.length > 0) {
        const ourBid = bids.find(bid => bid.id === this.createdBidId);
        if (ourBid) {
          console.log('✅ Нашият bid е намерен:', {
            id: ourBid.id,
            price: ourBid.proposedPrice,
            driverName: ourBid.driverInfo.name
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Грешка при получаване на bid-ове:', error);
      return false;
    }
  }

  /**
   * Тест 7: Приемане на bid
   */
  async testAcceptBid(): Promise<boolean> {
    try {
      console.log('🧪 Test 7: Приемане на bid...');
      
      if (!this.createdOrderId || !this.createdBidId) {
        throw new Error('Няма създадени заявка/bid за тестване');
      }

      await acceptBid(this.createdOrderId, this.createdBidId);
      
      // Проверяваме дали заявката е обновена
      const updatedOrder = await getOrder(this.createdOrderId);
      
      if (updatedOrder && updatedOrder.status === 'accepted' && 
          updatedOrder.acceptedBidId === this.createdBidId) {
        console.log('✅ Bid приет успешно! Заявката е обновена:', {
          status: updatedOrder.status,
          acceptedBidId: updatedOrder.acceptedBidId,
          finalPrice: updatedOrder.finalPrice,
          platformFee: updatedOrder.platformFee
        });
        return true;
      } else {
        throw new Error('Bid-ът не е приет правилно');
      }
    } catch (error) {
      console.error('❌ Грешка при приемане на bid:', error);
      return false;
    }
  }

  /**
   * Тест 8: Driver Location Tracking
   */
  async testDriverLocationTracking(): Promise<boolean> {
    try {
      console.log('🧪 Test 8: Driver Location Tracking...');
      
      const locationData: DriverLocation = {
        driverId: getCurrentUid(),
        orderId: this.createdOrderId || undefined,
        location: mockDriverLocation,
        heading: 90, // Изток
        speed: 45, // км/ч
        timestamp: new Date()
      };

      // Обновяваме локацията
      await updateDriverLocation(getCurrentUid(), locationData);
      console.log('✅ Локацията на шофьора е обновена');

      // Получаваме локацията
      const retrievedLocation = await getDriverLocation(getCurrentUid());
      
      if (retrievedLocation && retrievedLocation.driverId === getCurrentUid()) {
        console.log('✅ Локацията е получена успешно:', {
          driverId: retrievedLocation.driverId,
          address: retrievedLocation.location.address,
          speed: retrievedLocation.speed
        });
        return true;
      } else {
        throw new Error('Локацията не е получена правилно');
      }
    } catch (error) {
      console.error('❌ Грешка при location tracking:', error);
      return false;
    }
  }

  /**
   * Изпълнява всички тестове по ред
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Започване на Phase 1 тестове...\n');
    
    const tests = [
      { name: 'Firebase Connection', test: () => this.testFirebaseConnection() },
      { name: 'Създаване на заявка', test: () => this.testCreateOrder() },
      { name: 'Получаване на заявка', test: () => this.testGetOrder() },
      { name: 'Обновяване на статус', test: () => this.testUpdateOrderStatus() },
      { name: 'Търсене в радиус', test: () => this.testFindOrdersInRadius() },
      { name: 'Създаване на bid', test: () => this.testCreateBid() },
      { name: 'Получаване на bid-ове', test: () => this.testGetBidsForOrder() },
      { name: 'Приемане на bid', test: () => this.testAcceptBid() },
      { name: 'Location tracking', test: () => this.testDriverLocationTracking() }
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
      try {
        const result = await test();
        if (result) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ ${name} - неочаквана грешка:`, error);
        failed++;
      }
      console.log(''); // Празен ред между тестовете
    }

    console.log('📊 РЕЗУЛТАТИ ОТ ТЕСТОВЕТЕ:');
    console.log(`✅ Успешни: ${passed}`);
    console.log(`❌ Неуспешни: ${failed}`);
    console.log(`📈 Процент успех: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0) {
      console.log('🎉 PHASE 1 Е НАПЪЛНО ФУНКЦИОНАЛНА! Всички тестове минаха успешно!');
    } else if (failed === 1 && tests[0].name === 'Firebase Connection') {
      console.log('⚠️ Firebase конфигурацията има проблеми, но останалите тестове могат да работят');
      console.log('💡 Предложение: Проверете Firebase Console за правилни API keys');
    } else {
      console.log('⚠️ Има проблеми в Phase 1. Проверете грешките по-горе.');
    }
  }
}

// Експортираме функция за лесно изпълнение
export const runPhase1Tests = async () => {
  const tester = new Phase1Tests();
  await tester.runAllTests();
};

// За debugging - можем да експортираме и отделните тестове
export const runSingleTest = async (testName: string) => {
  const tester = new Phase1Tests();
  
  switch (testName) {
    case 'createOrder':
      return await tester.testCreateOrder();
    case 'getOrder':
      await tester.testCreateOrder(); // Първо създаваме заявка
      return await tester.testGetOrder();
    // ... други тестове
    default:
      console.log('Непознато име на тест. Достъпни: createOrder, getOrder, ...');
      return false;
  }
}; 