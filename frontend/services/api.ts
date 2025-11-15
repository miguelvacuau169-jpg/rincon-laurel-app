import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const API_URL = `${BACKEND_URL}/api`;
const SOCKET_URL = BACKEND_URL; // Socket.IO en mismo servidor

console.log('Backend URL:', BACKEND_URL);
console.log('API URL:', API_URL);
console.log('Socket URL:', SOCKET_URL);

let socket: Socket | null = null;

export const initSocket = (role: string, callbacks: any) => {
  if (socket && socket.connected) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    path: '/socket.io/',
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
    socket?.emit('set_role', { role });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('order_created', callbacks.onOrderCreated);
  socket.on('order_updated', callbacks.onOrderUpdated);
  socket.on('order_deleted', callbacks.onOrderDeleted);
  socket.on('product_created', callbacks.onProductCreated);
  socket.on('product_updated', callbacks.onProductUpdated);
  socket.on('product_deleted', callbacks.onProductDeleted);
  socket.on('category_created', callbacks.onCategoryCreated);
  socket.on('category_updated', callbacks.onCategoryUpdated);
  socket.on('category_deleted', callbacks.onCategoryDeleted);
  socket.on('notification', callbacks.onNotification);
  socket.on('daily_closure_created', callbacks.onDailyClosureCreated);

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const syncData = () => {
  if (socket && socket.connected) {
    socket.emit('sync_request', {});
  }
};

// API methods
export const api = {
  // Products
  getProducts: async () => {
    const response = await fetch(`${API_URL}/products`);
    return response.json();
  },

  createProduct: async (product: any) => {
    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    return response.json();
  },

  updateProduct: async (id: string, product: any) => {
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    return response.json();
  },

  deleteProduct: async (id: string) => {
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // Orders
  getOrders: async () => {
    const response = await fetch(`${API_URL}/orders`);
    return response.json();
  },

  createOrder: async (order: any) => {
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    return response.json();
  },

  updateOrder: async (id: string, order: any) => {
    const response = await fetch(`${API_URL}/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    return response.json();
  },

  deleteOrder: async (id: string) => {
    const response = await fetch(`${API_URL}/orders/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // Settings
  getSettings: async () => {
    const response = await fetch(`${API_URL}/settings`);
    return response.json();
  },

  updateSettings: async (settings: any) => {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return response.json();
  },

  // Seed data
  seedData: async () => {
    const response = await fetch(`${API_URL}/seed`, {
      method: 'POST',
    });
    return response.json();
  },
};

// API methods for new features
export const apiExtended = {
  // Categories
  getCategories: async () => {
    const response = await fetch(`${API_URL}/categories`);
    return response.json();
  },

  createCategory: async (category: any) => {
    const response = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category),
    });
    return response.json();
  },

  updateCategory: async (id: string, category: any) => {
    const response = await fetch(`${API_URL}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category),
    });
    return response.json();
  },

  deleteCategory: async (id: string) => {
    const response = await fetch(`${API_URL}/categories/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // Daily Stats
  getDailyStats: async (date?: string) => {
    const url = date ? `${API_URL}/daily-stats?date=${date}` : `${API_URL}/daily-stats`;
    const response = await fetch(url);
    return response.json();
  },

  // Daily Closures
  getDailyClosures: async (limit: number = 30) => {
    const response = await fetch(`${API_URL}/daily-closures?limit=${limit}`);
    return response.json();
  },

  createDailyClosure: async (closure: any) => {
    const response = await fetch(`${API_URL}/daily-closures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closure),
    });
    return response.json();
  },

  getWeeklyStats: async () => {
    const response = await fetch(`${API_URL}/weekly-stats`);
    return response.json();
  },

  // Partial Payments
  addPartialPayment: async (orderId: string, payment: any) => {
    const response = await fetch(`${API_URL}/orders/${orderId}/partial-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    });
    return response.json();
  },
};

// Combine both APIs
Object.assign(api, apiExtended);

// Offline storage
export const offlineStorage = {
  saveOrders: async (orders: any[]) => {
    await AsyncStorage.setItem('offline_orders', JSON.stringify(orders));
  },

  getOrders: async () => {
    const data = await AsyncStorage.getItem('offline_orders');
    return data ? JSON.parse(data) : [];
  },

  saveProducts: async (products: any[]) => {
    await AsyncStorage.setItem('offline_products', JSON.stringify(products));
  },

  getProducts: async () => {
    const data = await AsyncStorage.getItem('offline_products');
    return data ? JSON.parse(data) : [];
  },

  saveCategories: async (categories: any[]) => {
    await AsyncStorage.setItem('offline_categories', JSON.stringify(categories));
  },

  getCategories: async () => {
    const data = await AsyncStorage.getItem('offline_categories');
    return data ? JSON.parse(data) : [];
  },

  saveRole: async (role: string) => {
    await AsyncStorage.setItem('user_role', role);
  },

  getRole: async () => {
    return await AsyncStorage.getItem('user_role');
  },
};
