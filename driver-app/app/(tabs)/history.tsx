import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { colors } from '@/lib/colors';

interface CompletedJob {
  id: string;
  jobNumber: number;
  name: string;
  hauledFrom: string;
  hauledTo: string;
  material: string | null;
  completedLoads: number;
  totalLoads: number;
  date: string | null;
  driverTimeSeconds: number;
}

interface TripSheet {
  id: string;
  weekEnding: string;
  brokerName: string;
  ticketCount: number;
  totalRevenue: number;
}

export default function HistoryScreen() {
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [tripSheets, setTripSheets] = useState<TripSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'jobs' | 'sheets'>('jobs');

  const load = useCallback(async () => {
    try {
      // Fetch completed jobs
      const jobData = await apiFetch('/api/driver/jobs');
      const completed = (jobData.jobs || []).filter(
        (j: any) => j.assignmentStatus === 'COMPLETED' || j.status === 'COMPLETED'
      );
      setJobs(completed);

      // Try to fetch trip sheets (may not exist yet)
      try {
        const sheetData = await apiFetch('/api/driver/trip-sheets');
        setTripSheets(sheetData.tripSheets || []);
      } catch {
        // Trip sheets endpoint may not exist — silently ignore
        setTripSheets([]);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useAutoRefresh(load, { interval: 60_000 });

  const formatTime = (seconds: number) => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const renderJob = ({ item }: { item: CompletedJob }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.jobNumber}>#{item.jobNumber}</Text>
        <View style={[styles.badge, { backgroundColor: colors.status.greenBg }]}>
          <Text style={[styles.badgeText, { color: colors.status.green }]}>COMPLETED</Text>
        </View>
      </View>
      <Text style={styles.jobName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.route} numberOfLines={1}>
        {item.hauledFrom} → {item.hauledTo}
      </Text>
      {item.material && <Text style={styles.material}>{item.material}</Text>}
      <View style={styles.cardFooter}>
        <Text style={styles.footerItem}>
          {item.completedLoads}/{item.totalLoads} loads
        </Text>
        <Text style={styles.footerItem}>{formatTime(item.driverTimeSeconds)}</Text>
        {item.date && (
          <Text style={styles.footerDate}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
        )}
      </View>
    </View>
  );

  const renderSheet = ({ item }: { item: TripSheet }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.jobName}>{item.brokerName}</Text>
      </View>
      <Text style={styles.route}>
        Week ending: {new Date(item.weekEnding).toLocaleDateString()}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.footerItem}>{item.ticketCount} tickets</Text>
        <Text style={[styles.footerItem, { color: colors.status.green, fontWeight: '700' }]}>
          ${item.totalRevenue.toFixed(2)}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.safety[500]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'jobs' && styles.tabActive]}
          onPress={() => setTab('jobs')}
        >
          <Text style={[styles.tabText, tab === 'jobs' && styles.tabTextActive]}>
            Completed ({jobs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'sheets' && styles.tabActive]}
          onPress={() => setTab('sheets')}
        >
          <Text style={[styles.tabText, tab === 'sheets' && styles.tabTextActive]}>
            Trip Sheets ({tripSheets.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'jobs' ? (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.safety[500]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-outline" size={48} color={colors.steel[300]} />
              <Text style={styles.emptyText}>No completed jobs yet</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={tripSheets}
          keyExtractor={(item) => item.id}
          renderItem={renderSheet}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.safety[500]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-outline" size={48} color={colors.steel[300]} />
              <Text style={styles.emptyText}>No trip sheets available</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.steel[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.steel[50] },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
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
  jobNumber: { fontSize: 14, fontWeight: '700', color: colors.navy[700] },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  jobName: { fontSize: 16, fontWeight: '600', color: colors.steel[900], marginBottom: 4 },
  route: { fontSize: 13, color: colors.steel[500], marginBottom: 4 },
  material: { fontSize: 12, color: colors.steel[400], fontStyle: 'italic', marginBottom: 4 },
  cardFooter: {
    flexDirection: 'row', gap: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.steel[100],
  },
  footerItem: { fontSize: 13, fontWeight: '600', color: colors.steel[600] },
  footerDate: { fontSize: 13, color: colors.steel[400], marginLeft: 'auto' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: colors.steel[400] },
});
