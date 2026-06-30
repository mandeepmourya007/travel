# Group Travel Aggregator — Design System

A platform-agnostic design system for web (Tailwind CSS) and mobile (React Native). One source of truth — change once, applies everywhere.

**Vibe:** Fun & Young — bright, energetic, Gen-Z friendly. Think Headout meets Klook.

---

## 1. Color Palette

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-50` | `#E0FFFE` | Backgrounds, hover states |
| `primary-100` | `#B3FFFC` | Light fills, selected states |
| `primary-200` | `#80FFF9` | Tags, badges |
| `primary-300` | `#4DD9D0` | Borders, dividers |
| `primary-400` | `#26C6C0` | Secondary buttons |
| `primary-500` | `#0FBAB5` | **Primary brand color** — CTAs, links |
| `primary-600` | `#0A9E99` | Primary button hover |
| `primary-700` | `#077E7A` | Active/pressed states |
| `primary-800` | `#045E5B` | Dark accents |
| `primary-900` | `#023F3D` | Text on light backgrounds |

### Accent — Coral (Energy, Action)

| Token | Hex | Usage |
|-------|-----|-------|
| `accent-50` | `#FFF1ED` | Light background |
| `accent-100` | `#FFD9CF` | Notification badges bg |
| `accent-200` | `#FFB3A1` | Tags |
| `accent-300` | `#FF8C73` | Highlights |
| `accent-400` | `#FF6B4D` | Secondary CTA |
| `accent-500` | `#FF4F33` | **Accent color** — prices, deals, urgency |
| `accent-600` | `#E63E24` | Hover |
| `accent-700` | `#CC2E17` | Active |
| `accent-800` | `#991F0E` | Dark |
| `accent-900` | `#661508` | Text |

### Highlight — Purple (Fun, Premium)

| Token | Hex | Usage |
|-------|-----|-------|
| `highlight-50` | `#F3EEFF` | Background |
| `highlight-100` | `#E0D4FF` | Light fill |
| `highlight-200` | `#C4ADFF` | Tags, badges |
| `highlight-300` | `#A585FF` | Borders |
| `highlight-400` | `#8B63FF` | Icons |
| `highlight-500` | `#7C4DFF` | **Highlight color** — featured trips, premium |
| `highlight-600` | `#6A3DE6` | Hover |
| `highlight-700` | `#572ECC` | Active |
| `highlight-800` | `#3D1F99` | Dark |
| `highlight-900` | `#291466` | Text |

### Neutrals

| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-0` | `#FFFFFF` | White backgrounds |
| `neutral-50` | `#F8FAFB` | Page background |
| `neutral-100` | `#F1F4F6` | Card backgrounds, inputs |
| `neutral-200` | `#E2E7EB` | Borders, dividers |
| `neutral-300` | `#CBD2D9` | Disabled states |
| `neutral-400` | `#9AA5B1` | Placeholder text |
| `neutral-500` | `#6B7785` | Secondary text |
| `neutral-600` | `#4E5A65` | Body text |
| `neutral-700` | `#374151` | Strong text |
| `neutral-800` | `#1F2937` | Headings |
| `neutral-900` | `#111827` | Primary text |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `success-500` | `#10B981` | Confirmed, verified, SafePay held |
| `success-50` | `#ECFDF5` | Success background |
| `warning-500` | `#F59E0B` | Pending, limited seats |
| `warning-50` | `#FFFBEB` | Warning background |
| `error-500` | `#EF4444` | Cancelled, payment failed |
| `error-50` | `#FEF2F2` | Error background |
| `info-500` | `#3B82F6` | Tips, info badges |
| `info-50` | `#EFF6FF` | Info background |

### Accessibility — Color Contrast Rules (WCAG AA)

