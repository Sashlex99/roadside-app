import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { PendingOrder } from '../../../../types/driver';

interface OrdersModalProps {
  visible: boolean;
  onClose: () => void;
  pendingOrders: PendingOrder[];
  filteredOrders: PendingOrder[];
  loadingOrders: boolean;
  refreshingOrders: boolean;
  selectedRadius: number;
  radiusOptions: Array<{ label: string; value: number }>;
  showRadiusDropdown: boolean;
  onRefresh: () => void;
  onRadiusToggle: () => void;
  onRadiusSelect: (radius: number) => void;
  onOrderSelect: (order: PendingOrder) => void;
}

export default function OrdersModal({
  visible,
  onClose,
  pendingOrders,
  filteredOrders,
  loadingOrders,
  refreshingOrders,
  selectedRadius,
  radiusOptions,
  showRadiusDropdown,
  onRefresh,
  onRadiusToggle,
  onRadiusSelect,
  onOrderSelect,
}: OrdersModalProps) {

  const formatTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
    if (minutes < 60) return `преди ${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    return `преди ${hours} ч`;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => {
        onClose();
      }}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlayBackground} />
        </TouchableWithoutFeedback>
        <View style={styles.content}>
              {/* Modal Header */}
              <View style={styles.header}>
                <View style={styles.headerButtons}>
                  {/* Radius Filter Dropdown - Button Only */}
                  <View style={styles.radiusDropdownContainer}>
                    <Text style={styles.radiusLabel}>Радиус:</Text>
                    <TouchableOpacity
                      onPress={onRadiusToggle}
                      style={styles.radiusButton}
                    >
                      <Text style={styles.radiusButtonText}>
                        {selectedRadius === 0 ? 'Всички' : `${selectedRadius}км`}
                      </Text>
                      <Ionicons 
                        name={showRadiusDropdown ? "chevron-up" : "chevron-down"} 
                        size={14} 
                        color={colors.primary} 
                      />
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity
                    onPress={onRefresh}
                    style={styles.refreshButton}
                  >
                    <Ionicons name="refresh" size={24} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Orders List */}
              <ScrollView 
                style={styles.ordersList} 
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingOrders}
                    onRefresh={onRefresh}
                    colors={[colors.primary]}
                    tintColor={colors.primary}
                  />
                }
              >
                {loadingOrders ? (
                  <View style={styles.loadingOrders}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingOrdersText}>Зареждане на поръчки...</Text>
                  </View>
                ) : filteredOrders.length === 0 ? (
                  <View style={styles.noOrders}>
                    <Ionicons name="checkmark-circle-outline" size={64} color={colors.textSecondary} />
                    <Text style={styles.noOrdersText}>Няма чакащи поръчки</Text>
                    <Text style={styles.noOrdersSubtext}>
                      {selectedRadius === 0 
                        ? 'В момента няма активни заявки' 
                        : `В момента няма заявки в радиус ${selectedRadius}км от вашето местоположение`
                      }
                    </Text>
                    <TouchableOpacity
                      style={styles.refreshOnlyButton}
                      onPress={onRefresh}
                    >
                      <Ionicons name="refresh" size={20} color={colors.primary} />
                      <Text style={styles.refreshOnlyButtonText}>Обновяване</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  filteredOrders.map((order) => (
                    <View key={order.id} style={styles.orderCard}>
                      <View style={styles.orderHeader}>
                        <View style={styles.orderDistance}>
                          <Ionicons name="location-outline" size={16} color={colors.primary} />
                          <Text style={styles.orderDistanceText}>{order.distance}км</Text>
                        </View>
                        <Text style={styles.orderTime}>{formatTimeAgo(order.createdAt)}</Text>
                      </View>
                      
                      <Text style={styles.orderDescription}>{order.description}</Text>
                      
                      <View style={styles.orderLocation}>
                        <Ionicons name="pin-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.orderLocationText}>{order.location.address}</Text>
                      </View>
                      
                      {order.destinationLocation?.address && (
                        <View style={styles.orderLocation}>
                          <Ionicons name="navigate-outline" size={14} color={colors.primary} />
                          <Text style={styles.orderLocationText}>До: {order.destinationLocation.address}</Text>
                        </View>
                      )}
                      
                      <View style={styles.clientInfo}>
                        <View style={styles.clientDetails}>
                          <Text style={styles.clientName}>{order.clientName}</Text>
                        </View>
                        
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => onOrderSelect(order)}
                        >
                          <Ionicons name="information-circle-outline" size={20} color={colors.textOnPrimary} />
                          <Text style={styles.acceptButtonText}>Детайли</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
            
            {/* Radius Dropdown - Rendered outside content to avoid z-index issues */}
            {showRadiusDropdown && (
              <View style={styles.radiusDropdownOverlay}>
                <View style={styles.radiusDropdown}>
                  {radiusOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.radiusOption,
                        selectedRadius === option.value && styles.radiusOptionSelected
                      ]}
                      onPress={() => onRadiusSelect(option.value)}
                    >
                      <Text style={[
                        styles.radiusOptionText,
                        selectedRadius === option.value && styles.radiusOptionTextSelected
                      ]}>
                        {option.label}
                      </Text>
                      {selectedRadius === option.value && (
                        <Ionicons name="checkmark" size={16} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    width: '90%',
    maxWidth: 450,
    height: '80%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'visible', // 🔧 Allow dropdown to extend beyond modal bounds
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  refreshButton: {
    padding: 4,
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  },
  ordersList: {
    flex: 1,
  },
  loadingOrders: {
    padding: 40,
    alignItems: 'center',
  },
  loadingOrdersText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  noOrders: {
    padding: 40,
    alignItems: 'center',
  },
  noOrdersText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noOrdersSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderDistanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  orderTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  orderDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  orderLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderLocationText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  clientInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  acceptButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  refreshOnlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    alignSelf: 'center',
  },
  refreshOnlyButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 6,
  },

  // Radius Dropdown Styles
  radiusDropdownContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  radiusDropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'flex-end', // 🔧 Align to right side like the button
    paddingTop: 85, // 🔧 Position dropdown below header
    paddingRight: 110, // 🔧 Align with radius button position
    zIndex: 9999,
  },
  radiusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  radiusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 70,
  },
  radiusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginHorizontal: 2,
  },
  radiusDropdown: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12, // 🔧 Higher elevation than modal content
    minWidth: 120,
    alignSelf: 'flex-end', // 🔧 Align to right side
  },
  radiusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  radiusOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  radiusOptionText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  radiusOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
}); 