import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus } from '../../types/firestore';
import { subscribeToClientOrders } from '../../services/firestore';

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Очаква',
  searching: 'Търси шофьори',
  bidding: 'Получаване на оферти',
  payment_pending: 'Чака плащане',
  accepted: 'Приета',
  in_progress: 'В процес',
  completed: 'Завършена',
  cancelled: 'Отменена',
  expired: 'Изтекла'
};

export default function MyOrdersScreen() {
  const navigation = useNavigation();
  const { user, authReady } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady || !user?.uid) {
      setOrders([]);
      setLoading(true);
      return;
    }

    const unsub = subscribeToClientOrders(user.uid, (o) => {
      setOrders(o);
      setLoading(false);
    });
    return () => unsub();
  }, [authReady, user?.uid]);

  const renderItem = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.description}>{item.description}</Text>
        <Text style={styles.status}>{statusLabels[item.status]}</Text>
      </View>
      <Text style={styles.address}>{item.location.address}</Text>
      {item.destinationLocation?.address && (
        <Text style={styles.address}>→ {item.destinationLocation.address}</Text>
      )}
      <Text style={styles.date}>{item.createdAt.toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Моите заявки</Text>
      </View>
      {loading ? (
        <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ textAlign:'center', color:colors.textSecondary }}>Нямате заявки</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor: colors.background },
  header:{ flexDirection:'row', alignItems:'center', padding:16, backgroundColor: colors.surface, elevation:4 },
  headerTitle:{ fontSize:18, fontWeight:'bold', color: colors.text, marginLeft:8 },
  card:{ backgroundColor: colors.surface, borderRadius:12, padding:16, marginBottom:12, elevation:2 },
  rowBetween:{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 },
  description:{ fontSize:16, fontWeight:'600', color: colors.text },
  status:{ fontSize:14, color: colors.primary },
  address:{ fontSize:13, color: colors.textSecondary },
  date:{ fontSize:12, color: colors.textSecondary, marginTop:6 },
}); 