| Context | Use This | Contrast on White | WCAG AA |
|---------|----------|-------------------|---------|
| **Primary text on white** | `primary-700` (#077E7A) | 5.8:1 | ✅ Pass |
| **Primary links** | `primary-600` (#0A9E99) | 4.6:1 | ✅ Pass |
| **Primary large text (≥18px bold)** | `primary-500` (#0FBAB5) | 3.1:1 | ✅ Pass (large) |
| **Primary buttons** | `primary-500` bg + white text | N/A (white on teal) | ✅ Pass |
| **Accent text on white** | `accent-700` (#CC2E17) | 5.2:1 | ✅ Pass |
| **Highlight text on white** | `highlight-700` (#572ECC) | 5.5:1 | ✅ Pass |

**Rules:**
- **NEVER** use `primary-500` for body text on white backgrounds — fails WCAG AA (3.1:1 < 4.5:1).
- Use `primary-600` or `primary-700` for links and text on white.
- `primary-500` is ONLY for: buttons (bg), large headlines (≥18px bold), icons, and badges.
- Same rule applies to `accent` and `highlight` — use `700` shade for text on white.

### Gradients (Fun & Young element)

| Token | Value | Usage |
|-------|-------|-------|
| `gradient-primary` | `linear-gradient(135deg, #0FBAB5 0%, #7C4DFF 100%)` | Hero sections, featured cards |
| `gradient-warm` | `linear-gradient(135deg, #FF4F33 0%, #FF6B4D 100%)` | Sale badges, urgency banners |
| `gradient-fun` | `linear-gradient(135deg, #7C4DFF 0%, #FF4F33 100%)` | Special promotions |

---

## 2. Design Tokens (JSON — Single Source of Truth)

This JSON file is imported by both Tailwind config and React Native theme.

```json
{
  "colors": {
    "primary": {
      "50": "#E0FFFE",
      "100": "#B3FFFC",
      "200": "#80FFF9",
      "300": "#4DD9D0",
      "400": "#26C6C0",
      "500": "#0FBAB5",
      "600": "#0A9E99",
      "700": "#077E7A",
      "800": "#045E5B",
      "900": "#023F3D"
    },
    "accent": {
      "50": "#FFF1ED",
      "100": "#FFD9CF",
      "200": "#FFB3A1",
      "300": "#FF8C73",
      "400": "#FF6B4D",
      "500": "#FF4F33",
      "600": "#E63E24",
      "700": "#CC2E17",
      "800": "#991F0E",
      "900": "#661508"
    },
    "highlight": {
      "50": "#F3EEFF",
      "100": "#E0D4FF",
      "200": "#C4ADFF",
      "300": "#A585FF",
      "400": "#8B63FF",
      "500": "#7C4DFF",
      "600": "#6A3DE6",
      "700": "#572ECC",
      "800": "#3D1F99",
      "900": "#291466"
    },
    "neutral": {
      "0": "#FFFFFF",
      "50": "#F8FAFB",
      "100": "#F1F4F6",
      "200": "#E2E7EB",
      "300": "#CBD2D9",
      "400": "#9AA5B1",
      "500": "#6B7785",
      "600": "#4E5A65",
      "700": "#374151",
      "800": "#1F2937",
      "900": "#111827"
    },
    "success": { "50": "#ECFDF5", "500": "#10B981" },
    "warning": { "50": "#FFFBEB", "500": "#F59E0B" },
    "error": { "50": "#FEF2F2", "500": "#EF4444" },
    "info": { "50": "#EFF6FF", "500": "#3B82F6" }
  },
  "typography": {
    "fontFamily": {
      "sans": "Inter, system-ui, -apple-system, sans-serif",
      "display": "Plus Jakarta Sans, Inter, sans-serif",
      "mono": "JetBrains Mono, monospace"
    },
    "fontSize": {
      "xs": { "size": "12px", "lineHeight": "16px", "mobile": 12 },
      "sm": { "size": "14px", "lineHeight": "20px", "mobile": 14 },
      "base": { "size": "16px", "lineHeight": "24px", "mobile": 16 },
      "lg": { "size": "18px", "lineHeight": "28px", "mobile": 18 },
      "xl": { "size": "20px", "lineHeight": "28px", "mobile": 20 },
      "2xl": { "size": "24px", "lineHeight": "32px", "mobile": 24 },
      "3xl": { "size": "30px", "lineHeight": "36px", "mobile": 28 },
      "4xl": { "size": "36px", "lineHeight": "40px", "mobile": 32 },
      "5xl": { "size": "48px", "lineHeight": "52px", "mobile": 40 }
    },
    "fontWeight": {
      "normal": "400",
      "medium": "500",
      "semibold": "600",
      "bold": "700",
      "extrabold": "800"
    }
  },
  "spacing": {
    "0": "0px",
    "0.5": "2px",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px",
    "20": "80px",
    "24": "96px"
  },
  "borderRadius": {
    "none": "0px",
    "sm": "4px",
    "md": "8px",
    "lg": "12px",
    "xl": "16px",
    "2xl": "20px",
    "full": "9999px"
  },
  "shadows": {
    "sm": "0 1px 2px rgba(0,0,0,0.05)",
    "md": "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
    "lg": "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)",
    "xl": "0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)",
    "card": "0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.08)",
    "card-hover": "0 8px 24px rgba(0,0,0,0.10), 0 0 1px rgba(0,0,0,0.08)"
  }
}
```

Save this as `packages/shared/src/theme/tokens.json` in your monorepo.

---

## 3. Tailwind Config (Web)

Extend Tailwind with the design tokens:

```typescript
// apps/web/tailwind.config.ts

import tokens from '@shared/theme/tokens.json'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: tokens.colors.primary,
        accent: tokens.colors.accent,
        highlight: tokens.colors.highlight,
        neutral: tokens.colors.neutral,
        success: tokens.colors.success,
        warning: tokens.colors.warning,
        error: tokens.colors.error,
        info: tokens.colors.info,
      },
      fontFamily: {
        sans: [tokens.typography.fontFamily.sans],
        display: [tokens.typography.fontFamily.display],
        mono: [tokens.typography.fontFamily.mono],
      },
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.shadows,
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

**Usage in components:**
```tsx
<button className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg px-6 py-3 font-semibold shadow-md hover:shadow-lg transition-all">
  Book Now
</button>

<div className="bg-accent-500 text-white rounded-full px-3 py-1 text-sm font-bold">
  ₹4,500
</div>

<span className="bg-highlight-50 text-highlight-700 rounded-md px-2 py-1 text-xs font-medium">
  Featured
</span>
```

---

## 4. React Native Theme (Mobile)

Same tokens, React Native format:

```typescript
// packages/shared/src/theme/theme.native.ts

import tokens from './tokens.json'

export const colors = tokens.colors

export const typography = {
  fontFamily: {
    sans: 'Inter',
    display: 'PlusJakartaSans',
    mono: 'JetBrainsMono',
  },
  fontSize: {
    xs: tokens.typography.fontSize.xs.mobile,
    sm: tokens.typography.fontSize.sm.mobile,
    base: tokens.typography.fontSize.base.mobile,
    lg: tokens.typography.fontSize.lg.mobile,
    xl: tokens.typography.fontSize.xl.mobile,
    '2xl': tokens.typography.fontSize['2xl'].mobile,
    '3xl': tokens.typography.fontSize['3xl'].mobile,
    '4xl': tokens.typography.fontSize['4xl'].mobile,
    '5xl': tokens.typography.fontSize['5xl'].mobile,
  },
  fontWeight: tokens.typography.fontWeight,
}

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
}

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
}

export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 5 },
  card: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
}
```

**Usage in React Native:**
```typescript
import { colors, typography, spacing, borderRadius, shadows } from '@shared/theme/theme.native'

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  buttonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.sans,
  },
  priceTag: {
    backgroundColor: colors.accent[500],
    color: colors.neutral[0],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
})
```

---

## 5. Typography System

### Font Pairing

| Role | Font | Weight | Where |
|------|------|--------|-------|
| **Display** (hero headings) | Plus Jakarta Sans | 700-800 | Landing page hero, section titles |
| **Body** (everything else) | Inter | 400-600 | All text, buttons, inputs, labels |
| **Mono** (codes, prices) | JetBrains Mono | 400-500 | Booking IDs, code snippets |

### Type Scale

| Name | Web Size | Mobile Size | Usage |
|------|----------|-------------|-------|
| `5xl` | 48px | 40px | Hero headline |
| `4xl` | 36px | 32px | Page titles |
| `3xl` | 30px | 28px | Section headings |
| `2xl` | 24px | 24px | Card titles |
| `xl` | 20px | 20px | Sub-headings |
| `lg` | 18px | 18px | Lead text |
| `base` | 16px | 16px | Body text, buttons |
| `sm` | 14px | 14px | Labels, captions |
| `xs` | 12px | 12px | Badges, timestamps |

### Usage Examples (Tailwind)

```tsx
{/* Hero heading */}
<h1 className="font-display text-5xl font-extrabold text-neutral-900">
  Compare Group Trips. Book Safely.
