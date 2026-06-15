import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '@/services/auth';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Radius } from '@/constants/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [startTrial, setStartTrial] = useState(true);
  const [loading, setLoading] = useState(false);
  const { setUser, setToken } = useStore();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const { user, token } = await authService.register(email.trim(), password, name.trim(), startTrial);
      setToken(token);
      setUser(user);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Registration failed', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <LinearGradient colors={['#0A0A0A', '#0D1117', '#0A0A0A']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.wordmark}>REALITY CHECK</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Create account</Text>

          {/* Trial banner */}
          <TouchableOpacity
            style={[styles.trialBanner, startTrial && styles.trialBannerActive]}
            onPress={() => setStartTrial((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.trialCheck}>{startTrial ? '✓' : '○'}</Text>
            <View>
              <Text style={styles.trialTitle}>Start 7-day Premium trial</Text>
              <Text style={styles.trialSub}>Unlimited checks · All 5 perspectives · Cancel anytime</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min 8 characters"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
            />
          </View>

          <Button
            label={startTrial ? 'Start Free Trial' : 'Create Account'}
            onPress={handleRegister}
            loading={loading}
            fullWidth
            variant={startTrial ? 'secondary' : 'primary'}
          />

          <Text style={styles.legal}>
            By signing up you agree to our Terms and Privacy Policy.
            {startTrial ? ' Trial converts to $4.99/mo after 7 days.' : ''}
          </Text>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={styles.switchRow}>
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.switchLink}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  wordmark: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 3 },
  form: { gap: Spacing.md },
  formTitle: { color: Colors.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: Spacing.sm },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.secondaryMuted,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  trialBannerActive: { borderColor: Colors.secondary },
  trialCheck: { color: Colors.secondary, fontSize: 20, fontWeight: '700', width: 24 },
  trialTitle: { color: Colors.secondary, fontWeight: '700', fontSize: 14 },
  trialSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  legal: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  switchRow: { marginTop: Spacing.xl, alignItems: 'center' },
  switchText: { color: Colors.textSecondary, fontSize: 14 },
  switchLink: { color: Colors.primary, fontWeight: '600' },
});
