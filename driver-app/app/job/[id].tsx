import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, TextInput,
  StyleSheet, ActivityIndicator, Linking, Platform, KeyboardAvoidingView,
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
  lastResumedAt: string | null;
  ratePerUnit: string | null;
  quantityType: string;
  openForDrivers: boolean;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueNote, setIssueNote] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/driver/jobs/${id}`);
      setJob(data);
      const active = await isTrackingActive();
      setTracking(active && data.assignmentStatus === 'IN_PROGRESS');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useAutoRefresh(load, { interval: 15_000 });

  // Live timer — ticks every second when job is in progress
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    if (!job) return;
    const status = job.assignmentStatus || job.status;
    if (status !== 'IN_PROGRESS' || !job.lastResumedAt) {
      setLiveSeconds(job?.driverTimeSeconds || 0);
      return;
    }

    const base = job.driverTimeSeconds || 0;
    const resumedAt = new Date(job.lastResumedAt).getTime();

    const tick = () => {
      const elapsed = Math.max(0, Math.round((Date.now() - resumedAt) / 1000));
      setLiveSeconds(base + elapsed);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [job]);

  const callAction = async (action: string, note?: string) => {
    if (!job) return;
    setActionLoading(true);
    try {
      const result = await apiFetch('/api/driver/jobs/status', {
        method: 'POST',
        body: { jobId: job.id, action, note },
      });

      // Handle GPS tracking
      if (action === 'start' || action === 'resume') {
        const started = await startTracking(job.id, job.assignmentId || undefined);
        setTracking(started);
        if (!started) {
          Alert.alert('Location Permission Required', 'Please enable background location to track your delivery.');
        }
      } else if (action === 'pause' || action === 'complete' || action === 'cancel') {
        await stopTracking();
        setTracking(false);
      }

      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || `Failed to ${action} job`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = (action: string, title: string, message: string, destructive = false) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: destructive ? 'destructive' : 'default',
        onPress: () => callAction(action),
      },
    ]);
  };

  const handleReportIssue = () => {
    if (!issueNote.trim()) {
      Alert.alert('Required', 'Please describe the issue.');
      return;
    }
    callAction('report_issue', issueNote.trim()).then(() => {
      setShowIssueForm(false);
      setIssueNote('');
      Alert.alert('Sent', 'Your dispatcher has been notified.');
    });
  };

  const handleSelfAssign = () => {
    if (!job) return;
    Alert.alert('Claim Job', `Assign yourself to job #${job.jobNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Claim',
        onPress: () => callAction('assign'),
      },
    ]);
  };

  const openNavigation = (address: string) => {
    if (!address) return;
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
    CANCELLED: colors.status.red,
    PARTIALLY_COMPLETED: colors.status.yellow,
  }[status] || colors.steel[500];

  const isPaused = status === 'ASSIGNED' && (job.driverTimeSeconds > 0 || job.lastResumedAt);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  const rateLabel = job.quantityType === 'TONS' ? '/ton' : job.quantityType === 'YARDS' ? '/yard' : '/load';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
        {/* Job title + status */}
        <Text style={styles.jobName}>{job.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isPaused ? 'PAUSED' : status.replace('_', ' ')}
            </Text>
          </View>
          {(status === 'IN_PROGRESS' || liveSeconds > 0) && (
            <View style={styles.timerBadge}>
              <Ionicons name="time" size={14} color={status === 'IN_PROGRESS' ? colors.safety[600] : colors.steel[500]} />
              <Text style={[styles.timerText, status === 'IN_PROGRESS' && styles.timerActive]}>
                {formatTime(liveSeconds)}
              </Text>
            </View>
          )}
        </View>

        {/* Broker / Customer */}
        {(job.brokerName || job.customerName) && (
          <View style={styles.infoRow}>
            {job.brokerName && (
              <View style={styles.infoPill}>
                <Ionicons name="business-outline" size={14} color={colors.steel[600]} />
                <Text style={styles.infoPillText}>{job.brokerName}</Text>
              </View>
            )}
            {job.customerName && (
              <View style={styles.infoPill}>
                <Ionicons name="person-outline" size={14} color={colors.steel[600]} />
                <Text style={styles.infoPillText}>{job.customerName}</Text>
              </View>
            )}
          </View>
        )}

        {/* Route */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <TouchableOpacity style={styles.locationCard} onPress={() => openNavigation(job.hauledFromAddress)}>
            <Ionicons name="location" size={20} color={colors.status.green} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationName}>{job.hauledFrom}</Text>
              {job.hauledFromAddress ? <Text style={styles.locationAddress}>{job.hauledFromAddress}</Text> : null}
            </View>
            <Ionicons name="navigate-outline" size={20} color={colors.steel[400]} />
          </TouchableOpacity>

          <View style={styles.routeConnector}><View style={styles.routeLine} /></View>

          <TouchableOpacity style={styles.locationCard} onPress={() => openNavigation(job.hauledToAddress)}>
            <Ionicons name="navigate" size={20} color={colors.status.red} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Delivery</Text>
              <Text style={styles.locationName}>{job.hauledTo}</Text>
              {job.hauledToAddress ? <Text style={styles.locationAddress}>{job.hauledToAddress}</Text> : null}
            </View>
            <Ionicons name="navigate-outline" size={20} color={colors.steel[400]} />
          </TouchableOpacity>
        </View>

        {/* Details grid */}
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
              <Text style={styles.detailValue}>
                {job.completedLoads}/{job.totalLoads || '∞'}
              </Text>
            </View>
            {job.ratePerUnit && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Rate</Text>
                <Text style={styles.detailValue}>${job.ratePerUnit}{rateLabel}</Text>
              </View>
            )}
            {job.truckNumber && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Truck</Text>
                <Text style={styles.detailValue}>{job.truckNumber}</Text>
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

        {/* ── Actions ── */}
        <View style={styles.section}>
          {/* POD actions (photo + signature) */}
          {status === 'IN_PROGRESS' && (
            <View style={styles.podActions}>
              <TouchableOpacity style={styles.podButton} onPress={() => router.push(`/job/${id}/photo`)}>
                <Ionicons name="camera" size={20} color={colors.navy[700]} />
                <Text style={styles.podButtonText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.podButton} onPress={() => router.push(`/job/${id}/signature`)}>
                <Ionicons name="create" size={20} color={colors.navy[700]} />
                <Text style={styles.podButtonText}>Signature</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Self-assign for available jobs */}
          {!job.assignmentId && job.status === 'CREATED' && job.openForDrivers && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.status.blue }]}
              onPress={handleSelfAssign}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color={colors.white} /> : (
                <><Ionicons name="hand-left" size={20} color={colors.white} /><Text style={styles.actionText}>Claim This Job</Text></>
              )}
            </TouchableOpacity>
          )}

          {/* Start job (first time) */}
          {status === 'ASSIGNED' && !isPaused && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.status.green }]}
              onPress={() => handleAction('start', 'Start Job', 'Start this job? GPS tracking will begin.')}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color={colors.white} /> : (
                <><Ionicons name="play" size={20} color={colors.white} /><Text style={styles.actionText}>Start Job</Text></>
              )}
            </TouchableOpacity>
          )}

          {/* Resume (paused) */}
          {isPaused && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.status.green }]}
              onPress={() => handleAction('resume', 'Resume Job', 'Resume this job? Timer and GPS will restart.')}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color={colors.white} /> : (
                <><Ionicons name="play" size={20} color={colors.white} /><Text style={styles.actionText}>Resume Job</Text></>
              )}
            </TouchableOpacity>
          )}

          {/* Pause (in progress) */}
          {status === 'IN_PROGRESS' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.status.yellow }]}
              onPress={() => handleAction('pause', 'Pause Job', 'Pause this job? Timer will stop but you can resume later.')}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color={colors.white} /> : (
                <><Ionicons name="pause" size={20} color={colors.white} /><Text style={styles.actionText}>Pause Job</Text></>
              )}
            </TouchableOpacity>
          )}

          {/* Complete (in progress) */}
          {status === 'IN_PROGRESS' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.safety[500], marginTop: 8 }]}
              onPress={() => handleAction('complete', 'Complete Job', 'Mark this job as completed? GPS tracking will stop.', true)}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color={colors.white} /> : (
                <><Ionicons name="checkmark-circle" size={20} color={colors.white} /><Text style={styles.actionText}>Complete Job</Text></>
              )}
            </TouchableOpacity>
          )}

          {/* Report Issue */}
          {['ASSIGNED', 'IN_PROGRESS'].includes(status) && !showIssueForm && (
            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: colors.status.yellow, marginTop: 10 }]}
              onPress={() => setShowIssueForm(true)}
            >
              <Ionicons name="warning" size={18} color={colors.status.yellow} />
              <Text style={[styles.outlineButtonText, { color: colors.status.yellow }]}>Report Issue</Text>
            </TouchableOpacity>
          )}

          {/* Issue form */}
          {showIssueForm && (
            <View style={styles.issueForm}>
              <Text style={styles.issueFormTitle}>Describe the issue</Text>
              <TextInput
                style={styles.issueInput}
                multiline
                numberOfLines={3}
                placeholder="What happened? Your dispatcher will be notified..."
                placeholderTextColor={colors.steel[400]}
                value={issueNote}
                onChangeText={setIssueNote}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  style={[styles.outlineButton, { flex: 1, borderColor: colors.steel[300] }]}
                  onPress={() => { setShowIssueForm(false); setIssueNote(''); }}
                >
                  <Text style={[styles.outlineButtonText, { color: colors.steel[600] }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { flex: 1, backgroundColor: colors.status.yellow }]}
                  onPress={handleReportIssue}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color={colors.white} /> : (
                    <Text style={styles.actionText}>Send Report</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Cancel Job */}
          {['ASSIGNED', 'IN_PROGRESS'].includes(status) && (
            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: colors.status.red, marginTop: 10 }]}
              onPress={() => handleAction('cancel', 'Cancel Job', 'Are you sure you want to cancel this job? This cannot be undone.', true)}
              disabled={actionLoading}
            >
              <Ionicons name="close-circle" size={18} color={colors.status.red} />
              <Text style={[styles.outlineButtonText, { color: colors.status.red }]}>Cancel Job</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.steel[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.steel[50] },
  header: {
    backgroundColor: colors.navy[800],
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.white },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  trackingBar: {
    backgroundColor: colors.status.greenBg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, gap: 8,
  },
  trackingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.status.green },
  trackingText: { fontSize: 13, fontWeight: '600', color: colors.status.green },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  jobName: { fontSize: 22, fontWeight: '700', color: colors.steel[900], marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  statusText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: colors.steel[200],
  },
  timerText: { fontSize: 14, fontWeight: '700', color: colors.steel[600], fontVariant: ['tabular-nums'] },
  timerActive: { color: colors.safety[600] },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.steel[100], paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  infoPillText: { fontSize: 13, color: colors.steel[700], fontWeight: '500' },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.steel[500],
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  locationCard: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14,
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
  podActions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
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
  outlineButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14,
    borderWidth: 1.5, backgroundColor: 'transparent',
  },
  outlineButtonText: { fontSize: 15, fontWeight: '600' },
  issueForm: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16, marginTop: 10,
    borderWidth: 1, borderColor: colors.status.yellow + '44',
  },
  issueFormTitle: { fontSize: 14, fontWeight: '600', color: colors.steel[800], marginBottom: 8 },
  issueInput: {
    backgroundColor: colors.steel[50], borderRadius: 8, padding: 12,
    fontSize: 14, color: colors.steel[900], minHeight: 80, textAlignVertical: 'top',
    borderWidth: 1, borderColor: colors.steel[200],
  },
});
