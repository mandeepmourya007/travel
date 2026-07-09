---
name: travel-ui-audit
description: >-
  Scored UI/UX audit checklist for Safarnama/TripCompare pages under apps/web/src/.
  Use as a final review pass after building or polishing a page/component — separate
  from implementation. Outputs file:line findings with Tier 1/2/3 classification and
  a 0-100 score.
paths:
  - apps/web/src/**
---

# Travel UI Audit

**Purpose:** Final review pass after implementation. Do **not** mix audit with build — finish coding first, then run this checklist.

**Prerequisites:** Read [travel-ui-stack](../travel-ui-stack/SKILL.md) (tokens/primitives conventions) while building, and `apps/web/CLAUDE.md` for the route-group/primitive map. Complete visual verification with [travel-local-visual-review](../travel-local-visual-review/SKILL.md) before or alongside auditing.

---

## Workflow

### Phase 1 — Build (separate pass)

Implement using [travel-ui-stack](../travel-ui-stack/SKILL.md) conventions. Run `npm run type-check` and the local visual review.

### Phase 2 — Review (this skill)

1. Read every file in scope (page, sub-components, the `loading.tsx`/`error.tsx` siblings for that route segment, related nav/sidebar entries)
2. Walk the checklist below; record each finding in `file:line` format
3. Classify findings as Tier 1 / 2 / 3
4. Compute score (see scoring rubric)
5. Output audit report (template below)

Optional: run [web-design-guidelines](../web-design-guidelines/SKILL.md) for complementary a11y rules from Vercel's live guideline fetch.

---

## Checklist

### Tier 1 — Quick wins (must fix before done)

Each item is −5 points if failed.

- [ ] **Route-level loading** — the route segment has a `loading.tsx` sibling (Next.js file convention) rather than manual `isLoading` branching for a whole-page load; see `app/admin/payments/loading.tsx` for the pattern
- [ ] **Route-level error** — the route segment has an `error.tsx` sibling; in-page section errors use `ErrorState` from `@/components/shared/data-states` with `onRetry` wired to `refetch()`
- [ ] **Empty state** — uses `EmptyState` from `@/components/shared/data-states` with a real `message` + `action` when it's not a dead end; never a bare `<p>No data</p>`; never shown while `isLoading` is still true
- [ ] **List/grid skeleton over spinner** — lists/grids/cards use a content-shaped `<Feature>Skeleton` (see `trip-card-skeleton.tsx`, `profile-skeleton.tsx`, `admin/chart-skeletons.tsx`) rather than a raw `<Spinner />`; `Spinner`/`FullScreenLoader` are reserved for full-page blocking loads (e.g. payment redirect) or auth hydration gates
- [ ] **Mutation pending state** — buttons that trigger a mutation pass `disabled={isPending}` and show a `Spinner` or built-in `Button` loading affordance; no silent double-submit
- [ ] **Success feedback** — mutations show a toast (`@/components/shared/toast`) or inline confirmation, not a silent refetch
- [ ] **Tokens only** — no arbitrary hex or `text-[#…]`/`bg-[#…]`; only semantic Tailwind classes from `packages/shared/src/theme/tokens.json` (`text-neutral-900`, `bg-primary-400`, `bg-error-50`, `border-error-200`, `font-display`)
- [ ] **No magic strings** — sort/status/filter/role literals come from `packages/shared/src/constants/` or the `QK` object in `apps/web/src/lib/query-keys.ts`, never inlined (per root `CLAUDE.md`)
- [ ] **Query keys via `QK`/key factories** — no raw `useQuery({ queryKey: ['bookings', id] })`; must use the typed key factories (`bookingKeys.detail(id)`, etc.) from `query-keys.ts`
- [ ] **Icon-only buttons labeled** — `aria-label` + (where relevant) `title` on icon-only `<button>`/`IconButton` usage
- [ ] **Focus visible** — no `outline-none` without a replacement focus ring; keyboard tab order matches visual order
- [ ] **Role gating via `RoleGuard`** — admin/organizer-only UI wrapped with `role-guard.tsx`, not an ad-hoc `if (user.role === ...)` scattered in JSX

### Tier 2 — Medium (fix if in scope; backlog otherwise)

Each item is −3 points if failed.

- [ ] **Hierarchy** — title/body/meta text differentiated by weight/color (`font-display` for headings, `text-neutral-500` for meta), not all one size/weight
- [ ] **Spacing rhythm** — consistent Tailwind spacing scale (`p-4`, `gap-6`, …); no arbitrary `p-[13px]`
- [ ] **Hover/interactive states** — clickable rows/cards have a hover treatment (`hover:bg-neutral-50`, `hover:shadow-md`, etc.) and clear disabled styling
- [ ] **Responsive** — usable at mobile width (see `mobile-bottom-nav.tsx` pattern for traveler routes); tables collapse to cards or scroll horizontally rather than overflowing the viewport
- [ ] **Form validation** — React Hook Form + Zod schema imported from `packages/shared/src/validators/` (not a redeclared parallel shape); inline field errors, input preserved on error
- [ ] **Motion restraint** — animations use the existing utility classes (`animate-fade-in`, `animate-slide-up`, etc. from `globals.css`) not new ad-hoc keyframes; durations feel ≤300ms; respects the `prefers-reduced-motion` block in `globals.css`
- [ ] **Pagination / search** — long lists use `Pagination` (`@/components/shared/pagination.tsx`) and, where filterable, a documented filter/search pattern — not unbounded client-side lists
- [ ] **`AuthGuard`/`RoleGuard` present on gated routes** — private route segments set `robots: { index: false, follow: false }` in their layout `metadata` per `Web Frontend.md` SEO conventions

### Tier 3 — Strategic (backlog only unless explicitly requested)

Each item is −2 points if failed.

- [ ] **Information architecture** — primary action reachable in ≤2 clicks from the relevant dashboard/sidebar entry point
- [ ] **Progressive disclosure** — advanced/rare options behind tabs, accordions, or modals rather than cluttering the primary view
- [ ] **First-run delight** — empty states teach the feature (e.g. "no trips yet" links to trip discovery) rather than being a dead end
- [ ] **Tabular alignment** — `tabular-nums` on price/wallet/commission columns so figures align
- [ ] **No dead ends** — every `EmptyState`/`ErrorState` CTA leads to a real, working flow (trip discovery, retry, support chat), not a `#` link

---

## Scoring rubric

| Score  | Meaning                                                          |
| ------ | ---------------------------------------------------------------- |
| 90–100 | Ship-ready — Tier 1 clear, at most minor Tier 2 notes            |
| 75–89  | Acceptable — Tier 1 clear, Tier 2 items documented as backlog    |
| 60–74  | Needs work — Tier 1 failures remain or multiple Tier 2 blockers  |
| < 60   | Not ready — missing states, wrong archetype, or token violations |

**Formula:** Start at 100. Subtract per failed item (−5 Tier 1, −3 Tier 2, −2 Tier 3). Minimum 0.

---

## Finding format (required)

Use terse `file:line` output — one finding per line:

```
apps/web/src/app/my-bookings/page.tsx:42       [Tier 1] Missing EmptyState — renders blank div when bookings.length === 0
apps/web/src/app/dashboard/trips/page.tsx:18   [Tier 1] Raw Spinner in a list instead of TripCardSkeleton
apps/web/src/components/trips/trip-form/step-pricing.tsx:67  [Tier 2] No inline validation on earlyBirdPrice field
apps/web/src/app/wallet/page.tsx:1              [Tier 3] IA — cashback history buried two tabs deep
```

Severity prefix: `[Tier 1]`, `[Tier 2]`, or `[Tier 3]`.

---

## Audit report template

```markdown
## UI Audit — [Page/Feature Name]

**Score:** [0-100] — [Ship-ready | Acceptable | Needs work | Not ready]
**Files reviewed:** [list]

### Tier 1 findings

- file:line — description (or "None")

### Tier 2 findings

- file:line — description (or "None")

### Tier 3 backlog

- file:line — description (or "None")

### Visual verification

- [ ] Dev server route visited (`npm run dev` in `apps/web`)
- [ ] Screenshot/snapshot taken (desktop + mobile)
- [ ] `npm run type-check` passed
```

---

## When to re-audit

Re-run after any Tier 1 fix. Tier 2/3 fixes can batch before re-score if the user accepts backlog items.
