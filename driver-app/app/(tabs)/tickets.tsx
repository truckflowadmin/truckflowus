import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
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
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: colors.status.yellowBg, text: colors.status.yellow },
  DISPATCHED: { bg: colors.status.blueBg, text: colors.status.blue },
  IN_PROGRESS: { bg: colors.status.yellowBg, text: colors.status.yellow },
  COMPLETED: { bg: colors.status.greenBg, text: colors.status.green },
  ISSUE: { bg: colors.status.redBg, text: colors.status.red },
};

export default function TicketsScreen() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/driver/tickets');
      setTickets(data.tickets || []);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 15s + refetch on app resume / tab focus
  const { refreshing, onRefresh } = useAutoRefresh(load, { interval: 15_000 });

  const activeTickets = tickets.filter((t) =>
    ['PENDING', 'DISPATCHED', 'IN_PROGRESS', 'ISSUE'].includes(t.status)
  );
  const completedTickets = tickets.filter((t) => t.status === 'COMPLETED');
  const displayTickets = tab === 'active' ? activeTickets : completedTickets;

  const renderTicket = ({ item }: { item: Ticket }) => {
    const statusColor = STATUS_COLORS[item.status] || STATUS_COLORS.PENDING;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.ticketNumber}>#{item.ticketNumber}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.badgeText, { color: statusColor.text }]}>
              {item.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <Text style={styles.material}>{item.material}</Text>

        <View style={styles.route}>
          <Text style={styles.routeText} numberOfLines={1}>
            {item.hauledFrom} → {item.hauledTo}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.quantity}>
            {item.quantity} {item.quantityType.toLowerCase()}
          </Text>
          {item.ticketRef && (
            <Text style={styles.ref}>Ref: {item.ticketRef}</Text>
          )}
          {item.date && (
            <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
          )}
        </View>

        {item.photoUrl && (
          <View style={styles.photoIndicator}>
            <Ionicons name="image" size={14} color={colors.status.green} />
            <Text style={styles.photoText}>Photo attached</Text>
          </View>
        )}
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
      {/* Tab toggle */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Active ({activeTickets.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'completed' && styles.tabActive]}
          onPress={() => setTab('completed')}
        >
          <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>
            Completed ({completedTickets.length})
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
            <Ionicons name="receipt-outline" size={48} color={colors.steel[300]} />
            <Text style={styles.emptyText}>
              {tab === 'active' ? 'No active tickets' : 'No completed tickets'}
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
  tabs: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: colors.steel[100], alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.navy[800] },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.steel[600] },
  tabTextActive: { color: colors.white },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  ticketNumber: { fontSize: 14, fontWeight: '700', color: colors.navy[700] },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  material: { fontSize: 16, fontWeight: '600', color: colors.steel[900], marginBottom: 6 },
  route: { marginBottom: 8 },
  routeText: { fontSize: 13, color: colors.steel[500] },
  cardFooter: {
    flexDirection: 'row', gap: 16,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.steel[100],
  },
  quantity: { fontSize: 13, fontWeight: '600', color: colors.steel[600] },
  ref: { fontSize: 13, color: colors.steel[400] },
  date: { fontSize: 13, color: colors.steel[400], marginLeft: 'auto' },
  photoIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
  },
  photoText: { fontSize: 12, color: colors.status.green },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: colors.steel[400] },
});
