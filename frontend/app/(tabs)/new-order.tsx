import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Modal from 'react-native-modal';
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface CartProduct {
  product_id: string;
  name: string;
  category: string;
  price: number;
  original_price: number;
  quantity: number;
  note: string;
  is_paid: boolean;
}

export default function NewOrderScreen() {
  const { products, categories, role, createOrder } = useApp();
  const router = useRouter();
  const [tableNumber, setTableNumber] = useState('');
  const [zone, setZone] = useState('terraza_exterior');
  const [cart, setCart] = useState<CartProduct[]>([]);
  const [specialNote, setSpecialNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [editingCartItem, setEditingCartItem] = useState<CartProduct | null>(null);
  const [editPrice, setEditPrice] = useState('');

  const zones = [
    { value: 'terraza_exterior', label: 'Terraza Exterior', icon: 'sunny' },
    { value: 'salon_interior', label: 'Salón Interior', icon: 'home' },
    { value: 'terraza_interior', label: 'Terraza Interior', icon: 'leaf' },
    { value: 'barra', label: 'Barra', icon: 'beer' },
  ];

  const paymentMethods = [
    { value: 'efectivo', label: 'Efectivo', icon: 'cash' },
    { value: 'tarjeta', label: 'Tarjeta', icon: 'card' },
    { value: 'ambos', label: 'Ambos', icon: 'swap-horizontal' },
  ];

  const allCategories = ['all', ...categories.map(c => c.name)];

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  const addToCart = (product: any) => {
    const existingIndex = cart.findIndex((item) => item.product_id === product._id);
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product_id: product._id,
          name: product.name,
          category: product.category,
          price: product.price,
          original_price: product.price,
          quantity: 1,
          note: '',
          is_paid: false,
        },
      ]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    const newCart = cart.map((item) => {
      if (item.product_id === productId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    });
    setCart(newCart);
  };

  const updateNote = (productId: string, note: string) => {
    const newCart = cart.map((item) => {
      if (item.product_id === productId) {
        return { ...item, note };
      }
      return item;
    });
    setCart(newCart);
  };

  const openEditPriceModal = (item: CartProduct) => {
    setEditingCartItem(item);
    setEditPrice(item.price.toString());
  };

  const handleSaveEditPrice = () => {
    if (!editingCartItem) return;

    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      Alert.alert('Error', 'Precio inválido');
      return;
    }

    const newCart = cart.map((item) => {
      if (item.product_id === editingCartItem.product_id) {
        return { ...item, price: newPrice };
      }
      return item;
    });
    setCart(newCart);
    setEditingCartItem(null);
    setEditPrice('');
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleSubmit = async () => {
    if (!tableNumber.trim()) {
      Alert.alert('Error', 'Por favor ingresa el número de mesa');
      return;
    }

    if (cart.length === 0) {
      Alert.alert('Error', 'Agrega al menos un producto al pedido');
      return;
    }

    try {
      await createOrder({
        table_number: parseInt(tableNumber),
        zone,
        waiter_role: role,
        products: cart,
        total: calculateTotal(),
        paid_amount: 0,
        pending_amount: calculateTotal(),
        status: 'pendiente',
        payment_method: paymentMethod,
        special_note: specialNote || undefined,
      });

      Alert.alert('Éxito', 'Pedido creado correctamente', [
        {
          text: 'OK',
          onPress: () => {
            setTableNumber('');
            setZone('terraza_exterior');
            setCart([]);
            setSpecialNote('');
            setPaymentMethod('efectivo');
            router.push('/(tabs)/');
          },
        },
      ]);
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Número de Mesa</Text>
            <TextInput
              style={styles.tableInput}
              placeholder="Ingresa el número de mesa"
              placeholderTextColor={Colors.gray}
              value={tableNumber}
              onChangeText={setTableNumber}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zona del Restaurante</Text>
            <View style={styles.zonesContainer}>
              {zones.map((z) => (
                <TouchableOpacity
                  key={z.value}
                  style={[
                    styles.zoneButton,
                    zone === z.value && styles.zoneButtonActive,
                  ]}
                  onPress={() => setZone(z.value)}
                >
                  <Ionicons
                    name={z.icon as any}
                    size={24}
                    color={zone === z.value ? Colors.white : Colors.text}
                  />
                  <Text
                    style={[
                      styles.zoneText,
                      zone === z.value && styles.zoneTextActive,
                    ]}
                  >
                    {z.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Método de Pago</Text>
            <View style={styles.paymentContainer}>
              {paymentMethods.map((pm) => (
                <TouchableOpacity
                  key={pm.value}
                  style={[
                    styles.paymentButton,
                    paymentMethod === pm.value && styles.paymentButtonActive,
                  ]}
                  onPress={() => setPaymentMethod(pm.value)}
                >
                  <Ionicons
                    name={pm.icon as any}
                    size={20}
                    color={paymentMethod === pm.value ? Colors.white : Colors.text}
                  />
                  <Text
                    style={[
                      styles.paymentText,
                      paymentMethod === pm.value && styles.paymentTextActive,
                    ]}
                  >
                    {pm.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Productos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
              {allCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    selectedCategory === cat && styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === cat && styles.categoryTextActive,
                    ]}
                  >
                    {cat === 'all' ? 'Todos' : cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.productsGrid}>
              {filteredProducts.map((product) => (
                <TouchableOpacity
                  key={product._id}
                  style={styles.productCard}
                  onPress={() => addToCart(product)}
                  activeOpacity={0.7}
                >
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productPrice}>€{product.price.toFixed(2)}</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={Colors.secondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {cart.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Carrito ({cart.length})</Text>
              {cart.map((item) => (
                <View key={item.product_id} style={styles.cartItem}>
                  <View style={styles.cartItemHeader}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.cartItemPrice}>
                          €{(item.price * item.quantity).toFixed(2)}
                        </Text>
                        {item.price !== item.original_price && (
                          <Text style={styles.priceModified}>(Modificado)</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.cartItemActions}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => openEditPriceModal(item)}
                      >
                        <Ionicons name="pencil" size={18} color={Colors.secondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeFromCart(item.product_id)}
                      >
                        <Ionicons name="trash" size={18} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.cartItemControls}>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.product_id, -1)}
                      >
                        <Ionicons name="remove" size={20} color={Colors.white} />
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.product_id, 1)}
                      >
                        <Ionicons name="add" size={20} color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TextInput
                    style={styles.noteInput}
                    placeholder="Nota (ej: sin sal, poco hecho...)"
                    placeholderTextColor={Colors.gray}
                    value={item.note}
                    onChangeText={(text) => updateNote(item.product_id, text)}
                  />
                </View>
              ))}

              <TextInput
                style={styles.specialNoteInput}
                placeholder="Nota especial del pedido (opcional)"
                placeholderTextColor={Colors.gray}
                value={specialNote}
                onChangeText={setSpecialNote}
                multiline
                numberOfLines={3}
              />

              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>€{calculateTotal().toFixed(2)}</Text>
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
                <Text style={styles.submitButtonText}>Crear Pedido</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de editar precio */}
      <Modal
        isVisible={editingCartItem !== null}
        onBackdropPress={() => setEditingCartItem(null)}
        style={styles.modal}
      >
        {editingCartItem && (
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Precio</Text>
            <Text style={styles.modalSubtitle}>{editingCartItem.name}</Text>
            <Text style={styles.originalPrice}>
              Precio original: €{editingCartItem.original_price.toFixed(2)}
            </Text>
            <TextInput
              style={styles.priceInput}
              placeholder="Nuevo precio"
              placeholderTextColor={Colors.gray}
              value={editPrice}
              onChangeText={setEditPrice}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditingCartItem(null)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveEditPrice}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
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
  flex: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 12,
  },
  tableInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 2,
    borderColor: Colors.lightGray,
  },
  zonesContainer: {
    gap: 12,
  },
  zoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: Colors.lightGray,
  },
  zoneButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  zoneText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  zoneTextActive: {
    color: Colors.white,
  },
  paymentContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 2,
    borderColor: Colors.lightGray,
  },
  paymentButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  paymentTextActive: {
    color: Colors.white,
  },
  categories: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
  },
  categoryButtonActive: {
    backgroundColor: Colors.secondary,
  },
  categoryText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: Colors.white,
  },
  productsGrid: {
    gap: 12,
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '600',
  },
  cartItem: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  cartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '600',
  },
  removeButton: {
    padding: 8,
  },
  cartItemControls: {
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    minWidth: 30,
    textAlign: 'center',
  },
  noteInput: {
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
  },
  specialNoteInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceModified: {
    fontSize: 11,
    color: Colors.warning,
    fontStyle: 'italic',
  },
  cartItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
  },
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 16,
  },
  priceInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
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
