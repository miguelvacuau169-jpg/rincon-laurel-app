import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function RoleSelection() {
  const router = useRouter();
  const { setRole } = useApp();

  const selectRole = (role: string) => {
    setRole(role);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Selecciona tu rol</Text>
        <Text style={styles.subtitle}>El Rincón del Laurel</Text>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.roleButton, { backgroundColor: Colors.secondary }]}
          onPress={() => selectRole('barra')}
          activeOpacity={0.7}
        >
          <Ionicons name="restaurant" size={48} color={Colors.white} />
          <Text style={styles.roleText}>Barra</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, { backgroundColor: Colors.accent }]}
          onPress={() => selectRole('camarero_1')}
          activeOpacity={0.7}
        >
          <Ionicons name="person" size={48} color={Colors.white} />
          <Text style={styles.roleText}>Camarero 1</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, { backgroundColor: Colors.olive }]}
          onPress={() => selectRole('camarero_2')}
          activeOpacity={0.7}
        >
          <Ionicons name="person-outline" size={48} color={Colors.white} />
          <Text style={styles.roleText}>Camarero 2</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  logo: {
    width: width * 0.4,
    height: width * 0.4,
    maxWidth: 200,
    maxHeight: 200,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.olive,
    fontStyle: 'italic',
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  roleText: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.white,
  },
});
