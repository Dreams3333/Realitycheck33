import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/services/api';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Radius } from '@/constants/theme';

const CATEGORIES = ['Politics', 'Science', 'Health', 'History', 'Economy', 'Media', 'Technology', 'Other'];

export default function SubmitScreen() {
  const insets = useSafeAreaInsets();
  const { user, incrementChecksUsed } = useStore();
  const [claimText, setClaimText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const isPremium = user?.tier === 'premium';
  const checksLeft = isPremium
    ? '∞'
    : `${Math.max(0, (user?.dailyLimit ?? 5) - (user?.checksUsedToday ?? 0))}`;
  const isAtLimit = !isPremium && (user?.checksUsedToday ?? 0) >= (user?.dailyLimit ?? 5);

  const handleSubmit = async () => {
    if (!claimText.trim()) {
      Alert.alert('Empty claim', 'Please enter a claim or topic to check.');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Select category', 'Please choose a category for your claim.');
      return;
    }
    if (isAtLimit) {
      Alert.alert(
        'Daily limit reached',
        'Upgrade to Premium for unlimited checks.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/(tabs)/profile') },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const { id } = await api.post<{ id: string }>('/claims', {
        text: claimText.trim(),
        category: selectedCategory,
      });
      incrementChecksUsed();
      setClaimText('');
      setSelectedCategory('');
      router.push(`/claim/${id}`);
    } catch (err: any) {
      Alert.alert('Failed to submit', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#100D1A', '#0D0A14']}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Reality Check</Text>
            <View style={[styles.limitBadge, isAtLimit && styles.limitBadgeWarn]}>
              <Text style={[styles.limitText, isAtLimit && styles.limitTextWarn]}>
                {checksLeft} checks left today
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Enter a claim, statement, or topic. We'll return multiple sourced perspectives — no verdict.
          </Text>

          {/* Input */}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={claimText}
              onChangeText={setClaimText}
              placeholder="e.g. 'Social media is making teenagers depressed'"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{claimText.length}/500</Text>
          </View>

          {/* Category */}
          <Text style={styles.catLabel}>CATEGORY</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
                onPress={() => { Haptics.selectionAsync(); setSelectedCategory(cat); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Premium upsell */}
          {!isPremium && (
            <TouchableOpacity
              style={styles.upsellCard}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.85}
            >
              <Text style={styles.upsellTitle}>★ Go Premium — $4.99/mo</Text>
              <Text style={styles.upsellSub}>
                Unlimited checks · All 5 perspectives · Deep historical context · Saved library
              </Text>
            </TouchableOpacity>
          )}

          {/* What you'll get */}
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>You'll receive:</Text>
            {[
              { label: '◀  Left perspective', color: Colors.perspectiveLeft },
              { label: '▶  Right perspective', color: Colors.perspectiveRight },
              { label: '◉  Historical context', color: Colors.perspectiveHistorical },
              { label: '⬡  Scientific / Data', color: Colors.perspectiveScientific },
              {
                label: '◈  Contrarian view',
                color: isPremium ? Colors.perspectiveContrarian : Colors.textMuted,
                locked: !isPremium,
              },
            ].map((item) => (
              <View key={item.label} style={styles.previewRow}>
                <Text style={[styles.previewItemText, { color: item.color }]}>{item.label}</Text>
                {item.locked && <Text style={styles.lockTag}>★ PREMIUM</Text>}
              </View>
            ))}
          </View>

          <Button
            label={loading ? 'Analyzing...' : 'Check This Claim'}
            onPress={handleSubmit}
            loading={loading}
            disabled={isAtLimit || !claimText.trim()}
            fullWidth
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 100, gap: Spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: Colors.textPrimary, fontSize: 26, fontWeight: '900' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  limitBadge: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  limitBadgeWarn: { backgroundColor: 'rgba(255,68,68,0.1)', borderColor: Colors.error },
  limitText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  limitTextWarn: { color: Colors.error },
  inputWrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    minHeight: 140,
  },
  input: {
    color: Colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    flex: 1,
  },
  charCount: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  catLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  catChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  catChipText: { color: Colors.textSecondary, fontSize: 13 },
  catChipTextActive: { color: Colors.primary, fontWeight: '700' },
  upsellCard: {
    backgroundColor: Colors.secondaryMuted,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.secondary,
    padding: Spacing.md,
    gap: 4,
  },
  upsellTitle: { color: Colors.secondary, fontWeight: '800', fontSize: 15 },
  upsellSub: { color: Colors.textMuted, fontSize: 13 },
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: 10,
  },
  previewTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewItemText: { fontSize: 14, fontWeight: '600' },
  lockTag: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: Colors.secondaryMuted,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
});