</h1>

{/* Section heading */}
<h2 className="font-display text-3xl font-bold text-neutral-800">
  Trending Trips This Weekend
</h2>

{/* Card title */}
<h3 className="text-xl font-semibold text-neutral-800">
  Goa Beach Getaway
</h3>

{/* Body text */}
<p className="text-base text-neutral-600">
  3 days, 2 nights — AC bus + 3★ hotel + all meals
</p>

{/* Caption */}
<span className="text-sm text-neutral-500">
  12 seats left • Starts Dec 6
</span>

{/* Badge */}
<span className="text-xs font-bold uppercase tracking-wide">
  Verified
</span>
```

---

## 6. Component Style Guide

### Buttons

| Variant | Tailwind Classes |
|---------|-----------------|
| **Primary** | `bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold rounded-lg px-6 py-3 shadow-md hover:shadow-lg transition-all` |
| **Secondary** | `bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold rounded-lg px-6 py-3 border border-primary-200 transition-all` |
| **Accent** | `bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-lg px-6 py-3 shadow-md transition-all` |
| **Ghost** | `bg-transparent hover:bg-neutral-100 text-neutral-700 font-medium rounded-lg px-4 py-2 transition-all` |
| **Disabled** | `bg-neutral-200 text-neutral-400 cursor-not-allowed rounded-lg px-6 py-3` |

**Sizes:**

| Size | Classes |
|------|---------|
| `sm` | `text-sm px-4 py-2 rounded-md` |
| `md` | `text-base px-6 py-3 rounded-lg` |
| `lg` | `text-lg px-8 py-4 rounded-xl` |

### Cards

```
Trip Card:
  bg-white rounded-xl shadow-card hover:shadow-card-hover 
  border border-neutral-100 overflow-hidden transition-all duration-200

