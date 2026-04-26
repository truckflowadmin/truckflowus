import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  StyleSheet, ActivityIndicator, Linking, Platform,
  TextInput, Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { startTracking, stopTracking, isTrackingActive } from '@/lib/location';
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
  openForDrivers: boolean;
  proofOfDelivery?: Array<{ id: string; type: string; fileUrl: string; createdAt: string }>;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Report issue state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueNote, setIssueNote] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/driver/jobs/${id}`);
      setJob(data);
      const active = await isTrackingActive();
      setTracking(active && data.assignmentStatus === 'IN_PROGRESS');

      // Set up live timer
      const baseSeconds = data.driverTimeSeconds || 0;
      if (data.assignmentStatus === 'IN_PROGRESS') {
        setLiveSeconds(baseSeconds);
      } else {
        setLiveSeconds(baseSeconds);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Live timer tick every second when job is in progress
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (job?.assignmentStatus === 'IN_PROGRESS') {
      const baseSeconds = job.driverTimeSeconds || 0;
      setLiveSeconds(baseSeconds);

      timerRef.current = setInterval(() => {
        setLiveSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [job?.assignmentStatus, job?.driverTimeSeconds]);

  const handleAction = async (action: string, confirmMsg: string) => {
    if (!job) return;
    Alert.alert('Confirm', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: action === 'complete' || action === 'cancel' ? 'destructive' : 'default',
        onPress: async () => {
          setActionLoading(true);
          try {
            const result = await apiFetch('/api/driver/jobs/status', {
              method: 'POST',
              body: { jobId: job.id, action },
            });

            // Handle GPS tracking
            if (action === 'start' || action === 'resume') {
              const started = await startTracking(job.id, job.assignmentId || undefined);
              setTracking(started);
              if (!started) {
                Alert.alert('Location Permission Required', 'Enable background location for GPS tracking.');
              }
            } else if (action === 'complete' || action === 'cancel' || action === 'pause') {
              if (action !== 'pause') {
                await stopTracking();
                setTracking(false);
              }
            }

            await load();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update status');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleReportIssue = async () => {
    if (!job) return;
    setActionLoading(true);
    try {
      await apiFetch('/api/driver/jobs/status', {
        method: 'POST',
        body: { jobId: job.id, action: 'report_issue', note: issueNote.trim() },
      });
      setShowIssueModal(false);
      setIssueNote('');
      Alert.alert('Reported', 'Issue reported to your dispatcher.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to report issue');
    } finally {
      setActionLoading(false);
    }
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
            await apiFetch('/api/driver/jobs/status', {
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
    CANCELLED: colors.status.red,
  }[status] || colors.steel[500];

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s.toString().padStart(2, '0')}s`;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  // Determine if the job was previously started (has time or startedAt implies pause state)
  const isPaused = status === 'ASSIGNED' && (job.driverTimeSeconds > 0);
  const isActive = status === 'IN_PROGRESS';
  const isAssigned = status === 'ASSIGNED' && !isPaused;

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

      {/* Live timer bar */}
      {(isActive || isPaused || status === 'COMPLETED') && (
        <View style={[styles.timerBar, isActive && styles.timerBarActive]}>
          <Ionicons
            name={isActive ? 'timer' : 'time'}
            size={20}
            color={isActive ? colors.safety[500] : colors.steel[500]}
          />
          <Text style={[styles.timerText, isActive && styles.timerTextActive]}>
            {formatTime(liveSeconds)}
          </Text>
          {isActive && (
            <View style={styles.timerLiveDot} />
          )}
          {isPaused && (
            <Text style={styles.timerPausedLabel}>PAUSED</Text>
          )}
        </View>
      )}

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Job title */}
        <Text style={styles.jobName}>{job.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {isPaused ? 'PAUSED' : status.replace('_', ' ')}
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
            {job.customerName && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Customer</Text>
                <Text style={styles.detailValue}>{job.customerName}</Text>
              </View>
            )}
            {job.brokerName && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Broker</Text>
                <Text style={styles.detailValue}>{job.brokerName}</Text>
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

        {/* Proof of Delivery */}
        {job.proofOfDelivery && job.proofOfDelivery.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Proof of Delivery ({job.proofOfDelivery.length})</Text>
            {job.proofOfDelivery.map((pod) => (
              <View key={pod.id} style={styles.podItem}>
                <Ionicons
                  name={pod.type === 'SIGNATURE' ? 'create' : 'camera'}
                  size={16}
                  color={colors.status.green}
                />
                <Text style={styles.podText}>
                  {pod.type === 'SIGNATURE' ? 'Signature' : 'Photo'} —{' '}
                  {new Date(pod.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          {/* POD actions — show when in progress */}
          {isActive && (
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
          {!job.assignmentId && (job.status === 'CREATED' || job.openForDrivers) && (
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

          {/* Start job (first time) */}
          {isAssigned && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.status.green }]}
              onPress={() => handleAction('start', 'Start this job? GPS tracking will begin.')}
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

          {/* Resume (paused state) */}
          {isPaused && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.status.green }]}
              onPress={() => handleAction('resume', 'Resume this job? Timer will continue.')}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="play" size={20} color={colors.white} />
                  <Text style={styles.actionText}>Resume Job</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Pause job */}
          {isActive && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.status.yellow }]}
              onPress={() => handleAction('pause', 'Pause this job? Timer will stop until you resume.')}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="pause" size={20} color={colors.white} />
                  <Text style={styles.actionText}>Pause Job</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Complete job */}
          {isActive && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.safety[500] }]}
              onPress={() => handleAction('complete', 'Mark this job as completed? GPS tracking will stop.')}
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

          {/* Report Issue */}
          {(isActive || isAssigned || isPaused) && (
            <TouchableOpacity
              style={styles.issueButton}
              onPress={() => setShowIssueModal(true)}
              disabled={actionLoading}
            >
              <Ionicons name="warning" size={18} color={colors.status.red} />
              <Text style={styles.issueButtonText}>Report Issue</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Report Issue Modal */}
      <Modal visible={showIssueModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Issue</Text>
              <TouchableOpacity onPress={() => setShowIssueModal(false)}>
                <Ionicons name="close" size={24} color={colors.steel[600]} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Describe the issue</Text>
              <TextInput
                style={styles.issueInput}
                value={issueNote}
                onChangeText={setIssueNote}
                placeholder="e.g., Flat tire, wrong address, safety concern..."
                placeholderTextColor={colors.steel[400]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.issueSubmitBtn, actionLoading && { opacity: 0.7 }]}
                onPress={handleReportIssue}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.issueSubmitText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  // Timer bar
  timerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 12,
    backgroundColor: colors.steel[100],
  },
  timerBarActive: {
    backgroundColor: colors.safety[500] + '15',
  },
  timerText: {
    fontSize: 22, fontWeight: '800', color: colors.steel[600],
    fontVariant: ['tabular-nums'],
  },
  timerTextActive: {
    color: colors.safety[600],
  },
  timerLiveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.safety[500],
  },
  timerPausedLabel: {
    fontSize: 11, fontWeight: '700', color: colors.status.yellow,
    backgroundColor: colors.status.yellowBg, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, letterSpacing: 1,
  },
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
  // POD section
  podItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.white, borderRadius: 8, padding: 10, marginBottom: 6,
  },
  podText: { fontSize: 13, color: colors.steel[600] },
  podActions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  podButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.white, borderRadius: 12,
    paddingVertical: 14, borderWidth: 1.5, borderColor: colors.navy[200],
  },
  podButtonText: { fontSize: 14, fontWeight: '600', color: colors.navy[700] },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 12, paddingVertical: 16, marginBottom: 10,
  },
  actionText: { fontSize: 17, fontWeight: '700', color: colors.white },
  issueButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4,
    borderWidth: 1.5, borderColor: colors.status.red,
  },
  issueButtonText: { fontSize: 15, fontWeight: '600', color: colors.status.red },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.steel[100],
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.steel[900] },
  modalBody: { padding: 20 },
  fieldLabel: {
    fontSize: 13, fontWeight: '600', color: colors.steel[600],
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  issueInput: {
    backgroundColor: colors.steel[50], borderRadius: 10,
    padding: 14, fontSize: 16, color: colors.steel[900],
    borderWidth: 1, borderColor: colors.steel[200],
    minHeight: 100,
  },
  issueSubmitBtn: {
    backgroundColor: colors.status.red, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 16, marginBottom: 30,
  },
  issueSubmitText: { fontSize: 17, fontWeight: '700', color: colors.white },
});
