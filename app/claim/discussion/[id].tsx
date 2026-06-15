import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/services/api';
import { useStore } from '@/store/useStore';
import { Comment } from '@/constants/types';
import { CommentCard } from '@/components/discussion/CommentCard';
import { ClaimCardSkeleton } from '@/components/ui/SkeletonLoader';
import { Colors, Spacing, Radius } from '@/constants/theme';

const MOCK_COMMENTS: Comment[] = [
  {
    id: '1',
    claimId: '1',
    userId: 'u1',
    userDisplayName: 'Marcus T.',
    text: "The MIT research on this is pretty conclusive. The engagement loop isn't a bug, it's the product.",
    likes: 47,
    isLiked: false,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: '2',
    claimId: '1',
    userId: 'u2',
    userDisplayName: 'Priya S.',
    text: "I think the historical perspective is the most important one here. Yellow journalism did the same thing. We survived that.",
    likes: 31,
    isLiked: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '3',
    claimId: '1',
    userId: 'u3',
    userDisplayName: 'Derek L.',
    text: 'The contrarian view deserves more credit. I quit Twitter and my anxiety dropped 40%. Nobody held a gun to my head.',
    likes: 22,
    isLiked: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '4',
    claimId: '1',
    userId: 'u4',
    userDisplayName: 'Fatima A.',
    text: "The right-wing bias argument is interesting but falls apart when you look at which content Facebook actually boosted pre-2020.",
    likes: 18,
    isLiked: false,
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
];

export default function DiscussionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<Comment[]>(`/claims/${id}/comments`);
        setComments(data);
      } catch {
        setComments(MOCK_COMMENTS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => handler.remove();
  }, []);

  const handleLike = async (commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, isLiked: !c.isLiked, likes: c.likes + (c.isLiked ? -1 : 1) }
          : c
      )
    );
    try {
      await api.post(`/claims/${id}/comments/${commentId}/like`, {});
    } catch {
      // Revert on error
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, isLiked: !c.isLiked, likes: c.likes + (c.isLiked ? -1 : 1) }
            : c
        )
      );
    }
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user) {
      Alert.alert('Sign in', 'Please sign in to comment.');
      return;
    }
    setSubmitting(true);
    const optimistic: Comment = {
      id: `temp_${Date.now()}`,
      claimId: id,
      userId: user.id,
      userDisplayName: user.displayName,
      text: text.trim(),
      likes: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [optimistic, ...prev]);
    setText('');

    try {
      const saved = await api.post<Comment>(`/claims/${id}/comments`, { text: optimistic.text });
      setComments((prev) => prev.map((c) => (c.id === optimistic.id ? saved : c)));
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      Alert.alert('Failed to post', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Discussion</Text>
          <Text style={styles.count}>{comments.length} comments</Text>
        </View>

        {/* Comments */}
        {loading ? (
          <View style={{ padding: Spacing.lg }}>
            {Array.from({ length: 3 }).map((_, i) => <ClaimCardSkeleton key={i} />)}
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <CommentCard comment={item} onLike={handleLike} />}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Compose */}
        <View style={[styles.compose, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarChar}>
              {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <TextInput
            style={styles.composeInput}
            value={text}
            onChangeText={setText}
            placeholder="Add your perspective..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={handleSubmit}
            disabled={!text.trim() || submitting}
          >
            <Text style={styles.sendText}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  closeBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  closeText: { color: Colors.textMuted, fontSize: 16 },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  count: { color: Colors.textMuted, fontSize: 13 },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 16,
  },
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    backgroundColor: Colors.background,
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarChar: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  composeInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.surfaceElevated },
  sendText: { color: '#000', fontWeight: '900', fontSize: 16 },
});
