import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Perspective, PerspectiveType } from '@/constants/types';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const PERSPECTIVE_CONFIG: Record<
  PerspectiveType,
  { color: string; icon: string; description: string }
> = {
  left: { color: Colors.perspectiveLeft, icon: '◀', description: 'Progressive / Left-leaning' },
  right: { color: Colors.perspectiveRight, icon: '▶', description: 'Conservative / Right-leaning' },
  historical: { color: Colors.perspectiveHistorical, icon: '◉', description: 'Historical Context' },
  scientific: { color: Colors.perspectiveScientific, icon: '⬡', description: 'Scientific / Data-driven' },
  contrarian: { color: Colors.perspectiveContrarian, icon: '◈', description: 'Contrarian / Devil\'s Advocate' },
};

interface PerspectivePanelProps {
  perspective: Perspective;
  isLocked?: boolean;
  index: number;
}

export function PerspectivePanel({ perspective, isLocked = false, index }: PerspectivePanelProps) {
  const [expanded, setExpanded] = useState(index === 0);
  const config = PERSPECTIVE_CONFIG[perspective.type];

  const toggle = () => {
    if (isLocked) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={[styles.panel, { borderColor: isLocked ? Colors.cardBorder : config.color }]}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.8}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: `${config.color}18` }]}>
            <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
          </View>
          <View>
            <Text style={[styles.label, { color: isLocked ? Colors.textMuted : config.color }]}>
              {perspective.label}
            </Text>
            <Text style={styles.description}>{config.description}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {isLocked && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>★ PREMIUM</Text>
            </View>
          )}
          <Text style={[styles.chevron, { color: config.color }]}>
            {expanded ? '↑' : '↓'}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded && !isLocked && (
        <View style={styles.body}>
          <Text style={styles.summary}>{perspective.summary}</Text>
          <Text style={styles.analysis}>{perspective.analysis}</Text>

          {perspective.sources.length > 0 && (
            <View style={styles.sources}>
              <Text style={styles.sourcesHeader}>SOURCES</Text>
              {perspective.sources.map((source, i) => (
                <View key={i} style={styles.sourceRow}>
                  <View style={[styles.sourceDot, { backgroundColor: config.color }]} />
                  <Text style={styles.sourceText} numberOfLines={1}>
                    {source.title}
                  </Text>
                  <Text style={styles.sourceDomain}>{source.domain}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {isLocked && (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockText}>Unlock with Premium for full analysis and sources</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 15, fontWeight: '700' },
  description: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  chevron: { fontSize: 16, fontWeight: '700' },
  premiumBadge: {
    backgroundColor: Colors.secondaryMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  premiumBadgeText: { color: Colors.secondary, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  body: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  summary: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8,
  },
  analysis: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  sources: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    gap: 8,
  },
  sourcesHeader: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sourceDot: { width: 5, height: 5, borderRadius: 3 },
  sourceText: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  sourceDomain: { color: Colors.textMuted, fontSize: 11 },
  lockOverlay: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  lockText: { color: Colors.textMuted, fontSize: 13, fontStyle: 'italic' },
});
