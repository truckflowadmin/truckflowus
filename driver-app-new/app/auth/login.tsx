import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  StyleSheet, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pinRef = useRef<TextInput>(null);

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleLogin = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter your 10-digit phone number');
      return;
    }
    if (pin.length < 6) {
      setError('Enter your 6-digit PIN');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(digits, pin);

    setLoading(false);

    if (result.ok) {
      router.replace('/(tabs)/jobs');
    } else if (result.locked) {
      Alert.alert(
        'Account Locked',
        'Too many failed attempts. Please reset your PIN or contact your dispatcher.',
      );
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo area */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>TF</Text>
          </View>
          <Text style={styles.title}>TruckFlowUS</Text>
          <Text style={styles.subtitle}>Driver App</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(t) => setPhone(formatPhone(t))}
            placeholder="(239) 555-1234"
            placeholderTextColor={colors.steel[400]}
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => pinRef.current?.focus()}
            autoFocus
          />

          <Text style={styles.label}>PIN</Text>
          <TextInput
            ref={pinRef}
            style={styles.input}
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit PIN"
            placeholderTextColor={colors.steel[400]}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => {
              const digits = phone.replace(/\D/g, '');
              if (digits.length >= 10) {
                Linking.openURL(`https://truckflowus.com/d/reset?phone=${digits}`);
              } else {
                Alert.alert('Enter Phone', 'Please enter your phone number first, then tap Forgot PIN.');
              }
            }}
          >
            <Text style={styles.forgotText}>Forgot PIN?</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy[800],
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.safety[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  subtitle: {
    fontSize: 16,
    color: colors.navy[300],
    marginTop: 4,
  },
  form: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  errorBox: {
    backgroundColor: colors.status.redBg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.status.red,
    fontSize: 14,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.steel[600],
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.steel[50],
    borderRadius: 10,
    padding: 14,
    fontSize: 17,
    color: colors.steel[900],
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.steel[200],
  },
  button: {
    backgroundColor: colors.safety[500],
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  forgotLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotText: {
    color: colors.navy[600],
    fontSize: 14,
  },
});