Trip Card (selected for comparison):
  bg-white rounded-xl shadow-card-hover 
  ring-2 ring-primary-500 border border-primary-200 overflow-hidden

Dashboard Card:
  bg-white rounded-xl shadow-sm border border-neutral-200 p-6
```

### Inputs

```
Default:
  w-full rounded-lg border border-neutral-200 bg-neutral-50 
  px-4 py-3 text-base text-neutral-800 
  placeholder:text-neutral-400
  focus:border-primary-500 focus:ring-2 focus:ring-primary-100 
  focus:bg-white focus:outline-none transition-all

Error:
  border-error-500 focus:ring-error-100 bg-error-50

Disabled:
  bg-neutral-100 text-neutral-400 cursor-not-allowed
```

### Badges / Tags

| Type | Classes |
|------|---------|
| **Trip type** | `bg-primary-50 text-primary-700 rounded-full px-3 py-1 text-xs font-medium` |
| **Price** | `bg-accent-500 text-white rounded-full px-3 py-1 text-sm font-bold` |
| **Featured** | `bg-highlight-50 text-highlight-700 rounded-md px-2 py-1 text-xs font-semibold` |
| **Verified** | `bg-success-50 text-success-500 rounded-full px-2 py-0.5 text-xs font-medium` |
| **Seats left** | `bg-warning-50 text-warning-500 rounded-full px-2 py-0.5 text-xs font-medium` |
| **Cancelled** | `bg-error-50 text-error-500 rounded-full px-2 py-0.5 text-xs font-medium` |

### Star Rating

```tsx
{/* Filled star */}
<Star className="h-4 w-4 fill-warning-500 text-warning-500" />

{/* Empty star */}
<Star className="h-4 w-4 fill-neutral-200 text-neutral-200" />
```

### Compare Button (Trip Card Overlay)

The compare button sits on the trip card image, top-left. Two states:

```
Default (unselected):
  bg-white/90 backdrop-blur-sm text-neutral-600 rounded-md
  px-2 py-1 text-xs font-semibold shadow-sm
  hover:bg-white active:scale-90
  animation: animate-pulse-zoom (first render only)

