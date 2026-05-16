import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  AppState,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '@/services/auth';
import { useStore } from '@/store/useStore';
import { stripeApi, authApi } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Radius } from '@/constants/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, setUser } = useStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const appState = useRef(AppState.currentState);
  const isPremium = user?.tier === 'premium';

  const checksUsed = user?.checksUsedToday ?? 0;
  const dailyLimit = user?.dailyLimit ?? 5;
  const progress = isPremium ? 1 : checksUsed / dailyLimit;

  // Refresh user profile when app returns to foreground (catches webhook-triggered upgrades)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        try {
          const freshUser = await authApi.me();
          setUser(freshUser);
        } catch {
          // silently ignore — token may have expired
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  const handleLogout = async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await authService.logout();
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      const { url } = await stripeApi.createCheckout();
      // Opens Stripe checkout in-app; browser closes when Stripe redirects to realitycheck://
      const result = await WebBrowser.openAuthSessionAsync(url, 'realitycheck://');
      if (result.type === 'success') {
        // Webhook may take a moment — poll /me a couple of times
        for (let i = 0; i < 3; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const freshUser = await authApi.me();
            setUser(freshUser);
            if (freshUser.tier === 'premium') break;
          } catch { break; }
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not open checkout. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setOpeningPortal(true);
      const { url } = await stripeApi.createPortal();
      await WebBrowser.openBrowserAsync(url);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not open billing portal.');
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#0D0D14', '#0A0A0A']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, isPremium && styles.avatarPremium]}>
            <Text style={styles.avatarText}>
              {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.displayName}>{user?.displayName ?? 'Reader'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
          {isPremium ? (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>★ PREMIUM MEMBER</Text>
            </View>
          ) : (
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>FREE TIER</Text>
            </View>
          )}
        </View>

        {/* Usage card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>TODAY'S USAGE</Text>
          <View style={styles.usageRow}>
            <Text style={styles.usageNum}>
              {isPremium ? '∞' : `${checksUsed} / ${dailyLimit}`}
            </Text>
            <Text style={styles.usageLabel}>checks</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progress * 100, 100)}%`,
                  backgroundColor: isPremium ? Colors.secondary : progress >= 1 ? Colors.error : Colors.primary,
                },
              ]}
            />
          </View>
          {!isPremium && (
            <Text style={styles.progressLabel}>
              {Math.max(0, dailyLimit - checksUsed)} checks remaining — resets at midnight
            </Text>
          )}
        </View>

        {/* Manage billing for premium users */}
        {isPremium && (
          <Button
            label={openingPortal ? 'Opening…' : 'Manage Billing'}
            onPress={handleManageBilling}
            variant="ghost"
            loading={openingPortal}
            fullWidth
          />
        )}

        {/* Premium upgrade */}
        {!isPremium && (
          <TouchableOpacity style={styles.upgradeCard} onPress={handleUpgrade} activeOpacity={0.85}>
            <LinearGradient
              colors={['#1A1500', '#0A0A0A']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={styles.upgradeTitle}>★ Upgrade to Premium</Text>
            <Text style={styles.upgradePrice}>$4.99 / month</Text>
            <View style={styles.upgradeFeatures}>
              {[
                'Unlimited daily checks',
                'All 5 perspectives including Contrarian',
                'Deep historical context',
                'Saved research library',
                'Weekly editorial digest',
              ].map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.upgradeBtn, upgrading && { opacity: 0.7 }]}>
              <Text style={styles.upgradeBtnText}>
                {upgrading ? 'Opening Checkout…' : 'Start 7-Day Free Trial'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ACCOUNT</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Member since</Text>
            <Text style={styles.settingValue}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </Text>
          </View>
          <View style={[styles.settingRow, styles.noBorder]}>
            <Text style={styles.settingLabel}>Subscription</Text>
            <Text style={[styles.settingValue, { color: isPremium ? Colors.secondary : Colors.textMuted }]}>
              {isPremium ? 'Premium' : 'Free'}
            </Text>
          </View>
        </View>

        {/* Sign out */}
        <Button
          label="Sign Out"
          onPress={handleLogout}
          variant="ghost"
          loading={loggingOut}
          fullWidth
          style={{ marginTop: Spacing.sm }}
        />
        <Text style={styles.version}>Reality Check v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 100, gap: Spacing.md },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPremium: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondaryMuted,
  },
  avatarText: { color: Colors.primary, fontSize: 32, fontWeight: '900' },
  displayName: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  email: { color: Colors.textMuted, fontSize: 14 },
  premiumBadge: {
    backgroundColor: Colors.secondaryMuted,
    borderWidth: 1,
    borderColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  premiumBadgeText: { color: Colors.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  freeBadge: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  freeBadgeText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTitle: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  usageRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  usageNum: { color: Colors.textPrimary, fontSize: 36, fontWeight: '900' },
  usageLabel: { color: Colors.textSecondary, fontSize: 14 },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { color: Colors.textMuted, fontSize: 12 },
  upgradeCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.secondary,
    padding: Spacing.lg,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  upgradeTitle: { color: Colors.secondary, fontSize: 20, fontWeight: '900' },
  upgradePrice: { color: Colors.textSecondary, fontSize: 14 },
  upgradeFeatures: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureCheck: { color: Colors.secondary, fontSize: 14, fontWeight: '700', width: 16 },
  featureText: { color: Colors.textPrimary, fontSize: 14 },
  upgradeBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  upgradeBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  noBorder: { borderBottomWidth: 0 },
  settingLabel: { color: Colors.textSecondary, fontSize: 14 },
  settingValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  version: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: Spacing.sm },
});
