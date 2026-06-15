import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api } from '@/services/api';
import { useStore } from '@/store/useStore';
import { Claim } from '@/constants/types';
import { ClaimCard } from '@/components/home/ClaimCard';
import { ClaimCardSkeleton } from '@/components/ui/SkeletonLoader';
import { Colors, Spacing } from '@/constants/theme';

const CATEGORIES = ['All', 'Politics', 'Science', 'Health', 'History', 'Economy', 'Media', 'Technology'];

const MOCK_CLAIMS: Claim[] = [
  {
    id: '1',
    text: 'Social media algorithms are deliberately designed to maximize outrage and division.',
    category: 'Technology',
    heatScore: 78,
    perspectives: [],
    commentCount: 142,
    viewCount: 8400,
    submittedByName: 'Alex M.',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    status: 'processed',
  },
  {
    id: '2',
    text: "The US Federal Reserve's interest rate policies disproportionately benefit the wealthy.",
    category: 'Economy',
    heatScore: 62,
    perspectives: [],
    commentCount: 89,
    viewCount: 5200,
    submittedByName: 'Jordan K.',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    status: 'processed',
  },
  {
    id: '3',
    text: 'Ultra-processed food consumption is the primary driver of the modern mental health crisis.',
    category: 'Health',
    heatScore: 55,
    perspectives: [],
    commentCount: 67,
    viewCount: 3100,
    submittedByName: 'Sam R.',
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    status: 'processed',
  },
  {
    id: '4',
    text: 'Remote work has permanently shifted power from employers to employees.',
    category: 'Economy',
    heatScore: 38,
    perspectives: [],
    commentCount: 34,
    viewCount: 1800,
    submittedByName: 'Casey T.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'processed',
  },
  {
    id: '5',
    text: 'The 2008 financial crisis was caused primarily by deregulation, not individual irresponsibility.',
    category: 'History',
    heatScore: 91,
    perspectives: [],
    commentCount: 203,
    viewCount: 12000,
    submittedByName: 'Morgan L.',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    status: 'processed',
  },
];

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useStore();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchClaims = useCallback(async () => {
    try {
      const data = await api.get<Claim[]>('/claims/trending');
      setClaims(data);
    } catch {
      setClaims(MOCK_CLAIMS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClaims();
  };

  const filteredClaims = useMemo(
    () => selectedCategory === 'All' ? claims : claims.filter((c) => c.category === selectedCategory),
    [claims, selectedCategory]
  );

  const renderClaim = useCallback(
    ({ item }: { item: Claim }) => <ClaimCard claim={item} />,
    []
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getGreeting()},</Text>
          <Text style={styles.name}>{user?.displayName?.split(' ')[0] ?? 'Reader'}</Text>
        </View>
        {user?.tier === 'premium' && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumText}>★ PREMIUM</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Trending Claims</Text>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: Colors.heatLow }]} />
          <Text style={styles.legendText}>Low</Text>
          <View style={[styles.legendDot, { backgroundColor: Colors.heatHigh }]} />
          <Text style={styles.legendText}>Hot</Text>
        </View>
      </View>

      <FlatList
        data={CATEGORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.catList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.catBtn, selectedCategory === item && styles.catBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setSelectedCategory(item); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.catText, selectedCategory === item && styles.catTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
        style={styles.catRow}
      />

      {loading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 4 }).map((_, i) => <ClaimCardSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={filteredClaims}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderClaim}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={6}
          windowSize={5}
          initialNumToRender={6}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>◈</Text>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>
                {selectedCategory === 'All'
                  ? 'No claims yet. Be the first to submit one.'
                  : `No ${selectedCategory.toLowerCase()} claims yet. Submit the first one.`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  greeting: { color: Colors.textMuted, fontSize: 13 },
  name: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  premiumBadge: {
    backgroundColor: Colors.secondaryMuted,
    borderWidth: 1,
    borderColor: Colors.secondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  premiumText: { color: Colors.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: Colors.textMuted, fontSize: 11 },
  catRow: { maxHeight: 52, marginTop: Spacing.sm },
  catList: { paddingHorizontal: Spacing.lg, gap: 8 },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  catBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  catText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  catTextActive: { color: Colors.primary, fontWeight: '700' },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 100 },
  emptyWrap: { paddingTop: 60, alignItems: 'center', gap: 10 },
  emptyIcon: { fontSize: 40, color: Colors.textMuted },
  emptyTitle: { color: Colors.textSecondary, fontSize: 17, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
