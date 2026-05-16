import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { authService } from '@/services/auth';
import { useStore } from '@/store/useStore';

export default function RootLayout() {
  const { setUser, setToken, setLoading, setHasCompletedOnboarding } = useStore();

  useEffect(() => {
    async function bootstrap() {
      try {
        const token = await authService.getStoredToken();
        const onboarded = await authService.hasCompletedOnboarding();
        setHasCompletedOnboarding(onboarded);

        if (token) {
          setToken(token);
          const user = await authService.getMe();
          setUser(user);
        }
      } catch {
        // Token expired or invalid — stay logged out
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="claim/[id]" />
        <Stack.Screen name="claim/discussion/[id]" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
