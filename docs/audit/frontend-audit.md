# TripCompare Frontend Audit — Perceived Performance & UX

> Audited: 2026-06-12 · Scope: `apps/web/src` @ commit `9a9c643` (404 TS/TSX files, 50 pages, 193 files with `'use client'`). Every finding cites real code.

---

## P0 — Users definitely feel it / broken flows

### P0-1. A pre-hydration full-screen spinner hides ALL server-rendered content until React hydrates
- **Evidence:** `apps/web/src/app/layout.tsx:64-91` — root layout renders `<div id="__initial-loader">` with `position: fixed; inset: 0; z-index 9999; background rgba(250,250,250,0.95)` on **every page**. It is only hidden in `apps/web/src/app/providers.tsx:29-35` via a client `useEffect` after hydration.
- **Why it matters:** The app does real SSR/ISR (home, `/trips`, `/trips/[slug]`, `/destinations/[slug]` all server-fetch with `revalidate: 300`), then deliberately covers that HTML with an opaque spinner until the full JS bundle downloads, parses, and hydrates. On mid-range mobiles/3G that's seconds of staring at a teal spinner over already-painted content. LCP becomes the overlay; the entire SSR investment (see `app/page.tsx:34-38` "SSR-fetch homepage data… eliminates client-side waterfall") is nullified for perceived speed. This is the single biggest "feels slow" item in the codebase.
- **Fix:** Delete the overlay (SSR content is already meaningful), or scope it strictly to auth-transition routes. If interactivity-before-hydration is the concern, that's what skeleton islands are for — never a viewport-wide blocker in the root layout.

### P0-2. Losing a seat race shows "You've Already Booked This Trip"
- **Evidence:** `apps/web/src/app/trips/[slug]/book/page.tsx:176-177` maps **any** `err.code === 'CONFLICT'` to `setPhase('alreadyBooked')`. The backend throws `ConflictError('One or more selected seats are no longer available')` for seat conflicts (`apps/api/src/services/booking.service.ts:382-384`).
- **Why it matters:** A user who picks seats, fills traveler details, and clicks Pay just as someone else grabs the seat is told "You've Already Booked This Trip / Check your bookings" (`book/page.tsx:240-265`) — factually wrong, dead-ends the purchase, and they find nothing in My Bookings. This is a broken conversion path on the highest-intent flow.
- **Fix:** Branch on the error message/sub-code (backend already distinguishes duplicate-booking vs seat conflict). For seat conflicts: toast "Seats just got taken", `refetch()` the seat map, and return to the `seats` step with selection cleared.

### P0-3. Real-time notification toasts never render — sonner `<Toaster />` is never mounted
- **Evidence:** `apps/web/src/components/shared/socket-connector.tsx:11,56-62` calls `toast(payload.title, …)` from `'sonner'` for every `notification:new` socket event; `apps/web/src/app/admin/cashback/[tripId]/page.tsx:22` also uses sonner. But the sonner `<Toaster />` wrapper (`components/ui/sonner.tsx`) is **imported by zero files** (`grep "ui/sonner"` → no matches), and `providers.tsx:57-74` mounts only the custom `ToastProvider`.
- **Why it matters:** Every real-time notification toast (booking approved, payment received, new message, with its "View" action button) is silently dropped. Users get no live feedback for socket events at all; admin cashback actions show no success/error.
- **Fix:** Either mount `<Toaster />` in `providers.tsx`, or migrate the two sonner call-sites to `useToast()` from `components/shared/toast`. Pick one system (see P2-7).

---

## P1 — Significant

### P1-1. 30-minute seat hold is never communicated; hold-expiry mid-payment ends in "contact support"
- **Evidence:** Backend holds seats for `SEAT_HOLD_MINUTES = 30` at booking creation (`apps/api/src/utils/constants.ts:42`, `booking.service.ts:418-420`). The frontend shows no countdown, no "seats reserved until…" anywhere in `app/trips/[slug]/book/page.tsx` or `components/booking/*`. The `useHoldSeats` hook exists but is dead code — defined at `hooks/use-vehicle.ts:108-114`, used nowhere (grep confirms). If verification fails the user gets only `'Payment verification failed. Please contact support.'` (`hooks/use-verify-payment.ts:38`).
- **Why it matters:** Users dawdling in Razorpay or returning later from "Payment Pending" have no idea their seats are time-boxed. When the hold or booking expires (`BOOKING_EXPIRY` cron, `api/src/utils/cron-jobs.ts:24`), the failure mode is a generic toast with money possibly debited — the worst-anxiety moment of the flow has the least information.
- **Fix:** Return `holdExpiresAt` in `CreateBookingResponse`, render a countdown banner on the pay step, and on verification failure show booking ref + "if money was deducted it will be auto-refunded" copy instead of bare "contact support".

