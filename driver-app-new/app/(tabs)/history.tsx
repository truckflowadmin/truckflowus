import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Image, Alert, AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { colors } from '@/lib/colors';

interface Ticket {
  id: string;
  ticketNumber: number;
  material: string;
  hauledFrom: string;
  hauledTo: string;
  quantity: number;
  quantityType: string;
  status: string;
  date: string | null;
  ticketRef: string | null;
  photoUrl: string | null;
  jobName?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: colors.status.yellowBg, text: colors.status.yellow },
  DISPATCHED: { bg: colors.status.blueBg, text: colors.status.blue },
  IN_PROGRESS: { bg: colors.status.yellowBg, text: colors.status.yellow },
  COMPLETED: { bg: colors.status.greenBg, text: colors.status.green },
  ISSUE: { bg: colors.status.redBg, text: colors.status.red },
};

export default function HistoryScreen() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'completed' | 'pending'>('completed');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/driver/tickets');
      setTickets(data.tickets || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(load, 30_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const completedTickets = tickets.filter((t) => t.status === 'COMPLETED');
  const pendingTickets = tickets.filter((t) =>
    ['PENDING', 'DISPATCHED', 'IN_PROGRESS', 'ISSUE'].includes(t.status)
  );
  const displayTickets = tab === 'completed' ? completedTickets : pendingTickets;

  // Group by date
  const groupedByDate: Record<string, Ticket[]> = {};
  displayTickets.forEach((t) => {
    const dateKey = t.date
      ? new Date(t.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'No date';
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(t);
  });

  const sections = Object.entries(groupedByDate).map(([date, items]) => ({
    date,
    items,
    totalQuantity: items.reduce((sum, t) => sum + (t.quantity || 0), 0),
  }));

  const renderTicket = ({ item }: { item: Ticket }) => {
    const statusColor = STATUS_COLORS[item.status] || STATUS_COLORS.PENDING;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.ticketNumber}>#{item.ticketNumber}</Text>
            {item.ticketRef && (
              <Text style={styles.ticketRef}>Ref: {item.ticketRef}</Text>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.badgeText, { color: statusColor.text }]}>
              {item.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <Text style={styles.material} numberOfLines={1}>{item.material}</Text>

        <View style={styles.route}>
          <Ionicons name="location" size={13} color={colors.status.green} />
          <Text style={styles.routeText} numberOfLines={1}>{item.hauledFrom}</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.steel[400]} />
          <Ionicons name="navigate" size={13} color={colors.status.red} />
          <Text style={styles.routeText} numberOfLines={1}>{item.hauledTo}</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.quantity}>
            {item.quantity} {item.quantityType?.toLowerCase() || 'loads'}
          </Text>
          {item.photoUrl ? (
            <View style={styles.photoIndicator}>
              <Ionicons name="checkmark-circle" size={14} color={colors.status.green} />
              <Text style={styles.photoText}>Photo</Text>
            </View>
          ) : (
            <View style={styles.noPhotoIndicator}>
              <Ionicons name="alert-circle" size={14} color={colors.status.red} />
              <Text style={styles.noPhotoText}>No photo</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.safety[500]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{completedTickets.length}</Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{pendingTickets.length}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {completedTickets.filter((t) => t.photoUrl).length}
          </Text>
          <Text style={styles.summaryLabel}>With Photos</Text>
        </View>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'completed' && styles.tabActive]}
          onPress={() => setTab('completed')}
        >
          <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>
            Completed ({completedTickets.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'pending' && styles.tabActive]}
          onPress={() => setTab('pending')}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
            Pending Review ({pendingTickets.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayTickets}
        keyExtractor={(item) => item.id}
        renderItem={renderTicket}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.safety[500]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={48} color={colors.steel[300]} />
            <Text style={styles.emptyText}>
              {tab === 'completed' ? 'No completed tickets yet' : 'No pending tickets'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.steel[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.steel[50] },
  summaryBar: {
    backgroundColor: colors.navy[800],
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center' },
  summaryNumber: { fontSize: 22, fontWeight: '800', color: colors.white },
  summaryLabel: { fontSize: 11, color: colors.navy[300], marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryDivider: { width: 1, backgroundColor: colors.navy[600] },
  tabs: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: colors.steel[100], alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.navy[800] },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.steel[600] },
  tabTextActive: { color: colors.white },
  list: { padding: 16, gap: 8 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketNumber: { fontSize: 14, fontWeight: '700', color: colors.navy[700] },
  ticketRef: { fontSize: 12, color: colors.steel[400] },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  material: { fontSize: 15, fontWeight: '600', color: colors.steel[900], marginBottom: 6 },
  route: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8,
  },
  routeText: { fontSize: 12, color: colors.steel[500], flex: 1 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.steel[100],
  },
  quantity: { fontSize: 13, fontWeight: '600', color: colors.steel[600] },
  photoIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  photoText: { fontSize: 12, color: colors.status.green, fontWeight: '600' },
  noPhotoIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  noPhotoText: { fontSize: 12, color: colors.status.red, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: colors.steel[400] },
});
