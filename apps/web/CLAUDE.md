# Frontend Conventions (`apps/web`)

Next.js 15 (App Router) + React 19 + Tailwind + shadcn/ui (`new-york` style) + TanStack Query + Zustand. See [[Web Frontend]] and [[Frontend Routes Reference]] in `docs/codebase/` for the full route map and component inventory — this file is the quick-reference for writing new code.

## Route groups — pick the right one

| Group | Path | Audience | Layout |
| :--- | :--- | :--- | :--- |
| Public / marketing | `app/(public)/` | Anyone, unauthenticated | Static content pages (about, FAQ, legal) |
| Auth | `app/(auth)/` | Signed-out users | Login/signup/OTP flows |
| Traveler dashboard | `app/(dashboard)/`, `app/my-bookings/`, `app/my-payments/`, `app/my-reviews/`, `app/wallet/`, `app/profile/` | TRAVELER (+ ADMIN impersonation) | `app-shell.tsx` (`@/components/layout/app-shell`) — header + footer, no sidebar |
| Organizer dashboard | `app/dashboard/` | ORGANIZER | `dashboard-sidebar.tsx` (`@/components/dashboard/dashboard-sidebar`) |
| Admin | `app/admin/` | ADMIN only | `admin/layout.tsx` |
| Trip discovery/detail | `app/trips/`, `app/destinations/` | Public + traveler | Marketing-adjacent, no sidebar |

## Loading / error / empty states — use Next.js file conventions first

Every route segment under `app/` should have `loading.tsx` and `error.tsx` siblings (see `app/admin/payments/{loading,error}.tsx` for the pattern) — **prefer these over manual `isLoading`/`error` branching in the page component** wherever the whole route is loading, since Next.js wires the Suspense boundary for you.

For loading/error *within* a page (a card, a tab, a section) rather than the whole route, use:

- `EmptyState` / `ErrorState` from `@/components/shared/data-states` — pass `onRetry` on `ErrorState` for retryable sections.
- `Spinner` from `@/components/shared/spinner`, or `FullScreenLoader` (`@/components/shared/full-screen-loader`) for full-page blocking loads (e.g. payment redirect).
- Content-shaped skeletons over spinners for lists/grids/cards — see `trip-card-skeleton.tsx`, `profile-skeleton.tsx`, `admin/chart-skeletons.tsx` for the pattern; add a sibling `<Feature>Skeleton` component next to new list/grid components rather than a generic spinner.

Never render a bare `<p>No data</p>` — use `EmptyState` with a `message` and, when the empty state isn't a dead end, an `action` (e.g. a button linking to trip discovery).

## Data fetching

TanStack Query only — no raw `fetch`/`axios` calls in components. Query keys **must** come from the `QK` constants object in `apps/web/src/lib/query-keys.ts` (see root `CLAUDE.md` — no magic strings) — never inline string arrays like `['bookings', id]`.

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: [QK.BOOKINGS, QK.MY, filters],
  queryFn: () => getMyBookings(filters),
})
```

Custom hooks wrapping `useQuery`/`useMutation` live in `apps/web/src/hooks/` (one file per feature, e.g. `use-create-booking.ts`) — add new data hooks there rather than calling TanStack Query directly in a page component. Mutations invalidate the relevant `QK` keys in `onSuccess`.

## Client state

Zustand stores live in `apps/web/src/store/` (`auth.store.ts`, `chat.store.ts`, `connection.store.ts`, `loading.store.ts`, `notification.store.ts`). Add a new store only for state that must survive across route navigations or be shared by unrelated components — otherwise prefer local `useState` or React Query cache.

## UI primitives

- shadcn/ui primitives in `apps/web/src/components/ui/` (lowercase-kebab filenames: `button.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, …) — never hand-roll a component that shadcn already provides; run the shadcn CLI to add a new one instead of writing it from scratch.
- Shared app-level primitives in `apps/web/src/components/shared/`: `modal.tsx`, `data-states.tsx` (`EmptyState`/`ErrorState`), `spinner.tsx`, `full-screen-loader.tsx`, `pagination.tsx`, `date-picker.tsx`/`date-range-picker.tsx`, `search-combobox.tsx`, `toast.tsx`, `role-guard.tsx`/`auth-guard.tsx`.
- Dashboard primitives in `apps/web/src/components/dashboard/`: `stat-card.tsx`, `dashboard-sidebar.tsx`, `dashboard-alerts.tsx`, `trip-list-card.tsx`.
- Role gating: wrap admin/organizer-only UI with `role-guard.tsx`, not an ad-hoc `if (user.role === ...)` scattered across JSX.

## Forms

React Hook Form + Zod (`@hookform/resolvers`), schema imported from `packages/shared/src/validators/` — the same schema the API validates against. Never redeclare a parallel client-side shape.

## TypeScript & tests

- `npm run type-check` before committing.
- Tests are colocated in `__tests__/` folders next to the source they cover (`hooks/__tests__/`, `store/__tests__/`, `components/**/__tests__/`) — Vitest + Testing Library, MSW for API mocking (see `apps/web/src/test/mocks/`). This differs from `apps/api`, which keeps tests in a separate `tests/` tree — match whichever app you're in.
- Use fixtures from `apps/web/src/test/factories/` rather than inlining mock objects per test file.

## Design tokens

Tailwind tokens defined via `packages/shared/src/theme` + `tailwind.config` — use semantic classes already in use across the app (`text-neutral-900`, `bg-primary-400`, `bg-error-50`, `border-error-200`, `font-display`) rather than introducing new raw hex values or one-off Tailwind arbitrary values.
