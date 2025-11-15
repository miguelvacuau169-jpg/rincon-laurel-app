import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ONESIGNAL_APP_ID = Constants.expoConfig?.extra?.EXPO_PUBLIC_ONESIGNAL_APP_ID || process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;

// Configurar el comportamiento de las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const initializeOneSignal = async () => {
  try {
    // Solicitar permisos de notificaciones
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }
    
    // Obtener el token de notificación
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Push notification token:', token);
    
    return token;
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return null;
  }
};

export const sendNotification = async (title: string, body: string, data?: any) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Enviar inmediatamente
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

export const addNotificationListener = (callback: (notification: any) => void) => {
  return Notifications.addNotificationReceivedListener(callback);
};

export const addNotificationResponseListener = (callback: (response: any) => void) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};