Selected:
  bg-primary-500 text-white rounded-md
  px-2 py-1 text-xs font-semibold shadow-sm
  hover:bg-primary-600 active:scale-90
  animation: animate-pop (on select)
```

### Floating Compare Bar

Fixed bottom bar (z-40) shown when ≥1 trip is selected for comparison.

```
Container:
  fixed bottom-0 inset-x-0 z-40
  bg-white border-t border-neutral-200 shadow-xl
  animate-slide-up will-change-transform

Header row:
  bg-neutral-50 border-b border-neutral-100
  px-4 sm:px-6 py-2

Thumbnail grid:
  grid gap-2 sm:gap-4 (columns = maxItems + 1)
  Image: aspect-square max-w-20 sm:max-w-24 rounded-lg
  Title: text-xs font-medium text-neutral-700 line-clamp-2
  Price: text-xs sm:text-sm font-bold text-accent-500

Empty slot:
  aspect-square max-w-20 sm:max-w-24
  border-2 border-dashed border-neutral-200 rounded-lg

CTA:
  ≥2 trips  → .btn-accent text-sm uppercase tracking-wide
  <2 trips  → .btn-disabled text-sm
```

### Insight Badges (Compare Page)

```
Success variant:
  bg-success-50 border border-neutral-200 rounded-lg px-3 py-1.5
  Label: text-xs font-semibold text-success-500
  Value: text-xs font-medium text-neutral-700

Primary variant:
  bg-primary-50 border border-primary-200 rounded-lg px-3 py-1.5
  Label: text-xs font-semibold text-primary-600
  Value: text-xs font-medium text-neutral-700
```

### Winner Highlight (Comparison Table)

```
Winner cell: bg-success-50/60
Best Value / Best Rated label: text-xs text-success-500 font-medium
```

---

## 6b. Animation & Motion

### Registered Animations

All animations are registered in `tailwind.config.ts` under `theme.extend.keyframes` and `theme.extend.animation`. CSS fallbacks exist in `globals.css`.

| Utility Class | Keyframes | Duration | Easing | Use Case |
|---------------|-----------|----------|--------|----------|
| `animate-shimmer` | `shimmer` | 1.5s infinite | ease-in-out | Skeleton loading placeholders |
| `animate-spin` | `spin` | 0.8s infinite | linear | Spinner loaders |
| `animate-pulse-zoom` | `pulse-zoom` | 0.6s × 3 | ease-in-out (0.2s delay) | Compare button attention on first render |
| `animate-pop` | `pop` | 0.25s | cubic-bezier(0.34, 1.56, 0.64, 1) | Compare button selection bounce |
| `animate-slide-up` | `slide-up` | 0.3s | cubic-bezier(0.16, 1, 0.3, 1) | Subtle entrance — 24px upward translate + fade-in |
| `animate-fade-in` | `fade-in` | 0.2s | ease-out | Generic fade-in for overlays |

### GPU Acceleration

Add `will-change-transform` to any element with transform-based animations:

```
.compare-button → will-change-transform
.compare-bar    → will-change-transform
.skeleton       → will-change: background-position (in CSS)
.spinner        → will-change: transform (in CSS)
```

### Accessibility — prefers-reduced-motion

`globals.css` includes a global `@media (prefers-reduced-motion: reduce)` that sets:
- `animation-duration: 0.01ms`
- `transition-duration: 0.01ms`
- `scroll-behavior: auto`

**Never bypass this with inline styles.** All animations must go through CSS classes.

### Rules

1. **No arbitrary animation values** — register in `tailwind.config.ts`, fallback in `globals.css`.
2. **Keep animations ≤ 0.6s** — longer feels sluggish on mobile.
3. **Use spring/deceleration curves** — `cubic-bezier(0.34, 1.56, 0.64, 1)` for bounce, `cubic-bezier(0.16, 1, 0.3, 1)` for slide.
4. **Infinite animations only for loading indicators** — never for UI chrome.
5. **GPU-promote animated elements** — `will-change-transform` on transform animations.

---

## 7. Spacing Rules

### 4px Grid System

All spacing is a multiple of 4px. Never use arbitrary values.

| Use Case | Spacing Token | Value |
|----------|--------------|-------|
| Icon to text | `2` | 8px |
| Between inline elements | `2-3` | 8-12px |
| Input padding | `3-4` | 12-16px |
| Card internal padding | `4-6` | 16-24px |
| Between cards | `4-6` | 16-24px |
| Section padding | `8-12` | 32-48px |
| Page margin (mobile) | `4` | 16px |
| Page margin (desktop) | `6-8` | 24-32px |
| Between sections | `12-16` | 48-64px |

### Container Widths

```
Max content width: 1280px (max-w-7xl)
Card grid: 3 columns desktop, 2 tablet, 1 mobile
Sidebar: 280px fixed
Trip detail: 65% content / 35% booking sidebar
```

---

## 8. Dark Mode (Future-Ready)

Swap these values when `class="dark"` is applied:

| Token | Light | Dark |
|-------|-------|------|
| Page background | `neutral-50` (#F8FAFB) | `neutral-900` (#111827) |
| Card background | `neutral-0` (#FFFFFF) | `neutral-800` (#1F2937) |
| Primary text | `neutral-900` (#111827) | `neutral-50` (#F8FAFB) |
| Secondary text | `neutral-600` (#4E5A65) | `neutral-400` (#9AA5B1) |
| Borders | `neutral-200` (#E2E7EB) | `neutral-700` (#374151) |
| Input background | `neutral-50` (#F8FAFB) | `neutral-800` (#1F2937) |
| Primary color | `primary-500` (same) | `primary-400` (lighter) |
| Accent color | `accent-500` (same) | `accent-400` (lighter) |

**Tailwind dark mode classes:**
```tsx
<div className="bg-neutral-50 dark:bg-neutral-900">
  <h1 className="text-neutral-900 dark:text-neutral-50">Title</h1>
  <p className="text-neutral-600 dark:text-neutral-400">Body</p>
  <div className="bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
    Card content
  </div>
