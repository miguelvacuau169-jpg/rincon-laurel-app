import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  FlatList,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';

const ZONE_LABELS: { [key: string]: string } = {
  terraza_exterior: 'Terraza Exterior',
  salon_interior: 'Salón Interior',
  terraza_interior: 'Terraza Interior',
};

export default function DailyClosureScreen() {
  const { role } = useApp();
  const [stats, setStats] = useState<any>(null);
  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, closuresData] = await Promise.all([
        api.getDailyStats(),
        api.getDailyClosures(30),
      ]);
      setStats(statsData);
      setClosures(closuresData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleClosureDay = () => {
    Alert.alert(
      'Cerrar Día',
      `¿Confirmas el cierre del día con total de €${stats?.total_sales.toFixed(2)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            try {
              await api.createDailyClosure({
                date: new Date().toISOString(),
                total_sales: stats.total_sales,
                cash_sales: stats.cash_sales,
                card_sales: stats.card_sales,
                mixed_sales: stats.mixed_sales,
                total_orders: stats.total_orders,
                closed_by: role || 'administrador',
              });
              Alert.alert('Éxito', 'Cierre diario guardado correctamente');
              loadData();
            } catch (error) {
              console.error('Error creating closure:', error);
              Alert.alert('Error', 'No se pudo guardar el cierre');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderClosureItem = ({ item }: { item: any }) => {
    const date = new Date(item.date);
    return (
      <View style={styles.closureCard}>
        <View style={styles.closureHeader}>
          <Text style={styles.closureDate}>
            {format(date, 'dd/MM/yyyy')}
          </Text>
          <Text style={styles.closureTotal}>€{item.total_sales.toFixed(2)}</Text>
        </View>
        <View style={styles.closureDetails}>
          <View style={styles.closureRow}>
            <Ionicons name="cash" size={16} color={Colors.gray} />
            <Text style={styles.closureLabel}>Efectivo:</Text>
            <Text style={styles.closureValue}>€{item.cash_sales.toFixed(2)}</Text>
          </View>
          <View style={styles.closureRow}>
            <Ionicons name="card" size={16} color={Colors.gray} />
            <Text style={styles.closureLabel}>Tarjeta:</Text>
            <Text style={styles.closureValue}>€{item.card_sales.toFixed(2)}</Text>
          </View>
          <View style={styles.closureRow}>
            <Ionicons name="swap-horizontal" size={16} color={Colors.gray} />
            <Text style={styles.closureLabel}>Mixto:</Text>
            <Text style={styles.closureValue}>€{item.mixed_sales.toFixed(2)}</Text>
          </View>
          <View style={styles.closureRow}>
            <Ionicons name="receipt" size={16} color={Colors.gray} />
            <Text style={styles.closureLabel}>Pedidos:</Text>
            <Text style={styles.closureValue}>{item.total_orders}</Text>
          </View>
        </View>
        <Text style={styles.closureBy}>Cerrado por: {item.closed_by}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estadísticas del Día</Text>
          {stats ? (
            <View style={styles.statsCard}>
              <View style={styles.totalSection}>
                <Ionicons name="cash-outline" size={48} color={Colors.secondary} />
                <View style={styles.totalInfo}>
                  <Text style={styles.totalLabel}>Total Ventas</Text>
                  <Text style={styles.totalAmount}>€{stats.total_sales.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Ionicons name="cash" size={32} color={Colors.accent} />
                  <Text style={styles.statLabel}>Efectivo</Text>
                  <Text style={styles.statValue}>€{stats.cash_sales.toFixed(2)}</Text>
                </View>

                <View style={styles.statItem}>
                  <Ionicons name="card" size={32} color={Colors.secondary} />
                  <Text style={styles.statLabel}>Tarjeta</Text>
                  <Text style={styles.statValue}>€{stats.card_sales.toFixed(2)}</Text>
                </View>

                <View style={styles.statItem}>
                  <Ionicons name="swap-horizontal" size={32} color={Colors.olive} />
                  <Text style={styles.statLabel}>Mixto</Text>
                  <Text style={styles.statValue}>€{stats.mixed_sales.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.ordersSection}>
                <Ionicons name="receipt" size={24} color={Colors.text} />
                <Text style={styles.ordersText}>
                  {stats.total_orders} pedidos entregados hoy
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClosureDay}
                disabled={loading}
              >
                <Ionicons name="lock-closed" size={20} color={Colors.white} />
                <Text style={styles.closeButtonText}>
                  {loading ? 'Cerrando...' : 'Cerrar Día'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingText}>Cargando estadísticas...</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico de Cierres</Text>
          <FlatList
            data={closures}
            renderItem={renderClosureItem}
            keyExtractor={(item) => item._id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={64} color={Colors.gray} />
                <Text style={styles.emptyText}>No hay cierres registrados</Text>
              </View>
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 16,
  },
  statsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    elevation: 3,
  },
  totalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  totalInfo: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 16,
    color: Colors.gray,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.lightGray,
    marginVertical: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  ordersSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  ordersText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    gap: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  loadingCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.gray,
  },
  closureCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  closureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closureDate: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  closureTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  closureDetails: {
    gap: 8,
    marginBottom: 12,
  },
  closureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closureLabel: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  closureValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  closureBy: {
    fontSize: 12,
    color: Colors.gray,
    fontStyle: 'italic',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray,
    marginTop: 16,
  },
});
