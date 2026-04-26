import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, TextInput,
  StyleSheet, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
  Image, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, apiUpload } from '@/lib/api';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
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
  { key: 'FUEL', label: 'Fuel', icon: 'flame' },
  { key: 'PARTS', label: 'Parts', icon: 'construct' },
  { key: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal' },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  FUEL: colors.status.yellow,
  PARTS: colors.status.blue,
  OTHER: colors.steel[500],
};

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('FUEL');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/driver/expenses');
      setExpenses(data.expenses || []);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useAutoRefresh(load, { interval: 60_000 });

  const getToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const pickReceipt = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed for receipts.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setReceipt(result.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Library access is needed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setReceipt(result.assets[0].uri);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setDate('');
    setAmount('');
    setCategory('FUEL');
    setVendor('');
    setDescription('');
    setNotes('');
    setReceipt(null);
  };

  const handleSubmit = async () => {
    const expDate = date || getToday();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Alert.alert('Required', 'Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('date', expDate);
      formData.append('amount', amount);
      formData.append('category', category);
      if (vendor.trim()) formData.append('vendor', vendor.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (notes.trim()) formData.append('notes', notes.trim());
      if (receipt) {
        formData.append('receipt', {
          uri: receipt,
          name: `receipt_${Date.now()}.jpg`,
          type: 'image/jpeg',
        } as any);
      }

      await apiUpload('/api/driver/expenses', formData);
      resetForm();
      Alert.alert('Submitted', 'Expense has been recorded.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit expense');
    } finally {
      setSubmitting(false);
    }
  };

  const renderExpense = ({ item }: { item: Expense }) => {
    const catColor = CATEGORY_COLORS[item.category] || colors.steel[500];
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.catDot, { backgroundColor: catColor }]} />
          <Text style={styles.catLabel}>{item.category}</Text>
          <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
        </View>
        {item.vendor && <Text style={styles.vendor}>{item.vendor}</Text>}
        {item.description && <Text style={styles.desc}>{item.description}</Text>}
        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>{new Date(item.date).toLocaleDateString()}</Text>
          {item.receiptUrl && (
            <View style={styles.receiptIndicator}>
              <Ionicons name="image" size={14} color={colors.status.green} />
              <Text style={styles.receiptText}>Receipt</Text>
            </View>
          )}
          {item.truckNumber && <Text style={styles.truck}>Truck {item.truckNumber}</Text>}
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
      {/* Total banner */}
      <View style={styles.totalBanner}>
        <Text style={styles.totalLabel}>Total Expenses</Text>
        <Text style={styles.totalAmount}>${totalExpenses.toFixed(2)}</Text>
      </View>

      {showForm ? (
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContainer}>
          <Text style={styles.formTitle}>New Expense</Text>

          {/* Category selector */}
          <Text style={styles.formLabel}>Category</Text>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.catPill, category === c.key && styles.catPillActive]}
                onPress={() => setCategory(c.key)}
              >
                <Ionicons name={c.icon as any} size={16} color={category === c.key ? colors.white : colors.steel[600]} />
                <Text style={[styles.catPillText, category === c.key && styles.catPillTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Amount *</Text>
              <TextInput
                style={styles.formInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.steel[400]}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Date</Text>
              <TextInput
                style={styles.formInput}
                value={date}
                onChangeText={setDate}
                placeholder={getToday()}
                placeholderTextColor={colors.steel[400]}
              />
            </View>
          </View>

          <Text style={styles.formLabel}>Vendor</Text>
          <TextInput
            style={styles.formInput}
            value={vendor}
            onChangeText={setVendor}
            placeholder="e.g. Shell, AutoZone..."
            placeholderTextColor={colors.steel[400]}
          />

          <Text style={styles.formLabel}>Description</Text>
          <TextInput
            style={styles.formInput}
            value={description}
            onChangeText={setDescription}
            placeholder="What was this for?"
            placeholderTextColor={colors.steel[400]}
          />

          <Text style={styles.formLabel}>Notes</Text>
          <TextInput
            style={[styles.formInput, { minHeight: 50, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes..."
            placeholderTextColor={colors.steel[400]}
            multiline
          />

          {/* Receipt photo */}
          <Text style={styles.formLabel}>Receipt Photo</Text>
          {receipt ? (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Image source={{ uri: receipt }} style={styles.receiptPreview} />
              <TouchableOpacity onPress={() => setReceipt(null)}>
                <Text style={{ color: colors.status.red, fontSize: 13, fontWeight: '600' }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.receiptActions}>
              <TouchableOpacity style={styles.receiptBtn} onPress={pickReceipt}>
                <Ionicons name="camera" size={18} color={colors.navy[700]} />
                <Text style={styles.receiptBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.receiptBtn} onPress={pickFromLibrary}>
                <Ionicons name="images" size={18} color={colors.navy[700]} />
                <Text style={styles.receiptBtnText}>Library</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
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
                <Text style={styles.submitBtnText}>Submit Expense</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <>
          <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="add-circle" size={20} color={colors.safety[500]} />
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
                <Text style={styles.emptyText}>No expenses recorded</Text>
              </View>
            }
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.steel[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.steel[50] },
  totalBanner: {
    backgroundColor: colors.navy[800], paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalLabel: { fontSize: 14, color: colors.navy[300] },
  totalAmount: { fontSize: 22, fontWeight: '700', color: colors.white },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginTop: 12,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.safety[500],
  },
  newBtnText: { fontSize: 15, fontWeight: '600', color: colors.safety[600] },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catLabel: { fontSize: 12, fontWeight: '700', color: colors.steel[500], textTransform: 'uppercase', flex: 1 },
  amount: { fontSize: 17, fontWeight: '700', color: colors.steel[900] },
  vendor: { fontSize: 14, fontWeight: '600', color: colors.steel[700], marginBottom: 2 },
  desc: { fontSize: 13, color: colors.steel[500], marginBottom: 4 },
  cardFooter: {
    flexDirection: 'row', gap: 16, alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.steel[100],
  },
  dateText: { fontSize: 12, color: colors.steel[400] },
  receiptIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  receiptText: { fontSize: 12, color: colors.status.green },
  truck: { fontSize: 12, color: colors.steel[400], marginLeft: 'auto' },
  // Form styles
  formScroll: { flex: 1 },
  formContainer: { padding: 16, gap: 12, paddingBottom: 40 },
  formTitle: { fontSize: 18, fontWeight: '700', color: colors.steel[900] },
  formRow: { flexDirection: 'row', gap: 12 },
  formField: { flex: 1 },
  formLabel: {
    fontSize: 12, fontWeight: '600', color: colors.steel[500],
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  formInput: {
    backgroundColor: colors.white, borderRadius: 8, padding: 12,
    fontSize: 14, color: colors.steel[900],
    borderWidth: 1, borderColor: colors.steel[200],
  },
  catRow: { flexDirection: 'row', gap: 8 },
  catPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.steel[100],
  },
  catPillActive: { backgroundColor: colors.navy[800] },
  catPillText: { fontSize: 13, fontWeight: '600', color: colors.steel[600] },
  catPillTextActive: { color: colors.white },
  receiptActions: { flexDirection: 'row', gap: 12 },
  receiptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.navy[200],
  },
  receiptBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy[700] },
  receiptPreview: { width: 200, height: 150, borderRadius: 8, backgroundColor: colors.steel[200] },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.steel[300], alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.steel[600] },
  submitBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: colors.safety[500], alignItems: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: colors.steel[400] },
});
