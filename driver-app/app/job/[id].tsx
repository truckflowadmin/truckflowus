import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  StyleSheet, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { startTracking, stopTracking, isTrackingActive } from '@/lib/location';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { colors } from '@/lib/colors';

interface JobDetail {
  id: string;
  jobNumber: number;
  name: string;
  hauledFrom: string;
  hauledFromAddress: string;
  hauledTo: string;
  hauledToAddress: string;
  material: string | null;
  status: string;
  assignmentStatus: string;
  assignmentId: string | null;
  date: string | null;
  totalLoads: number;
  completedLoads: number;
  notes: string | null;
  truckNumber: string | null;
  customerName: string | null;
  brokerName: string | null;
  driverTimeSeconds: number;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tracking, setTracking] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/driver/jobs/${id}`);
      setJob(data);
      // Check if GPS is actively tracking
      const active = await isTrackingActive();
      setTracking(active && data.assignmentStatus === 'IN_PROGRESS');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Auto-refresh every 15s + refetch on app resume / screen focus
  useAutoRefresh(load, { interval: 15_000 });

  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;

    const confirmMessages: Record<string, string> = {
      IN_PROGRESS: 'Start this job? GPS tracking will begin.',
      COMPLETED: 'Mark this job as completed? GPS tracking will stop.',
      ASSIGNED: 'Move this job back to assigned?',
    };

    Alert.alert(
      'Confirm',
      confirmMessages[newStatus] || `Change status to ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: newStatus === 'COMPLETED' ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiFetch('/api/jobs/status', {
                method: 'POST',
                body: {
                  jobId: job.id,
                  assignmentId: job.assignmentId,
                  status: newStatus,
                },
              });

              // Handle GPS tracking
              if (newStatus === 'IN_PROGRESS') {
                const started = await startTracking(job.id, job.assignmentId || undefined);
                setTracking(started);
                if (!started) {
                  Alert.alert(
                    'Location Permission Required',
                    'Please enable background location access in Settings to track your delivery.',
                  );
                }
              } else if (newStatus === 'COMPLETED' || newStatus === 'ASSIGNED') {
                await stopTracking();
                setTracking(false);
              }

              await load();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update status');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleSelfAssign = async () => {
    if (!job) return;
    Alert.alert('Claim Job', `Assign yourself to job #${job.jobNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Claim',
        onPress: async () => {
          setActionLoading(true);
          try {
            await apiFetch('/api/jobs/status', {
              method: 'POST',
              body: { jobId: job.id, action: 'assign' },
            });
            await load();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to claim job');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const openNavigation = (address: string) => {
    const encoded = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:?daddr=${encoded}`,
      android: `google.navigation:q=${encoded}`,
    });
    if (url) Linking.openURL(url);
  };

  if (loading || !job) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.safety[500]} />
      </View>
    );
  }

  const status = job.assignmentStatus || job.status;
  const statusColor = {
    ASSIGNED: colors.status.blue,
    IN_PROGRESS: colors.status.yellow,
    COMPLETED: colors.status.green,
    CREATED: colors.steel[500],
  }[status] || colors.steel[500];

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job #{job.jobNumber}</Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>

      {/* Tracking indicator */}
      {tracking && (
        <View style={styles.trackingBar}>
          <View style={styles.trackingDot} />
          <Text style={styles.trackingText}>GPS tracking active</Text>
        </View>
      )}

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Job title */}
        <Text style={styles.jobName}>{job.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {status.replace('_', ' ')}
          </Text>
        </View>

        {/* Route */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>

          <TouchableOpacity
            style={styles.locationCard}
            onPress={() => openNavigation(job.hauledFromAddress)}
          >
            <Ionicons name="location" size={20} color={colors.status.green} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationName}>{job.hauledFrom}</Text>
              <Text style={styles.locationAddress}>{job.hauledFromAddress}</Text>
            </View>
            <Ionicons name="navigate-outline" size={20} color={colors.steel[400]} />
          </TouchableOpacity>

          <View style={styles.routeConnector}>
            <View style={styles.routeLine} />
          </View>

          <TouchableOpacity
            style={styles.locationCard}
            onPress={() => openNavigation(job.hauledToAddress)}
          >
            <Ionicons name="navigate" size={20} color={colors.status.red} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Delivery</Text>
              <Text style={styles.locationName}>{job.hauledTo}</Text>
              <Text style={styles.locationAddress}>{job.hauledToAddress}</Text>
            </View>
            <Ionicons name="navigate-outline" size={20} color={colors.steel[400]} />
          </TouchableOpacity>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailGrid}>
            {job.material && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Material</Text>
                <Text style={styles.detailValue}>{job.material}</Text>
              </View>
            )}
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Loads</Text>
              <Text style={styles.detailValue}>{job.completedLoads}/{job.totalLoads}</Text>
            </View>
            {job.truckNumber && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Truck</Text>
                <Text style={styles.detailValue}>{job.truckNumber}</Text>
              </View>
            )}
            {job.driverTimeSeconds > 0 && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{formatTime(job.driverTimeSeconds)}</Text>
              </View>
            )}
            {job.customerName && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Customer</Text>
                <Text style={styles.detailValue}>{job.customerName}</Text>
              </View>
            )}
            {job.date && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{new Date(job.date).toLocaleDateString()}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Notes */}
        {job.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{job.notes}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          {/* POD actions */}
          {status === 'IN_PROGRESS' && (
            <View style={styles.podActions}>
              <TouchableOpacity
                style={styles.podButton}
                onPress={() => router.push(`/job/${id}/photo`)}
              >
                <Ionicons name="camera" size={20} color={colors.navy[700]} />
                <Text style={styles.podButtonText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.podButton}
                onPress={() => router.push(`/job/${id}/signature`)}
              >
                <Ionicons name="create" size={20} color={colors.navy[700]} />
                <Text style={styles.podButtonText}>Signature</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Self-assign for available jobs */}
          {!job.assignmentId && job.status === 'CREATED' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.status.blue }]}
              onPress={handleSelfAssign}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="hand-left" size={20} color={colors.white} />
                  <Text style={styles.actionText}>Claim This Job</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Start job */}
          {status === 'ASSIGNED' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.status.green }]}
              onPress={() => handleStatusChange('IN_PROGRESS')}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="play" size={20} color={colors.white} />
                  <Text style={styles.actionText}>Start Job</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Complete job */}
          {status === 'IN_PROGRESS' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.safety[500] }]}
              onPress={() => handleStatusChange('COMPLETED')}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                  <Text style={styles.actionText}>Complete Job</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.steel[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.steel[50] },
  header: {
    backgroundColor: colors.navy[800],
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.white },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  trackingBar: {
    backgroundColor: colors.status.greenBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  trackingDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.status.green,
  },
  trackingText: { fontSize: 13, fontWeight: '600', color: colors.status.green },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  jobName: { fontSize: 22, fontWeight: '700', color: colors.steel[900], marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginBottom: 20 },
  statusText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.steel[500],
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  locationCard: {
    backgroundColor: colors.white,
    borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  locationInfo: { flex: 1 },
  locationLabel: { fontSize: 11, color: colors.steel[400], textTransform: 'uppercase', fontWeight: '600' },
  locationName: { fontSize: 15, fontWeight: '600', color: colors.steel[900], marginTop: 2 },
  locationAddress: { fontSize: 13, color: colors.steel[500], marginTop: 2 },
  routeConnector: { alignItems: 'center', height: 20 },
  routeLine: { width: 2, flex: 1, backgroundColor: colors.steel[200] },
  detailGrid: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16,
    flexDirection: 'row', flexWrap: 'wrap', gap: 16,
  },
  detailItem: { width: '45%' },
  detailLabel: { fontSize: 11, color: colors.steel[400], textTransform: 'uppercase', fontWeight: '600' },
  detailValue: { fontSize: 15, fontWeight: '600', color: colors.steel[900], marginTop: 2 },
  notes: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16,
    fontSize: 14, color: colors.steel[700], lineHeight: 20,
  },
  podActions: {
    flexDirection: 'row', gap: 12, marginBottom: 12,
  },
  podButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.white, borderRadius: 12,
    paddingVertical: 14, borderWidth: 1.5, borderColor: colors.navy[200],
  },
  podButtonText: { fontSize: 14, fontWeight: '600', color: colors.navy[700] },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 12, paddingVertical: 16,
  },
  actionText: { fontSize: 17, fontWeight: '700', color: colors.white },
});
