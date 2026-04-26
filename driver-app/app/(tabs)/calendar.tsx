import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, TextInput,
  StyleSheet, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { colors } from '@/lib/colors';

interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: colors.status.yellowBg, text: colors.status.yellow },
  APPROVED: { bg: colors.status.greenBg, text: colors.status.green },
  DENIED: { bg: colors.status.redBg, text: colors.status.red },
};

export default function CalendarScreen() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
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
    }
  }, []);

  const { refreshing, onRefresh } = useAutoRefresh(load, { interval: 60_000 });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  };

  const getToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Required', 'Please enter start and end dates (YYYY-MM-DD).');
      return;
    }
    // Basic date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      Alert.alert('Invalid Date', 'Use format YYYY-MM-DD (e.g. 2026-05-01).');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('Invalid Range', 'End date must be on or after start date.');
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

  const handleCancel = (id: string) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this time-off request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch('/api/driver/time-off', {
              method: 'DELETE',
              body: { requestId: id },
            });
            await load();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to cancel request');
          }
        },
      },
    ]);
  };

  const renderRequest = ({ item }: { item: TimeOffRequest }) => {
    const style = STATUS_STYLES[item.status] || STATUS_STYLES.PENDING;
    const start = formatDate(item.startDate);
    const end = formatDate(item.endDate);
    const isSameDay = item.startDate.slice(0, 10) === item.endDate.slice(0, 10);
    const canCancel = item.status === 'PENDING' || item.status === 'APPROVED';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.dateRange}>
            {isSameDay ? start : `${start} – ${end}`}
          </Text>
          <View style={[styles.badge, { backgroundColor: style.bg }]}>
            <Text style={[styles.badgeText, { color: style.text }]}>{item.status}</Text>
          </View>
        </View>
        {item.reason && <Text style={styles.reason}>{item.reason}</Text>}
        <View style={styles.cardFooter}>
          <Text style={styles.submitted}>
            Submitted {formatDate(item.createdAt)}
          </Text>
          {canCancel && (
            <TouchableOpacity onPress={() => handleCancel(item.id)}>
              <Text style={styles.cancelLink}>Cancel</Text>
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* New request form */}
      {showForm ? (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Request Time Off</Text>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Start Date</Text>
              <TextInput
                style={styles.formInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder={getToday()}
                placeholderTextColor={colors.steel[400]}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>End Date</Text>
              <TextInput
                style={styles.formInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder={getToday()}
                placeholderTextColor={colors.steel[400]}
              />
            </View>
          </View>
          <Text style={styles.formLabel}>Reason (optional)</Text>
          <TextInput
            style={[styles.formInput, { minHeight: 60, textAlignVertical: 'top' }]}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Family event, medical appointment..."
            placeholderTextColor={colors.steel[400]}
            multiline
          />
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowForm(false); setStartDate(''); setEndDate(''); setReason(''); }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.newRequestBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={20} color={colors.safety[500]} />
          <Text style={styles.newRequestText}>Request Time Off</Text>
        </TouchableOpacity>
      )}

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
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.steel[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.steel[50] },
  newRequestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginTop: 12,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.safety[500],
  },
  newRequestText: { fontSize: 15, fontWeight: '600', color: colors.safety[600] },
  formContainer: {
    backgroundColor: colors.white, margin: 16, marginBottom: 0,
    padding: 16, borderRadius: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: colors.steel[900] },
  formRow: { flexDirection: 'row', gap: 12 },
  formField: { flex: 1 },
  formLabel: {
    fontSize: 12, fontWeight: '600', color: colors.steel[500],
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  formInput: {
    backgroundColor: colors.steel[50], borderRadius: 8, padding: 12,
    fontSize: 14, color: colors.steel[900],
    borderWidth: 1, borderColor: colors.steel[200],
  },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.steel[300], alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.steel[600] },
  submitBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: colors.safety[500], alignItems: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  dateRange: { fontSize: 15, fontWeight: '700', color: colors.steel[900] },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  reason: { fontSize: 14, color: colors.steel[600], marginBottom: 8 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.steel[100],
  },
  submitted: { fontSize: 12, color: colors.steel[400] },
  cancelLink: { fontSize: 13, fontWeight: '600', color: colors.status.red },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: colors.steel[400] },
});
