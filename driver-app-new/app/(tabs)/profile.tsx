import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Switch,
  TextInput, Modal, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, apiUpload } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isTrackingActive } from '@/lib/location';
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

const DOC_TYPES = [
  { value: 'LICENSE_FRONT', label: 'License (Front)', icon: 'card' },
  { value: 'LICENSE_BACK', label: 'License (Back)', icon: 'card-outline' },
  { value: 'MEDICAL_CERT', label: 'Medical Certificate', icon: 'medkit' },
  { value: 'VOID_CHECK', label: 'Void Check', icon: 'document-text' },
  { value: 'OTHER', label: 'Other Document', icon: 'folder' },
] as const;

export default function ProfileScreen() {
  const { driverName, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editZip, setEditZip] = useState('');
  const [editECName, setEditECName] = useState('');
  const [editECPhone, setEditECPhone] = useState('');

  // Document upload
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('LICENSE_FRONT');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/driver/profile');
      const p = data.driver || data;
      setProfile(p);
      setEditEmail(p.email || '');
      setEditPhone(p.phone || '');
      setEditAddress(p.address || '');
      setEditCity(p.city || '');
      setEditState(p.state || '');
      setEditZip(p.zip || '');
      setEditECName(p.emergencyContactName || '');
      setEditECPhone(p.emergencyContactPhone || '');
      const isTracking = await isTrackingActive();
      setTracking(isTracking);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
          emergencyContactName: editECName.trim() || null,
          emergencyContactPhone: editECPhone.trim() || null,
        },
      });
      setEditMode(false);
      Alert.alert('Saved', 'Profile updated successfully.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDocUpload = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access needed.');
      return;
    }

    Alert.alert('Upload Document', 'Choose source:', [
      {
        text: 'Camera',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadDoc(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const libStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (libStatus.status !== 'granted') {
            Alert.alert('Permission Required', 'Photo library access needed.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadDoc(result.assets[0].uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadDoc = async (uri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: `doc_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
      formData.append('docType', selectedDocType);
      // The documents API uses token-based auth from the web portal
      // For mobile, we'll use the auth header that apiUpload sends
      await apiUpload('/api/driver/documents', formData);
      Alert.alert('Uploaded', `${DOC_TYPES.find((d) => d.value === selectedDocType)?.label} uploaded successfully.`);
      setShowDocUpload(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload document');
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
      </View>

      {/* Edit toggle */}
      <View style={styles.editToggleRow}>
        <TouchableOpacity
          style={[styles.editToggleBtn, editMode && styles.editToggleBtnActive]}
          onPress={() => {
            if (editMode) {
              // Cancel edit
              setEditEmail(profile.email || '');
              setEditPhone(profile.phone || '');
              setEditAddress(profile.address || '');
              setEditCity(profile.city || '');
              setEditState(profile.state || '');
              setEditZip(profile.zip || '');
              setEditECName(profile.emergencyContactName || '');
              setEditECPhone(profile.emergencyContactPhone || '');
            }
            setEditMode(!editMode);
          }}
        >
          <Ionicons
            name={editMode ? 'close' : 'create'}
            size={18}
            color={editMode ? colors.status.red : colors.navy[700]}
          />
          <Text style={[styles.editToggleText, editMode && { color: colors.status.red }]}>
            {editMode ? 'Cancel' : 'Edit Profile'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contact info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        {editMode ? (
          <>
            <EditField label="Phone" value={editPhone} onChange={setEditPhone} keyboardType="phone-pad" />
            <EditField label="Email" value={editEmail} onChange={setEditEmail} keyboardType="email-address" />
          </>
        ) : (
          <>
            <InfoRow icon="call" label="Phone" value={profile.phone} />
            <InfoRow icon="mail" label="Email" value={profile.email || 'Not set'} />
            {profile.truckNumber && (
              <InfoRow icon="car" label="Truck" value={profile.truckNumber} />
            )}
          </>
        )}
      </View>

      {/* Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Address</Text>
        {editMode ? (
          <>
            <EditField label="Street" value={editAddress} onChange={setEditAddress} />
            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                <EditField label="City" value={editCity} onChange={setEditCity} />
              </View>
              <View style={{ flex: 1 }}>
                <EditField label="State" value={editState} onChange={setEditState} />
              </View>
              <View style={{ flex: 1 }}>
                <EditField label="ZIP" value={editZip} onChange={setEditZip} keyboardType="number-pad" />
              </View>
            </View>
          </>
        ) : (
          <InfoRow
            icon="location"
            label="Address"
            value={
              [profile.address, profile.city, profile.state, profile.zip]
                .filter(Boolean).join(', ') || 'Not set'
            }
          />
        )}
      </View>

      {/* Emergency Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Contact</Text>
        {editMode ? (
          <>
            <EditField label="Name" value={editECName} onChange={setEditECName} />
            <EditField label="Phone" value={editECPhone} onChange={setEditECPhone} keyboardType="phone-pad" />
          </>
        ) : (
          <>
            <InfoRow icon="person" label="Name" value={profile.emergencyContactName || 'Not set'} />
            <InfoRow icon="call" label="Phone" value={profile.emergencyContactPhone || 'Not set'} />
          </>
        )}
      </View>

      {/* Save button */}
      {editMode && (
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Documents */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <TouchableOpacity
            style={styles.uploadDocBtn}
            onPress={() => setShowDocUpload(true)}
          >
            <Ionicons name="cloud-upload" size={16} color={colors.navy[700]} />
            <Text style={styles.uploadDocBtnText}>Upload</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.docHint}>
          Upload your license, medical certificate, void check, and other required documents.
        </Text>
        {DOC_TYPES.slice(0, 4).map((dt) => (
          <View key={dt.value} style={styles.docRow}>
            <Ionicons name={dt.icon as any} size={18} color={colors.steel[400]} />
            <Text style={styles.docLabel}>{dt.label}</Text>
            <TouchableOpacity
              style={styles.docUploadSmallBtn}
              onPress={() => {
                setSelectedDocType(dt.value);
                handleDocUpload();
              }}
            >
              <Ionicons name="camera" size={16} color={colors.navy[700]} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>SMS notifications</Text>
          <Switch
            value={profile.smsEnabled}
            trackColor={{ true: colors.safety[500] }}
            disabled
          />
        </View>
      </View>

      {/* App info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <InfoRow icon="information-circle" label="Version" value="2.0.0" />
        {profile.lastLoginAt && (
          <InfoRow
            icon="time"
            label="Last login"
            value={new Date(profile.lastLoginAt).toLocaleString()}
          />
        )}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out" size={20} color={colors.status.red} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Document Upload Modal */}
      <Modal visible={showDocUpload} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Document</Text>
              <TouchableOpacity onPress={() => setShowDocUpload(false)}>
                <Ionicons name="close" size={24} color={colors.steel[600]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Document Type</Text>
              {DOC_TYPES.map((dt) => (
                <TouchableOpacity
                  key={dt.value}
                  style={[
                    styles.docTypeOption,
                    selectedDocType === dt.value && styles.docTypeOptionActive,
                  ]}
                  onPress={() => setSelectedDocType(dt.value)}
                >
                  <Ionicons
                    name={dt.icon as any}
                    size={20}
                    color={selectedDocType === dt.value ? colors.white : colors.navy[700]}
                  />
                  <Text
                    style={[
                      styles.docTypeText,
                      selectedDocType === dt.value && styles.docTypeTextActive,
                    ]}
                  >
                    {dt.label}
                  </Text>
                  {selectedDocType === dt.value && (
                    <Ionicons name="checkmark" size={20} color={colors.white} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[styles.uploadMainBtn, uploading && styles.uploadMainBtnDisabled]}
                onPress={handleDocUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="camera" size={20} color={colors.white} />
                    <Text style={styles.uploadMainBtnText}>Take Photo / Choose File</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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

function EditField({
  label, value, onChange, keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: string;
}) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
        style={styles.editInput}
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={colors.steel[400]}
        keyboardType={keyboardType as any}
        autoCapitalize="none"
      />
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
  editToggleRow: {
    paddingHorizontal: 20, paddingTop: 12, alignItems: 'flex-end',
  },
  editToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1.5, borderColor: colors.navy[200],
  },
  editToggleBtnActive: { borderColor: colors.status.red },
  editToggleText: { fontSize: 14, fontWeight: '600', color: colors.navy[700] },
  section: {
    backgroundColor: colors.white, marginTop: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: colors.steel[100],
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.steel[500],
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 8,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: colors.steel[400] },
  infoValue: { fontSize: 15, color: colors.steel[900], marginTop: 1 },
  row: { flexDirection: 'row', gap: 8 },
  editField: { marginBottom: 10 },
  editFieldLabel: { fontSize: 12, color: colors.steel[500], marginBottom: 4, fontWeight: '600' },
  editInput: {
    backgroundColor: colors.steel[50], borderRadius: 8,
    padding: 12, fontSize: 15, color: colors.steel[900],
    borderWidth: 1, borderColor: colors.steel[200],
  },
  saveBtn: {
    backgroundColor: colors.safety[500], borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
    marginHorizontal: 20, marginTop: 16,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  toggleLabel: { fontSize: 15, color: colors.steel[900] },
  // Documents
  uploadDocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
    borderWidth: 1, borderColor: colors.navy[200],
  },
  uploadDocBtnText: { fontSize: 13, fontWeight: '600', color: colors.navy[700] },
  docHint: { fontSize: 13, color: colors.steel[400], marginBottom: 12, lineHeight: 18 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.steel[50],
  },
  docLabel: { flex: 1, fontSize: 14, color: colors.steel[700] },
  docUploadSmallBtn: {
    padding: 8, borderRadius: 8,
    backgroundColor: colors.steel[50],
  },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 24, marginHorizontal: 20,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.status.red,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: colors.status.red },
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
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  docTypeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10,
    marginBottom: 6, borderWidth: 1, borderColor: colors.steel[200],
  },
  docTypeOptionActive: {
    backgroundColor: colors.navy[800], borderColor: colors.navy[800],
  },
  docTypeText: { fontSize: 15, fontWeight: '600', color: colors.steel[700] },
  docTypeTextActive: { color: colors.white },
  uploadMainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: colors.safety[500], borderRadius: 12,
    paddingVertical: 16, marginTop: 16, marginBottom: 30,
  },
  uploadMainBtnDisabled: { opacity: 0.7 },
  uploadMainBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
});
