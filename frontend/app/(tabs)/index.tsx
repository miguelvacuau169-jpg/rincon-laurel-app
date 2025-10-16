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
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { Colors, StatusColors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Modal from 'react-native-modal';
import { api } from '../../services/api';

export default function OrdersScreen() {
  const { orders, refreshData, updateOrder, deleteOrder, loading, role, isOnline } = useApp();
  const [filter, setFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newPrice, setNewPrice] = useState('');
  const [partialPaymentModalVisible, setPartialPaymentModalVisible] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [selectedProductsForPayment, setSelectedProductsForPayment] = useState<string[]>([]);
  const [partialPaymentMethod, setPartialPaymentMethod] = useState('efectivo');

  const zones = [
    { value: 'all', label: 'Todas' },
    { value: 'terraza_exterior', label: 'Terraza Ext.' },
    { value: 'salon_interior', label: 'Salón' },
    { value: 'terraza_interior', label: 'Terraza Int.' },
  ];

  const filteredOrders = orders.filter((order) => {
    if (filter !== 'all' && order.status !== filter) return false;
    if (zoneFilter !== 'all' && (order.zone || 'terraza_exterior') !== zoneFilter) return false;
    return true;
  });

  const handleStatusChange = async (order: any, newStatus: string) => {
    try {
      // Preparar productos asegurando que todos los campos requeridos estén presentes
      const products = order.products.map((p: any) => ({
        product_id: p.product_id,
        name: p.name,
        category: p.category,
        price: p.price,
        original_price: p.original_price || p.price,
        quantity: p.quantity,
        note: p.note || '',
        is_paid: p.is_paid || false,
      }));

      const updatedOrder = {
        table_number: order.table_number,
        zone: order.zone || 'terraza_exterior',
        waiter_role: order.waiter_role,
        products: products,
        total: order.total,
        status: newStatus,
        payment_method: order.payment_method || null,
        special_note: order.special_note || null,
      };
      
      const result = await updateOrder(order._id, updatedOrder);
      // Actualizar el estado local con el resultado
      setSelectedOrder(result);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'No se pudo cambiar el estado del pedido');
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

  const openEditPriceModal = (product: any) => {
    setEditingProduct(product);
    setNewPrice(product.price.toString());
  };

  const handleSavePrice = async () => {
    if (!editingProduct || !selectedOrder) return;

    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
      Alert.alert('Error', 'Precio inválido');
      return;
    }

    const updatedProducts = selectedOrder.products.map((p: any) => ({
      product_id: p.product_id,
      name: p.name,
      category: p.category,
      price: p.product_id === editingProduct.product_id ? price : p.price,
      original_price: p.original_price || p.price,
      quantity: p.quantity,
      note: p.note || '',
      is_paid: p.is_paid || false,
    }));

    // Recalcular total
    const newTotal = updatedProducts.reduce((sum: number, p: any) => sum + (p.price * p.quantity), 0);

    try {
      const updatedOrder = {
        table_number: selectedOrder.table_number,
        zone: selectedOrder.zone || 'terraza_exterior',
        waiter_role: selectedOrder.waiter_role,
        products: updatedProducts,
        total: newTotal,
        status: selectedOrder.status,
        payment_method: selectedOrder.payment_method || null,
        special_note: selectedOrder.special_note || null,
      };
      
      const result = await updateOrder(selectedOrder._id, updatedOrder);
      setEditingProduct(null);
      setNewPrice('');
      // Actualizar estado local con el resultado
      setSelectedOrder(result);
    } catch (error) {
      console.error('Error updating price:', error);
      Alert.alert('Error', 'No se pudo actualizar el precio');
    }
  };

  const openPartialPaymentModal = () => {
    setPartialPaymentModalVisible(true);
    setPartialAmount('');
    setSelectedProductsForPayment([]);
    setPartialPaymentMethod('efectivo');
  };

  const toggleProductForPayment = (productId: string) => {
    setSelectedProductsForPayment((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handlePartialPayment = async () => {
    if (!selectedOrder) return;

    if (selectedProductsForPayment.length === 0 && !partialAmount) {
      Alert.alert('Error', 'Selecciona productos o ingresa un monto');
      return;
    }

    try {
      // Calcular monto basado en productos seleccionados
      let calculatedAmount = 0;
      if (selectedProductsForPayment.length > 0) {
        calculatedAmount = selectedOrder.products
          .filter((p: any) => selectedProductsForPayment.includes(p.product_id) && !p.is_paid)
          .reduce((sum: number, p: any) => sum + (p.price * p.quantity), 0);
      } else if (partialAmount) {
        calculatedAmount = parseFloat(partialAmount);
      }

      if (calculatedAmount <= 0) {
        Alert.alert('Error', 'Monto inválido');
        return;
      }

      // Marcar productos como pagados
      const updatedProducts = selectedOrder.products.map((p: any) => ({
        ...p,
        is_paid: selectedProductsForPayment.includes(p.product_id) ? true : p.is_paid,
      }));

      // Calcular nuevo paid_amount y pending_amount
      const newPaidAmount = (selectedOrder.paid_amount || 0) + calculatedAmount;
      const newPendingAmount = selectedOrder.total - newPaidAmount;

      // Agregar a partial_payments
      const partialPayments = selectedOrder.partial_payments || [];
      partialPayments.push({
        amount: calculatedAmount,
        payment_method: partialPaymentMethod,
        paid_products: selectedProductsForPayment,
        timestamp: new Date().toISOString(),
        note: '',
      });

      const updatedOrder = {
        table_number: selectedOrder.table_number,
        zone: selectedOrder.zone || 'terraza_exterior',
        waiter_role: selectedOrder.waiter_role,
        products: updatedProducts,
        total: selectedOrder.total,
        paid_amount: newPaidAmount,
        pending_amount: newPendingAmount,
        status: selectedOrder.status,
        payment_method: partialPaymentMethod,
        partial_payments: partialPayments,
        special_note: selectedOrder.special_note || null,
      };

      await updateOrder(selectedOrder._id, updatedOrder);
      await refreshData();
      setPartialPaymentModalVisible(false);
      setSelectedOrder(null);
      Alert.alert('Éxito', 'Pago parcial registrado');
    } catch (error) {
      console.error('Error adding partial payment:', error);
      Alert.alert('Error', 'No se pudo registrar el pago parcial');
    }
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const orderDate = new Date(item.created_at);
    const timeStr = format(orderDate, 'HH:mm');

    const zoneLabel = zones.find((z) => z.value === (item.zone || 'terraza_exterior'))?.label || (item.zone || 'Terraza Ext.');

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
            <View style={styles.zoneBadge}>
              <Ionicons name="location" size={12} color={Colors.secondary} />
              <Text style={styles.zoneText}>{zoneLabel}</Text>
            </View>
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
          <View style={styles.orderBodyLeft}>
            <Text style={styles.productsText}>
              {item.products.length} producto{item.products.length !== 1 ? 's' : ''}
            </Text>
            {item.payment_method && (
              <View style={styles.paymentBadge}>
                <Ionicons 
                  name={item.payment_method === 'efectivo' ? 'cash' : item.payment_method === 'tarjeta' ? 'card' : 'swap-horizontal'} 
                  size={12} 
                  color={Colors.accent} 
                />
                <Text style={styles.paymentText}>
                  {item.payment_method === 'efectivo' ? 'Efectivo' : 
                   item.payment_method === 'tarjeta' ? 'Tarjeta' : 'Ambos'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.orderBodyRight}>
            <Text style={styles.totalText}>€{item.total.toFixed(2)}</Text>
            {(item.pending_amount || 0) > 0 && (
              <Text style={styles.pendingText}>Pendiente: €{(item.pending_amount || 0).toFixed(2)}</Text>
            )}
          </View>
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
              {role === 'barra' ? '👨‍🍳' : role === 'camarero_1' ? '🍽️' : role === 'camarero_2' ? '🍷' : '⚙️'} {' '}
              {role === 'administrador' ? 'Admin' : role?.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {zones.map((z) => (
            <TouchableOpacity
              key={z.value}
              style={[styles.filterButton, zoneFilter === z.value && styles.filterButtonActive]}
              onPress={() => setZoneFilter(z.value)}
            >
              <Text style={[styles.filterText, zoneFilter === z.value && styles.filterTextActive]}>
                {z.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
        isVisible={selectedOrder !== null && !editingProduct}
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
                  {format(new Date(selectedOrder.created_at), 'dd/MM HH:mm')}
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Productos</Text>
                {selectedOrder.products.map((product: any, index: number) => (
                  <View key={index} style={styles.productRow}>
                    <View style={styles.productLeft}>
                      <Text style={styles.productQuantity}>{product.quantity}x</Text>
                      <View style={styles.productDetails}>
                        <Text style={styles.productName}>{product.name}</Text>
                        {product.note && <Text style={styles.productNote}>{product.note}</Text>}
                        {product.price !== product.original_price && (
                          <Text style={styles.priceModified}>Precio modificado</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.productRight}>
                      <Text style={styles.productPrice}>€{(product.price * product.quantity).toFixed(2)}</Text>
                      <TouchableOpacity
                        style={styles.editPriceButton}
                        onPress={() => openEditPriceModal(product)}
                      >
                        <Ionicons name="pencil" size={16} color={Colors.secondary} />
                      </TouchableOpacity>
                    </View>
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
                {(selectedOrder.paid_amount || 0) > 0 && (
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Pagado</Text>
                    <Text style={styles.paidAmount}>€{(selectedOrder.paid_amount || 0).toFixed(2)}</Text>
                  </View>
                )}
                {(selectedOrder.pending_amount || 0) > 0 && (
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Pendiente</Text>
                    <Text style={styles.pendingAmount}>€{(selectedOrder.pending_amount || 0).toFixed(2)}</Text>
                  </View>
                )}
              </View>

              {(selectedOrder.pending_amount || 0) > 0 && (
                <TouchableOpacity
                  style={styles.partialPaymentButton}
                  onPress={openPartialPaymentModal}
                >
                  <Ionicons name="cash" size={20} color={Colors.white} />
                  <Text style={styles.partialPaymentButtonText}>Cobro Parcial</Text>
                </TouchableOpacity>
              )}

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

      {/* Edit Price Modal */}
      <Modal
        isVisible={editingProduct !== null}
        onBackdropPress={() => setEditingProduct(null)}
        style={styles.modal}
      >
        {editingProduct && (
          <View style={styles.smallModalContent}>
            <Text style={styles.smallModalTitle}>Editar Precio</Text>
            <Text style={styles.smallModalSubtitle}>{editingProduct.name}</Text>
            <Text style={styles.originalPriceText}>
              Precio original: €{editingProduct.original_price.toFixed(2)}
            </Text>
            <TextInput
              style={styles.priceInput}
              placeholder="Nuevo precio"
              placeholderTextColor={Colors.gray}
              value={newPrice}
              onChangeText={setNewPrice}
              keyboardType="decimal-pad"
            />
            <View style={styles.smallModalActions}>
              <TouchableOpacity
                style={[styles.smallModalButton, styles.cancelButton]}
                onPress={() => setEditingProduct(null)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallModalButton, styles.saveButton]}
                onPress={handleSavePrice}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* Partial Payment Modal */}
      <Modal
        isVisible={partialPaymentModalVisible}
        onBackdropPress={() => setPartialPaymentModalVisible(false)}
        style={styles.modal}
      >
        <View style={styles.smallModalContent}>
          <Text style={styles.smallModalTitle}>Cobro Parcial</Text>
          <Text style={styles.smallModalSubtitle}>
            Pendiente: €{(selectedOrder?.pending_amount || selectedOrder?.total || 0).toFixed(2)}
          </Text>
          
          <Text style={styles.selectProductsLabel}>Selecciona productos pagados:</Text>
          <ScrollView style={styles.productsList}>
            {selectedOrder?.products
              .filter((p: any) => !p.is_paid)
              .map((product: any, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.productCheckbox,
                    selectedProductsForPayment.includes(product.product_id) && styles.productCheckboxActive,
                  ]}
                  onPress={() => toggleProductForPayment(product.product_id)}
                >
                  <Text style={styles.productCheckboxText}>
                    {product.quantity}x {product.name} - €{(product.price * product.quantity).toFixed(2)}
                  </Text>
                  {selectedProductsForPayment.includes(product.product_id) && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.secondary} />
                  )}
                </TouchableOpacity>
              ))}
          </ScrollView>

          <Text style={styles.selectProductsLabel}>Método de Pago:</Text>
          <View style={styles.paymentMethodButtons}>
            {[
              { value: 'efectivo', label: 'Efectivo', icon: 'cash' },
              { value: 'tarjeta', label: 'Tarjeta', icon: 'card' },
              { value: 'ambos', label: 'Ambos', icon: 'swap-horizontal' }
            ].map((method) => (
              <TouchableOpacity
                key={method.value}
                style={[
                  styles.paymentMethodButton,
                  partialPaymentMethod === method.value && styles.paymentMethodButtonActive,
                ]}
                onPress={() => setPartialPaymentMethod(method.value)}
              >
                <Ionicons 
                  name={method.icon as any}
                  size={18} 
                  color={partialPaymentMethod === method.value ? Colors.white : Colors.text} 
                />
                <Text style={[
                  styles.paymentMethodText,
                  partialPaymentMethod === method.value && styles.paymentMethodTextActive,
                ]}>
                  {method.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.priceInput}
            placeholder="Monto a cobrar (opcional si seleccionaste productos)"
            placeholderTextColor={Colors.gray}
            value={partialAmount}
            onChangeText={setPartialAmount}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={() => {}}
          />
          <View style={styles.smallModalActions}>
            <TouchableOpacity
              style={[styles.smallModalButton, styles.cancelButton]}
              onPress={() => setPartialPaymentModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallModalButton, styles.saveButton]}
              onPress={handlePartialPayment}
            >
              <Text style={styles.saveButtonText}>Cobrar</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    marginBottom: 8,
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
    gap: 8,
    flex: 1,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  zoneText: {
    fontSize: 11,
    color: Colors.secondary,
    fontWeight: '600',
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
  orderBodyLeft: {
    flex: 1,
    gap: 4,
  },
  orderBodyRight: {
    alignItems: 'flex-end',
  },
  productsText: {
    fontSize: 14,
    color: Colors.gray,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '500',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  pendingText: {
    fontSize: 12,
    color: Colors.warning,
    marginTop: 2,
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
  productDetails: {
    flex: 1,
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
  priceModified: {
    fontSize: 11,
    color: Colors.warning,
    marginTop: 2,
  },
  productRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  editPriceButton: {
    padding: 4,
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
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: Colors.gray,
  },
  paidAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.success,
  },
  pendingAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.warning,
  },
  partialPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 16,
  },
  partialPaymentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
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
  smallModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
  },
  smallModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  smallModalSubtitle: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
  },
  originalPriceText: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 12,
  },
  priceInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    marginBottom: 16,
  },
  selectProductsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  productsList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  productCheckbox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  productCheckboxActive: {
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  productCheckboxText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  smallModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  smallModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.lightGray,
  },
  saveButton: {
    backgroundColor: Colors.secondary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
