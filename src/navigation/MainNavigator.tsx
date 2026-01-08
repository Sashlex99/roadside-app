import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import AuthStack from './AuthStack';
import ClientHomeScreen from '../screens/client/ClientHomeScreen';
import DriverHomeScreen from '../screens/driver/DriverHomeScreen';

import MyOrdersScreen from '../screens/client/MyOrdersScreen';
import TestScreen from '../screens/TestScreen';
import { ActivityIndicator, View } from 'react-native';

const Stack = createStackNavigator();

export default function MainNavigator() {
  const { user, loading } = useAuth();

  // Debug logs (development only)
  if (__DEV__) {
    console.log('MainNavigator - Loading:', loading);
    console.log('MainNavigator - User:', user?.uid ? 'User logged in' : 'No user');
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user.userType === 'client' ? (
            <>
              <Stack.Screen name="ClientHome" component={ClientHomeScreen} />
              <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
              <Stack.Screen name="ImageTest" component={TestScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
              <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
              <Stack.Screen name="ImageTest" component={TestScreen} />
            </>
          )}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
} 