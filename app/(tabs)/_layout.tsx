import { Tabs } from 'expo-router';
import { Platform, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/theme';

const ICONS: Record<string, { active: string; inactive: string }> = {
  index:   { active: '◈', inactive: '◇' },
  submit:  { active: '⊕', inactive: '⊕' },
  profile: { active: '◉', inactive: '○' },
};

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const icon = ICONS[name]?.[focused ? 'active' : 'inactive'] ?? '·';
  return <Text style={[styles.icon, { color, fontSize: focused ? 24 : 21 }]}>{icon}</Text>;
}

function GlassTabBar() {
  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 80 : 60}
      tint="dark"
      style={[StyleSheet.absoluteFill, styles.blurBase]}
    />
  );
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
        tabBarBackground: GlassTabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => <TabIcon name="index" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: 'Check',
          tabBarIcon: ({ color, focused }) => <TabIcon name="submit" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon name="profile" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.10)',
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8,
    elevation: 0,
  },
  blurBase: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  icon: {
    lineHeight: 28,
  },
});
