# State Completeness

Every page, list, card, form, and table region must handle **all five states**. Missing states is the #1 signal of AI-generated "cheap" UI.

| State | When | Travel codebase pattern |
| ----- | ---- | ------------------------ |
| **Empty** | No data yet, no search results, filtered-to-zero | `<EmptyState message={...} action={...} />` (`@/components/shared/data-states`) — specific copy, one verb-driven CTA when there's a next step (e.g. "Browse trips" linking to `/trips`) |
| **Loading** | Initial fetch or section refresh | Whole route: `loading.tsx` sibling file (Next.js file convention — see `apps/web/src/app/admin/payments/loading.tsx`). Within a page: `<Spinner size="sm/md/lg" />` for a discrete action, or a feature `<Name>Skeleton` (e.g. `TripCardSkeleton`, `StatCardSkeleton`, `ProfileSkeleton`, `admin/chart-skeletons.tsx`) for structural list/grid/card content |
| **Error** | Query/mutation failed | Whole route: `error.tsx` sibling file (see `apps/web/src/app/admin/payments/error.tsx`). Within a page: `<ErrorState onRetry={refetch} />` (`@/components/shared/data-states`) — never a raw error message or error code |
| **Success** | Mutation completed | Toast (`@/components/shared/toast`), inline confirmation, or updated row/badge state — user must know it worked without re-reading the page |
| **Disabled** | Pending, unauthorized, or unavailable | shadcn `<Button disabled>` / `<Button>` with a pending state during `isPending` — preserve layout, don't just swap the label to "Saving..." with no visual disabled treatment. Role-gated UI uses `<RoleGuard roles={[...]}>` / `<AuthGuard allowedRoles={[...]}>` (`@/components/shared/role-guard`, `@/components/shared/auth-guard`) — both render a `Spinner` while hydrating; `RoleGuard` then shows an inline "Access Denied" message for unauthorized users, while `AuthGuard` redirects (to `/login/email` or `/`) showing a "Redirecting..." spinner instead of an Access Denied screen — reuse these instead of a bespoke unauthorized UI |

## Empty state anatomy (required)

1. **Why empty** — "You haven't booked any trips yet" not "No data"
2. **What success looks like** — optional preview copy or icon (`EmptyState`'s default icon is `SearchX` from lucide-react; pass a feature-specific icon when it adds clarity)
3. **One primary CTA** via the `action` prop — "Browse trips", "Create a trip"
4. **Recovery path** for no-results — suggest clearing filters or broadening the search (e.g. trip discovery filters)

## Loading decision tree

| Duration | Pattern |
| -------- | ------- |
| < 100ms | Show nothing (avoid flicker) |
| 100–400ms | Inline `<Spinner size="sm">` on the triggering control only |
| 400ms–2s | Skeleton matching final layout — `TripCardSkeleton`, `StatCardSkeleton`, `.skeleton` bars, or a route `loading.tsx` |
| > 2s | Skeleton + progress text (e.g. `FullScreenLoader`, which takes no props and reads its `message` from `useLoadingStore` — call `useLoadingStore.getState().show(message)` to set it) — used for payment-redirect-style blocking loads |

**Spinner vs skeleton:** `Spinner` for discrete user actions (submit, delete, a single card refresh); skeleton (`.skeleton` shimmer via `TripCardSkeleton`/`StatCardSkeleton`/etc.) for structural content (lists, dashboards, tables). `FullScreenLoader` is reserved for full-page blocking flows, not routine data fetches — prefer route-level `loading.tsx` for those.

## Skeleton accessibility (required)

1. **Parent container** — set `aria-busy="true"` on the loading region (page section, card grid, or table wrapper) while data is fetching.
2. **Placeholder elements** — the `.skeleton` class itself has no semantics; mark skeleton bars/blocks with `aria-hidden="true"` so screen readers skip decorative shimmer.
3. **Completion** — when data lands, remove `aria-busy`, replace skeletons with real content, and announce completion via a live region:

```tsx
<div aria-live="polite" role="status" className="sr-only">
  {isLoading ? '' : 'Content loaded'}
</div>
```

4. **Never show empty state before loading completes** — gate `EmptyState` on `!isLoading && !error && data.length === 0`. Showing "Nothing to show here yet" while still fetching is a common agent mistake.

Existing primitives (`Spinner` already sets `role="status"` and `aria-label`; `FullScreenLoader` sets `role="status"` + `aria-live="assertive"`) follow this pattern — extend custom skeleton layouts with the same attributes rather than reinventing.
