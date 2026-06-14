# Premium Website Design Skill

When building websites or landing pages, mimic the design quality of: Stripe, Linear, Vercel, Loom, Notion, Apple, Framer, and Arc Browser.

## Core Philosophy
Before writing code, commit to a bold design direction:
- **Brutally Minimal** (Linear, Vercel) — dark, tight, monospace accents
- **Editorial** (Stripe) — large type, asymmetric layouts, bold color sections
- **Warm & Human** (Notion, Loom) — soft colors, illustrations, friendly tone
- **Tech Luxury** (Apple) — cinema-quality images, precise whitespace, no clutter

## Typography System
```css
/* Scale */
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 2rem;
--text-4xl: 2.5rem;
--text-5xl: 3.5rem;
--text-6xl: 4.5rem;
--text-hero: clamp(3rem, 8vw, 6rem);

/* Weights: 400 body, 500 medium, 600 semibold, 700 bold, 800 extrabold */
/* Letter spacing: -0.04em on large headings, 0.08em on labels/caps */
/* Line height: 1.1 headings, 1.6 body */
```

## Color System
```css
/* Dark theme (preferred for premium) */
--bg: #09090B;
--surface: #18181B;
--surface-2: #27272A;
--border: rgba(255,255,255,0.08);
--text: #FAFAFA;
--text-muted: #A1A1AA;
--accent: #6366F1; /* or brand color */
--accent-glow: rgba(99,102,241,0.3);

/* Light theme */
--bg: #FFFFFF;
--surface: #F4F4F5;
--border: rgba(0,0,0,0.08);
--text: #09090B;
--text-muted: #71717A;
```

## Hero Section (Most Important)
```html
<!-- Pattern: Badge + Headline + Subline + CTA -->
<section class="hero">
  <div class="badge">New — v2.0 just launched</div>
  <h1>The headline that<br><span class="gradient-text">stops the scroll</span></h1>
  <p>One clear value prop. 15 words max. No jargon.</p>
  <div class="cta-group">
    <button class="btn-primary">Get Started Free</button>
    <button class="btn-ghost">Watch Demo →</button>
  </div>
</section>
```

## Layout Patterns That Convert

**Above the fold:** Centered hero, max-width 680px headline, full-width background
**Features:** 3-column icon grid OR alternating image+text rows
**Social proof:** Logo strip (grayscale) below hero, testimonial cards
**Pricing:** 3 tiers, middle one highlighted, annual toggle
**Footer:** 4-column links, newsletter, social icons, legal

## CSS Techniques for Premium Feel

```css
/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #6366F1, #8B5CF6, #EC4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Glassmorphism card */
.glass-card {
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
}

/* Glow effect */
.glow {
  box-shadow: 0 0 40px rgba(99,102,241,0.3);
}

/* Subtle noise texture */
.noise::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,...");
  opacity: 0.03;
}

/* Premium button */
.btn-primary {
  background: #6366F1;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 15px;
  transition: all 0.15s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(99,102,241,0.4);
}
```

## Animation Principles
- Scroll-triggered fade-up: `opacity 0→1, translateY 20px→0, duration 0.5s`
- Stagger children: 0.1s delay between each
- Hover cards: `translateY(-4px)` with shadow increase
- Never animate layout properties (width, height) — only transform and opacity
- Use `will-change: transform` on animated elements

## Sites to Mimic

| Brand | What to Copy |
|---|---|
| **Stripe** | Bold section colors, large serif headings, 3D product illustrations |
| **Linear** | Dark minimal, monospace code snippets, tight grid |
| **Vercel** | Terminal aesthetic, gradient orbs, grid background |
| **Loom** | Friendly gradients, video-first, rounded cards |
| **Framer** | Motion-first, bold typography, interactive demos |
| **Apple** | Full-bleed images, cinematic scroll, zero clutter |

## Component Checklist
- [ ] Responsive: mobile-first, breakpoints at 640/768/1024/1280px
- [ ] Dark/light mode toggle
- [ ] Loading: skeleton screens or optimistic UI
- [ ] Accessibility: semantic HTML, ARIA labels, 4.5:1 contrast ratio
- [ ] Performance: lazy load images, preload fonts, minimize JS
- [ ] Animations respect `prefers-reduced-motion`

## What Separates Premium from Generic
1. Every section has a clear purpose — delete anything decorative
2. Consistent 8px spacing grid — no random margins
3. Max 2 fonts, max 3 colors per page
4. White space is intentional, not empty
5. CTAs are specific: "Start Building Free" not "Get Started"
6. Mobile is just as polished as desktop
7. Every interaction has feedback (hover, active, focus states)