</div>
```

---

## 9. Loading, Empty & Error State Patterns

Every data-driven component must handle three states consistently across the app.

### Loading States

| Component | Pattern | Classes |
|-----------|---------|---------|
| **Full page** | Centered spinner | `flex items-center justify-center min-h-[50vh]` + animated spinner |
| **Card skeleton** | Shimmer placeholder | `.skeleton` class (shimmer gradient) |
| **Table skeleton** | Row placeholders | `.skeleton` class on cells |
| **Button loading** | Spinner inside button | Disable button + show spinner left of text |
| **Inline** | Small spinner | `h-4 w-4 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin` |

```
Skeleton Card:
  rounded-xl overflow-hidden
  ┌──────────────────────────┐
  │ ████████████████████████ │  ← .skeleton h-48 (shimmer gradient)
  │                          │
  │ ████████████             │  ← .skeleton h-4 w-3/4
  │ ████████                 │  ← .skeleton h-4 w-1/2
  │                          │
  │ ██████  ████████████████ │  ← .skeleton h-8 w-24
  └──────────────────────────┘
```

### Empty States

| Context | Icon | Message | Action |
|---------|------|---------|--------|
| **No search results** | 🔍 | "No trips found for your search" | "Clear filters" button |
| **No bookings** | 🏝️ | "No bookings yet. Time to explore!" | "Browse Trips" button |
| **No reviews** | ✍️ | "No reviews yet. Be the first!" | — |
| **No messages** | 💬 | "No conversations yet" | — |
| **No trips (organizer)** | 📋 | "You haven't created any trips yet" | "Create Your First Trip" button |

```
Empty State:
  flex flex-col items-center justify-center py-16 gap-4
  ┌──────────────────────────────┐
  │                              │
  │           🏝️ (text-5xl)     │
  │                              │
  │    "No bookings yet."        │  ← text-neutral-900 font-semibold text-lg
  │    "Time to explore!"        │  ← text-neutral-500 text-sm
  │                              │
  │      [ Browse Trips ]        │  ← btn-primary or btn-secondary
  │                              │
  └──────────────────────────────┘
