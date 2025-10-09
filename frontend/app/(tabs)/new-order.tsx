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
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface CartProduct {
  product_id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  note: string;
}

export default function NewOrderScreen() {
  const { products, role, createOrder } = useApp();
  const router = useRouter();
  const [tableNumber, setTableNumber] = useState('');
  const [cart, setCart] = useState<CartProduct[]>([]);
  const [specialNote, setSpecialNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', 'comida', 'bebida', 'postre'];

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
          quantity: 1,
          note: '',
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
        waiter_role: role,
        products: cart,
        total: calculateTotal(),
        status: 'pendiente',
        special_note: specialNote || undefined,
      });

      Alert.alert('Éxito', 'Pedido creado correctamente', [
        {
          text: 'OK',
          onPress: () => {
            setTableNumber('');
            setCart([]);
            setSpecialNote('');
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
            <Text style={styles.sectionTitle}>Productos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
              {categories.map((cat) => (
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
                    {cat === 'all' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1)}
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
                      <Text style={styles.cartItemPrice}>
                        €{(item.price * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeFromCart(item.product_id)}
                    >
                      <Ionicons name="trash" size={20} color={Colors.error} />
                    </TouchableOpacity>
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
});
