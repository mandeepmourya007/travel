# TripCompare Backend Audit — Pending Findings

> Audited: 2026-06-12 · Scope: `apps/api` @ commit `9a9c643`
> **P0 money-loss bugs and most P1 reliability bugs are resolved.** This file tracks what remains open.

---

## P1 — Will fall over under load / multi-instance / partial-failure

### P1-1. Crons have no distributed lock
**Evidence:** `src/index.ts:30` — `startCronJobs(cronDeps)` unconditionally at boot; `cron-jobs.ts:163-170` plain `setInterval`s. `docker-compose.prod.yml` currently runs a single `api` container, so it works today — but the moment you scale: duplicate escrow-release sweeps where the idempotency check itself is check-then-create (`trip-lifecycle.service.ts:103-110` reads existing ESCROW_RELEASE rows, then creates one at line 215 with no unique constraint on `(bookingId, type)`) → concurrent instances both call `releaseTransferHold` and write duplicate ESCROW_RELEASE rows, corrupting payout audit/revenue numbers.

**Fix:** Redis `SET NX PX` lock per job, or a `CRON_ENABLED=1` env flag set on exactly one instance; add a partial unique index on `PaymentTransaction(bookingId) WHERE type='ESCROW_RELEASE'`.

### P1-2. No Socket.IO Redis adapter; presence does `io.fetchSockets()` per disconnect
**Evidence:** `src/socket/index.ts:16-24` — plain `new Server(httpServer, …)`, no `@socket.io/redis-adapter` anywhere (grep: zero hits in the repo). Docs claim Redis is used as "Socket.IO adapter" — false. Presence: `socket/handlers/presence.handler.ts` keeps the online set in Redis (good) but `markOffline` calls `io.fetchSockets()` and scans all sockets on **every disconnect**, and `presence:check` falls back to full-socket scans without Redis. Under one instance it's O(N) per disconnect; under >1 instance, rooms (`user:${userId}`, conversation rooms in chat.handler) silently stop reaching users on other nodes and `fetchSockets()` only sees local sockets → wrong offline broadcasts.

**Fix:** Add `@socket.io/redis-adapter` with a pub/sub pair from the existing ioredis URL; track per-user connection counts in Redis (`HINCRBY`) instead of `fetchSockets()`.

### P1-3. Rate limiting: Redis eviction can drop limiter state; booking endpoints under-protected
**Evidence:** Redis-backed sliding window (Lua, atomic — `utils/rate-limiter.ts:20-42`) ✅, applied: global `generalRateLimit` 100/min (`server.ts:51`), `authRateLimit` 10/min on `/auth` (`server.ts:57`), `otpRateLimit` 5/min on OTP routes (`auth.routes.ts:58-62`), webhook tier (`webhook.routes.ts:27`). Login brute-force also has per-email lockout (`utils/login-attempt-tracker.ts`, 5 attempts/15min). Two real gaps: (a) `docker-compose.prod.yml` Redis now runs `volatile-lru` but rate-limit and login-lockout keys have no `TTL` set — they're ineligible for eviction under `volatile-lru`, so under memory pressure they'll never evict (use a dedicated logical DB or set TTLs); (b) booking/payment endpoints (`/bookings`, `/:id/verify-payment` — `booking.routes.ts:17-64`) only get the general 100/min tier — no dedicated stricter tier on money endpoints.

---

## P2 — Performance

### P2-1. Trip list queries over-fetch entire rows (huge JSON columns)
**Evidence:** `trip.repository.ts:62-75` (`search`), `:103-124` (`findByOrganizerIdPaginated`), `:126-169` (`findByDestinationIdPaginated`) all use `include: TRIP_INCLUDE_SUMMARY` on the full Trip row → every list row carries `itinerary Json`, `inclusions/exclusions Json`, `photos[]`, `description` (schema.prisma:314-329) even though the mapper only emits summary fields. Mitigated by 60s search cache (`trip.service.ts:55-57`) but every cache miss / organizer dashboard / destination page pays it.

**Fix:** A `TRIP_SELECT_SUMMARY` with explicit scalars (drop itinerary/description/inclusions for lists).

### P2-2. Wallet reconciliation N+1 (and it isn't even scheduled)
**Evidence:** `wallet.service.ts:213-229` — `findAll()` wallets then `sumByDirection(wallet.id)` per wallet. One groupBy over all WalletTransactions grouped by walletId would do it. Note: `reconcile()` is not in `cron-jobs.ts` at all — drift detection never runs.

