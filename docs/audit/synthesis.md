# TripCompare Repository Audit — Synthesis (Updated)

> Audited: 2026-06-12 @ commit `9a9c643`. Synthesized from three parallel audits: [backend-audit.md](./backend-audit.md), [frontend-audit.md](./frontend-audit.md), [product-audit.md](./product-audit.md).
> **Week 1 (all money bugs) and most of Week 2 (high-intent frontend path) are resolved.** This document reflects what remains open.

---

## (a) Remaining reliability risk

**Cron distributed lock is missing.** `index.ts:30` boots cron jobs on every process with no Redis lock; the escrow-release idempotency check is check-then-create with no unique constraint — first scaling event creates duplicate payouts. Fix: Redis `SET NX` lock per job + a partial unique index on `PaymentTransaction(bookingId) WHERE type='ESCROW_RELEASE'`. Fine on today's single container, but cheap insurance before any horizontal scale.

---

## (b) Performance — remaining items

1. **Stop double-fetching on /trips filters.** Every filter change does a full server navigation *and* a duplicate client-side TanStack fetch of the same query (`components/trips/trip-filters.tsx:38-71` + `trip-grid.tsx:20`). `nuqs` is a declared dependency, imported nowhere — use it for shallow URL state after first paint.
2. **Trip list over-fetching:** list queries pull full rows including `itinerary`/`photos`/`description` JSON for every card (`trip.repository.ts:62-169`). Switch to an explicit summary `select`.
3. **Add the Socket.IO Redis adapter** (`socket/index.ts:16-24` — docs claim it exists; it doesn't) and replace per-disconnect `io.fetchSockets()` scans with Redis counters. Prerequisite for ever running 2+ API replicas.
4. **Unbounded queries:** unpaginated `findByOrganizerId`, `findAllPendingForOrganizer`, `findExpiredPendingBookings` (the last makes the cron poll Razorpay serially per booking).
5. **Frontend polish:** replace the 11 raw `<img>` usages (avatars, seat-map thumbs) with `next/image`; stop the 30s seat-map polling on the public trip-detail preview.

---

## (c) Remaining UX gaps

1. **Chat:** "Load earlier messages" yanks scroll to the bottom (`chat-window.tsx:40-44`), and socket sends are fire-and-forget — a rejected message looks delivered forever (`use-chat.ts:363-366`). Add scroll anchoring and ack-with-timeout.
2. **Accessibility:** the custom `Modal` (used for approve/reject and cancellation) has no focus trap while an unused Radix Dialog sits installed (`components/shared/modal.tsx:40-81`); 10 icon-only back links lack `aria-label`; vehicle deletion uses `window.confirm`.

---

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

---

## (e) Suggested order of attack

**Now (Week 3) — reliability insurance + remaining perf:**
- Cron distributed lock + escrow unique index
- Trip-list `select` discipline
- Booking-endpoint rate-limit tier
- Missing DB indexes for remaining queries (unpaginated findManys)

**Week 4 — the lifecycle-cron product sprint:**
Review prompts, auto-cashback, trip reminders — three S-sized features sharing one cron and the existing notification infra, hitting trust and retention simultaneously.

**Then:** organizer retention (payout statements, trip duplication, analytics) → search → chat fixes + Socket.IO Redis adapter → web push foundation → book-together as the big bet.

One deliberate deferral: the Socket.IO adapter and multi-instance concerns are P1-not-P0 only because prod currently runs a single API container — revisit the moment you scale.
