import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, initSocket, disconnectSocket, offlineStorage } from '../services/api';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

interface Product {
  _id: string;
  name: string;
  category: string;
  price: number;
  created_at: string;
}

interface Category {
  _id: string;
  name: string;
  icon: string;
  created_at: string;
}

interface OrderProduct {
  product_id: string;
  name: string;
  category: string;
  price: number;
  original_price: number;
  quantity: number;
  note?: string;
  is_paid: boolean;
}

interface Order {
  _id: string;
  table_number: number;
  zone: string;
  waiter_role: string;
  created_by?: string;
  products: OrderProduct[];
  total: number;
  paid_amount: number;
  pending_amount: number;
  status: string;
  payment_method?: string;
  partial_payments: any[];
  special_note?: string;
  created_at: string;
  updated_at: string;
  unified_with?: string[];
}

interface AppContextType {
  role: string | null;
  username: string | null;
  setRole: (role: string) => void;
  orders: Order[];
  products: Product[];
  categories: Category[];
  isOnline: boolean;
  refreshData: () => Promise<void>;
  createOrder: (order: any) => Promise<void>;
  updateOrder: (id: string, order: any) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  createProduct: (product: any) => Promise<void>;
  updateProduct: (id: string, product: any) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  createCategory: (category: any) => Promise<void>;
  updateCategory: (id: string, category: any) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRoleState] = useState<string | null>(null);
  const [username, setUsernameState] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);

  const ROLE_TO_USERNAME: { [key: string]: string } = {
    'barra': 'usuario1',
    'camarero_1': 'usuario2',
    'camarero_2': 'usuario3',
    'administrador': 'administrador'
  };

  const setRole = async (newRole: string) => {
    const newUsername = ROLE_TO_USERNAME[newRole] || newRole;
    setRoleState(newRole);
    setUsernameState(newUsername);
    await offlineStorage.saveRole(newRole);
  };

  useEffect(() => {
    const loadRole = async () => {
      const savedRole = await offlineStorage.getRole();
      if (savedRole) {
        const savedUsername = ROLE_TO_USERNAME[savedRole] || savedRole;
        setRoleState(savedRole);
        setUsernameState(savedUsername);
      }
    };
    loadRole();
  }, []);

  useEffect(() => {
    if (role) {
      const socket = initSocket(role, {
        onOrderCreated: (order: Order) => {
          console.log('Order created:', order);
          setOrders((prev) => [order, ...prev]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onOrderUpdated: (order: Order) => {
          console.log('Order updated:', order);
          setOrders((prev) =>
            prev.map((o) => (o._id === order._id ? order : o))
          );
          
          if (order.status === 'listo' && order.waiter_role === role) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              'Pedido Listo',
              `El pedido de la mesa ${order.table_number} está listo para servir`,
              [{ text: 'OK' }]
            );
          }
        },
        onOrderDeleted: (data: { order_id: string }) => {
          console.log('Order deleted:', data);
          setOrders((prev) => prev.filter((o) => o._id !== data.order_id));
        },
        onProductCreated: (product: Product) => {
          console.log('Product created:', product);
          setProducts((prev) => [...prev, product]);
        },
        onProductUpdated: (product: Product) => {
          console.log('Product updated:', product);
          setProducts((prev) =>
            prev.map((p) => (p._id === product._id ? product : p))
          );
        },
        onProductDeleted: (data: { product_id: string }) => {
          console.log('Product deleted:', data);
          setProducts((prev) => prev.filter((p) => p._id !== data.product_id));
        },
        onCategoryCreated: (category: Category) => {
          console.log('Category created:', category);
          setCategories((prev) => [...prev, category]);
        },
        onCategoryUpdated: (category: Category) => {
          console.log('Category updated:', category);
          setCategories((prev) =>
            prev.map((c) => (c._id === category._id ? category : c))
          );
        },
        onCategoryDeleted: (data: { category_id: string }) => {
          console.log('Category deleted:', data);
          setCategories((prev) => prev.filter((c) => c._id !== data.category_id));
        },
        onNotification: (notification: any) => {
          console.log('Notification received:', notification);
          if (notification.role === role) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert('Notificación', notification.message, [{ text: 'OK' }]);
          }
        },
        onDailyClosureCreated: (closure: any) => {
          console.log('Daily closure created:', closure);
          // Refrescar datos para actualizar stats
          refreshData();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });

      refreshData();

      return () => {
        disconnectSocket();
      };
    }
  }, [role]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [ordersData, productsData, categoriesData] = await Promise.all([
        api.getOrders(),
        api.getProducts(),
        api.getCategories(),
      ]);

      setOrders(ordersData);
      setProducts(productsData);
      setCategories(categoriesData);
      setIsOnline(true);

      await offlineStorage.saveOrders(ordersData);
      await offlineStorage.saveProducts(productsData);
      await offlineStorage.saveCategories(categoriesData);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setIsOnline(false);

      const offlineOrders = await offlineStorage.getOrders();
      const offlineProducts = await offlineStorage.getProducts();
      const offlineCategories = await offlineStorage.getCategories();
      setOrders(offlineOrders);
      setProducts(offlineProducts);
      setCategories(offlineCategories);
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (order: any) => {
    try {
      await api.createOrder(order);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Error', 'No se pudo crear el pedido');
      throw error;
    }
  };

  const updateOrder = async (id: string, order: any) => {
    try {
      const updatedOrder = await api.updateOrder(id, order);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Actualizar el estado local inmediatamente
      setOrders((prev) =>
        prev.map((o) => (o._id === id ? updatedOrder : o))
      );
      return updatedOrder;
    } catch (error) {
      console.error('Error updating order:', error);
      Alert.alert('Error', 'No se pudo actualizar el pedido');
      throw error;
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      await api.deleteOrder(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Error deleting order:', error);
      Alert.alert('Error', 'No se pudo eliminar el pedido');
      throw error;
    }
  };

  const createProduct = async (product: any) => {
    try {
      await api.createProduct(product);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating product:', error);
      Alert.alert('Error', 'No se pudo crear el producto');
      throw error;
    }
  };

  const updateProduct = async (id: string, product: any) => {
    try {
      await api.updateProduct(id, product);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error updating product:', error);
      Alert.alert('Error', 'No se pudo actualizar el producto');
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Error deleting product:', error);
      Alert.alert('Error', 'No se pudo eliminar el producto');
      throw error;
    }
  };

  const createCategory = async (category: any) => {
    try {
      await api.createCategory(category);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating category:', error);
      Alert.alert('Error', 'No se pudo crear la categoría');
      throw error;
    }
  };

  const updateCategory = async (id: string, category: any) => {
    try {
      await api.updateCategory(id, category);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error updating category:', error);
      Alert.alert('Error', 'No se pudo actualizar la categoría');
      throw error;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await api.deleteCategory(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Error deleting category:', error);
      Alert.alert('Error', 'No se pudo eliminar la categoría');
      throw error;
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        orders,
        products,
        categories,
        isOnline,
        refreshData,
        createOrder,
        updateOrder,
        deleteOrder,
        createProduct,
        updateProduct,
        deleteProduct,
        createCategory,
        updateCategory,
        deleteCategory,
        loading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
