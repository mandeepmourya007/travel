# TripCompare Backend Audit — Findings

> Audited: 2026-06-12 · Scope: `apps/api` @ commit `9a9c643`
> **All P0–P3 findings are now resolved** as of 2026-06-14.

---

## P1 — Will fall over under load / multi-instance / partial-failure ✅ RESOLVED

### P1-1. Crons have no distributed lock → **FIXED**
- New `utils/redis-lock.ts`: `withLock(key, ttlMs, fn)` using Redis `SET NX PX` + token-checked Lua release.
- Every cron job in `utils/cron-jobs.ts` wrapped in `withLock('cron:<name>', ...)`. Falls back to running directly when Redis is unavailable (dev/CI).
- Partial unique index added via migration `20260614000001_escrow_release_unique_index`: `CREATE UNIQUE INDEX ... ON "PaymentTransaction"("bookingId") WHERE type='ESCROW_RELEASE'` — DB backstop against duplicate escrow rows.
- `resolveAndRelease` in `trip-lifecycle.service.ts` now writes the ESCROW_RELEASE DB row **before** calling Razorpay and catches P2002 to prevent double `releaseTransferHold`.
- Missing wallet reconciliation job added to cron schedule (was implemented but never called).

### P1-2. No Socket.IO Redis adapter → **FIXED**
- `@socket.io/redis-adapter` installed; `socket/index.ts` creates `pub/subClient = redis.duplicate()` and calls `io.adapter(createAdapter(...))` when Redis is available. Falls back to in-memory adapter in dev.
- `presence.handler.ts` replaced `io.fetchSockets()` with a Redis connection counter (`HINCRBY chat:conn_counts`): O(1), correct across all nodes.

### P1-3. Rate limiting gaps → **FIXED**
- New `bookingRateLimit` tier (20/min) in `rate-limit.middleware.ts` applied to `POST /bookings`, `POST /:id/cancel`, `POST /:id/verify-payment`.
- Rate-limit keys already carry TTLs (PEXPIRE) — evictable under `volatile-lru` by design. Dedicated Redis DB separation remains an ops-level follow-up.

---

## P2 — Performance ✅ RESOLVED

### P2-1. Trip list queries over-fetch → **FIXED**
- New `TRIP_SELECT_SUMMARY` in `trip.repository.ts` uses `select` (not `include`) — excludes `itinerary`, `inclusions`, `exclusions`, `description` from list queries.
- Applied to `search`, `findByOrganizerId`, `findByOrganizerIdPaginated`, `findByDestinationIdPaginated`.

### P2-2. Wallet reconciliation N+1 → **FIXED**
- New `sumByDirectionBatch()` on `WalletRepository` issues a single `groupBy(['walletId','type'])` returning `Map<walletId, balance>`.
- `reconcile()` in `wallet.service.ts` now uses the batch method. Also now scheduled as a cron job (see P1-1).

### P2-3. Duplicate booking query → **FIXED**
- `findCompletedTripsForCashback` in `trip.repository.ts` now issues one `booking.findMany` and derives both the ID set and the `bookingToTrip` map from the single result.

### P2-4. Unpaginated `findMany`s → **FIXED**
- `conversation.repository.ts` `findByTripId`: `take: 200`
- `trip-request.repository.ts` `findAllPendingForOrganizer`: `take: 500`
- `booking.repository.ts` `findExpiredPendingBookings`: `take: 100`, `orderBy: expiresAt asc`
- `wallet.repository.ts` `findAll`: `select: {id, balance}` (minimal projection for reconcile)

### P2-5. Seat hydrate-then-count → **FIXED**
- New `countSeatsByTripId(tripId)` on `VehicleRepository`: single `groupBy` returning `Map<vehicleId, count>`.
- `getAllVehicles` and `recalcTripSeats` in `vehicle.service.ts` use the new method instead of loading full seat rows with booking/travelerDetail joins.

---

## P3 — Hygiene ✅ RESOLVED

### P3-1. Webhook idempotency race → **FIXED**
- New `upsertBySourceAndEventId()` on `WebhookEventRepository` replaces the find-then-create TOCTOU pattern.
- `handleWebhook` in `payment.service.ts` now uses upsert: concurrent duplicate deliveries both resolve deterministically; duplicates detected by `attempts > 1`.

### P3-2. Sitemap route bypasses service layer → **FIXED**
- New `services/sitemap.service.ts` wraps the three repo calls in a proper service.
- `server.ts` now calls `sitemapService.getSitemapData()` instead of accessing repos directly.
- `sitemapDeps` export removed from `dependencies.ts`; replaced by `sitemapService`.

---

## Claims vs Reality Scorecard

| Doc claim | Verdict | Evidence |
|---|---|---|
| Strict Controller→Service→Repository layering | ✅ | Sitemap route now calls SitemapService; crons use repos by design |
| Redis for rate limiting | ✅ | Lua sliding-window, tiers wired; booking tier added |
| Redis for caching | ✅ | `cache.service.ts` + `getOrSet` |
| Redis as Socket.IO adapter | ✅ | `@socket.io/redis-adapter` attached in `socket/index.ts` |
| Atomic seat increment, raw SQL, capacity WHERE | ✅ | `trip.repository.ts` atomicIncrementBookings |
| Webhook HMAC verification + WebhookEvent audit trail | ✅ | Upsert idempotency; raw body + timing-safe HMAC |
| Cron jobs; intervals match docs | ✅ | 8 intervals (+ wallet reconcile). Distributed lock via Redis SET NX PX |
| Escrow released after trip completion | ✅ | Create-before-Razorpay ordering; P2002 guard; DB partial unique index |
| Refunds go to wallet instantly | ✅ | `initiateRefund` wired in `cancelBooking` |
| Rate-limit middleware with general + auth + booking tiers | ✅ | general/auth/otp/webhook/booking tiers applied |
