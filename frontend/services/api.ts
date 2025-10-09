import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const API_URL = `${BACKEND_URL}/api`;

console.log('Backend URL:', BACKEND_URL);
console.log('API URL:', API_URL);

let socket: Socket | null = null;

export const initSocket = (role: string, callbacks: any) => {
  if (socket && socket.connected) {
    socket.disconnect();
  }

  socket = io(BACKEND_URL, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
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
  socket.on('notification', callbacks.onNotification);

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

  saveRole: async (role: string) => {
    await AsyncStorage.setItem('user_role', role);
  },

  getRole: async () => {
    return await AsyncStorage.getItem('user_role');
  },
};
