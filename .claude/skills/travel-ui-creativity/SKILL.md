---
name: travel-ui-creativity
description: >-
  UI/UX creativity and polish patterns for Safarnama/TripCompare frontend agents. Use when
  building or improving pages, components, empty/loading/error states, micro-interactions,
  typography, spacing, or visual hierarchy in apps/web/src/.
paths:
  - apps/web/src/**
---

# Travel UI Creativity

**Read first:** [travel-ui-stack](../travel-ui-stack/SKILL.md) (tokens, primitives, archetypes, pre-flight, verification loop).

This skill teaches agents how to make Safarnama/TripCompare feel **premium like Linear/Vercel/Stripe** while staying true to its own visual identity — a **warm, trustworthy travel marketplace**: teal `primary` as the brand color, coral `accent` for secondary CTAs and highlights, violet `highlight` reserved for rare emphasis, Plus Jakarta Sans display headings over Inter body text, generous `rounded-xl`/`rounded-lg` corners and soft `shadow-card` elevation (see `packages/shared/src/theme/tokens.json`, `apps/web/src/app/globals.css`). This is not oprag's indigo-on-warm-paper SaaS dashboard — don't carry that palette over.

**Visual language:** minimal precision applied to a friendly, human marketplace — not a cold enterprise console. Design by subtraction still applies: one primary action per view, clear hierarchy, no decorative noise. Avoid glassmorphism-as-layout, neumorphism, brutalism, and neobrutalism on both dashboard surfaces (admin/organizer) and public/marketing surfaces.

---

## Core design principles (always apply)

Apply these before adding any visual detail. When in doubt, remove rather than add.

| Principle | Rule for agents |
| --------- | ---------------- |
| **Hierarchy** | One primary action per view. Most important number/CTA top-left or top-of-card. Use `font-display` weight, size, and `text-neutral-900` vs `text-neutral-500` — not more boxes. |
| **Whitespace** | Whitespace is grouping signal. Prefer `gap-6`/`space-y-8` between sections over cramming; `p-4`/`p-6` inside `.card`/`.card-static`. Max 5–7 primary elements per screen. |
| **Contrast** | High foreground/background contrast (`text-neutral-900` on `bg-white`/`bg-neutral-50`). `primary`/`accent` colors only on interactive or emphasis elements (buttons, active tabs, badges) — not decoration. |
| **Feedback** | Every click, submit, toggle, and async action gets visible acknowledgment within 100ms — button `loading` state, toast (`@/components/shared/toast`), or inline row update. |
| **Consistency** | Reuse primitives from [travel-ui-stack](../travel-ui-stack/SKILL.md#component-primitives-use-existing-dont-recreate) and the archetype header pattern. Same hover duration, same card pattern, same empty-state anatomy everywhere. |
| **Progressive disclosure** | Show the common case first (e.g. trip search filters collapsed to essentials); advanced options behind "More filters", tabs, or a `Dialog`/`Sheet`. |
| **Accessibility-first** | WCAG 2.2 AA is the creative brief, not a ceiling. Visible focus rings, real `<label htmlFor>`, semantic heading order — not gray-on-gray "safe" defaults that also fail contrast. |

**60-30-10 color rule:** ~60% neutral surfaces (`bg-white`/`bg-neutral-50`, `text-neutral-900`/`700`/`500`), ~30% secondary UI (`neutral-100`/`200` borders, muted badges), ~10% brand color for CTAs and active/selected states (`primary-500` mainly, `accent-500` for secondary emphasis, `highlight` sparingly).

---

## Reference docs (read as needed)

| Topic | File |
| ----- | ---- |
| 5-state completeness, empty/loading/error/success/disabled, skeleton a11y | [references/states.md](references/states.md) |
| Micro-interaction timing, hover/focus, when to animate, reduced motion | [references/motion.md](references/motion.md) |
| Type scale, spacing rhythm, 8px grid | [references/typography.md](references/typography.md) |
| Linear/Stripe/Vercel patterns, trust signals, anti-patterns | [references/inspiration.md](references/inspiration.md) |
| Single-column forms, inline validation, undo-over-confirm, autocomplete | [references/forms.md](references/forms.md) |

---

## Agent workflow (build or polish)

1. Complete [travel-ui-stack pre-flight](../travel-ui-stack/SKILL.md#pre-flight-before-editing) checklist.
2. Read this skill + target page file; identify the route group and page archetype (Public/Marketing / Traveler Dashboard / Organizer Dashboard / Admin / Trip Discovery-Detail).
3. Audit against [state completeness](references/states.md) — all five states planned, using real primitives (`EmptyState`, `ErrorState`, `Spinner`, feature `<Name>Skeleton`, `loading.tsx`/`error.tsx`).
4. Fix hierarchy and spacing ([typography](references/typography.md)) before adding motion.
5. Add micro-interactions only where [motion rules](references/motion.md) allow — reuse the existing `animate-*` utilities in `tailwind.config.ts`/`globals.css` rather than inventing new keyframes.
6. Run the **mandatory** visual verification loop from [travel-ui-stack](../travel-ui-stack/SKILL.md#visual-verification-mandatory).
7. Run [travel-ui-audit](../travel-ui-audit/SKILL.md) review pass before marking done.
8. `cd apps/web && npm run type-check`.

---

## Related skills

| Skill | When |
| ----- | ---- |
| [travel-ui-stack](../travel-ui-stack/SKILL.md) | Tokens, primitives, archetypes, pre-flight, verification loop |
| [travel-ui-audit](../travel-ui-audit/SKILL.md) | Scored review pass before marking done |
| [web-design-guidelines](../web-design-guidelines/SKILL.md) | Complementary a11y/UX audit |
