import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Alert,
  StyleSheet, ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { apiUpload } from '@/lib/api';
import { colors } from '@/lib/colors';

/**
 * Quick photo upload tab — lets drivers snap a ticket photo and
 * upload it with minimal friction (just a ticket number).
 */
export default function CameraScreen() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [ticketRef, setTicketRef] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      setSuccess(false);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      setSuccess(false);
    }
  };

  const upload = async () => {
    if (!photo) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: photo,
        name: `ticket_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
      if (ticketRef.trim()) {
        formData.append('ticketRef', ticketRef.trim());
      }

      await apiUpload('/api/driver/scan', formData);

      setSuccess(true);
      setPhoto(null);
      setTicketRef('');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {success && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color={colors.status.green} />
          <Text style={styles.successText}>Photo uploaded successfully!</Text>
        </View>
      )}

      {/* Preview or capture buttons */}
      {photo ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photo }} style={styles.preview} />
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={() => setPhoto(null)}
          >
            <Ionicons name="refresh" size={18} color={colors.steel[600]} />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.captureArea}>
          <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
            <View style={styles.captureBtnInner}>
              <Ionicons name="camera" size={40} color={colors.navy[700]} />
              <Text style={styles.captureBtnText}>Take Photo</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.libraryBtn} onPress={pickFromLibrary}>
            <Ionicons name="images" size={20} color={colors.navy[700]} />
            <Text style={styles.libraryBtnText}>Choose from Library</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Ticket reference */}
      {photo && (
        <View style={styles.form}>
          <Text style={styles.label}>Ticket Number (optional)</Text>
          <TextInput
            style={styles.input}
            value={ticketRef}
            onChangeText={setTicketRef}
            placeholder="e.g. 12345"
            placeholderTextColor={colors.steel[400]}
            keyboardType="default"
          />

          <TouchableOpacity
            style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
            onPress={upload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color={colors.white} />
                <Text style={styles.uploadBtnText}>Upload Ticket Photo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.hint}>
        Take a photo of your delivery ticket. AI will automatically extract the details for your dispatcher.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.steel[50] },
  content: { padding: 20, paddingBottom: 40 },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.status.greenBg,
    padding: 12, borderRadius: 10, marginBottom: 16,
  },
  successText: { fontSize: 14, fontWeight: '600', color: colors.status.green },
  captureArea: { alignItems: 'center', gap: 16, marginBottom: 24 },
  captureBtn: {
    width: '100%', aspectRatio: 1.3, borderRadius: 16,
    borderWidth: 2, borderColor: colors.steel[200], borderStyle: 'dashed',
    backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center',
  },
  captureBtnInner: { alignItems: 'center', gap: 12 },
  captureBtnText: { fontSize: 16, fontWeight: '600', color: colors.navy[700] },
  libraryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 10, borderWidth: 1.5, borderColor: colors.navy[200],
  },
  libraryBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy[700] },
  previewContainer: { marginBottom: 20, alignItems: 'center' },
  preview: {
    width: '100%', aspectRatio: 1.3, borderRadius: 12,
    backgroundColor: colors.steel[200],
  },
  retakeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 8, borderWidth: 1, borderColor: colors.steel[300],
  },
  retakeBtnText: { fontSize: 13, color: colors.steel[600], fontWeight: '600' },
  form: { gap: 12 },
  label: {
    fontSize: 13, fontWeight: '600', color: colors.steel[600],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.white, borderRadius: 10,
    padding: 14, fontSize: 16, color: colors.steel[900],
    borderWidth: 1, borderColor: colors.steel[200],
  },
  uploadBtn: {
    backgroundColor: colors.safety[500], borderRadius: 12,
    paddingVertical: 16, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 10,
    marginTop: 4,
  },
  uploadBtnDisabled: { opacity: 0.7 },
  uploadBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
  hint: {
    fontSize: 13, color: colors.steel[400], textAlign: 'center',
    marginTop: 24, lineHeight: 19,
  },
});