### P1-2. Compare queue: 4th add silently does nothing; adding from home page gives zero feedback
- **Evidence:** `hooks/use-compare-queue.tsx:113` — `if (prev.length >= MAX_ITEMS) return prev` with no toast/shake. And `components/trips/global-compare-bar.tsx:19` — `if (pathname !== '/trips') return null`, while the home page wires compare toggles (`components/home/trending-trips.tsx:53` passes `onCompare={toggle}`).
- **Why it matters:** On `/` a user can tap "Compare" on trending trips, the button flips to "Added", and… nothing else ever appears — no bar, no route to `/trips/compare`. On `/trips`, the 4th tap is a dead click. (The bar itself, `components/trips/compare-bar.tsx`, is well done — empty slots, "Select 1 more" state.)
- **Fix:** Toast "You can compare up to 3 trips" on overflow; show `GlobalCompareBar` on every page with trip cards (home, destination detail) or at least on `/` and `/destinations/[slug]`.

### P1-3. Chat: "Load earlier messages" yanks the scroll position to the bottom
- **Evidence:** `components/chat/chat-window.tsx:40-44` — `scrollRef.current.scrollTop = scrollHeight` runs on every `messages.length` change. `fetchNextPage` (line 33, 72-83) appends an older page → `messages.length` changes → user is teleported back to the newest message and must scroll up through everything again.
- **Why it matters:** Pagination of history is effectively unusable; this is a classic chat bug users hit immediately in long conversations.
- **Fix:** Track scroll anchor: record `scrollHeight` before `fetchNextPage`, restore `scrollTop = newScrollHeight - prevScrollHeight` after; only autoscroll to bottom when the *newest* message changes and the user is already near the bottom.

### P1-4. Chat socket sends are fire-and-forget — optimistic message can stay "sent" forever
- **Evidence:** `hooks/use-chat.ts:363-366` — `socket.emit('chat:send', …)` with no ack callback, no timeout, no failed state. The optimistic `temp-*` message (`use-chat.ts:328-361`) is only reconciled if the server echoes `chat:message` back (`use-chat.ts:237-244`). The REST fallback rolls back on failure (371-388), but the socket path does not.
- **Why it matters:** If the server rejects the message (closed conversation, moderation flag, transient disconnect after `connected` check), the message sits in the UI looking delivered and is silently lost on next refetch — users believe they messaged the organizer when they didn't.
- **Fix:** Use socket.io ack (`socket.emit('chat:send', payload, cb)`) with a 5s timeout → mark the bubble "failed, tap to retry" and fall back to REST.

### P1-5. Custom `Modal` has no focus trap, no initial focus, no focus restore — while Radix Dialog sits unused
- **Evidence:** `components/shared/modal.tsx:40-81` — portal + `role="dialog"` + Esc handler, but nothing manages focus; Tab walks the page behind the backdrop. This modal powers booking-critical flows: `RequestActionModal` (`components/dashboard/trip-users/request-action-modal.tsx:38`), cancel-booking, etc. Meanwhile a fully accessible `components/ui/dialog.tsx` (Radix) and `alert-dialog.tsx` are installed and used in only a couple of files.
- **Why it matters:** WCAG 2.4.3/2.1.2 failure on approve/reject and cancellation flows; keyboard and screen-reader users can interact with obscured content.
- **Fix:** Rebase `Modal` onto `components/ui/dialog.tsx` or add a focus trap + `useRef` initial-focus + restore-on-close.

### P1-6. Every filter tweak on /trips triggers a full server navigation plus a duplicate client fetch
- **Evidence:** `components/trips/trip-filters.tsx:38-50` and the debounced-price effect at `:61-71` call `router.push(pathname?params)`. Because `app/trips/page.tsx:13-35` is an async server component reading `searchParams`, every change re-runs the RSC (server `fetchApiWithPagination`, `:27-30`) **and** then `TripGrid`'s `useTrips` fires the same query client-side (`components/trips/trip-grid.tsx:20`, `hooks/use-trips.ts:12-30`). `nuqs` is declared in `apps/web/package.json` but imported nowhere (grep: 0 hits).
- **Why it matters:** Each select change / price keystroke (after 500ms debounce) costs a server roundtrip for data the client immediately refetches. `placeholderData: prev` (use-trips.ts:26) hides the flash, but on slow networks filtering feels laggy and the server does double work.
- **Fix:** Use shallow URL state (nuqs, already a dependency) for filter changes after first paint; keep the RSC fetch only for initial load/SEO. Positive note: pagination reset on filter change (`trip-filters.tsx:46`) and debounce are correctly done.

