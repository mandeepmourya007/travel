# Micro-interactions & Motion

Purpose: **feedback, continuity, hierarchy** — not decoration.

## Timing scale (use the existing Tailwind utilities — don't invent new ones)

All defined in `apps/web/tailwind.config.ts` + `apps/web/src/app/globals.css`:

| Interaction | Utility | Duration | Easing |
| ----------- | ------- | -------- | ------ |
| Hover (card/link/row) | `transition-colors duration-150` / `duration-200` | 150–200ms | default ease |
| Card lift on hover | `.card` (built-in `hover:shadow-card-hover transition-all duration-200`) | 200ms | ease |
| Button press | shadcn `Button` built-in states; `.btn-*` classes use `transition-all duration-200` | 200ms | ease |
| Modal/dialog/sheet open | shadcn `Dialog`/`Sheet` (Radix) default transitions | ~200ms | Radix default |
| Toast exit | `animate-toast-exit` | 200ms | `ease-in` |
| Accordion expand/collapse | `animate-accordion-down` / `animate-accordion-up` | 200ms | `ease-out` |
| Slide up (bottom sheet / mobile nav reveal) | `animate-slide-up` | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Slide down | `animate-slide-down` | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Route/page enter | `animate-page-enter` (also see `page-transition.tsx`) | 350ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Fade in | `animate-fade-in` | 200ms | `ease-out` |
| Success/delight pop (e.g. favorite, first booking) | `animate-pop` | 250ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Image zoom emphasis (hero/card imagery) | `animate-pulse-zoom` | 600ms ×3 | `ease-in-out` |
| Form field error shake | `animate-shake` | 400ms | `ease-in-out` |
| Skeleton shimmer | `.skeleton` (`animate-shimmer`, built in) | 1.5s loop | `ease-in-out` |

**Animate only** `transform`, `opacity`, `box-shadow`, `border-color`, `background-position` (shimmer). Never animate `width`, `height`, `top`, `margin` (the accordion keyframes animate `height` against a Radix CSS var, which is the one sanctioned exception since Radix drives it).

## Hover patterns (every interactive element)

```tsx
// Card — use the existing utility class, don't hand-roll shadow/translate values
className = "card" // hover lift + shadow built in

// List row
className = "transition-colors duration-150 hover:bg-neutral-50"

// Link
className = "text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline"

// Ghost/outline button — shadcn Button variant already wires hover state; don't add ad-hoc hover classes on top
<Button variant="ghost">...</Button>
```

**Active press:** shadcn `Button` and `.btn-primary`/`.btn-accent` etc. already define `active:` states (`active:bg-primary-700`) — reuse them rather than adding `active:scale-[...]` on top unless the task specifically calls for a press-scale delight moment (reserve for first-run/rare actions, see below).

## Focus (non-negotiable)

Radix-based primitives (`ui/*`) and native `input`/`.input` already ship visible focus rings (`focus:ring-2 focus:ring-primary-100`, Radix `focus-visible` defaults). Never remove or override focus styles. Icon-only buttons need `aria-label`.

## Reduced motion

`globals.css` already collapses all animation/transition durations to `0.01ms` under `prefers-reduced-motion: reduce`. Do not add looping decorative animation that bypasses this (no inline `!important` overrides). Essential progress indicators (`.spinner`) may remain functionally visible.

## When to animate vs not

| Animate | Skip |
| ------- | ---- |
| Button press feedback, toggle state | Page load hero reveals beyond one `animate-page-enter` |
| Hover/focus transitions on cards, rows, links | Parallax, floating background shapes |
| Dialog/Sheet/dropdown enter/exit (Radix defaults) | Looping ambient motion |
| Toast arrival/exit | Stagger on every list/grid item |
| `animate-page-enter` once per route navigation | Animation on table/list row hover for 50+ rows |
| `animate-pop`/`animate-pulse-zoom` for rare milestones (first trip booked, wishlist add) | Delight on every save click |
| Skeleton shimmer (loading) | Decorative rotating loading copy |

**Rules:**

1. If you cannot state the animation's job in one sentence, remove it.
2. Delight (`animate-pop`, `animate-pulse-zoom`) is for **first-run/rare** moments (empty states, first booking, wishlist) — not routine dashboard workflows (admin tables, payment lists).
3. Frequency kills delight — animate state changes, not chrome.
4. When unsure, skip — no animation beats bad animation.
5. Honor `prefers-reduced-motion` — already global; don't override with inline `!important`.
