import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '@/services/auth';
import { Colors, Spacing, Radius } from '@/constants/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '◎',
    iconColor: Colors.primary,
    title: 'No Agenda.\nJust Angles.',
    body: 'Every claim deserves more than a true or false. We surface the full spectrum — left, right, historical, scientific, and contrarian — so you can think for yourself.',
    accent: Colors.primary,
  },
  {
    icon: '⬡',
    iconColor: Colors.perspectiveScientific,
    title: 'Five Lenses.\nOne Truth.',
    body: 'Backed by real sources. Each perspective is labeled, color-coded, and cited — from peer-reviewed research to primary documents to expert commentary.',
    accent: Colors.perspectiveScientific,
  },
  {
    icon: '★',
    iconColor: Colors.secondary,
    title: 'Stay Sharp.\nStay Informed.',
    body: "Track the week's most contested claims, join the community discussion, and go deeper with Premium — unlimited checks, full historical context, saved research.",
    accent: Colors.secondary,
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const dotAnims = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrentIndex(index);
    dotAnims.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === index ? 1 : 0,
        useNativeDriver: false,
        speed: 20,
      }).start();
    });
  };

  const handleScroll = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== currentIndex) goTo(index);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      goTo(currentIndex + 1);
    } else {
      handleDone();
    }
  };

  const handleDone = async () => {
    await authService.setOnboardingComplete();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0A0A', '#0D1117', '#0A0A0A']} style={StyleSheet.absoluteFill} />

      <TouchableOpacity style={styles.skipBtn} onPress={handleDone}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, index) => (
          <View key={index} style={styles.slide}>
            <View style={[styles.iconWrap, { borderColor: `${slide.accent}50`, shadowColor: slide.accent }]}>
              <LinearGradient
                colors={[`${slide.accent}20`, `${slide.accent}05`]}
                style={StyleSheet.absoluteFill}
                borderRadius={48}
              />
              <Text style={[styles.icon, { color: slide.iconColor }]}>{slide.icon}</Text>
            </View>

            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>

            {index === 2 && (
              <View style={[styles.premiumNote, { borderColor: `${Colors.secondary}40`, backgroundColor: `${Colors.secondary}08` }]}>
                <Text style={styles.premiumNoteText}>
                  ★  Premium users get unlimited checks + deep historical context
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotsRow}>
        {SLIDES.map((slide, i) => {
          const dotWidth = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [8, 28] });
          const bg = dotAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [Colors.textMuted, slide.accent],
          });
          return (
            <TouchableOpacity key={i} onPress={() => goTo(i)}>
              <Animated.View style={[styles.dot, { width: dotWidth, backgroundColor: bg }]} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: SLIDES[currentIndex].accent }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {currentIndex < SLIDES.length - 1 ? 'Continue' : 'Get Started'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  skipBtn: { position: 'absolute', top: 60, right: Spacing.lg, zIndex: 10, padding: 8 },
  skipText: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 80,
    gap: Spacing.lg,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    overflow: 'hidden',
  },
  icon: { fontSize: 40, fontWeight: '900' },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -1,
  },
  body: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  premiumNote: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  premiumNoteText: {
    color: Colors.secondary,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  dot: { height: 8, borderRadius: 4 },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: 52 },
  ctaBtn: {
    borderRadius: Radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  ctaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
});
