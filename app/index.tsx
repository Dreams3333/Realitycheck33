import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const { isLoading, isAuthenticated, hasCompletedOnboarding } = useStore();

  const mainOpacity = useRef(new Animated.Value(0)).current;
  const glitchX = useRef(new Animated.Value(0)).current;
  const glitchX2 = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const glitchOpacity = useRef(new Animated.Value(0)).current;
  const glitchOpacity2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in logo
    Animated.parallel([
      Animated.timing(mainOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      // Run glitch bursts
      runGlitch(() => {
        // Fade in subtitle after glitch
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      });
    });
  }, []);

  function runGlitch(onDone: () => void) {
    const glitchSequence = (glitchXVal: Animated.Value, opacityVal: Animated.Value, shifts: number[]) =>
      Animated.sequence(
        shifts.map((val, i) =>
          Animated.parallel([
            Animated.timing(glitchXVal, { toValue: val, duration: 35, useNativeDriver: true }),
            Animated.timing(opacityVal, {
              toValue: i % 2 === 0 ? 0.7 : 0,
              duration: 35,
              useNativeDriver: true,
            }),
          ])
        )
      );

    Animated.sequence([
      Animated.delay(300),
      glitchSequence(glitchX, glitchOpacity, [-4, 3, -6, 2, -3, 1, 0]),
      Animated.delay(100),
      glitchSequence(glitchX2, glitchOpacity2, [5, -3, 4, -2, 3, -1, 0]),
      Animated.delay(120),
      glitchSequence(glitchX, glitchOpacity, [-2, 4, -5, 3, 0]),
    ]).start(onDone);
  }

  // Navigate once loading is done
  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else if (!hasCompletedOnboarding) {
        router.replace('/onboarding');
      } else {
        router.replace('/(auth)/login');
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, hasCompletedOnboarding]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#0D1117', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.logoWrap, { opacity: mainOpacity, transform: [{ scale: logoScale }] }]}>
        {/* Glitch layer 1 */}
        <Animated.Text
          style={[
            styles.logo,
            styles.glitchBlue,
            { transform: [{ translateX: glitchX }], opacity: glitchOpacity },
          ]}
        >
          REALITY{'\n'}CHECK
        </Animated.Text>

        {/* Glitch layer 2 */}
        <Animated.Text
          style={[
            styles.logo,
            styles.glitchGold,
            { transform: [{ translateX: glitchX2 }], opacity: glitchOpacity2 },
          ]}
        >
          REALITY{'\n'}CHECK
        </Animated.Text>

        {/* Main logo */}
        <Text style={styles.logo}>
          REALITY{'\n'}
          <Text style={styles.logoAccent}>CHECK</Text>
        </Text>
      </Animated.View>

      <Animated.View style={[styles.subtitleWrap, { opacity: subtitleOpacity }]}>
        <Text style={styles.subtitle}>No agenda. Just angles.</Text>
        <View style={styles.line} />
      </Animated.View>

      {/* Decorative grid */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.gridLine, { left: (width / 6) * i }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    width: width,
  },
  logo: {
    fontSize: 52,
    fontWeight: '900',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 56,
  },
  logoAccent: { color: Colors.primary },
  glitchBlue: {
    color: Colors.primary,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  glitchGold: {
    color: Colors.secondary,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  subtitleWrap: {
    position: 'absolute',
    bottom: 120,
    alignItems: 'center',
    gap: 12,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  line: {
    width: 40,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
});
