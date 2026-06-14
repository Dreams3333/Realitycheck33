import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Glass } from '@/constants/theme';
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

function getHeatColor(score: number): string {
  if (score >= 75) return Colors.heatHigh;
  if (score >= 50) return Colors.heatMedium;
  return Colors.heatLow;
}

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
  const isHot = claim.heatScore >= 70;
  const accentColor = getHeatColor(claim.heatScore);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.card,
          isHot && {
            borderColor: `${accentColor}25`,
            shadowColor: accentColor,
            shadowOpacity: 0.12,
          },
          { transform: [{ scale }] },
        ]}
      >
        {/* Glass edge highlight (iOS 27 Liquid Glass top-edge effect) */}
        <View style={styles.glassEdge} />

        {/* Left accent bar for hot claims */}
        {isHot && <View style={[styles.hotAccent, { backgroundColor: accentColor }]} />}

        <View style={styles.inner}>
          <View style={styles.header}>
            <View style={[styles.categoryBadge, { borderColor: `${catColor}50`, backgroundColor: `${catColor}10` }]}>
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
              {claim.perspectives.length > 0 ? `${claim.perspectives.length} perspectives` : 'Analyzing...'}
            </Text>
            <Text style={styles.separator}>·</Text>
            <Text style={styles.footerText}>{claim.commentCount} comments</Text>
            <Text style={styles.separator}>·</Text>
            <Text style={styles.footerText}>{formatViews(claim.viewCount)} views</Text>
          </View>
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
    ...Glass.card,
    borderRadius: Radius.lg,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    flexDirection: 'row',
  },
  glassEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    zIndex: 1,
  },
  hotAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  inner: {
    flex: 1,
    padding: 20,
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  claimText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.2,
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
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerText: { color: Colors.textMuted, fontSize: 12 },
  separator: { color: Colors.textMuted, fontSize: 12 },
});
