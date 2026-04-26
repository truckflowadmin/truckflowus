import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Alert,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { apiUpload } from '@/lib/api';
import { colors } from '@/lib/colors';

export default function JobPhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
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
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async () => {
    if (photos.length === 0) {
      Alert.alert('No Photos', 'Take or select at least one photo.');
      return;
    }

    setUploading(true);
    try {
      for (const uri of photos) {
        const formData = new FormData();
        formData.append('jobId', id);
        formData.append('type', 'pod');
        formData.append('photo', {
          uri,
          name: `pod_${Date.now()}.jpg`,
          type: 'image/jpeg',
        } as any);

        await apiUpload('/api/driver/pod', formData);
      }

      Alert.alert('Success', 'Photos uploaded successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proof of Delivery</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Photo grid */}
        <View style={styles.photoGrid}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
                <Ionicons name="close-circle" size={24} color={colors.status.red} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add photo buttons */}
          <TouchableOpacity style={styles.addBtn} onPress={takePhoto}>
            <Ionicons name="camera" size={32} color={colors.steel[400]} />
            <Text style={styles.addBtnText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addBtn} onPress={pickFromLibrary}>
            <Ionicons name="images" size={32} color={colors.steel[400]} />
            <Text style={styles.addBtnText}>Library</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Take photos of the delivery ticket, material, or drop-off location as proof of delivery.
        </Text>
      </ScrollView>

      {/* Upload button */}
      {photos.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
            onPress={uploadPhotos}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color={colors.white} />
                <Text style={styles.uploadText}>
                  Upload {photos.length} Photo{photos.length > 1 ? 's' : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.steel[50] },
  header: {
    backgroundColor: colors.navy[800],
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.white },
  body: { flex: 1 },
  bodyContent: { padding: 16 },
  photoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  photoWrapper: {
    width: '47%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 4, right: 4 },
  addBtn: {
    width: '47%', aspectRatio: 1, borderRadius: 12,
    borderWidth: 2, borderColor: colors.steel[200], borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: colors.white,
  },
  addBtnText: { fontSize: 13, color: colors.steel[400], fontWeight: '600' },
  hint: {
    fontSize: 13, color: colors.steel[500], textAlign: 'center',
    marginTop: 20, lineHeight: 19,
  },
  footer: {
    padding: 16, backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.steel[200],
  },
  uploadBtn: {
    backgroundColor: colors.safety[500], borderRadius: 12,
    paddingVertical: 16, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  uploadBtnDisabled: { opacity: 0.7 },
  uploadText: { fontSize: 17, fontWeight: '700', color: colors.white },
});
