import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { role, setRole } = useApp();
  const router = useRouter();
  const [appId, setAppId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await api.getSettings();
      if (settings.onesignal_app_id) {
        setAppId(settings.onesignal_app_id);
      }
      if (settings.onesignal_api_key) {
        setApiKey(settings.onesignal_api_key);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.updateSettings({
        onesignal_app_id: appId.trim() || null,
        onesignal_api_key: apiKey.trim() || null,
      });
      Alert.alert('Éxito', 'Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = () => {
    Alert.alert(
      'Cambiar Rol',
      '¿Estás seguro de que quieres cambiar de rol?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar',
          onPress: () => {
            setRole('');
            router.replace('/role-selection');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rol Actual</Text>
            <View style={styles.roleCard}>
              <View style={styles.roleInfo}>
                <Ionicons
                  name={role === 'barra' ? 'restaurant' : 'person'}
                  size={32}
                  color={Colors.secondary}
                />
                <View style={styles.roleTextContainer}>
                  <Text style={styles.roleLabel}>Tu rol</Text>
                  <Text style={styles.roleValue}>
                    {role === 'barra' ? 'Barra' : role === 'camarero_1' ? 'Camarero 1' : 'Camarero 2'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.changeRoleButton}
                onPress={handleChangeRole}
              >
                <Text style={styles.changeRoleButtonText}>Cambiar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="notifications" size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>OneSignal</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Configura las credenciales de OneSignal para recibir notificaciones push cuando los pedidos estén listos.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>App ID</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ingresa el OneSignal App ID"
                placeholderTextColor={Colors.gray}
                value={appId}
                onChangeText={setAppId}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>API Key</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ingresa el OneSignal API Key"
                placeholderTextColor={Colors.gray}
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={loading}
            >
              <Ionicons name="save" size={20} color={Colors.white} />
              <Text style={styles.saveButtonText}>
                {loading ? 'Guardando...' : 'Guardar Configuración'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Información</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>El Rincón del Laurel</Text>
              <Text style={styles.infoText}>Sistema de Gestión de Pedidos</Text>
              <Text style={styles.infoVersion}>Versión 1.0.0</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="help-circle" size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Cómo obtener credenciales de OneSignal</Text>
            </View>
            <View style={styles.instructionsCard}>
              <View style={styles.instructionStep}>
                <Text style={styles.stepNumber}>1</Text>
                <Text style={styles.stepText}>Crea una cuenta en onesignal.com</Text>
              </View>
              <View style={styles.instructionStep}>
                <Text style={styles.stepNumber}>2</Text>
                <Text style={styles.stepText}>Crea una nueva app</Text>
              </View>
              <View style={styles.instructionStep}>
                <Text style={styles.stepNumber}>3</Text>
                <Text style={styles.stepText}>Ve a Settings {'>'} Keys & IDs</Text>
              </View>
              <View style={styles.instructionStep}>
                <Text style={styles.stepNumber}>4</Text>
                <Text style={styles.stepText}>Copia el App ID y REST API Key</Text>
              </View>
            </View>
          </View>
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
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 16,
    lineHeight: 20,
  },
  roleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleTextContainer: {
    justifyContent: 'center',
  },
  roleLabel: {
    fontSize: 12,
    color: Colors.gray,
    marginBottom: 2,
  },
  roleValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  changeRoleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.secondary,
    borderRadius: 8,
  },
  changeRoleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 4,
  },
  infoVersion: {
    fontSize: 12,
    color: Colors.lightGray,
  },
  instructionsCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondary,
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
});
