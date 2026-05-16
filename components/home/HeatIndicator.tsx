import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface HeatIndicatorProps {
  score: number; // 0-100
  showLabel?: boolean;
}

function getHeatConfig(score: number) {
  if (score < 35) return { color: Colors.heatLow, label: 'Low Debate', bg: Colors.primaryMuted };
  if (score < 70) return { color: Colors.heatMedium, label: 'Contested', bg: 'rgba(255, 140, 0, 0.10)' };
  return { color: Colors.heatHigh, label: 'Highly Contested', bg: Colors.secondaryMuted };
}

export function HeatIndicator({ score, showLabel = true }: HeatIndicatorProps) {
  const { color, label, bg } = getHeatConfig(score);

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      {showLabel && <Text style={[styles.label, { color }]}>{label}</Text>}
    </View>
  );
}

export function HeatBar({ score }: { score: number }) {
  const { color } = getHeatConfig(score);
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${score}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  barTrack: {
    height: 3,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
    flex: 1,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});
