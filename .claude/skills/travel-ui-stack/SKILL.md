---
name: travel-ui-stack
description: >-
  Safarnama/TripCompare frontend design system enforcement — tokens, primitives, page
  archetypes, pre-flight checklist, and mandatory visual verification. Use when building
  or editing components/pages in apps/web/src/.
paths:
  - apps/web/src/**
---

# Travel UI Stack

Use this skill whenever building or editing frontend components in `apps/web/src/` (Next.js 15 App Router + React 19 + Tailwind + shadcn/ui + TanStack Query + Zustand).

---

## Pre-flight (before editing)

Copy and complete before writing any UI code:

```
Pre-flight:
- [ ] Tokens from packages/shared/src/theme/tokens.json / tailwind.config.ts only — no arbitrary hex
- [ ] Primitive from @/components/ui/*, @/components/shared/*, or @/components/dashboard/* — no new one-offs
- [ ] Route group + page archetype identified (Public/Marketing / Traveler Dashboard / Organizer Dashboard / Admin / Trip Discovery-Detail)
- [ ] All 5 states planned (empty / loading / error / success / disabled) — prefer loading.tsx/error.tsx over manual branching
- [ ] Query keys come from QK / *Keys objects in apps/web/src/lib/query-keys.ts — no inline string arrays
- [ ] Dev server route known for verify (apps/web, npm run dev, default port 3000)
```

If any box is unchecked, read the relevant section below before proceeding. See also root `CLAUDE.md` "No Magic Strings" rule and `apps/web/CLAUDE.md`.

---

## Design tokens (Tailwind — never use arbitrary hex values)

Source of truth: `packages/shared/src/theme/tokens.json`, wired into `apps/web/tailwind.config.ts`. Do not invent new colors or hardcode hex — extend `tokens.json` if a genuinely new value is needed (and update both `apps/web/CLAUDE.md` design-tokens line and `docs/codebase/Web Frontend.md` if you do).

**Color scales:** `primary` (teal, brand), `accent` (coral/orange, secondary CTA), `highlight` (violet), `neutral` (grays), `success`, `warning`, `error`, `info` — each `50`–`900` (or `50/100/200/300/500/600/700` for status colors). Common usage seen across the app: `text-neutral-900` (headings), `text-neutral-500`/`text-neutral-700` (body/secondary), `bg-primary-500`/`bg-primary-600` (primary actions), `bg-error-50`/`border-error-200`/`text-error-500` (error surfaces), `bg-neutral-50` (page background).

**Fonts:** `font-sans` (Inter, body), `font-display` (Plus Jakarta Sans, headings — `h1`/`h2`/`h3` get it automatically via `globals.css`), `font-mono` (JetBrains Mono). Loaded via `next/font/google` in `apps/web/src/app/layout.tsx`.

**Component classes** (Tailwind `@layer components` in `apps/web/src/app/globals.css`) — prefer these over rebuilding the same look with raw utilities:
- Buttons: `.btn-primary`, `.btn-secondary`, `.btn-accent`, `.btn-ghost`, `.btn-outline`, `.btn-danger`, `.btn-disabled` — but for interactive buttons prefer the shadcn `Button` primitive (`@/components/ui/button`) with its `variant` prop over raw classes; these classes are for legacy/marketing markup and quick static CTAs.
- Surfaces: `.card` (hover-lift), `.card-static` (no hover), both `bg-white rounded-xl shadow-card border border-neutral-100`.
- Forms: `.label`, `.input`, `.otp-input`.
- Badges: `.badge` + `.badge-primary` / `.badge-accent` / `.badge-success` / `.badge-warning` / `.badge-error` / `.badge-info` / `.badge-neutral`.
- Loading: `.skeleton` (shimmer bar), `.spinner` + `.spinner-sm`/`.spinner-md`/`.spinner-lg`.

**Motion utilities** (Tailwind config + `globals.css` keyframes): `animate-fade-in`, `animate-page-enter`, `animate-slide-up`, `animate-slide-down`, `animate-pop`, `animate-pulse-zoom`, `animate-shake`, `animate-toast-exit`, `animate-shimmer`, `animate-accordion-down`/`up`. `prefers-reduced-motion` is globally handled in `globals.css` — do not override it.

Never use arbitrary colors like `bg-[#fff]` or `text-[#333]`.

---

## Component primitives (use existing, don't recreate)

**shadcn/ui primitives** — `apps/web/src/components/ui/` (lowercase-kebab filenames, `new-york` style): `accordion`, `alert-dialog`, `avatar`, `badge`, `button`, `calendar`, `card`, `carousel`, `checkbox`, `command`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `progress`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `slider`, `switch`, `table`, `tabs`, `textarea`, `tooltip`. Need one that isn't listed? Run the shadcn CLI to add it — don't hand-roll.

**Shared app-level primitives** — `apps/web/src/components/shared/`:
- States: `EmptyState`, `ErrorState` (`data-states.tsx`, pass `onRetry` to `ErrorState`), `Spinner` (`spinner.tsx`, sizes `sm`/`md`/`lg`), `FullScreenLoader` (`full-screen-loader.tsx`, driven by `useLoadingStore`), `fetching-overlay.tsx`, `dismiss-loader.tsx`, `server-down-banner.tsx`.
- Overlays: `modal.tsx`, `toast.tsx`, `tooltip.tsx`, `image-lightbox.tsx`.
- Forms/inputs: `date-picker.tsx`, `date-range-picker.tsx`, `date-time-picker.tsx`, `time-picker.tsx`, `email-input.tsx`, `phone-input.tsx`, `number-input.tsx`, `price-range-slider.tsx`, `search-combobox.tsx`, `trip-search-combobox.tsx`, `star-rating.tsx`/`star-rating-input.tsx`.
- Navigation/structure: `pagination.tsx`, `tabs.tsx`, `alert.tsx`, `blur-image.tsx`, `avatar.tsx`.
- Guards: `auth-guard.tsx`, `role-guard.tsx`, `login-required-dialog.tsx` — wrap gated UI with these, never an ad-hoc `if (user.role === ...)`.
- Misc: `page-transition.tsx`, `route-progress.tsx`, `socket-connector.tsx`.

**Dashboard primitives** — `apps/web/src/components/dashboard/`: `stat-card.tsx` (`StatCard` + `StatCardSkeleton`), `dashboard-sidebar.tsx`, `dashboard-alerts.tsx`, `trip-list-card.tsx`, `bank-account-form.tsx`, `organizer-review-card.tsx`, `verification-banner.tsx`.

**Layout chrome** — `apps/web/src/components/layout/`: `header.tsx` (`Header`, used across marketing, dashboard, admin), `footer.tsx`, `app-shell.tsx`, `mobile-bottom-nav.tsx`. The admin sidebar lives separately at `apps/web/src/components/admin/admin-sidebar.tsx` (not under `layout/`).

**Feature-local skeletons** (co-located with the feature, not a generic spinner): `apps/web/src/components/trips/trip-card-skeleton.tsx`, `apps/web/src/components/profile/profile-skeleton.tsx`, `apps/web/src/components/admin/chart-skeletons.tsx`. Add a sibling `<Feature>Skeleton` next to any new list/grid component rather than reaching for `Spinner`.

Import from `@/components/ui/<name>`, `@/components/shared/<name>`, `@/components/dashboard/<name>`, `@/components/<feature>/<name>`. Never build a new primitive unless the task explicitly requires one not covered above — check `apps/web/src/components/` first with a grep.

---

## Page archetypes — pick one for every page

This codebase has **no shared `PageHeader`/`AppPageHeader` component** — every page currently rolls its own `<h1 className="font-display text-2xl font-bold text-neutral-900">...</h1>` (confirmed by grepping `apps/web/src/app`). Treat that `<h1>` pattern as the de-facto header convention until/unless a shared header primitive is introduced; don't invent one unilaterally — flag it to `travel-ui-ux-engineer`/`travel-designer` if a page needs a materially different header.

Route groups map to archetypes (see `apps/web/CLAUDE.md`):

| Archetype | Route group(s) | Header pattern | Layout | Examples |
| --------- | -------------- | --------------- | ------ | -------- |
| **Public / Marketing** | `app/(public)/`, `app/page.tsx`, `app/destinations/` | Hero `<h1 className="font-display text-2xl sm:text-3xl font-bold ...">` inside a centered/wide container, no sidebar | Static sections, `Header` layout chrome only | Home, About, FAQ, Destinations |
| **Traveler Dashboard** | `app/(dashboard)/`, `app/my-bookings/`, `app/my-payments/`, `app/my-reviews/`, `app/wallet/`, `app/profile/` | `<h1 className="font-display text-xl md:text-2xl font-bold text-neutral-900">` at top of `<main>` | `Header` + content column, `AuthGuard` wraps route | Notifications, My Bookings, Wallet, Profile |
| **Organizer Dashboard** | `app/dashboard/` | Same `<h1>` pattern, page-specific title | `Header` + `DashboardSidebar` + `DashboardAlerts` + `MobileBottomNav`, gated by `AuthGuard` + `RoleGuard(['ORGANIZER'])` | Dashboard home, Trips, Requests, Payments, Reviews, Settings |
| **Admin** | `app/admin/` | Same `<h1>` pattern | `Header` + `AdminSidebar`, gated by `AuthGuard(allowedRoles=['ADMIN'])`, `robots: noindex` | Admin Overview, Bookings, Organizers, Cashback, Reviews, Trip Types |
| **Trip Discovery / Detail** | `app/trips/`, `app/destinations/[slug]/` | Marketing-adjacent hero or breadcrumb-style header, no dashboard sidebar | Filters + grid (`TripCardSkeleton` for loading) or single-trip detail with tabs/sections | Trips list, Trip detail, Compare, Organizer public profile |

Archetype drift (dashboard page missing sidebar, admin page not wrapped in `AuthGuard`, ad-hoc role checks instead of `RoleGuard`) is an audit finding — see `travel-ui-audit` (sibling skill).

---

## Data fetching & query keys (part of pre-flight, not optional)

- TanStack Query only — no raw `fetch`/`axios` in components.
- Query keys must come from `apps/web/src/lib/query-keys.ts` — either the flat `QK` string-segment object or a domain key-factory (`tripKeys`, `bookingKeys`, `walletKeys`, `paymentKeys`, `adminKeys`, `chatKeys`, `vehicleKeys`, `reviewKeys`, `notificationKeys`, `profileKeys`, `tripRequestKeys`, `destinationKeys`, `tripCategoryKeys`, `docReviewKeys`, `organizerKeys`, `uploadKeys`). Never inline `['bookings', id]`.
- Wrap `useQuery`/`useMutation` in a custom hook under `apps/web/src/hooks/` (one file per feature) — don't call TanStack Query directly from a page/component.
- Zustand stores live in `apps/web/src/store/` (`auth.store.ts`, `chat.store.ts`, `connection.store.ts`, `loading.store.ts`, `notification.store.ts`) — add a new one only for state that must survive navigation or is shared across unrelated components.

---

## Visual verification (mandatory)

**Do not mark UI work done without completing this loop.**

1. **Start dev server** (if not already running):
   ```bash
   cd apps/web && npm run dev
   ```
   Defaults to `http://localhost:3000`.
2. **Navigate** to the affected route (e.g. `/dashboard`, `/admin/bookings`, `/trips`, `/wallet`) using the Puppeteer MCP or a browser — see `debug-runtime` skill for the headless-Chrome-plus-`connect_active_tab` pattern if the default Puppeteer browser wedges.
3. **Capture** — screenshot and/or accessibility snapshot of the changed view, at desktop and a narrow (mobile) viewport.
4. **Verify:**
   - Token usage (`text-neutral-900` not `text-gray-900`, `bg-primary-500` not `bg-[#0fbab5]`, etc.)
   - Archetype header matches the pattern above; route group has the right layout chrome (sidebar present where expected, `AuthGuard`/`RoleGuard` in place)
   - All five states render correctly: empty (`EmptyState`), loading (`loading.tsx`, `Spinner`, or a feature skeleton — never a bare spinner for list/grid content), error (`error.tsx` or `ErrorState` with `onRetry`), success, disabled
   - Spacing and hierarchy look intentional at desktop and mobile widths; no layout shift when skeleton → content swap happens
5. **Fix** any visual issues found, then re-screenshot.
6. **Typecheck:**
   ```bash
   cd apps/web && npm run type-check
   ```

If the dev server cannot run, note the blocker in your output — do not skip verification silently.

---

## File conventions

- Pages: `apps/web/src/app/<route-group>/<segment>/page.tsx`, with sibling `loading.tsx` and `error.tsx` for whole-route states (see `apps/web/src/app/admin/payments/{loading,error}.tsx`).
- Components: `apps/web/src/components/<domain>/<name>.tsx` (kebab-case), colocated `<name>-skeleton.tsx` for list/grid loading states.
- Hooks: `apps/web/src/hooks/use-<feature>.ts`.
- Query keys: add to `apps/web/src/lib/query-keys.ts` — never a magic string array elsewhere.
- Forms: React Hook Form + Zod schema imported from `packages/shared/src/validators/` (same schema the API validates against) — don't redeclare a parallel shape.
- Types: `packages/shared/src/types/`.
- Design tokens: `packages/shared/src/theme/tokens.json` (colors/typography/spacing/radius/shadow), consumed by `apps/web/tailwind.config.ts`.

---

## Known gap (flag, don't silently invent)

Unlike a dashboard-primitives file (`DashboardPrimitives.tsx` in some codebases), this app has **no `AppPageHeader`/`PageHeader`/`Breadcrumbs`/`TabBar`/`PageLayout` shared components** — headers, tab bars, and page shells are hand-rolled per page with consistent but unenforced classes. If a task needs a genuinely reusable page shell, raise it with `travel-designer`/`travel-ui-ux-engineer` rather than inventing an ad-hoc "primitive" inside one feature folder.

---

## Related skills

| Skill | When |
| ----- | ---- |
| [travel-ui-creativity](../travel-ui-creativity/SKILL.md) | Hierarchy, states, motion, forms during build |
| [travel-ui-audit](../travel-ui-audit/SKILL.md) | Scored review pass before marking done |
| [web-design-guidelines](../web-design-guidelines/SKILL.md) | Complementary a11y/UX audit |
| [debug-runtime](../debug-runtime/SKILL.md) | Browser-driving mechanics for the mandatory verification loop |