```

### Error States

| Context | Icon | Message | Action |
|---------|------|---------|--------|
| **API failure** | 😕 | "Failed to load. Please try again." | "Retry" button |
| **Network offline** | 📡 | "You're offline. Check your connection." | "Retry" button |
| **Page not found** | 🗺️ | "This page doesn't exist." | "Go Home" button |
| **Permission denied** | 🔒 | "You don't have access to this page." | "Go to Dashboard" button |
| **Component crash** | 😵 | "Something went wrong in this section." | "Try Again" button |

```
Error State (inline):
  p-6 rounded-xl bg-error-50 border border-error-200 text-center
  ┌──────────────────────────────┐
  │           😕 (text-4xl)     │
  │                              │
  │    "Failed to load trips"    │  ← text-neutral-800 font-semibold
  │    "This is probably temp."  │  ← text-neutral-500 text-sm
  │                              │
  │       [ Try Again ]          │  ← text-primary-600 font-medium
  │                              │
  └──────────────────────────────┘

Error State (full page):
  flex flex-col items-center justify-center min-h-[50vh] gap-4
  Same content but centered in page
```

### Usage Rule

```
EVERY data-fetching component MUST follow this pattern:

if (isLoading) return <LoadingSkeleton />     // Skeleton matching component shape
if (error)     return <ErrorState onRetry />   // With retry button
if (!data)     return <EmptyState />           // With relevant action
return         <ActualComponent data={data} /> // Happy path
```

---

## 10. Quick Reference — Tailwind Class Cheat Sheet

### Most Used Classes in This App

```
BACKGROUNDS:
  Page:     bg-neutral-50
  Card:     bg-white
  Input:    bg-neutral-50 focus:bg-white
  Primary:  bg-primary-500
  Accent:   bg-accent-500
  Muted:    bg-neutral-100

TEXT:
  Heading:    text-neutral-900 font-display font-bold
  Body:       text-neutral-600
  Secondary:  text-neutral-500
  Link:       text-primary-600 hover:text-primary-700
  Price:      text-accent-500 font-bold
  Error:      text-error-500

BORDERS:
  Default:  border border-neutral-200
  Focus:    focus:border-primary-500 focus:ring-2 focus:ring-primary-100
  Active:   ring-2 ring-primary-500

SHADOWS:
  Card:     shadow-card hover:shadow-card-hover
  Button:   shadow-md hover:shadow-lg
  Modal:    shadow-xl

RADIUS:
  Button:   rounded-lg (12px)
  Card:     rounded-xl (16px)
  Badge:    rounded-full
  Input:    rounded-lg (12px)

TRANSITIONS:
  Default:  transition-all duration-200
  Colors:   transition-colors duration-150
```

---

## 11. File Structure for Design System

```
packages/
  shared/
    src/
      theme/
        tokens.json           ← Single source of truth (colors, spacing, etc.)
        theme.native.ts       ← React Native theme derived from tokens
        index.ts              ← Re-exports for easy imports

apps/
  web/
    tailwind.config.ts        ← Imports tokens.json, extends Tailwind
    src/
      styles/
        globals.css           ← Base styles, font imports, CSS custom properties
