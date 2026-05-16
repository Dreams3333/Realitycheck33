import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Claim } from '@/constants/types';
import { HeatIndicator, HeatBar } from './HeatIndicator';

interface ClaimCardProps {
  claim: Claim;
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics: Colors.perspectiveLeft,
  Science: Colors.perspectiveScientific,
  Health: Colors.perspectiveScientific,
  History: Colors.perspectiveHistorical,
  Economy: Colors.perspectiveRight,
  Media: Colors.perspectiveContrarian,
  Technology: Colors.primary,
  Other: Colors.textMuted,
};

export function ClaimCard({ claim }: ClaimCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/claim/${claim.id}`);
  };

  const catColor = CATEGORY_COLORS[claim.category] || Colors.textMuted;

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.header}>
          <View style={[styles.categoryBadge, { borderColor: catColor }]}>
            <Text style={[styles.categoryText, { color: catColor }]}>{claim.category}</Text>
          </View>
          <HeatIndicator score={claim.heatScore} />
        </View>

        <Text style={styles.claimText} numberOfLines={3}>
          {claim.text}
        </Text>

        <View style={styles.heatBarRow}>
          <Text style={styles.heatLabel}>Debate intensity</Text>
          <HeatBar score={claim.heatScore} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {claim.perspectives.length} perspectives
          </Text>
          <Text style={styles.separator}>·</Text>
          <Text style={styles.footerText}>{claim.commentCount} comments</Text>
          <Text style={styles.separator}>·</Text>
          <Text style={styles.footerText}>{formatViews(claim.viewCount)} views</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: 12,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  claimText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
  },
  heatBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heatLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    width: 90,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  separator: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
