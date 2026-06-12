# TripCompare Frontend Audit — Pending Findings

> Audited: 2026-06-12 · Scope: `apps/web/src` @ commit `9a9c643`
> **P0 critical-path bugs (hydration overlay, seat-conflict dead-end, missing Toaster) and P1-1/2/7 are resolved.** This file tracks what remains open.

---

## P1 — Significant

### P1-1. Chat: "Load earlier messages" yanks the scroll position to the bottom
**Evidence:** `components/chat/chat-window.tsx:40-44` — `scrollRef.current.scrollTop = scrollHeight` runs on every `messages.length` change. `fetchNextPage` (line 33, 72-83) appends an older page → `messages.length` changes → user is teleported back to the newest message and must scroll up through everything again.

**Fix:** Track scroll anchor: record `scrollHeight` before `fetchNextPage`, restore `scrollTop = newScrollHeight - prevScrollHeight` after; only autoscroll to bottom when the *newest* message changes and the user is already near the bottom.

### P1-2. Chat socket sends are fire-and-forget — optimistic message can stay "sent" forever
**Evidence:** `hooks/use-chat.ts:363-366` — `socket.emit('chat:send', …)` with no ack callback, no timeout, no failed state. The optimistic `temp-*` message (`use-chat.ts:328-361`) is only reconciled if the server echoes `chat:message` back (`use-chat.ts:237-244`). The REST fallback rolls back on failure (371-388), but the socket path does not.

**Fix:** Use socket.io ack (`socket.emit('chat:send', payload, cb)`) with a 5s timeout → mark the bubble "failed, tap to retry" and fall back to REST.

### P1-3. Custom `Modal` has no focus trap, no initial focus, no focus restore — while Radix Dialog sits unused
**Evidence:** `components/shared/modal.tsx:40-81` — portal + `role="dialog"` + Esc handler, but nothing manages focus; Tab walks the page behind the backdrop. This modal powers booking-critical flows: `RequestActionModal` (`components/dashboard/trip-users/request-action-modal.tsx:38`), cancel-booking, etc. Meanwhile a fully accessible `components/ui/dialog.tsx` (Radix) and `alert-dialog.tsx` are installed and used in only a couple of files.

**Fix:** Rebase `Modal` onto `components/ui/dialog.tsx` or add a focus trap + `useRef` initial-focus + restore-on-close.

### P1-4. Every filter tweak on /trips triggers a full server navigation plus a duplicate client fetch
**Evidence:** `components/trips/trip-filters.tsx:38-50` and the debounced-price effect at `:61-71` call `router.push(pathname?params)`. Because `app/trips/page.tsx:13-35` is an async server component reading `searchParams`, every change re-runs the RSC **and** then `TripGrid`'s `useTrips` fires the same query client-side (`components/trips/trip-grid.tsx:20`, `hooks/use-trips.ts:12-30`). `nuqs` is declared in `apps/web/package.json` but imported nowhere.

**Fix:** Use shallow URL state (nuqs, already a dependency) for filter changes after first paint; keep the RSC fetch only for initial load/SEO.

---

## P2 — Polish

