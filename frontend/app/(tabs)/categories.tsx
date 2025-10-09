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

export default function CategoriesScreen() {
  const { categories, refreshData } = useApp();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('restaurant');

  const iconOptions = [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'pizza', label: 'Pizza' },
    { value: 'beer', label: 'Beer' },
    { value: 'ice-cream', label: 'Ice Cream' },
    { value: 'fish', label: 'Fish' },
    { value: 'nutrition', label: 'Nutrition' },
    { value: 'cafe', label: 'Cafe' },
    { value: 'wine', label: 'Wine' },
  ];

  const openModal = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setName(category.name);
      setIcon(category.icon || 'restaurant');
    } else {
      setEditingCategory(null);
      setName('');
      setIcon('restaurant');
    }
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setEditingCategory(null);
    setName('');
    setIcon('restaurant');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre de la categoría');
      return;
    }

    try {
      const categoryData = {
        name: name.trim(),
        icon,
        created_at: new Date().toISOString(),
      };

      if (editingCategory) {
        await api.updateCategory(editingCategory._id, categoryData);
      } else {
        await api.createCategory(categoryData);
      }

      await refreshData();
      closeModal();
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Error', 'No se pudo guardar la categoría');
    }
  };

  const handleDelete = (category: any) => {
    Alert.alert(
      'Eliminar Categoría',
      `¿Estás seguro de que quieres eliminar "${category.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteCategory(category._id);
              await refreshData();
            } catch (error) {
              console.error('Error deleting category:', error);
              Alert.alert('Error', 'No se pudo eliminar la categoría');
            }
          },
        },
      ]
    );
  };

  const renderCategoryItem = ({ item }: { item: any }) => {
    return (
      <View style={styles.categoryCard}>
        <View style={styles.categoryLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name={item.icon as any} size={32} color={Colors.secondary} />
          </View>
          <Text style={styles.categoryName}>{item.name}</Text>
        </View>

        <View style={styles.categoryActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openModal(item)}>
            <Ionicons name="pencil" size={20} color={Colors.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
            <Ionicons name="trash" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestión de Categorías</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => openModal()}>
          <Ionicons name="add" size={20} color={Colors.white} />
          <Text style={styles.headerButtonText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="apps-outline" size={64} color={Colors.gray} />
            <Text style={styles.emptyText}>No hay categorías</Text>
          </View>
        }
      />

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
            {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Nombre</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: Entrantes"
              placeholderTextColor={Colors.gray}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Icono</Text>
            <View style={styles.iconGrid}>
              {iconOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.iconOption,
                    icon === opt.value && styles.iconOptionActive,
                  ]}
                  onPress={() => setIcon(opt.value)}
                >
                  <Ionicons
                    name={opt.value as any}
                    size={24}
                    color={icon === opt.value ? Colors.white : Colors.text}
                  />
                </TouchableOpacity>
              ))}
            </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
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
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  listContainer: {
    padding: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryActions: {
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
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconOption: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionActive: {
    backgroundColor: Colors.secondary,
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
