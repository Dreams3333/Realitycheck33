import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/services/api';
import { useStore } from '@/store/useStore';
import { Claim, Perspective } from '@/constants/types';
import { PerspectivePanel } from '@/components/claim/PerspectivePanel';
import { HeatIndicator } from '@/components/home/HeatIndicator';
import { Colors, Spacing, Radius } from '@/constants/theme';

const MOCK_CLAIM: Claim = {
  id: '1',
  text: 'Social media algorithms are deliberately designed to maximize outrage and division.',
  category: 'Technology',
  heatScore: 78,
  commentCount: 142,
  viewCount: 8400,
  submittedByName: 'Alex M.',
  createdAt: new Date(Date.now() - 3600000).toISOString(),
  status: 'processed',
  perspectives: [
    {
      type: 'left',
      label: 'Left Perspective',
      summary: 'Platforms knowingly amplify divisive content because engagement drives ad revenue.',
      analysis:
        'Progressive critics argue social media companies have internal research showing their algorithms boost emotionally charged content. Whistleblowers from Meta and Twitter revealed internal documents showing executives were aware of the radicalization pathways their products created but prioritized growth metrics over safety. The profit motive creates a structural incentive incompatible with social cohesion.',
      sources: [
        { title: 'The Facebook Files — WSJ Investigation', url: '', domain: 'wsj.com' },
        { title: 'Frances Haugen Congressional Testimony, 2021', url: '', domain: 'congress.gov' },
        { title: 'MIT Media Lab: Outrage Engagement Study', url: '', domain: 'media.mit.edu' },
      ],
    },
    {
      type: 'right',
      label: 'Right Perspective',
      summary: 'Platforms actually suppress conservative content, making "outrage maximization" claims overblown.',
      analysis:
        'Conservative analysts note that platforms disproportionately flag, throttle, or remove right-leaning content, undermining the "engagement maximization" narrative. If algorithms truly optimized for outrage, conservative content — which often generates strong reactions — would not face systematic suppression. The real issue is ideological bias in moderation, not neutral algorithmic design.',
      sources: [
        { title: 'Twitter Files: Internal Moderation Docs', url: '', domain: 'twitter.com' },
        { title: 'Stanford Internet Observatory: Bias Analysis', url: '', domain: 'stanford.edu' },
        { title: 'CATO Institute: Platform Neutrality Report', url: '', domain: 'cato.org' },
      ],
    },
    {
      type: 'historical',
      label: 'Historical Context',
      summary: 'Media has always been incentivized toward conflict — social media is a technological acceleration.',
      analysis:
        "Yellow journalism of the 1890s, radio shock jocks of the 1980s, and cable news culture wars of the 2000s all predate algorithmic feeds. The pattern of conflict-driven media is as old as the penny press. What social media has changed is the speed, personalization, and scale of delivery — not the underlying human preference for emotionally resonant content.",
      sources: [
        { title: 'Yellow Journalism and the Spanish-American War', url: '', domain: 'history.com' },
        { title: 'Neil Postman: Amusing Ourselves to Death (1985)', url: '', domain: 'archive.org' },
      ],
    },
    {
      type: 'scientific',
      label: 'Scientific View',
      summary: 'Research is mixed — emotional content spreads faster, but "outrage maximization" is too simple.',
      analysis:
        'A landmark 2018 MIT study found false news spreads six times faster than true news on Twitter. However, subsequent research challenges blanket algorithmic blame: a 2023 Nature study found Facebook algorithm changes had minimal effect on political polarization. Human choices and existing beliefs play a larger role than the algorithm alone in determining what users consume.',
      sources: [
        { title: 'Vosoughi et al.: The spread of true and false news online (Science, 2018)', url: '', domain: 'science.org' },
        { title: 'Gonzalez-Bailon et al.: Asymmetric ideological segregation (Nature, 2023)', url: '', domain: 'nature.com' },
        { title: 'NYU Center for Social Media and Politics', url: '', domain: 'nyu.edu' },
      ],
    },
    {
      type: 'contrarian',
      label: 'Contrarian View',
      summary: 'Users choose outrage. Blaming the algorithm is a convenient abdication of personal responsibility.',
      analysis:
        'The contrarian case: users can curate their own feeds, mute, unfollow, and choose how they engage — but millions actively seek out conflict. Algorithms respond to revealed preference, not the other way around. If the algorithm is a mirror, perhaps the uncomfortable question is what we see reflected. The "algorithm did it" narrative conveniently absolves users and societies of examining their own appetites.',
      sources: [
        { title: 'Haidt & Rose-Stockwell: The Dark Psychology of Social Networks (The Atlantic)', url: '', domain: 'theatlantic.com' },
      ],
      isPremiumOnly: true,
    },
  ],
};

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useStore();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);

  const isPremium = user?.tier === 'premium';

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<Claim>(`/claims/${id}`);
        setClaim(data);
      } catch {
        setClaim(MOCK_CLAIM);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Generating perspectives...</Text>
      </View>
    );
  }

  if (!claim) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#0D0D14', '#0A0A0A']} style={StyleSheet.absoluteFill} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(`/claim/discussion/${claim.id}`)}
          style={styles.discussBtn}
        >
          <Text style={styles.discussText}>{claim.commentCount} comments</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Claim header */}
        <View style={styles.claimHeader}>
          <View style={styles.metaRow}>
            <Text style={styles.categoryTag}>{claim.category}</Text>
            <HeatIndicator score={claim.heatScore} />
          </View>
          <Text style={styles.claimText}>{claim.text}</Text>
          <Text style={styles.meta}>
            Submitted by {claim.submittedByName} · {formatViews(claim.viewCount)} views
          </Text>
        </View>

        {/* Perspectives */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PERSPECTIVES</Text>
          {claim.perspectives.map((p, i) => (
            <PerspectivePanel
              key={p.type}
              perspective={p}
              isLocked={p.isPremiumOnly && !isPremium}
              index={i}
            />
          ))}
        </View>

        {/* Premium upsell if free */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.upsellCard}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.85}
          >
            <Text style={styles.upsellTitle}>★ Unlock the Contrarian View</Text>
            <Text style={styles.upsellSub}>
              Premium gives you all 5 perspectives, deep historical context, and unlimited checks.
            </Text>
          </TouchableOpacity>
        )}

        {/* Discussion CTA */}
        <TouchableOpacity
          style={styles.discussCta}
          onPress={() => router.push(`/claim/discussion/${claim.id}`)}
          activeOpacity={0.85}
        >
          <Text style={styles.discussCtaTitle}>Join the Discussion</Text>
          <Text style={styles.discussCtaSub}>{claim.commentCount} people are talking about this</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { color: Colors.textMuted, fontSize: 14 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backBtn: { padding: 8 },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  discussBtn: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  discussText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 100, gap: Spacing.lg },
  claimHeader: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryTag: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    letterSpacing: 0.5,
  },
  claimText: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', lineHeight: 26 },
  meta: { color: Colors.textMuted, fontSize: 12 },
  section: { gap: 4 },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  upsellCard: {
    backgroundColor: Colors.secondaryMuted,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.secondary,
    padding: Spacing.md,
    gap: 6,
  },
  upsellTitle: { color: Colors.secondary, fontWeight: '800', fontSize: 15 },
  upsellSub: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  discussCta: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  discussCtaTitle: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  discussCtaSub: { color: Colors.textMuted, fontSize: 12 },
});
