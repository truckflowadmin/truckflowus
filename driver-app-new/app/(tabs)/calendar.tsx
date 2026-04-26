import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Alert, TextInput, AppState,
  Platform, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { colors } from '@/lib/colors';

interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  PENDING: { bg: colors.status.yellowBg, text: colors.status.yellow, icon: 'time' },
  APPROVED: { bg: colors.status.greenBg, text: colors.status.green, icon: 'checkmark-circle' },
  DENIED: { bg: colors.status.redBg, text: colors.status.red, icon: 'close-circle' },
};

export default function CalendarScreen() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/driver/time-off');
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to load time-off:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please enter both start and end dates (YYYY-MM-DD format).');
      return;
    }

    // Basic date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      Alert.alert('Error', 'Please use YYYY-MM-DD format (e.g., 2026-05-01).');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/driver/time-off', {
        method: 'POST',
        body: { startDate, endDate, reason: reason.trim() || null },
      });
      setShowForm(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      Alert.alert('Submitted', 'Your time-off request has been sent to your dispatcher.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this time-off request?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch('/api/driver/time-off', {
              method: 'DELETE',
              body: { requestId },
            });
            await load();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to cancel request');
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  const formatDateRange = (start: string, end: string) => {
    const s = formatDate(start);
    const e = formatDate(end);
    return s === e ? s : `${s} – ${e}`;
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;

  const renderRequest = ({ item }: { item: TimeOffRequest }) => {
    const statusInfo = STATUS_COLORS[item.status] || STATUS_COLORS.PENDING;
    const canCancel = item.status === 'PENDING' || item.status === 'APPROVED';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon as any} size={14} color={statusInfo.text} />
            <Text style={[styles.badgeText, { color: statusInfo.text }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Ionicons name="calendar" size={18} color={colors.navy[700]} />
          <Text style={styles.dateText}>
            {formatDateRange(item.startDate, item.endDate)}
          </Text>
        </View>

        {item.reason && (
          <Text style={styles.reason}>{item.reason}</Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.submitted}>
            Submitted {formatDate(item.createdAt)}
          </Text>
          {canCancel && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => handleCancel(item.id)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
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
      {/* Summary */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{approvedCount}</Text>
          <Text style={styles.summaryLabel}>Approved</Text>
        </View>
      </View>

      {/* New request button */}
      <TouchableOpacity
        style={styles.newRequestBtn}
        onPress={() => setShowForm(true)}
      >
        <Ionicons name="add-circle" size={20} color={colors.white} />
        <Text style={styles.newRequestBtnText}>Request Time Off</Text>
      </TouchableOpacity>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.safety[500]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.steel[300]} />
            <Text style={styles.emptyText}>No time-off requests</Text>
            <Text style={styles.emptySubtext}>
              Tap the button above to request time off
            </Text>
          </View>
        }
      />

      {/* New Request Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Time Off</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={colors.steel[600]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Start Date</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.steel[400]}
                keyboardType="default"
              />

              <Text style={styles.fieldLabel}>End Date</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.steel[400]}
                keyboardType="default"
              />

              <Text style={styles.fieldLabel}>Reason (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={reason}
                onChangeText={setReason}
                placeholder="e.g., Family vacation, Medical appointment..."
                placeholderTextColor={colors.steel[400]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  newRequestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.safety[500],
    marginHorizontal: 16, marginTop: 12, paddingVertical: 14,
    borderRadius: 12,
  },
  newRequestBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  list: { padding: 16, gap: 8 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, marginBottom: 10,
  },
  cardHeader: { marginBottom: 10 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dateText: { fontSize: 16, fontWeight: '600', color: colors.steel[900] },
  reason: { fontSize: 14, color: colors.steel[600], marginBottom: 10, lineHeight: 20 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.steel[100],
  },
  submitted: { fontSize: 12, color: colors.steel[400] },
  cancelBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1.5, borderColor: colors.status.red,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: colors.status.red },
  empty: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.steel[400] },
  emptySubtext: { fontSize: 13, color: colors.steel[400] },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '80%',
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
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: colors.steel[50], borderRadius: 10,
    padding: 14, fontSize: 16, color: colors.steel[900],
    borderWidth: 1, borderColor: colors.steel[200],
  },
  textArea: { minHeight: 80 },
  submitBtn: {
    backgroundColor: colors.safety[500], borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 20, marginBottom: 30,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
});
