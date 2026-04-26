import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Switch, Platform, KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, apiUpload, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { isTrackingActive } from '@/lib/location';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { colors } from '@/lib/colors';

interface Profile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  truckNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  smsEnabled: boolean;
  smsJobAssignment: boolean;
  smsJobStatusChange: boolean;
  lastLoginAt: string | null;
}

interface Document {
  id: string;
  docType: string;
  fileUrl: string;
  label: string | null;
}

export default function ProfileScreen() {
  const { driverName, logout } = useAuth();
  const { lang, t, setLang } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);

  // Edit form state
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editZip, setEditZip] = useState('');
  const [editEmergName, setEditEmergName] = useState('');
  const [editEmergPhone, setEditEmergPhone] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/driver/profile');
      // API returns { driver: {...} }
      const p = data.driver || data;
      setProfile(p);
      const isTracking = await isTrackingActive();
      setTracking(isTracking);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useAutoRefresh(load, { interval: 60_000 });

  const startEditing = () => {
    if (!profile) return;
    setEditEmail(profile.email || '');
    setEditPhone(profile.phone || '');
    setEditAddress(profile.address || '');
    setEditCity(profile.city || '');
    setEditState(profile.state || '');
    setEditZip(profile.zip || '');
    setEditEmergName(profile.emergencyContactName || '');
    setEditEmergPhone(profile.emergencyContactPhone || '');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/driver/profile', {
        method: 'POST',
        body: {
          email: editEmail.trim() || null,
          phone: editPhone.trim(),
          address: editAddress.trim() || null,
          city: editCity.trim() || null,
          state: editState.trim() || null,
          zip: editZip.trim() || null,
          emergencyContactName: editEmergName.trim() || null,
          emergencyContactPhone: editEmergPhone.trim() || null,
        },
      });
      setEditing(false);
      Alert.alert('Saved', 'Profile updated successfully.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (docType: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const formData = new FormData();
      const tok = await getToken();
      formData.append('token', tok || '');
      formData.append('docType', docType);
      formData.append('file', {
        uri: result.assets[0].uri,
        name: `doc_${docType}_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      await apiUpload('/api/driver/documents', formData);
      Alert.alert('Uploaded', `${docType.replace('_', ' ')} uploaded successfully.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading || !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.safety[500]} />
      </View>
    );
  }

  if (editing) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.editContent}>
          <Text style={styles.editTitle}>Edit Profile</Text>

          <Text style={styles.fieldLabel}>Phone *</Text>
          <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone}
            placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor={colors.steel[400]} />

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail}
            placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none"
            placeholderTextColor={colors.steel[400]} />

          <Text style={styles.fieldLabel}>Address</Text>
          <TextInput style={styles.input} value={editAddress} onChangeText={setEditAddress}
            placeholder="Street address" placeholderTextColor={colors.steel[400]} />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput style={styles.input} value={editCity} onChangeText={setEditCity}
                placeholder="City" placeholderTextColor={colors.steel[400]} />
            </View>
            <View style={{ width: 80 }}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput style={styles.input} value={editState} onChangeText={setEditState}
                placeholder="TX" autoCapitalize="characters" placeholderTextColor={colors.steel[400]} />
            </View>
            <View style={{ width: 100 }}>
              <Text style={styles.fieldLabel}>ZIP</Text>
              <TextInput style={styles.input} value={editZip} onChangeText={setEditZip}
                placeholder="78701" keyboardType="number-pad" placeholderTextColor={colors.steel[400]} />
            </View>
          </View>

          <Text style={[styles.editTitle, { fontSize: 16, marginTop: 20 }]}>Emergency Contact</Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput style={styles.input} value={editEmergName} onChangeText={setEditEmergName}
            placeholder="Contact name" placeholderTextColor={colors.steel[400]} />
          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput style={styles.input} value={editEmergPhone} onChangeText={setEditEmergPhone}
            placeholder="Contact phone" keyboardType="phone-pad" placeholderTextColor={colors.steel[400]} />

          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.profileName}>{profile.name}</Text>
        <Text style={styles.profilePhone}>{profile.phone}</Text>
        {tracking && (
          <View style={styles.trackingBadge}>
            <View style={styles.trackingDot} />
            <Text style={styles.trackingText}>GPS tracking active</Text>
          </View>
        )}
        <TouchableOpacity style={styles.editProfileBtn} onPress={startEditing}>
          <Ionicons name="create-outline" size={16} color={colors.safety[500]} />
          <Text style={styles.editProfileText}>{t('profile.editProfile')}</Text>
        </TouchableOpacity>
      </View>

      {/* Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.contact')}</Text>
        <InfoRow icon="call" label={t('common.phone')} value={profile.phone} />
        <InfoRow icon="mail" label={t('common.email')} value={profile.email || t('common.notSet')} />
        {profile.truckNumber && (
          <InfoRow icon="car" label="Truck" value={profile.truckNumber} />
        )}
      </View>

      {/* Address */}
      {profile.address && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.address')}</Text>
          <InfoRow
            icon="location"
            label="Address"
            value={[profile.address, profile.city, profile.state, profile.zip].filter(Boolean).join(', ')}
          />
        </View>
      )}

      {/* Emergency Contact */}
      {profile.emergencyContactName && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.emergencyContact')}</Text>
          <InfoRow icon="person" label={t('common.name')} value={profile.emergencyContactName} />
          <InfoRow icon="call" label={t('common.phone')} value={profile.emergencyContactPhone || t('common.notSet')} />
        </View>
      )}

      {/* Documents */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.documents')}</Text>
        <Text style={styles.docHint}>Upload your licenses and certifications</Text>
        {(['LICENSE_FRONT', 'LICENSE_BACK', 'MEDICAL_CERT'] as const).map((docType) => (
          <TouchableOpacity
            key={docType}
            style={styles.docRow}
            onPress={() => uploadDocument(docType)}
            disabled={uploading}
          >
            <Ionicons name="document-outline" size={18} color={colors.steel[400]} />
            <Text style={styles.docLabel}>
              {docType === 'LICENSE_FRONT' ? 'License (Front)' :
               docType === 'LICENSE_BACK' ? 'License (Back)' :
               'Medical Certificate'}
            </Text>
            {uploading ? (
              <ActivityIndicator size="small" color={colors.safety[500]} />
            ) : (
              <Ionicons name="camera-outline" size={18} color={colors.safety[500]} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.notifications')}</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{t('profile.smsNotifications')}</Text>
          <Switch
            value={profile.smsEnabled}
            trackColor={{ true: colors.safety[500] }}
            disabled
          />
        </View>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
            onPress={() => setLang('en')}
          >
            <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>
              English
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, lang === 'es' && styles.langBtnActive]}
            onPress={() => setLang('es')}
          >
            <Text style={[styles.langBtnText, lang === 'es' && styles.langBtnTextActive]}>
              Español
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* App info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.app')}</Text>
        <InfoRow icon="information-circle" label={t('profile.version')} value="1.0.0" />
        {profile.lastLoginAt && (
          <InfoRow
            icon="time"
            label={t('profile.lastLogin')}
            value={new Date(profile.lastLoginAt).toLocaleString()}
          />
        )}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out" size={20} color={colors.status.red} />
        <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={colors.steel[400]} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.steel[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.steel[50] },
  content: { paddingBottom: 40 },
  profileHeader: {
    backgroundColor: colors.navy[800],
    alignItems: 'center', paddingTop: 20, paddingBottom: 28,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.safety[500],
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: colors.white },
  profileName: { fontSize: 22, fontWeight: '700', color: colors.white },
  profilePhone: { fontSize: 14, color: colors.navy[300], marginTop: 4 },
  trackingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, backgroundColor: colors.status.greenBg + '40',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  trackingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.status.green },
  trackingText: { fontSize: 12, fontWeight: '600', color: colors.status.green },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.safety[500],
  },
  editProfileText: { fontSize: 13, fontWeight: '600', color: colors.safety[500] },
  section: {
    backgroundColor: colors.white, marginTop: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: colors.steel[100],
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.steel[500],
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: colors.steel[400] },
  infoValue: { fontSize: 15, color: colors.steel[900], marginTop: 1 },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  toggleLabel: { fontSize: 15, color: colors.steel[900] },
  // Documents
  docHint: { fontSize: 13, color: colors.steel[400], marginBottom: 12 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.steel[100],
  },
  docLabel: { flex: 1, fontSize: 14, color: colors.steel[700] },
  // Edit form
  editContent: { padding: 20, paddingBottom: 40, gap: 8 },
  editTitle: { fontSize: 20, fontWeight: '700', color: colors.steel[900], marginBottom: 12 },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: colors.steel[500],
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 4,
  },
  input: {
    backgroundColor: colors.white, borderRadius: 8, padding: 12,
    fontSize: 15, color: colors.steel[900],
    borderWidth: 1, borderColor: colors.steel[200],
  },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.steel[300], alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.steel[600] },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: colors.safety[500], alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.steel[200],
    alignItems: 'center', backgroundColor: colors.white,
  },
  langBtnActive: {
    borderColor: colors.safety[500],
    backgroundColor: colors.safety[500] + '12',
  },
  langBtnText: { fontSize: 15, fontWeight: '600', color: colors.steel[500] },
  langBtnTextActive: { color: colors.safety[500] },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 24, marginHorizontal: 20,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.status.red,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: colors.status.red },
});
