import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
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

export default function ProfileScreen() {
  const { driverName, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/driver/profile');
      // API returns { driver: { ... } } — unwrap it
      setProfile(data.driver || data);
      const isTracking = await isTrackingActive();
      setTracking(isTracking);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: logout,
      },
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

      {/* Info sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <InfoRow icon="call" label="Phone" value={profile.phone} />
        <InfoRow icon="mail" label="Email" value={profile.email || 'Not set'} />
        {profile.truckNumber && (
          <InfoRow icon="car" label="Truck" value={profile.truckNumber} />
        )}
      </View>

      {profile.address && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <InfoRow
            icon="location"
            label="Address"
            value={[profile.address, profile.city, profile.state, profile.zip].filter(Boolean).join(', ')}
          />
        </View>
      )}

      {profile.emergencyContactName && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <InfoRow icon="person" label="Name" value={profile.emergencyContactName} />
          <InfoRow icon="call" label="Phone" value={profile.emergencyContactPhone || 'Not set'} />
        </View>
      )}

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
        <InfoRow icon="information-circle" label="Version" value="1.0.0" />
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
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 8,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: colors.steel[400] },
  infoValue: { fontSize: 15, color: colors.steel[900], marginTop: 1 },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  toggleLabel: { fontSize: 15, color: colors.steel[900] },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 24, marginHorizontal: 20,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.status.red,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: colors.status.red },
});