### P1-7. Session expiry path can strand the user behind a pinned full-screen overlay
- **Evidence:** `lib/api-client.ts:100-106` — on failed refresh it calls `useLoadingStore.getState().show('Session expired...')` (which pins, `store/loading.store.ts:17-19`) then navigates only `if (appRouter)`. The pinned overlay is dismissed solely by `DismissLoader` on a pathname change (`components/shared/dismiss-loader.tsx:15-21`).
- **Why it matters:** If the router isn't registered yet or navigation lands on the same pathname, the blocking overlay never clears — the user is locked out of the page until a manual reload.
- **Fix:** Add a timeout-based force-hide (e.g., `hide(true)` after 3s) and a `window.location` fallback when `appRouter` is null.

---

## P2 — Polish

1. **recharts statically imported on admin pages** — `components/admin/revenue-chart.tsx:3`, `bookings-chart.tsx:3`, `trip-type-chart.tsx:3`, all imported directly by `app/admin/page.tsx:8-10`. No `dynamic()`. Recharts (+d3) inflates the admin route chunk; the dashboard already renders skeletons, so `next/dynamic` with the existing `*Skeleton` fallbacks is a drop-in fix.
2. **11 files use raw `<img>` vs 15 using `next/image`** — notably `components/shared/avatar.tsx:39` (avatars everywhere), `components/vehicle/seat-map-picker.tsx:121-125` (vehicle thumbs in the booking flow), `components/chat/message-bubble.tsx`, `components/trips/trip-vehicle-preview.tsx`, `components/dashboard/trip-list-card.tsx`. Cloudinary remotePatterns are configured (`next.config.js:9-19`) so these miss free resizing/AVIF/lazy-loading.
3. **`prefetch={false}` on 89 links, including every TripCard link** (`components/trips/trip-card.tsx:72,109,182-186`). Card click always pays a full RSC roundtrip. The hover handler only warms the React Query cache (`trip-card.tsx:39-45`) — which the *server-rendered* detail page never reads; it only helps the later `/book` page. Re-enable prefetch for above-the-fold cards or prefetch the route on hover too.
4. **One `animate-pulse` violation of the shimmer rule** — `components/vehicle/seat-map-viewer.tsx:20` (everything else correctly uses `.skeleton` shimmer from `app/globals.css:104-115`). Chat uses bare spinners instead of skeletons (`chat-window.tsx:86-88`, `app/messages/page.tsx:35`).
5. **10 icon-only back links with no `aria-label`** — pattern `<Link className="btn-ghost p-2"><ArrowLeft/></Link>`: `app/trips/page.tsx:61-63`, `app/dashboard/trips/create/page.tsx:145-147`, `app/dashboard/requests/page.tsx:73-75`, `components/destinations/destination-detail-client.tsx:77-79`, plus 6 more (grep `btn-ghost p-2` → 10 hits, 0 with aria-label). Seat cells, by contrast, are exemplary (`components/vehicle/seat-cell.tsx:97-117` — `aria-label`, `aria-pressed`, titles).
6. **`window.confirm` for a destructive action** — `app/dashboard/trips/[id]/vehicle/page.tsx:141` deletes a vehicle layout (and all seat assignments) via native confirm, while `components/ui/alert-dialog.tsx` exists and is used elsewhere.
7. **Two toast systems, two component languages** — custom `ToastProvider` (10 files) vs sonner (2 files, broken per P0-3); shadcn primitives used in only 19 non-ui files while the rest is raw HTML + `btn-primary`/`input`/`card-static` utility classes (`app/globals.css`). Visually consistent today, but double maintenance and the sonner trap already bit.
8. **Over-invalidation** — 23 of 71 `invalidateQueries` calls target whole-domain `.all` keys; e.g. payment verification nukes `tripKeys.all` + `bookingKeys.all` (`hooks/use-verify-payment.ts:34-35`), vehicle create invalidates `vehicleKeys.all` (`hooks/use-vehicle.ts:71-72`). Causes refetch bursts of unrelated lists right after high-traffic mutations.
9. **Aggressive refetch posture** — `refetchOnWindowFocus` left at default `true` with `staleTime: 60s` global (`providers.tsx:42`) and `STALE_TIME_DEFAULT = 15s` (`lib/constants.ts:6`); seat map polls every 30s (`hooks/use-vehicle.ts:24-25`) even on the public trip-detail preview (`components/trips/trip-vehicle-preview.tsx:126`), not just during booking.
10. **Chat layout uses `h-[calc(100vh-4rem)]`** (`components/chat/chat-layout.tsx:47`) — on mobile Safari/Chrome the URL bar makes the message input sit partially offscreen; use `dvh`. Mobile sidebar/window swap itself is handled correctly (`:48-61`).
11. **Dead "view details" button on Booking Requests** — `app/dashboard/requests/page.tsx:123` passes `onViewDetails={() => {}}`; `components/dashboard/trip-users/participant-card.tsx:162` renders the clickable control → click does nothing.
12. **Compare page eviction is abrupt** — removing a trip below 2 silently redirects to `/trips` (`app/trips/compare/page.tsx:21-27`) with no message about why you left the compare view.

