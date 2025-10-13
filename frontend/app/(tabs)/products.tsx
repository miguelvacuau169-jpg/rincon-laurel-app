import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import { api } from '../../services/api';

export default function ProductsScreen() {
  const { products, categories, refreshData, createProduct, updateProduct, deleteProduct } = useApp();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [seedLoading, setSeedLoading] = useState(false);

  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].name);
    }
  }, [categories]);

  const handleSeedData = async () => {
    Alert.alert(
      'Cargar Datos de Ejemplo',
      '¿Quieres cargar el menú con productos de ejemplo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cargar',
          onPress: async () => {
            setSeedLoading(true);
            try {
              await api.seedData();
              await refreshData();
              Alert.alert('Éxito', 'Productos cargados correctamente');
            } catch (error) {
              console.error('Error seeding data:', error);
              Alert.alert('Error', 'No se pudieron cargar los productos');
            } finally {
              setSeedLoading(false);
            }
          },
        },
      ]
    );
  };

  const openModal = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setName(product.name);
      setCategory(product.category);
      setPrice(product.price.toString());
    } else {
      setEditingProduct(null);
      setName('');
      setCategory('comida');
      setPrice('');
    }
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setEditingProduct(null);
    setName('');
    setCategory('comida');
    setPrice('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del producto');
      return;
    }

    if (!price.trim() || isNaN(parseFloat(price))) {
      Alert.alert('Error', 'Por favor ingresa un precio válido');
      return;
    }

    try {
      const productData = {
        name: name.trim(),
        category,
        price: parseFloat(price),
        created_at: new Date().toISOString(),
      };

      if (editingProduct) {
        await updateProduct(editingProduct._id, productData);
      } else {
        await createProduct(productData);
      }

      closeModal();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDelete = (product: any) => {
    Alert.alert(
      'Eliminar Producto',
      `¿Estás seguro de que quieres eliminar "${product.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product._id);
            } catch (error) {
              console.error('Error deleting product:', error);
            }
          },
        },
      ]
    );
  };

  const renderProductItem = ({ item }: { item: any }) => {
    const categoryData = categories.find((c) => c.name === item.category);

    return (
      <View style={styles.productCard}>
        <View style={styles.productLeft}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={categoryData?.icon as any || 'restaurant'}
              size={24}
              color={Colors.secondary}
            />
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productCategory}>{item.category}</Text>
          </View>
        </View>

        <View style={styles.productRight}>
          <Text style={styles.productPrice}>€{item.price.toFixed(2)}</Text>
          <View style={styles.productActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openModal(item)}
            >
              <Ionicons name="pencil" size={20} color={Colors.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash" size={20} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestión de Productos</Text>
        <View style={styles.headerButtons}>
          {products.length === 0 && (
            <TouchableOpacity
              style={[styles.headerButton, styles.seedButton]}
              onPress={handleSeedData}
              disabled={seedLoading}
            >
              <Ionicons name="download" size={20} color={Colors.white} />
              <Text style={styles.headerButtonText}>Cargar Datos</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => openModal()}
          >
            <Ionicons name="add" size={20} color={Colors.white} />
            <Text style={styles.headerButtonText}>Nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={products}
        renderItem={renderProductItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" size={64} color={Colors.gray} />
            <Text style={styles.emptyText}>No hay productos</Text>
            <Text style={styles.emptySubtext}>Agrega productos o carga datos de ejemplo</Text>
          </View>
        }
      />

      {/* Product Modal */}
      <Modal
        isVisible={isModalVisible}
        onBackdropPress={closeModal}
        onSwipeComplete={closeModal}
        swipeDirection="down"
        style={styles.modal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContent}
        >
          <View style={styles.modalHandle} />
          
          <Text style={styles.modalTitle}>
            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Nombre</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: Paella Valenciana"
              placeholderTextColor={Colors.gray}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Categoría</Text>
            <View style={styles.categoryButtons}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat._id}
                  style={[
                    styles.categoryButton,
                    category === cat.name && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat.name)}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={20}
                    color={category === cat.name ? Colors.white : Colors.text}
                  />
                  <Text
                    style={[
                      styles.categoryButtonText,
                      category === cat.name && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Precio (€)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="0.00"
              placeholderTextColor={Colors.gray}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={closeModal}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  seedButton: {
    backgroundColor: Colors.accent,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  listContainer: {
    padding: 16,
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
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
  productCategory: {
    fontSize: 14,
    color: Colors.gray,
  },
  productRight: {
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 8,
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 8,
    textAlign: 'center',
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
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.lightGray,
    backgroundColor: Colors.white,
    gap: 8,
  },
  categoryButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  categoryButtonTextActive: {
    color: Colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
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