```

### globals.css (Base Web Styles)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

@layer base {
  :root {
    --color-primary: 15 186 181;       /* primary-500 in RGB */
    --color-accent: 255 79 51;         /* accent-500 in RGB */
    --color-highlight: 124 77 255;     /* highlight-500 in RGB */
  }

  body {
    @apply bg-neutral-50 text-neutral-800 font-sans antialiased;
  }

  h1, h2, h3 {
    @apply font-display;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary-500 hover:bg-primary-600 active:bg-primary-700
           text-white font-semibold rounded-lg px-6 py-3
           shadow-md hover:shadow-lg transition-all duration-200;
  }

  .btn-secondary {
    @apply bg-primary-50 hover:bg-primary-100
           text-primary-700 font-semibold rounded-lg px-6 py-3
           border border-primary-200 transition-all duration-200;
  }

  .btn-accent {
    @apply bg-accent-500 hover:bg-accent-600 active:bg-accent-700
           text-white font-semibold rounded-lg px-6 py-3
           shadow-md hover:shadow-lg transition-all duration-200;
  }

  .card {
    @apply bg-white rounded-xl shadow-card hover:shadow-card-hover
           border border-neutral-100 overflow-hidden transition-all duration-200;
  }

  .input {
    @apply w-full rounded-lg border border-neutral-200 bg-neutral-50
           px-4 py-3 text-base text-neutral-800
           placeholder:text-neutral-400
           focus:border-primary-500 focus:ring-2 focus:ring-primary-100
           focus:bg-white focus:outline-none transition-all;
  }

  .badge {
    @apply inline-flex items-center rounded-full px-2.5 py-0.5
           text-xs font-medium;
  }

  .badge-primary { @apply bg-primary-50 text-primary-700; }
  .badge-accent { @apply bg-accent-50 text-accent-700; }
  .badge-success { @apply bg-success-50 text-success-500; }
  .badge-warning { @apply bg-warning-50 text-warning-500; }
  .badge-error { @apply bg-error-50 text-error-500; }

  .skeleton {
    @apply rounded-lg;
    background: linear-gradient(90deg, theme('colors.neutral.100') 25%, theme('colors.neutral.200') 50%, theme('colors.neutral.100') 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    will-change: background-position;
  }

  .spinner {
    @apply inline-block rounded-full;
    border: 4px solid theme('colors.primary.100');
    border-top-color: theme('colors.primary.500');
    animation: spin 0.8s linear infinite;
    will-change: transform;
  }
}

/* Keyframes (CSS fallback — also in tailwind.config.ts) */
@keyframes shimmer   { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
@keyframes spin      { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
@keyframes pulse-zoom { 0%,100% { transform: scale(1) } 50% { transform: scale(1.18) } }
@keyframes pop       { 0% { transform: scale(1) } 50% { transform: scale(1.15) } 100% { transform: scale(1) } }
@keyframes slide-up  { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
@keyframes fade-in   { from { opacity: 0 } to { opacity: 1 } }

.animate-pulse-zoom { animation: pulse-zoom 0.6s ease-in-out 0.2s 3; }
.animate-pop        { animation: pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.animate-slide-up   { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.animate-fade-in    { animation: fade-in 0.2s ease-out; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@layer utilities {
  .will-change-transform { will-change: transform; }
}
```

---

---

## 12. Dark Mode (Phase 2)

> Dark mode is **not included in MVP**. Tailwind config includes `darkMode: 'class'` for future use.
> When implemented, dark mode tokens will be added to `tokens.json` under a `dark` key and consumed via CSS custom properties.
> Do NOT add `dark:` variants to components until the dark token set is finalized.

---

## 13. Responsive Breakpoints

The target audience is Gen-Z — **mobile-first design is critical**.

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Mobile landscape, small tablets |
| `md` | 768px | Tablet portrait |
| `lg` | 1024px | Tablet landscape, small desktop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

### Mobile-First UI Rule (MANDATORY)

Every component and page **MUST** be designed mobile-first:
1. Write mobile styles as the **default** (no breakpoint prefix).
2. Use `sm:`, `md:`, `lg:` prefixes to **enhance** for larger screens.
3. Never build desktop-first and then "fix" mobile — always start with the smallest screen.
4. Tables on mobile → convert to **stacked cards** (one card per item, label–value rows inside).
5. Side-by-side layouts on mobile → stack vertically with `flex-col` → `md:flex-row`.
6. Test every page at 375px width before considering it done.

**Mobile-specific behaviors:**
- Trip listing: Vertical single-column cards (not grid)
- Trip comparison: Stacked trip cards on mobile, side-by-side table on `md+`
- Trip detail: Booking sidebar becomes bottom sheet (sticky CTA at bottom)
- Chat: Full-screen overlay on mobile
- Filters: Slide-up drawer instead of inline sidebar
- Navigation: Bottom tab bar on mobile, top nav on desktop

---

*This design system is a living document. Update tokens.json and all platforms update automatically. When adding a new color or spacing value, always add it to tokens.json first, never hardcode it in a component.*
