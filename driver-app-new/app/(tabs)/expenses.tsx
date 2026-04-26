import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Alert, TextInput, AppState,
  Modal, ScrollView, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, apiUpload } from '@/lib/api';
import { colors } from '@/lib/colors';

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  vendor: string | null;
  receiptUrl: string | null;
  notes: string | null;
  truckNumber: string | null;
}

const CATEGORIES = [
  { value: 'FUEL', label: 'Fuel', icon: 'flame', color: colors.safety[500] },
  { value: 'PARTS', label: 'Parts', icon: 'construct', color: colors.status.blue },
  { value: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-circle', color: colors.steel[500] },
] as const;

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [category, setCategory] = useState<string>('FUEL');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/driver/expenses');
      setExpenses(data.expenses || []);
    } catch (err) {
      console.error('Failed to load expenses:', err);
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

  const pickReceipt = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take receipt photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptPhoto(result.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access needed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptPhoto(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('date', new Date().toISOString().split('T')[0]);
      formData.append('amount', amount);
      formData.append('category', category);
      if (vendor.trim()) formData.append('vendor', vendor.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (notes.trim()) formData.append('notes', notes.trim());

      if (receiptPhoto) {
        formData.append('receipt', {
          uri: receiptPhoto,
          name: `receipt_${Date.now()}.jpg`,
          type: 'image/jpeg',
        } as any);
      }

      await apiUpload('/api/driver/expenses', formData);

      setShowForm(false);
      setAmount('');
      setVendor('');
      setDescription('');
      setNotes('');
      setReceiptPhoto(null);
      setCategory('FUEL');
      Alert.alert('Submitted', 'Expense submitted to your dispatcher.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit expense');
    } finally {
      setSubmitting(false);
    }
  };

  const totalThisMonth = expenses
    .filter((e) => {
      const d = new Date(e.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const getCategoryInfo = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat) || CATEGORIES[2];

  const renderExpense = ({ item }: { item: Expense }) => {
    const catInfo = getCategoryInfo(item.category);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.categoryBadge}>
            <Ionicons name={catInfo.icon as any} size={16} color={catInfo.color} />
            <Text style={[styles.categoryText, { color: catInfo.color }]}>{catInfo.label}</Text>
          </View>
          <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
        </View>

        {item.vendor && (
          <Text style={styles.vendor}>{item.vendor}</Text>
        )}
        {item.description && (
          <Text style={styles.description}>{item.description}</Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.date}>
            {new Date(item.date).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </Text>
          {item.receiptUrl && (
            <View style={styles.receiptIndicator}>
              <Ionicons name="document" size={14} color={colors.status.green} />
              <Text style={styles.receiptText}>Receipt</Text>
            </View>
          )}
          {item.truckNumber && (
            <Text style={styles.truckBadge}>Truck {item.truckNumber}</Text>
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
          <Text style={styles.summaryNumber}>{expenses.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            ${totalThisMonth.toFixed(0)}
          </Text>
          <Text style={styles.summaryLabel}>This Month</Text>
        </View>
      </View>

      {/* New expense button */}
      <TouchableOpacity
        style={styles.newBtn}
        onPress={() => setShowForm(true)}
      >
        <Ionicons name="add-circle" size={20} color={colors.white} />
        <Text style={styles.newBtnText}>Add Expense</Text>
      </TouchableOpacity>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpense}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.safety[500]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={48} color={colors.steel[300]} />
            <Text style={styles.emptyText}>No expenses yet</Text>
            <Text style={styles.emptySubtext}>
              Log fuel, parts, and other expenses here
            </Text>
          </View>
        }
      />

      {/* New Expense Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Expense</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={colors.steel[600]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Category selector */}
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryOption,
                      category === cat.value && styles.categoryOptionActive,
                    ]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={20}
                      color={category === cat.value ? colors.white : cat.color}
                    />
                    <Text
                      style={[
                        styles.categoryOptionText,
                        category === cat.value && styles.categoryOptionTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Amount ($)</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.steel[400]}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>Vendor (optional)</Text>
              <TextInput
                style={styles.input}
                value={vendor}
                onChangeText={setVendor}
                placeholder="e.g., Shell, AutoZone..."
                placeholderTextColor={colors.steel[400]}
              />

              <Text style={styles.fieldLabel}>Description (optional)</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g., Diesel fill-up, brake pads..."
                placeholderTextColor={colors.steel[400]}
              />

              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional notes..."
                placeholderTextColor={colors.steel[400]}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />

              {/* Receipt photo */}
              <Text style={styles.fieldLabel}>Receipt Photo (optional)</Text>
              {receiptPhoto ? (
                <View style={styles.receiptPreview}>
                  <Image source={{ uri: receiptPhoto }} style={styles.receiptImage} />
                  <TouchableOpacity
                    style={styles.removeReceiptBtn}
                    onPress={() => setReceiptPhoto(null)}
                  >
                    <Ionicons name="close-circle" size={28} color={colors.status.red} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.receiptButtons}>
                  <TouchableOpacity style={styles.receiptBtn} onPress={pickReceipt}>
                    <Ionicons name="camera" size={20} color={colors.navy[700]} />
                    <Text style={styles.receiptBtnText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.receiptBtn} onPress={pickFromLibrary}>
                    <Ionicons name="images" size={20} color={colors.navy[700]} />
                    <Text style={styles.receiptBtnText}>Library</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Expense</Text>
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
  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.safety[500],
    marginHorizontal: 16, marginTop: 12, paddingVertical: 14,
    borderRadius: 12,
  },
  newBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  list: { padding: 16, gap: 8 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  amount: { fontSize: 18, fontWeight: '800', color: colors.steel[900] },
  vendor: { fontSize: 15, fontWeight: '600', color: colors.steel[800], marginBottom: 2 },
  description: { fontSize: 14, color: colors.steel[600], marginBottom: 6 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.steel[100],
  },
  date: { fontSize: 12, color: colors.steel[400] },
  receiptIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  receiptText: { fontSize: 12, color: colors.status.green, fontWeight: '600' },
  truckBadge: { fontSize: 12, color: colors.steel[500], marginLeft: 'auto' },
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
    maxHeight: '90%',
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
  textArea: { minHeight: 60 },
  categoryRow: {
    flexDirection: 'row', gap: 10,
  },
  categoryOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.steel[200], backgroundColor: colors.white,
  },
  categoryOptionActive: {
    backgroundColor: colors.navy[800], borderColor: colors.navy[800],
  },
  categoryOptionText: { fontSize: 13, fontWeight: '600', color: colors.steel[700] },
  categoryOptionTextActive: { color: colors.white },
  receiptPreview: { position: 'relative', marginTop: 4 },
  receiptImage: { width: '100%', height: 150, borderRadius: 10, backgroundColor: colors.steel[200] },
  removeReceiptBtn: { position: 'absolute', top: 8, right: 8 },
  receiptButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  receiptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.navy[200], backgroundColor: colors.white,
  },
  receiptBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy[700] },
  submitBtn: {
    backgroundColor: colors.safety[500], borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 20, marginBottom: 30,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
});
