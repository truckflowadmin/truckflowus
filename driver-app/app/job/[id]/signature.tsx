import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { apiUpload } from '@/lib/api';
import { colors } from '@/lib/colors';

/**
 * Signature capture screen using an HTML canvas inside a WebView.
 * This avoids native module issues with react-native-signature-canvas
 * and works reliably on both iOS and Android.
 */
export default function SignatureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const webViewRef = useRef<WebView>(null);
  const [uploading, setUploading] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const signatureHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; overflow: hidden; touch-action: none; }
    canvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="sig"></canvas>
  <script>
    const canvas = document.getElementById('sig');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasDrawn = false;

    function resize() {
      canvas.width = window.innerWidth * 2;
      canvas.height = window.innerHeight * 2;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(2, 2);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1E293B';
    }
    resize();
    window.addEventListener('resize', resize);

    function getPos(e) {
      const t = e.touches ? e.touches[0] : e;
      const r = canvas.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      drawing = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!drawing) return;
      hasDrawn = true;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'drawing' }));
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }, { passive: false });

    canvas.addEventListener('touchend', () => { drawing = false; });

    window.clear = function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cleared' }));
    };

    window.save = function() {
      if (!hasDrawn) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'empty' }));
        return;
      }
      const data = canvas.toDataURL('image/png');
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data }));
    };
  </script>
</body>
</html>`;

  const handleMessage = async (event: any) => {
    const msg = JSON.parse(event.nativeEvent.data);

    if (msg.type === 'drawing') {
      setHasSignature(true);
    } else if (msg.type === 'cleared') {
      setHasSignature(false);
    } else if (msg.type === 'empty') {
      Alert.alert('No Signature', 'Please sign before saving.');
    } else if (msg.type === 'signature') {
      setUploading(true);
      try {
        // Convert base64 data URL to blob for upload
        const base64 = msg.data.split(',')[1];
        const formData = new FormData();
        formData.append('jobId', id);
        formData.append('type', 'signature');
        formData.append('signature', {
          uri: `data:image/png;base64,${base64}`,
          name: `signature_${Date.now()}.png`,
          type: 'image/png',
        } as any);

        await apiUpload('/api/driver/pod', formData);

        Alert.alert('Success', 'Signature saved!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to save signature');
      } finally {
        setUploading(false);
      }
    }
  };

  const clearSignature = () => {
    webViewRef.current?.injectJavaScript('window.clear(); true;');
  };

  const saveSignature = () => {
    webViewRef.current?.injectJavaScript('window.save(); true;');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Signature</Text>
      </View>

      <Text style={styles.hint}>Sign below to confirm delivery</Text>

      {/* Signature canvas */}
      <View style={styles.canvasContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: signatureHTML }}
          onMessage={handleMessage}
          scrollEnabled={false}
          bounces={false}
          style={styles.canvas}
        />
        <View style={styles.signLine} />
        <Text style={styles.signLabel}>Sign here</Text>
      </View>

      {/* Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.clearBtn} onPress={clearSignature}>
          <Ionicons name="refresh" size={20} color={colors.steel[600]} />
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, !hasSignature && styles.saveBtnDisabled]}
          onPress={saveSignature}
          disabled={uploading || !hasSignature}
        >
          {uploading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text style={styles.saveText}>Save Signature</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  hint: {
    fontSize: 14, color: colors.steel[500], textAlign: 'center',
    paddingVertical: 12,
  },
  canvasContainer: {
    flex: 1, margin: 16, backgroundColor: colors.white,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.steel[200],
    position: 'relative',
  },
  canvas: { flex: 1, backgroundColor: 'transparent' },
  signLine: {
    position: 'absolute', bottom: 50, left: 24, right: 24,
    height: 1, backgroundColor: colors.steel[300],
  },
  signLabel: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    textAlign: 'center', fontSize: 12, color: colors.steel[400],
  },
  footer: {
    flexDirection: 'row', gap: 12,
    padding: 16, backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.steel[200],
  },
  clearBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.steel[300],
  },
  clearText: { fontSize: 15, fontWeight: '600', color: colors.steel[600] },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.safety[500],
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