**Good things worth keeping (so they don't get "fixed"):** trips/trip-detail/destination pages have real `generateMetadata` + JSON-LD + ISR (`app/trips/[slug]/page.tsx:22-57`); booking page derives a clean 8-value render state (`book/page.tsx:93-101`); trip form has debounced localStorage draft saving + per-tab error badges + jump-to-error (`components/trips/trip-form/trip-form.tsx:103-114,155-160`); list→detail uses `placeholderData`/`initialData` and hover prefetch; chat has real optimistic sends with dedupe; Razorpay dismiss/cancel is handled with a toast (`book/page.tsx:168-173`).

---

## Claims vs Reality Scorecard

| Doc claim | Verdict | Evidence |
|---|---|---|
| "Next.js 14 (App Router, **client-side rendering**)" (`docs/PROJECT_REFERENCE.md:82`) | **FALSE — docs outdated.** Home, /trips, /trips/[slug], /destinations(+slug) are async server components with `fetchApi` + `revalidate`, `generateMetadata`, JSON-LD, sitemap/robots. ~40/50 pages are still `'use client'`, but the SEO-critical ones are server-rendered. The irony: P0-1's hydration overlay makes it *feel* CSR anyway. | `app/page.tsx:30-38`, `app/trips/[slug]/page.tsx:22-57`, `app/layout.tsx:64-91` |
| "Every data component: Loading → Error → Empty → Data" (`PROJECT_REFERENCE.md:859`) | **~90% TRUE.** 10 sampled: TripGrid ✓, WalletTransactionList ✓, admin overview ✓, admin bookings ✓, requests ✓, seat-map-picker ✓ (all four, dedicated components), my-bookings-list ✓, trip-vehicle-preview ✓, notifications ✓, chat-window ✓ states but spinner-not-skeleton. Shared `ErrorState`/`EmptyState` used consistently. | e.g. `components/vehicle/seat-map-picker.tsx:23-80,201-203`, `components/shared/data-states.tsx` |
| "Skeleton shimmer, never animate-pulse" (`.windsurfrules:77`) | **MOSTLY TRUE — 1 violation** (`components/vehicle/seat-map-viewer.tsx:20`), plus chat/messages use raw spinners instead of skeletons. `.skeleton` shimmer properly defined (`app/globals.css:104-115`). | |
| Mobile-first | **LARGELY TRUE.** Filters drawer, sticky book bar, admin bottom nav (`components/admin/admin-sidebar.tsx:73`), responsive tables with md: breakpoints. Gaps: chat `100vh` (P2-10), compare-bar grid squeezes 4 columns at 320px (`compare-bar.tsx:51-53`). | |
| WCAG AA | **PARTIAL.** Color system and seat grid are strong; fails on modal focus management (P1-5) and 10 unlabeled icon links (P2-5). | |
| "api-client triggers a FULL-SCREEN loader on every non-GET" | **NO LONGER TRUE** — the interceptor only shows it on session expiry (`api-client.ts:100`); `useBlockingLoader` (`hooks/use-blocking-mutation.ts`) is dead code. The real full-screen-loader problem today is the pre-hydration overlay (P0-1). | |

**Top 3 actions by impact:** (1) remove the root-layout hydration overlay, (2) fix the seat-conflict→"already booked" mismap + add hold countdown, (3) mount the sonner Toaster (or migrate its two call-sites).
