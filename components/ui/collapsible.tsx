import { PropsWithChildren, useState } from 'react';
import { StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={styles.heading}
        onPress={() => setIsOpen((v) => !v)}
        activeOpacity={0.8}
      >
        <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
        <Text style={styles.title}>{title}</Text>
      </TouchableOpacity>
      {isOpen && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chevron: { color: Colors.textSecondary, fontSize: 18, transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  content: { marginTop: 6, marginLeft: 24 },
});
