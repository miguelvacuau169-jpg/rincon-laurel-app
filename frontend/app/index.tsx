import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { role } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (role) {
        router.replace('/(tabs)');
      } else {
        router.replace('/role-selection');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [role, router]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  logo: {
    width: width * 0.7,
    height: width * 0.7,
    maxWidth: 400,
    maxHeight: 400,
  },
});