1. **11 files use raw `<img>` vs `next/image`** — notably `components/shared/avatar.tsx:39` (avatars everywhere), `components/vehicle/seat-map-picker.tsx:121-125` (vehicle thumbs in the booking flow), `components/chat/message-bubble.tsx`, `components/trips/trip-vehicle-preview.tsx`, `components/dashboard/trip-list-card.tsx`. Cloudinary remotePatterns are configured (`next.config.js`) so these miss free resizing/AVIF/lazy-loading.
2. **One `animate-pulse` violation of the shimmer rule** — `components/vehicle/seat-map-viewer.tsx:20` (everything else correctly uses `.skeleton` shimmer from `app/globals.css:104-115`). Chat uses bare spinners instead of skeletons (`chat-window.tsx:86-88`, `app/messages/page.tsx:35`).
3. **10 icon-only back links with no `aria-label`** — pattern `<Link className="btn-ghost p-2"><ArrowLeft/></Link>`: `app/trips/page.tsx:61-63`, `app/dashboard/trips/create/page.tsx:145-147`, `app/dashboard/requests/page.tsx:73-75`, `components/destinations/destination-detail-client.tsx:77-79`, plus 6 more (grep `btn-ghost p-2` → 10 hits, 0 with aria-label).
4. **`window.confirm` for a destructive action** — `app/dashboard/trips/[id]/vehicle/page.tsx:141` deletes a vehicle layout (and all seat assignments) via native confirm, while `components/ui/alert-dialog.tsx` exists and is used elsewhere.
5. **Two toast systems, two component languages** — custom `ToastProvider` (10 files) vs the now-unused sonner import paths that were the source of the prior bug; shadcn primitives used in only 19 non-ui files while the rest is raw HTML + utility classes. Visually consistent today, but double maintenance surface.
6. **Over-invalidation** — 23 of 71 `invalidateQueries` calls target whole-domain `.all` keys; e.g. payment verification nukes `tripKeys.all` + `bookingKeys.all` (`hooks/use-verify-payment.ts:34-35`), vehicle create invalidates `vehicleKeys.all` (`hooks/use-vehicle.ts:71-72`). Causes refetch bursts of unrelated lists right after high-traffic mutations.
7. **Seat-map polls every 30s on the public trip-detail preview** — `hooks/use-vehicle.ts:24-25` and `components/trips/trip-vehicle-preview.tsx:126`. Polling during booking is fine; polling on the public read-only preview page wastes bandwidth and CPU for all visitors.
8. **Chat layout uses `h-[calc(100vh-4rem)]`** (`components/chat/chat-layout.tsx:47`) — on mobile Safari/Chrome the URL bar makes the message input sit partially offscreen; use `dvh`.
9. **Dead "view details" button on Booking Requests** — `app/dashboard/requests/page.tsx:123` passes `onViewDetails={() => {}}`; `components/dashboard/trip-users/participant-card.tsx:162` renders the clickable control → click does nothing.
10. **Compare page eviction is abrupt** — removing a trip below 2 silently redirects to `/trips` (`app/trips/compare/page.tsx:21-27`) with no message about why you left the compare view.

---

## Claims vs Reality Scorecard

| Doc claim | Verdict | Evidence |
|---|---|---|
| "Next.js 14 (App Router, **client-side rendering**)" (`docs/PROJECT_REFERENCE.md:82`) | **FALSE — docs outdated.** Home, /trips, /trips/[slug], /destinations(+slug) are async server components with `fetchApi` + `revalidate`, `generateMetadata`, JSON-LD, sitemap/robots. ~40/50 pages are still `'use client'`, but the SEO-critical ones are server-rendered. | `app/page.tsx:30-38`, `app/trips/[slug]/page.tsx:22-57` |
| "Every data component: Loading → Error → Empty → Data" | **~90% TRUE.** 10 sampled: TripGrid ✓, WalletTransactionList ✓, admin overview ✓, seat-map-picker ✓ (all four states), my-bookings-list ✓, notifications ✓, chat-window ✓ states but spinner-not-skeleton. | `components/vehicle/seat-map-picker.tsx:23-80`, `components/shared/data-states.tsx` |
| "Skeleton shimmer, never animate-pulse" | **MOSTLY TRUE — 1 violation** (`components/vehicle/seat-map-viewer.tsx:20`), plus chat/messages use raw spinners instead of skeletons. | |
| Mobile-first | **LARGELY TRUE.** Filters drawer, sticky book bar, admin bottom nav, responsive tables. Gaps: chat `100vh` (P2-8), compare-bar grid squeezes 4 columns at 320px. | |
| WCAG AA | **PARTIAL.** Color system and seat grid are strong; fails on modal focus management (P1-3) and 10 unlabeled icon links (P2-3). | |

**Good things worth keeping:** trips/trip-detail/destination pages have real `generateMetadata` + JSON-LD + ISR; booking page derives a clean 8-value render state; trip form has debounced localStorage draft saving + per-tab error badges; list→detail uses `placeholderData`/`initialData` and hover prefetch; chat has real optimistic sends with dedupe; Razorpay dismiss/cancel is handled with a toast.
