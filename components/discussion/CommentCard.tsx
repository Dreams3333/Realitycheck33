import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Comment } from '@/constants/types';

interface CommentCardProps {
  comment: Comment;
  onLike: (id: string) => void;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function CommentCard({ comment, onLike }: CommentCardProps) {
  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike(comment.id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarCol}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {comment.userDisplayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.threadLine} />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{comment.userDisplayName}</Text>
          <Text style={styles.time}>{timeAgo(comment.createdAt)}</Text>
        </View>
        <Text style={styles.text}>{comment.text}</Text>
        <TouchableOpacity style={styles.likeRow} onPress={handleLike} activeOpacity={0.7}>
          <Text style={[styles.likeIcon, comment.isLiked && styles.liked]}>♥</Text>
          <Text style={[styles.likeCount, comment.isLiked && styles.liked]}>
            {comment.likes}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  avatarCol: { alignItems: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  threadLine: {
    width: 1,
    flex: 1,
    backgroundColor: Colors.cardBorder,
    marginTop: 4,
  },
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  time: { color: Colors.textMuted, fontSize: 12 },
  text: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  likeIcon: { color: Colors.textMuted, fontSize: 14 },
  likeCount: { color: Colors.textMuted, fontSize: 12 },
  liked: { color: Colors.error },
});
