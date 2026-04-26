import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, AppState,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/colors';

interface Job {
  id: string;
  jobNumber: number;
  name: string;
  hauledFrom: string;
  hauledTo: string;
  material: string | null;
  status: string;
  assignmentStatus: string;
  date: string | null;
  totalLoads: number;
  completedLoads: number;
  openForDrivers: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ASSIGNED: { bg: colors.status.blueBg, text: colors.status.blue },
  IN_PROGRESS: { bg: colors.status.yellowBg, text: colors.status.yellow },
  COMPLETED: { bg: colors.status.greenBg, text: colors.status.green },
  CREATED: { bg: colors.steel[100], text: colors.steel[600] },
  CANCELLED: { bg: colors.status.redBg, text: colors.status.red },
};

export default function JobsScreen() {
  const { driverName } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'my' | 'available'>('my');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/driver/jobs');
      setJobs(data.jobs || []);
      setAvailableJobs(data.availableJobs || []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds + when app comes back to foreground
  useEffect(() => {
    const interval = setInterval(load, 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const renderJob = ({ item }: { item: Job }) => {
    const statusColor = STATUS_COLORS[item.assignmentStatus || item.status] || STATUS_COLORS.CREATED;
    const displayStatus = item.assignmentStatus || item.status;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/job/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.jobNumber}>#{item.jobNumber}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.badgeText, { color: statusColor.text }]}>
              {displayStatus.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <Text style={styles.jobName} numberOfLines={1}>{item.name}</Text>

        <View style={styles.route}>
          <Ionicons name="location" size={14} color={colors.status.green} />
          <Text style={styles.routeText} numberOfLines={1}>{item.hauledFrom}</Text>
        </View>
        <View style={styles.route}>
          <Ionicons name="navigate" size={14} color={colors.status.red} />
          <Text style={styles.routeText} numberOfLines={1}>{item.hauledTo}</Text>
        </View>

        {item.material && (
          <Text style={styles.material}>{item.material}</Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.loads}>
            {item.completedLoads}/{item.totalLoads} loads
          </Text>
          {item.date && (
            <Text style={styles.date}>
              {new Date(item.date).toLocaleDateString()}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.safety[500]} />
      </View>
    );
  }

  const displayJobs = tab === 'my' ? jobs : availableJobs;

  return (
    <View style={styles.container}>
      {/* Welcome bar */}
      <View style={styles.welcome}>
        <Text style={styles.welcomeText}>Welcome, {driverName}</Text>
        <Text style={styles.jobCount}>{jobs.length} active job{jobs.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'my' && styles.tabActive]}
          onPress={() => setTab('my')}
        >
          <Text style={[styles.tabText, tab === 'my' && styles.tabTextActive]}>My Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'available' && styles.tabActive]}
          onPress={() => setTab('available')}
        >
          <Text style={[styles.tabText, tab === 'available' && styles.tabTextActive]}>
            Available ({availableJobs.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.safety[500]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={48} color={colors.steel[300]} />
            <Text style={styles.emptyText}>
              {tab === 'my' ? 'No jobs assigned to you' : 'No available jobs right now'}
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
  welcome: {
    backgroundColor: colors.navy[800],
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  welcomeText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  jobCount: { color: colors.navy[300], fontSize: 13, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.steel[100],
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.navy[800],
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.steel[600],
  },
  tabTextActive: {
    color: colors.white,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy[700],
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jobName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.steel[900],
    marginBottom: 10,
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  routeText: {
    fontSize: 13,
    color: colors.steel[600],
    flex: 1,
  },
  material: {
    fontSize: 12,
    color: colors.steel[500],
    marginTop: 6,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.steel[100],
  },
  loads: { fontSize: 13, color: colors.steel[600], fontWeight: '600' },
  date: { fontSize: 13, color: colors.steel[400] },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.steel[400],
  },
});
