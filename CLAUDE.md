# RealityCheck33 — Claude Context

## What This App Is
A fact-checking / claim-analysis app. Users submit contested claims; the app surfaces 5 perspectives (Left, Right, Historical, Scientific, Contrarian) with sources. Built for iOS and Android.

## Tech Stack
- **Framework:** React Native + Expo (Expo Router v4, file-based routing)
- **Language:** TypeScript
- **State:** Zustand (`store/useStore.ts`)
- **API:** Custom REST via `services/api.ts`
- **Auth:** Custom via `services/auth.ts`
- **Navigation:** Expo Router — `app/(tabs)/` for main tabs, `app/(auth)/` for auth, `app/claim/` for detail

## Key Files
| File | Purpose |
|---|---|
| `constants/theme.ts` | All colors, spacing, radius tokens |
| `app/index.tsx` | Splash screen with glitch animation |
| `app/onboarding.tsx` | 3-slide onboarding |
| `app/(tabs)/index.tsx` | Main feed (trending claims) |
| `app/(tabs)/submit.tsx` | Submit a claim for fact-check |
| `app/(tabs)/profile.tsx` | User profile + premium upsell |
| `components/home/ClaimCard.tsx` | Main feed card component |
| `components/home/HeatIndicator.tsx` | Heat score badge + bar |

## Design Language
- **Style:** Dark-first, premium. Inspired by Linear + iOS 27 Liquid Glass
- **Primary:** `#00A8FF` (electric blue)
- **Secondary:** `#FFD700` (gold — used for premium/heat)
- **Background:** `#0A0A0A` (near-black, never pure black)
- **Spacing base unit:** 4px (use multiples: 4/8/12/16/24/32/48)
- **Cards:** `borderRadius: 16`, `padding: 20`, shadow always present
- **Glass effect:** `rgba` backgrounds + `rgba(255,255,255,0.08)` borders + top-edge highlight `rgba(255,255,255,0.15)`
- **Typography:** Weight contrast over size — `900` headings, `400` body, `-0.5` to `-1` letter spacing on large text
- **Buttons:** 56px tall, `borderRadius: 16`, white text always
- **Tab bar:** BlurView backed, `rgba(255,255,255,0.06)` border, no elevation

## Claim Heat Score
- 0–49: Low (blue `#00A8FF`)
- 50–74: Medium (orange `#FF8C00`)
- 75–100: High (gold `#FFD700`)
- Cards with score ≥ 70 get a left accent bar in the heat color

## Perspective Colors
| Perspective | Color |
|---|---|
| Left | `#4A90D9` |
| Right | `#D94A4A` |
| Historical | `#9B59B6` |
| Scientific | `#27AE60` |
| Contrarian | `#E67E22` |

## Running Locally
```bash
npm install
npx expo start
```
Scan QR with Expo Go, or press `i` for iOS simulator / `a` for Android.

## Conventions
- All styles use `StyleSheet.create()` — no inline style objects
- Haptics on all press interactions: `Haptics.impactAsync(ImpactFeedbackStyle.Light)`
- Safe area: always wrap screens in `useSafeAreaInsets()` or `SafeAreaView`
- Never use pure `#000000` — use `#0A0A0A` or `#0C0C0C`
- Never use pure `#FFFFFF` — use `#FAFAFA` or `rgba` variants
- Skeleton loaders for loading states, never spinners
- Press animations: `scale(0.97)` spring on all touchable cards

## Skills Available
- `.claude/skills/premium-app-design.md` — mobile UI design system
- `.claude/skills/premium-web-design.md` — web/landing page design system
- `higgsfield-kids-content-guide.md` — Higgsfield video generation for kids content
