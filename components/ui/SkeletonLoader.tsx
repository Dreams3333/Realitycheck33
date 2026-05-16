import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = Radius.sm, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[styles.base, { width: width as any, height, borderRadius, opacity }, style]}
    />
  );
}

export function ClaimCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Skeleton width={60} height={22} borderRadius={Radius.sm} />
        <Skeleton width={40} height={10} style={{ marginLeft: 8 }} />
      </View>
      <Skeleton height={18} style={{ marginTop: 12 }} />
      <Skeleton height={14} width="80%" style={{ marginTop: 6 }} />
      <View style={styles.row}>
        <Skeleton width={80} height={10} style={{ marginTop: 16 }} />
        <Skeleton width={60} height={10} style={{ marginTop: 16, marginLeft: 12 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: Colors.surfaceElevated },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
