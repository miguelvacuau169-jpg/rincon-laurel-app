import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { Colors, StatusColors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Modal from 'react-native-modal';

export default function OrdersScreen() {
  const { orders, refreshData, updateOrder, deleteOrder, loading, role, isOnline } = useApp();
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const handleStatusChange = async (order: any, newStatus: string) => {
    try {
      await updateOrder(order._id, { ...order, status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    Alert.alert(
      'Eliminar Pedido',
      '¿Estás seguro de que quieres eliminar este pedido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrder(orderId);
              setSelectedOrder(null);
            } catch (error) {
              console.error('Error deleting order:', error);
            }
          },
        },
      ]
    );
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const orderDate = new Date(item.created_at);
    const timeStr = format(orderDate, 'HH:mm', { locale: es });

    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          { borderLeftColor: StatusColors[item.status as keyof typeof StatusColors] || Colors.gray },
        ]}
        onPress={() => setSelectedOrder(item)}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.tableNumber}>Mesa {item.table_number}</Text>
            <Text style={styles.orderTime}>{timeStr}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: StatusColors[item.status as keyof typeof StatusColors] || Colors.gray }]}>
            <Text style={styles.statusText}>
              {item.status === 'pendiente' ? 'Pendiente' : 
               item.status === 'en_preparacion' ? 'En Prep.' : 
               item.status === 'listo' ? 'Listo' : 'Entregado'}
            </Text>
          </View>
        </View>

        <View style={styles.orderBody}>
          <Text style={styles.productsText}>
            {item.products.length} producto{item.products.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.totalText}>€{item.total.toFixed(2)}</Text>
        </View>

        {item.unified_with && item.unified_with.length > 0 && (
          <View style={styles.unifiedBadge}>
            <Ionicons name="link" size={12} color={Colors.info} />
            <Text style={styles.unifiedText}>Unificado</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Pedidos</Text>
          <View style={styles.headerRight}>
            {!isOnline && (
              <Ionicons name="cloud-offline" size={20} color={Colors.error} style={{ marginRight: 8 }} />
            )}
            <Text style={styles.roleText}>
              {role === 'barra' ? '👨‍🍳 Barra' : role === 'camarero_1' ? '🍽️ Camarero 1' : '🍷 Camarero 2'}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'pendiente' && styles.filterButtonActive]}
            onPress={() => setFilter('pendiente')}
          >
            <Text style={[styles.filterText, filter === 'pendiente' && styles.filterTextActive]}>Pendiente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'en_preparacion' && styles.filterButtonActive]}
            onPress={() => setFilter('en_preparacion')}
          >
            <Text style={[styles.filterText, filter === 'en_preparacion' && styles.filterTextActive]}>En Preparación</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'listo' && styles.filterButtonActive]}
            onPress={() => setFilter('listo')}
          >
            <Text style={[styles.filterText, filter === 'listo' && styles.filterTextActive]}>Listo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'entregado' && styles.filterButtonActive]}
            onPress={() => setFilter('entregado')}
          >
            <Text style={[styles.filterText, filter === 'entregado' && styles.filterTextActive]}>Entregado</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshData} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={Colors.gray} />
            <Text style={styles.emptyText}>No hay pedidos</Text>
          </View>
        }
      />

      {/* Order Detail Modal */}
      <Modal
        isVisible={selectedOrder !== null}
        onBackdropPress={() => setSelectedOrder(null)}
        onSwipeComplete={() => setSelectedOrder(null)}
        swipeDirection="down"
        style={styles.modal}
      >
        {selectedOrder && (
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Mesa {selectedOrder.table_number}</Text>
                <Text style={styles.modalTime}>
                  {format(new Date(selectedOrder.created_at), 'dd MMM, HH:mm', { locale: es })}
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Productos</Text>
                {selectedOrder.products.map((product: any, index: number) => (
                  <View key={index} style={styles.productRow}>
                    <View style={styles.productLeft}>
                      <Text style={styles.productQuantity}>{product.quantity}x</Text>
                      <View>
                        <Text style={styles.productName}>{product.name}</Text>
                        {product.note && <Text style={styles.productNote}>{product.note}</Text>}
                      </View>
                    </View>
                    <Text style={styles.productPrice}>€{(product.price * product.quantity).toFixed(2)}</Text>
                  </View>
                ))}
              </View>

              {selectedOrder.special_note && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Nota Especial</Text>
                  <Text style={styles.noteText}>{selectedOrder.special_note}</Text>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Estado</Text>
                <View style={styles.statusButtons}>
                  {['pendiente', 'en_preparacion', 'listo', 'entregado'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButton,
                        selectedOrder.status === status && styles.statusButtonActive,
                        { borderColor: StatusColors[status as keyof typeof StatusColors] },
                      ]}
                      onPress={() => handleStatusChange(selectedOrder, status)}
                    >
                      <Text
                        style={[
                          styles.statusButtonText,
                          selectedOrder.status === status && styles.statusButtonTextActive,
                        ]}
                      >
                        {status === 'pendiente' ? 'Pendiente' : 
                         status === 'en_preparacion' ? 'En Preparación' : 
                         status === 'listo' ? 'Listo' : 'Entregado'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalSection}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalAmount}>€{selectedOrder.total.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDeleteOrder(selectedOrder._id)}
                >
                  <Ionicons name="trash" size={20} color={Colors.white} />
                  <Text style={styles.actionButtonText}>Eliminar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.closeButton]}
                  onPress={() => setSelectedOrder(null)}
                >
                  <Text style={styles.actionButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleText: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '600',
  },
  filters: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
  },
  filterButtonActive: {
    backgroundColor: Colors.secondary,
  },
  filterText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.white,
  },
  listContainer: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  orderTime: {
    fontSize: 14,
    color: Colors.gray,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  orderBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productsText: {
    fontSize: 14,
    color: Colors.gray,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  unifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  unifiedText: {
    fontSize: 12,
    color: Colors.info,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray,
    marginTop: 16,
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  modalTime: {
    fontSize: 14,
    color: Colors.gray,
  },
  modalSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  productLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  productQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary,
    minWidth: 30,
  },
  productName: {
    fontSize: 14,
    color: Colors.text,
  },
  productNote: {
    fontSize: 12,
    color: Colors.gray,
    fontStyle: 'italic',
    marginTop: 2,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  noteText: {
    fontSize: 14,
    color: Colors.text,
    fontStyle: 'italic',
    backgroundColor: Colors.lightGray,
    padding: 12,
    borderRadius: 8,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: Colors.white,
  },
  statusButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  statusButtonText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  statusButtonTextActive: {
    color: Colors.white,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  closeButton: {
    backgroundColor: Colors.secondary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
