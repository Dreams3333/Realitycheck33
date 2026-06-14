# Premium Mobile App Design Skill

When building mobile UI, mimic the design language of the world's best apps: Airbnb, Spotify, Revolut, Duolingo, Phantom, Linear, Notion, and Stripe.

## Core Design Principles

### 1. Visual Hierarchy
- Large bold headings (32-40px), medium subheadings (18-22px), small body (14-16px)
- Use weight contrast (800 bold vs 400 regular) not just size
- One dominant element per screen — never compete for attention

### 2. Color System
- Always define: primary, secondary, accent, background, surface, text, muted, error
- Dark mode first — then light mode
- Use opacity variants (primary/10, primary/20) for subtle fills
- Never use pure black (#000) — use near-black (#0A0A0B or #111111)

### 3. Spacing & Layout
- Base unit: 4px. Use multiples: 4, 8, 12, 16, 24, 32, 48, 64
- Generous padding on cards: 16-24px minimum
- Screen horizontal padding: 20-24px
- Group related elements tightly, separate unrelated ones generously

### 4. Typography Rules
- Use system fonts or Inter/SF Pro — never mix more than 2 typefaces
- Line height: 1.4-1.6 for body, 1.1-1.2 for headings
- Letter spacing: -0.5 to -1px on large headings
- Muted text: 50-60% opacity of primary text color

### 5. Components That Feel Premium

**Cards:**
```
borderRadius: 16-20px
padding: 20px
background: surface color (not pure white)
shadow: subtle — 0 2px 12px rgba(0,0,0,0.08)
```

**Buttons:**
```
Primary: full width, 54px height, 14px border radius, bold label
Secondary: outlined or ghost, same size
Never: flat buttons with no visual feedback
Always: pressed state (scale 0.97 + slight opacity)
```

**Input Fields:**
```
Height: 52-56px
Border: 1px subtle, glows on focus
Label: floating or above field
Background: slightly elevated from page background
```

**Bottom Navigation:**
```
Max 4-5 items
Icon + label (active item), icon only (inactive)
Active: filled icon + accent color
Background: blurred glass effect or solid surface
```

### 6. Motion & Micro-interactions
- All transitions: 200-300ms, ease-out curve
- Button press: scale(0.97)
- Screen transitions: slide or fade, never jump
- Loading states: skeleton screens, not spinners
- Success states: subtle checkmark animation

### 7. Premium App Patterns to Copy

**Spotify:** Dark background, card grids, bold art-forward design, green accent
**Revolut:** Clean white, strong typography, gradient accents, data visualization
**Airbnb:** Generous whitespace, photography-first, coral accent, rounded everything
**Linear:** Minimal, keyboard-first, dark mode default, tight spacing
**Duolingo:** Rounded cartoon, high contrast, gamification elements, green primary
**Phantom:** Crypto-dark, purple gradient, glassmorphism cards

### 8. React Native Specific
- Use `StyleSheet.create()` for performance
- Shadow: iOS uses `shadow*` props, Android uses `elevation`
- Safe areas: always wrap in `SafeAreaView`
- Haptics: use `expo-haptics` on button presses
- Fonts: load with `expo-font` and use throughout consistently
- Images: always specify width/height, use `resizeMode='cover'`

### 9. Screen Layout Template
```
SafeAreaView
  ScrollView (or FlatList)
    Header (back button + title + action)
    Hero Section (image or key metric)
    Content Sections (cards, lists)
    CTA Button (sticky bottom or inline)
```

### 10. What to AVOID
- Generic blue primary color
- Thin hairline borders everywhere
- Centered body text (left-align always)
- Too many colors (3 max in any screen)
- Flat design with no depth
- Default React Native styles with no customization
- Cards that touch the screen edges (always margin)