### P2-3. `findCompletedTripsForCashback` runs the same booking query twice
**Evidence:** `trip.repository.ts:549-581` — bookings for `tripIds` are fetched once inside the `referenceId.in` (lines 558-563) and again to build `bookingToTrip` (lines 572-581). Fetch once, reuse.

### P2-4. Unpaginated `findMany`s
- `conversation.repository.ts:145-151` `findByTripId` — all conversations for a trip, no `take`.
- `trip-request.repository.ts:123-136` `findAllPendingForOrganizer` — unbounded with nested includes.
- `trip.repository.ts:91-101` `findByOrganizerId` (used by `getMyTrips`, trip.service.ts:84-89) — unbounded, full rows.
- `wallet.repository.ts:178-182` `findAll` — every wallet.
- `booking.repository.ts:335-350` `findExpiredPendingBookings` — no `take`; a backlog burst makes the cron poll Razorpay once per booking serially.

### P2-5. Misc
- `vehicle.service.ts:278-301` `getAllVehicles` and `recalcTripSeats` (446-456) load every seat row (with booking/travelerDetail joins via `findByTripId`) just to count — use `count()`.

---

## P3 — Hygiene

### P3-1. Webhook idempotency race
**Evidence:** `handleWebhook` is find-then-create (`payment.service.ts:168-199`); concurrent duplicate deliveries are saved only by the `@@unique([source, externalEventId])` (schema:727) throwing P2002 into a generic catch (`webhook.controller.ts:74-77`). Works, but intentional handling (check error code, return 200 explicitly) would be cleaner.

### P3-2. Layering: sitemap route hits repositories directly
**Evidence:** `server.ts:78-85` inline `/sitemap-data` route uses repositories directly (exported as `sitemapDeps`, `dependencies.ts:248-252`). Strict Controller→Service→Repository layering holds everywhere else.

### P3-3. Positive findings (keep these invariants)
MockPaymentService cannot run in prod — hard throw (`dependencies.ts:141-146`); FE payment verification does real HMAC `timingSafeEqual` (`payment.service.ts:85-99`); webhook raw-body + timing-safe compare ✅; refresh tokens hashed, rotated, family-revoked on reuse with 30s grace (`auth.service.ts:137-177`); bcrypt cost 12, JWT 15m access / 7d refresh, cookie `httpOnly+secure+sameSite=strict`; helmet + HSTS + strict CORS allowlist + `trust proxy 1`; wallet credit/debit are atomic SQL increments with `balance >= amount` guard inside `$transaction`; cashback dedup enforced by `@@unique([type, referenceModel, referenceId])` + app-level check; Redis caching real and used (trip search/detail, destinations, organizer stats) with prefix invalidation on mutations; rate limiter is a real Redis Lua sliding window.

---

## Claims vs Reality Scorecard

| Doc claim | Verdict | Evidence |
|---|---|---|
| Strict Controller→Service→Repository layering | ⚠️ Partial | Holds everywhere except inline sitemap route hitting repos (`server.ts:78-85`); crons use repos directly by design |
| Redis for rate limiting | ✅ | Lua sliding-window (`utils/rate-limiter.ts`), tiers wired in `server.ts:51,57` |
| Redis for caching | ✅ | `cache.service.ts` + `getOrSet` in trip/destination/category/organizer services |
| Redis as Socket.IO adapter | ❌ False | No `@socket.io/redis-adapter` anywhere; plain in-process server (`socket/index.ts:16-24`) |
| Atomic seat increment, raw SQL, capacity WHERE | ✅ | `trip.repository.ts:402-413` — version CAS removed; capacity predicate is sufficient |
| Webhook HMAC verification + WebhookEvent audit trail | ✅ | Raw body + timing-safe HMAC + `@@unique` event dedup + secret now required in prod |
| Cron jobs; intervals match docs | ✅ | 6 intervals match. Caveat: no distributed lock (P1-1) |
| Escrow released after trip completion | ✅ | Completion cron releases via Razorpay `transfers.edit`; CANCELLED bookings now filtered out |
| Refunds go to wallet instantly | ✅ | `initiateRefund` wired in `cancelBooking`; REFUND tx created; finalised on `refund.processed` webhook |
| Rate-limit middleware with general + auth tiers | ✅ | general/auth/otp/webhook tiers applied; in-memory fallback when Redis is down |
