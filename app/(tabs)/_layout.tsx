import { Tabs } from 'expo-router';
import { Platform, Text, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';

const ICONS: Record<string, string> = { index: '◈', submit: '⊕', profile: '◉' };

function TabIcon({ name, color }: { name: string; color: string }) {
  return <Text style={[styles.icon, { color }]}>{ICONS[name]}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => <View style={styles.tabBg} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <TabIcon name="index" color={color} />,
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: 'Check',
          tabBarIcon: ({ color }) => <TabIcon name="submit" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
      {/* Hide explore tab — replaced by submit */}
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0F0F0F',
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8,
    elevation: 0,
  },
  tabBg: { flex: 1, backgroundColor: '#0F0F0F' },
  tabLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  icon: { fontSize: 22 },
});
