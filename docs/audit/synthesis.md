# TripCompare Repository Audit — Synthesis

> Audited: 2026-06-12 @ commit `9a9c643`. Synthesized from three parallel audits: [backend-audit.md](./backend-audit.md), [frontend-audit.md](./frontend-audit.md), [product-audit.md](./product-audit.md).

**Headline:** the refund path doesn't exist — cancellations tell users a refund was processed but never move money, and the escrow cron then pays organizers for those cancelled bookings.

---

## (a) Critical bugs to fix first (money paths)

**1. Refunds are never issued.** `cancelBooking` computes the refund amount, flips the booking status, and sends a notification saying "Refund: ₹X" — but `initiateRefund` has **zero call sites** in the codebase, and no wallet credit or REFUND transaction is ever created (`apps/api/src/services/booking.service.ts:175-248`). The docs' claim "refunds go to your wallet instantly" is false. Every paid cancellation silently keeps 100% of the customer's money. Fix: in one `$transaction`, create the REFUND `PaymentTransaction`, call `initiateRefund` (it's already implemented at `payment.service.ts:124`) or credit the wallet, and mark REFUNDED on the `refund.processed` webhook.

**2. Escrow is released to organizers for cancelled bookings.** The escrow-release queries filter only on `type: PAYMENT, status: CAPTURED` with **no bookingStatus filter** (`payment-transaction.repository.ts:309-386`), so the completion cron pays out money for bookings the traveler cancelled (`trip-lifecycle.service.ts:91-128`). Combined with bug 1, a cancel-then-trip-completes sequence permanently transfers the customer's money to the organizer. Fix: filter to CONFIRMED/COMPLETED and reverse the Razorpay transfer on cancellation (`reverse_all: 1` already supported).

**3. Webhook HMAC verified against an empty string.** `RAZORPAY_WEBHOOK_SECRET` is optional in env validation (`config/env.ts:12`) and the route is mounted with `env.RAZORPAY_WEBHOOK_SECRET || ''` (`dependencies.ts:242-244`). If unset in prod, anyone can forge webhooks that corrupt the payment ledger. Fix: require it whenever Razorpay keys are set; refuse to mount the route with an empty secret.

**4. `confirmBooking` resurrects EXPIRED/CANCELLED bookings and swallows seat-confirmation failure.** The only guard is "already CONFIRMED → return" (`booking.service.ts:467-477`). A late payment on an expired booking re-confirms it, and since the 1-minute cron already freed the held seats, `confirmSeats` fails — and that failure is caught and ignored ("booking still confirmed", `booking.service.ts:527-529`). Result: a charged, confirmed traveler with no seat while the same seat is sold to someone else. Fix: an atomic `UPDATE ... WHERE bookingStatus='PENDING_PAYMENT'` gate before capture; refund (not confirm) paid-but-expired bookings; treat seat re-acquisition failure as a hard error.

**5. Confirmation isn't transactional → double seat-count increment.** Increment, Razorpay capture (network call), and status update are three separate steps (`booking.service.ts:485-510`). A crash between capture and status update leaves money taken + booking PENDING; the retry increments `currentBookings` a second time, and the expiry cron sees "paid" and skips it forever — permanent limbo. Closely related: the trip-wide `version` CAS makes concurrent confirms of *different* bookings spuriously fail after payment was authorized (`trip.repository.ts:402-413`), and double-cancel is a read-then-write race (`booking.service.ts:177-211`).

**6. Crons have no distributed lock** (`index.ts:30`, plain `setInterval`s). Fine on today's single container, but the escrow-release idempotency check is check-then-create with no unique constraint — first scaling event creates duplicate payouts. Cheap insurance now: Redis `SET NX` lock + a partial unique index on `PaymentTransaction(bookingId) WHERE type='ESCROW_RELEASE'`.

Worth noting what's **solid**: wallet credit/debit are atomic SQL with balance guards in transactions, cashback dedup has a real unique constraint, webhook signature compare is timing-safe with raw body, refresh tokens rotate with reuse detection, MockPaymentService hard-throws in prod, and the rate limiter is a real Redis Lua sliding window applied to auth/OTP/webhooks.

## (b) Top performance fixes, ranked by impact

1. **Delete the pre-hydration full-screen overlay** (`apps/web/src/app/layout.tsx:64-91`). The app does real SSR/ISR on home, trips, trip detail, and destinations — then covers all of it with an opaque spinner until React hydrates. This single element nullifies the entire SSR investment and is the biggest "feels slow" item in the product.
2. **Stop double-fetching on /trips filters.** Every filter change does a full server navigation *and* a duplicate client-side TanStack fetch of the same query (`components/trips/trip-filters.tsx:38-71` + `trip-grid.tsx:20`). `nuqs` is a declared dependency, imported nowhere — use it for shallow URL state after first paint.
3. **Trip list over-fetching:** list queries pull full rows including `itinerary`/`photos`/`description` JSON for every card (`trip.repository.ts:62-169`). Switch to an explicit summary `select`.
4. **Add missing indexes:** `Trip(isDeleted, status, tripType)`, `Trip(status, endDate)` (the completion cron's exact predicate), `Conversation.lastMessageAt` (every conversation list sorts on it).
5. **Add the Socket.IO Redis adapter** (`socket/index.ts:16-24` — docs claim it exists; it doesn't) and replace per-disconnect `io.fetchSockets()` scans with Redis counters. Prerequisite for ever running 2+ API replicas.
6. **N+1s and unbounded queries:** escrow release queries per-payment in a loop (`trip-lifecycle.service.ts:104-110`); unpaginated `findByOrganizerId`, `findAllPendingForOrganizer`, `findExpiredPendingBookings` (the last makes the cron poll Razorpay serially per booking).
7. **Frontend polish:** `dynamic()`-import recharts on admin pages, replace the 11 raw `<img>` usages (avatars, seat-map thumbs) with `next/image`, re-enable prefetch on TripCard links, and stop the 30s seat-map polling on the public trip-detail preview.

Redis caching, by the way, is **real** — trip search/detail, destinations, and organizer stats are cached with sensible TTLs and invalidation. That doc claim checks out.

## (c) Top UX improvements

1. **Seat-race loser is told "You've Already Booked This Trip."** Any `CONFLICT` error in the booking flow maps to the already-booked screen (`app/trips/[slug]/book/page.tsx:176-177`), but the backend uses CONFLICT for "seats no longer available" too. Highest-intent user, factually wrong dead-end. Branch the error and return them to seat selection with a refreshed map.
2. **The 30-minute seat hold is invisible.** No countdown, no "reserved until" anywhere in the booking flow; `useHoldSeats` is dead code. When the hold expires mid-payment the user gets "Payment verification failed. Please contact support." (`hooks/use-verify-payment.ts:38`) — possibly with money debited. Add a countdown banner and auto-refund reassurance copy.
3. **Real-time toasts never render.** `SocketConnector` fires sonner toasts for every notification event, but sonner's `<Toaster />` is mounted nowhere (`components/shared/socket-connector.tsx:56-62`). All live "booking approved / payment received" feedback is silently dropped. One-line fix.
4. **Chat:** "Load earlier messages" yanks scroll to the bottom (`chat-window.tsx:40-44`), and socket sends are fire-and-forget — a rejected message looks delivered forever (`use-chat.ts:363-366`). Add scroll anchoring and ack-with-timeout.
5. **Compare flow gaps:** the 4th add is a silent no-op, and the compare bar only renders on `/trips` while home-page cards wire compare toggles — adding from home gives zero feedback (`global-compare-bar.tsx:19`).
6. **Accessibility:** the custom `Modal` (used for approve/reject and cancellation) has no focus trap while an unused Radix Dialog sits installed (`components/shared/modal.tsx:40-81`); 10 icon-only back links lack `aria-label`; vehicle deletion uses `window.confirm`.

The claimed 4-state (loading/error/empty/data) discipline is ~90% real across sampled components — credit where due.

## (d) Ranked new ideas (filtered against mvp-plan and rnd docs)

Quick-wins (S effort, ride existing infra):

1. **Post-trip review prompts + verified-booking badge** — `REVIEW_REQUEST` notification type exists but is never fired; the trip-completion cron is the exact hook point. Reviews are the trust moat and nobody is ever asked to write one. Highest ROI-per-line in the codebase.
2. **Auto-cashback on trip completion** — wallet credit + idempotency constraint + completion cron all exist; today cashback is manual admin work. Pair with **wallet expiry** (the `EXPIRY` enum value is dead code) so credit creates urgency.
3. **Trip duplication ("repeat this trip")** — `TripEditHistory.snapshot` proves full-trip serialization exists; Pune organizers rerun the same Goa trip every 2–4 weeks and currently refill a 9-section form each time.
4. **Trip reminder notifications (48h/24h)** — `TRIP_REMINDER` is enum'd and channel-mapped, never sent.
5. **Branded OG share cards for trips** — WhatsApp is the discovery channel; Next's `ImageResponse` can compose photo + price + seats-left + verified badge.

Medium:

6. **Payout statements for organizers** — `ESCROW_RELEASE` rows with exact organizer shares and transfer IDs are already recorded but never surfaced. "Where's my money?" during a 90-day hold is the #1 leakage driver per the market-research doc.
7. **Organizer analytics** — admin already has revenue-trend SQL and Recharts components; re-scope by organizerId and lift into `/dashboard`.
8. **Free-text trip search + autocomplete** — mvp-plan claims Postgres FTS; it was never built. The hero search bar currently can't find "Gokarna" by typing.
9. **Organizer announcements (broadcast to confirmed travelers)** — chat infra, SYSTEM message type, and bulk notifications all exist; today "pickup moved to 6:30" means N separate conversations.
10. **Web push + PWA shell** — the push provider is a literal "replace with FCM" stub; Firebase Admin is already configured. This is the foundation the already-planned FOMO/wishlist features depend on.

Big-bet: **Book-together invite link with per-person payment** — per-seat holds with expiry give you the mechanics; one person fronting the full group amount is the biggest cash-flow objection in group travel. Sequence against the planned Referral Chain.

Also: `docs/mvp/mvp-plan.md` is stale — Destination Pages are listed "Not Started" but are shipped with SSR + JSON-LD.

## (e) Suggested order of attack

**Week 1 — stop losing money (backend, all in `booking.service.ts` / `payment-transaction.repository.ts` territory):** implement the refund path → filter cancelled bookings out of escrow release + reverse transfers on cancel → atomic `PENDING_PAYMENT→CONFIRMED` status gate (fixes resurrection, double-increment, and double-cancel together) → require the webhook secret in prod. These four close every money-loss hole found.

**Week 2 — make it feel fast + unbreak conversion (frontend):** delete the hydration overlay; fix the seat-conflict→"already booked" mismap; add the seat-hold countdown; mount the sonner Toaster. Four small changes, all on the highest-intent path.

**Week 3 — reliability insurance + cheap perf:** cron distributed lock + escrow unique index; expiry cron releases seats explicitly (today it works only because two constants happen to be equal); missing DB indexes; trip-list `select` discipline; booking-endpoint rate-limit tier.

**Week 4 — the lifecycle-cron product sprint:** review prompts, auto-cashback, trip reminders — three S-sized features sharing one cron and the existing notification infra, hitting trust and retention simultaneously.

**Then:** organizer retention (payout statements, trip duplication, analytics) → search → chat fixes + Socket.IO Redis adapter → web push foundation → book-together as the big bet.

One deliberate deferral: the Socket.IO adapter and multi-instance concerns are P1-not-P0 only because prod currently runs a single API container — revisit the moment you scale.
