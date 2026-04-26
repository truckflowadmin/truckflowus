import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { colors } from '@/lib/colors';

type Step = 'phone' | 'questions' | 'new-pin' | 'email-sent';

export default function ForgotPinScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState(['', '', '']);
  const [hasEmail, setHasEmail] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleGetQuestions = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter your 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/driver/auth', {
        method: 'POST',
        body: { action: 'get-questions', phone: digits },
        noAuth: true,
      });
      setQuestions(data.questions || []);
      setHasEmail(data.hasEmail || false);
      setStep('questions');
    } catch (err: any) {
      setError(err.message || 'Could not find account. Contact your dispatcher.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswers = async () => {
    if (answers.some((a) => !a.trim())) {
      setError('Please answer all 3 security questions');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const digits = phone.replace(/\D/g, '');
      const data = await apiFetch('/api/driver/auth', {
        method: 'POST',
        body: {
          action: 'reset-verify',
          phone: digits,
          answer1: answers[0].trim(),
          answer2: answers[1].trim(),
          answer3: answers[2].trim(),
        },
        noAuth: true,
      });
      if (data.ok && data.resetToken) {
        setResetToken(data.resetToken);
        setStep('new-pin');
      }
    } catch (err: any) {
      const msg = err.message || 'Incorrect answers';
      if (err.data?.attemptsExhausted) {
        setError('Too many failed attempts. Try resetting via email instead.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setError('PIN must be exactly 6 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/driver/auth', {
        method: 'POST',
        body: { action: 'reset-pin', resetToken, newPin },
        noAuth: true,
      });
      Alert.alert('PIN Reset', 'Your PIN has been updated. Please sign in with your new PIN.', [
        { text: 'OK', onPress: () => router.replace('/auth/login') },
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to reset PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    setLoading(true);
    setError('');
    try {
      const digits = phone.replace(/\D/g, '');
      const data = await apiFetch('/api/driver/auth', {
        method: 'POST',
        body: { action: 'send-reset-email', phone: digits },
        noAuth: true,
      });
      setMaskedEmail(data.maskedEmail || '***');
      setStep('email-sent');
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner}>
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (step === 'phone') router.back();
          else if (step === 'questions') setStep('phone');
          else if (step === 'new-pin') setStep('questions');
          else router.replace('/auth/login');
        }}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Step 1: Enter phone */}
          {step === 'phone' && (
            <>
              <Text style={styles.title}>Forgot PIN</Text>
              <Text style={styles.desc}>
                Enter your phone number. We'll ask your security questions to verify your identity.
              </Text>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(t) => setPhone(formatPhone(t))}
                placeholder="(239) 555-1234"
                placeholderTextColor={colors.steel[400]}
                keyboardType="phone-pad"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleGetQuestions}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={colors.white} /> : (
                  <Text style={styles.buttonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Step 2: Answer security questions */}
          {step === 'questions' && (
            <>
              <Text style={styles.title}>Security Questions</Text>
              <Text style={styles.desc}>Answer all 3 questions to verify your identity.</Text>
              {questions.map((q, i) => (
                <View key={i}>
                  <Text style={styles.question}>{q}</Text>
                  <TextInput
                    style={styles.input}
                    value={answers[i]}
                    onChangeText={(t) => {
                      const updated = [...answers];
                      updated[i] = t;
                      setAnswers(updated);
                    }}
                    placeholder="Your answer"
                    placeholderTextColor={colors.steel[400]}
                    autoCapitalize="none"
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyAnswers}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={colors.white} /> : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </TouchableOpacity>
              {hasEmail && (
                <TouchableOpacity style={styles.emailLink} onPress={handleSendEmail}>
                  <Ionicons name="mail-outline" size={16} color={colors.navy[600]} />
                  <Text style={styles.emailLinkText}>Reset via email instead</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Step 3: Set new PIN */}
          {step === 'new-pin' && (
            <>
              <Text style={styles.title}>Set New PIN</Text>
              <Text style={styles.desc}>Choose a new 6-digit PIN.</Text>
              <Text style={styles.label}>New PIN</Text>
              <TextInput
                style={styles.input}
                value={newPin}
                onChangeText={(t) => setNewPin(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit PIN"
                placeholderTextColor={colors.steel[400]}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                autoFocus
              />
              <Text style={styles.label}>Confirm PIN</Text>
              <TextInput
                style={styles.input}
                value={confirmPin}
                onChangeText={(t) => setConfirmPin(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="Confirm PIN"
                placeholderTextColor={colors.steel[400]}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleResetPin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={colors.white} /> : (
                  <Text style={styles.buttonText}>Reset PIN</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Step 4: Email sent */}
          {step === 'email-sent' && (
            <>
              <View style={styles.emailSentIcon}>
                <Ionicons name="mail" size={48} color={colors.safety[500]} />
              </View>
              <Text style={styles.title}>Check Your Email</Text>
              <Text style={styles.desc}>
                We sent a reset link to {maskedEmail}. Open the link to set a new PIN.
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace('/auth/login')}
              >
                <Text style={styles.buttonText}>Back to Login</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[800] },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 24,
  },
  backText: { color: colors.white, fontSize: 16 },
  form: {
    backgroundColor: colors.white, borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.steel[900], marginBottom: 8 },
  desc: { fontSize: 14, color: colors.steel[500], marginBottom: 20, lineHeight: 20 },
  label: {
    fontSize: 13, fontWeight: '600', color: colors.steel[600],
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  question: { fontSize: 14, fontWeight: '600', color: colors.steel[700], marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.steel[50], borderRadius: 10, padding: 14,
    fontSize: 17, color: colors.steel[900], marginBottom: 16,
    borderWidth: 1, borderColor: colors.steel[200],
  },
  button: {
    backgroundColor: colors.safety[500], borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  errorBox: {
    backgroundColor: colors.status.redBg, borderRadius: 8,
    padding: 12, marginBottom: 16,
  },
  errorText: { color: colors.status.red, fontSize: 14, textAlign: 'center' },
  emailLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 16, paddingVertical: 8,
  },
  emailLinkText: { color: colors.navy[600], fontSize: 14 },
  emailSentIcon: { alignItems: 'center', marginBottom: 16 },
});
