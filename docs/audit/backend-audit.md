# TripCompare Backend Audit — Evidence-Based Findings

> Audited: 2026-06-12 · Scope: `apps/api` @ commit `9a9c643`
> Severity: P0 money-loss/double-booking → P3 hygiene.

---

## P0 — Money-loss / booking-integrity bugs

### P0-1. Refunds are never actually issued — cancelBooking computes a refund, tells the user, and does nothing
**Evidence:** `src/services/booking.service.ts:175-248`. The method computes `refundAmount` (line 187), then for CONFIRMED bookings only flips status + decrements `currentBookings` (lines 191-211), and sends a notification literally saying *"Refund: ₹${refundAmount} (${refundPercent}%)"* (line 234). There is **no call to `paymentService.initiateRefund`, no wallet credit, no REFUND PaymentTransaction anywhere in the codebase**:

```
grep -rn "initiateRefund" src/  → only the definition (payment.service.ts:124) and the mock. Zero call sites.
```

`WALLET_TX.REFUND` is likewise never used to credit a wallet. The docs claim "refunds go to wallet instantly" — false.

**Failure:** Every cancellation of a paid booking keeps 100% of the customer's money while notifying them a refund was processed. Direct financial/legal exposure.

**Fix:** In `cancelBooking`, when status was CONFIRMED and `refundAmount > 0`: inside one `$transaction` — create `PaymentTransaction(type=REFUND, status=INITIATED)`, call `initiateRefund(razorpayPaymentId, refundPaise, …)` (or `walletRepo.atomicCredit` if wallet-refund is the product decision), and mark booking REFUNDED on `refund.processed` webhook. Use the existing `@@unique([type, referenceModel, referenceId])` on WalletTransaction for idempotency.

### P0-2. Escrow is released to the organizer for CANCELLED bookings
**Evidence:** `src/repositories/payment-transaction.repository.ts:309-336` (`findCapturedTransfersForTrip`) and `:345-386` (`findUnreleasedEscrows`) filter only on `type: 'PAYMENT', status: 'CAPTURED', booking: { tripId, isDeleted: false }` — **no `bookingStatus` filter**. `trip-lifecycle.service.ts:91-128` then calls `releaseTransferHold` for each.

**Failure:** User pays (CAPTURED), cancels → booking CANCELLED, no refund issued (P0-1), and 30 minutes after trip completion the cron releases the held Route transfer to the organizer anyway. Customer money is permanently paid out for a cancelled booking.

**Fix:** Add `bookingStatus: { in: ['CONFIRMED','COMPLETED'] }` to both escrow queries; on cancellation of a captured payment, call `initiateRefund` with `reverse_all: 1` (already implemented at `payment.service.ts:124-135`) which reverses the transfer.

### P0-3. Webhook HMAC verified against empty string when `RAZORPAY_WEBHOOK_SECRET` is unset — forgeable webhooks
**Evidence:** `src/config/env.ts:12` — `RAZORPAY_WEBHOOK_SECRET: z.string().optional()` (no production refinement, unlike Razorpay keys which are enforced at `dependencies.ts:146`). `src/config/dependencies.ts:242-244`:

```ts
export const webhookRoutes = webhookController
  ? createWebhookRoutes(webhookController, env.RAZORPAY_WEBHOOK_SECRET || '')
```

`webhook-verify.middleware.ts:22-25` happily computes `createHmac('sha256', '')` — anyone who guesses the secret is empty can sign valid payloads.

**Failure:** Forged `payment.authorized`/`order.paid` events set `razorpayPaymentId` and flip `PaymentTransaction` → CAPTURED (`payment.service.ts:281-296, 319-335`) and trigger `confirmBooking` from `webhook.controller.ts:53-63`. Real capture would fail at Razorpay so full free-booking is blocked, but the payment ledger is corruptible (forged `refund.processed` → tx marked REFUNDED, `payment.service.ts:472-486`) and forged events poison the cron's "already paid, skip expiry" logic.

**Fix:** Make `RAZORPAY_WEBHOOK_SECRET` required whenever `RAZORPAY_KEY_ID` is set / NODE_ENV=production; refuse to mount webhook routes with an empty secret.

### P0-4. `confirmBooking` resurrects EXPIRED/CANCELLED bookings, and confirms bookings whose seats were already released
**Evidence:** `src/services/booking.service.ts:467-477` — the only status guard is `if (booking.bookingStatus === 'CONFIRMED') return …`. EXPIRED or CANCELLED bookings fall straight through to seat increment + capture + `updateStatus(CONFIRMED)` (line 510). The webhook path (`webhook.controller.ts:53-63`) and FE path (`verifyAndConfirmPayment`, booking.service.ts:571-613) both reach it.

Meanwhile seat holds: cron `expireHeldSeats` (`vehicle.repository.ts:255-271`) frees HELD seats and **nulls `bookingId`** after `SEAT_HOLD_MINUTES=30`. When a late payment confirms an expired booking, `confirmSeats` finds 0 held rows → throws ConflictError, which is **swallowed**: `booking.service.ts:527-529` — *"Seat confirmation failed — booking still confirmed"*. Another traveler may have legitimately held/booked those exact physical seats in between.

**Failure:** (a) booking cancelled-then-paid gets silently re-confirmed with no refund path; (b) customer is charged and CONFIRMED with no assigned seat while the same seat is sold to someone else — seat-level double-sell on a seat-selection trip.

**Fix:** Guard `confirmBooking` with an atomic `UPDATE Booking SET bookingStatus='CONFIRMED' WHERE id=? AND bookingStatus='PENDING_PAYMENT'` gate before capture; for EXPIRED bookings with a paid order, the correct action is `initiateRefund`, not confirmation. Treat seat re-acquisition failure as a hard error (re-hold by seatIds before capture, refund on failure).

---

## P1 — Will fall over under load / multi-instance / partial-failure

### P1-1. Confirmation is not transactional → double-increment of `currentBookings` and money/state divergence
**Evidence:** `booking.service.ts:485-510` — sequence is (1) `atomicIncrementBookings` (separate statement), (2) `capturePayment` (network call), (3) `bookingRepo.updateStatus(CONFIRMED)` (separate statement). The doc claim "seat confirmation and booking confirmation in one transaction" is not met. If the process dies between (2) and (3): money captured, booking still PENDING_PAYMENT, seats incremented. The next confirm attempt (webhook retry / FE) sees status ≠ CONFIRMED and **increments seats again** — the CAS version guard (`trip.repository.ts:402-413`) only protects concurrent updates, not sequential re-runs. Additionally `expireStaleBookings` sees the order as `paid` and skips expiry forever (`cron-jobs.ts:40-49`) without confirming — permanent limbo unless something retries.

**Fix:** Make increment idempotent per booking (e.g., guard on the same atomic booking-status transition from P0-4: only the request that wins `PENDING_PAYMENT→CONFIRMING` may increment), and wrap increment + status change in one `$transaction` with capture between two idempotent halves. Have the cron call `confirmBooking` (not just `continue`) when it finds a paid order.

### P1-2. Trip-wide `version` CAS causes spurious "trip may be full" failures for concurrent confirms of *different* bookings
**Evidence:** `booking.service.ts:485-492` uses `booking.trip.version` read earlier in `findWithPaymentDetails` (`booking.repository.ts:357-398`); `atomicIncrementBookings` requires `"version" = ${expectedVersion}` (`trip.repository.ts:410`). Any concurrent confirm/cancel on the same trip bumps `version` (cancel path also bumps it, booking.service.ts:203-210), so the loser gets `rowsUpdated=0` → `ConflictError('Not enough seats available — trip may be full')` **after the customer's payment was authorized**. Webhook path won't retry (200 already sent, error only logged, webhook.controller.ts:65-67); booking later expires; the authorized-but-never-captured payment is auto-refunded by Razorpay only after ~5 days.

**Fix:** The capacity predicate `"currentBookings" + N <= "maxGroupSize"` is already atomic — drop the version equality from this statement (or retry the read+CAS loop). Version CAS adds only false negatives here.

### P1-3. Double-cancel race: status check is read-then-write
**Evidence:** `booking.service.ts:177-211` — `findById` → status check (line 181) → unconditional `tx.booking.update` (line 194). Two concurrent cancel requests both pass the check and both run the seat decrement (`GREATEST(... - N, 0)` floors at 0 but still double-decrements while other bookings exist), corrupting `currentBookings` and potentially flipping FULL→ACTIVE incorrectly. Once refunds exist (P0-1), this becomes a double-refund vector.

**Fix:** `UPDATE Booking SET bookingStatus='CANCELLED' … WHERE id=? AND bookingStatus IN ('CONFIRMED','PENDING_PAYMENT')` and only proceed if 1 row updated.

### P1-4. Crons run in every API process, no distributed lock
**Evidence:** `src/index.ts:30` — `startCronJobs(cronDeps)` unconditionally at boot; `cron-jobs.ts:163-170` plain `setInterval`s. `docker-compose.prod.yml` currently runs a single `api` container (fixed `container_name: travel-api-prod`), so it works today — but the moment you scale: duplicate escrow-release sweeps where the idempotency check itself is check-then-create (`trip-lifecycle.service.ts:103-110` reads existing ESCROW_RELEASE rows, then creates one at line 215 with no unique constraint on `(bookingId, type)`) → concurrent instances both call `releaseTransferHold` and write duplicate ESCROW_RELEASE rows, corrupting payout audit/revenue numbers.

**Fix:** Redis `SET NX PX` lock per job, or a `CRON_ENABLED=1` env flag set on exactly one instance; add a partial unique index on `PaymentTransaction(bookingId) WHERE type='ESCROW_RELEASE'`.

### P1-5. No Socket.IO Redis adapter; presence does `io.fetchSockets()` per disconnect
**Evidence:** `src/socket/index.ts:16-24` — plain `new Server(httpServer, …)`, no `@socket.io/redis-adapter` anywhere (grep: zero hits in the repo). Docs claim Redis is used as "Socket.IO adapter" — false. Presence: `socket/handlers/presence.handler.ts` keeps the online set in Redis (good) but `markOffline` calls `io.fetchSockets()` and scans all sockets on **every disconnect**, and `presence:check` falls back to full-socket scans without Redis. Under one instance it's O(N) per disconnect; under >1 instance, rooms (`user:${userId}`, conversation rooms in chat.handler) silently stop reaching users on other nodes and `fetchSockets()` only sees local sockets → wrong offline broadcasts.

**Fix:** Add `@socket.io/redis-adapter` with a pub/sub pair from the existing ioredis URL; track per-user connection counts in Redis (`HINCRBY`) instead of `fetchSockets()`.

### P1-6. Rate limiting: fine single-node, fails open-ish across replicas; Redis eviction policy can drop limiter state
**Evidence:** Redis-backed sliding window (Lua, atomic — `utils/rate-limiter.ts:20-42`) ✅, applied: global `generalRateLimit` 100/min (`server.ts:51`), `authRateLimit` 10/min on `/auth` (`server.ts:57`), `otpRateLimit` 5/min on OTP routes (`auth.routes.ts:58-62`), webhook tier (`webhook.routes.ts:27`). Login brute-force also has per-email lockout (`utils/login-attempt-tracker.ts`, 5 attempts/15min). On Redis error it falls back to a **per-process in-memory** limiter (`rate-limit.middleware.ts:83-104`) — acceptable now, fail-open per fleet at scale. Two real gaps: (a) `docker-compose.prod.yml` Redis runs `--maxmemory-policy allkeys-lru` — rate-limit and login-lockout keys are evictable under memory pressure (use `volatile-lru` or a dedicated DB); (b) booking/payment endpoints (`/bookings`, `/:id/verify-payment` — `booking.routes.ts:17-64`) only get the general 100/min tier — no dedicated stricter tier on money endpoints.

### P1-7. Booking expiry doesn't release seats; relies on coincidence of equal windows
**Evidence:** `cron-jobs.ts:58` expires the booking only (`updateStatus(booking.id, 'EXPIRED')`); held seats are released solely by the separate seat cron via `heldUntil` (`vehicle.repository.ts:255-271`). It works only because `SEAT_HOLD_MINUTES = 30 === BOOKING_EXPIRY_MINUTES = 30` (`utils/constants.ts`). Anyone changing one constant desynchronizes seat inventory from booking state. Also when `createBooking`'s seat-hold fails, the booking is marked EXPIRED but the Razorpay order remains payable (booking.service.ts:417-427) — a late payment then hits P0-4 resurrection.

**Fix:** `expireStaleBookings` should call `vehicleService.releaseSeats(booking.id)` explicitly when expiring.

---

## P2 — Performance

### P2-1. Trip list queries over-fetch entire rows (huge JSON columns) — `include` without `select`
**Evidence:** `trip.repository.ts:62-75` (`search`), `:103-124` (`findByOrganizerIdPaginated`), `:126-169` (`findByDestinationIdPaginated`) all use `include: TRIP_INCLUDE_SUMMARY` on the full Trip row → every list row carries `itinerary Json`, `inclusions/exclusions Json`, `photos[]`, `description` (schema.prisma:314-329) even though the mapper only emits summary fields. Mitigated by 60s search cache (`trip.service.ts:55-57`) but every cache miss / organizer dashboard / destination page pays it.

**Fix:** A `TRIP_SELECT_SUMMARY` with explicit scalars (drop itinerary/description/inclusions for lists).

### P2-2. Escrow release N+1
**Evidence:** `trip-lifecycle.service.ts:104-110` — `for (const payment of capturedPayments) { await this.paymentTxRepo.findByBookingId(payment.bookingId) }` one query per payment just to detect prior ESCROW_RELEASE. Also `findUnreleasedEscrows` (`payment-transaction.repository.ts:345-386`) loads *all* captured payments on completed trips then filters in memory — unbounded as history grows.

**Fix:** Single query with `NOT EXISTS` subquery (or `bookingId NOT IN` batch), plus `take` batch limit.

### P2-3. Wallet reconciliation N+1 (and it isn't even scheduled)
**Evidence:** `wallet.service.ts:213-229` — `findAll()` wallets then `sumByDirection(wallet.id)` per wallet. One groupBy over all WalletTransactions grouped by walletId would do it. Note: `reconcile()` is not in `cron-jobs.ts` at all — drift detection never runs.

### P2-4. `findCompletedTripsForCashback` runs the same booking query twice
**Evidence:** `trip.repository.ts:549-581` — bookings for `tripIds` are fetched once inside the `referenceId.in` (lines 558-563) and again to build `bookingToTrip` (lines 572-581). Fetch once, reuse.

### P2-5. Unpaginated `findMany`s
- `conversation.repository.ts:145-151` `findByTripId` — all conversations for a trip, no `take`.
- `trip-request.repository.ts:123-136` `findAllPendingForOrganizer` — unbounded with nested includes.
- `trip.repository.ts:91-101` `findByOrganizerId` (used by `getMyTrips`, trip.service.ts:84-89) — unbounded, full rows.
- `wallet.repository.ts:178-182` `findAll` — every wallet.
- `trip.repository.ts:231-237` `findSlugsForSitemap` — unbounded (slug-only select, acceptable for now).
- `booking.repository.ts:335-350` `findExpiredPendingBookings` — no `take`; a backlog burst makes the cron poll Razorpay once per booking serially.

Flagged messages, admin lists, reviews, messages, notifications, wallet txns, cashback lists **are** paginated (verified: `message.repository.ts:217-243`, `review.repository.ts:110/174`, `notification.repository.ts:60-79`, `payment-transaction.repository.ts:132-202`).

### P2-6. Missing indexes (schema.prisma vs actual predicates)
Present and good: Trip `[isDeleted,status,startDate/pricePerPerson/currentBookings]`, Booking `[bookingStatus,expiresAt]`, `[userId,bookingStatus]`, `[tripId,bookingStatus]`, Message `[conversationId,createdAt]`, Notification `[userId,readAt]`, WalletTransaction `[walletId,createdAt]` + unique cashback dedup, VehicleSeat `[status,heldUntil]`, `[tripVehicleId,status]`, TripRequest `[status,approvalExpiresAt]`, PaymentTransaction order/payment-id indexes.

Missing:
1. **`Trip.tripType`** — filtered in `buildWhere` (trip.repository.ts:248) and destination filter (line 135) and `countByType` groupBy; no index includes it. Add `@@index([isDeleted, status, tripType])`.
2. **`Trip.endDate`** — `findTripsToComplete` (trip.repository.ts:476-492) filters `status IN (...) AND endDate < now ORDER BY endDate`; only `[status,startDate]` exists. Add `@@index([status, endDate])`.
3. **`Conversation.lastMessageAt`** — every conversation list sorts by it (conversation.repository.ts:134,149,168); no index. Add to `[travelerId, type]`-style composites or standalone.
4. `PaymentTransaction` cron/admin groupBys by `(type,status)` are covered by `[status,type]` ✅.
5. Hygiene: `User.@@index([email])` (schema:212) is redundant with `@unique` (schema:183).

### P2-7. Misc
- `vehicle.service.ts:278-301` `getAllVehicles` and `recalcTripSeats` (446-456) load every seat row (with booking/travelerDetail joins via `findByTripId`) just to count — use `count()`.
- Trip detail payload is disciplined: reviews capped at `take: 10`, transfer points selected, no bookings included (`trip.repository.ts:27-53`) ✅.
- Redis caching reality: real and used — trip search (60s), trip detail (300s), destinations (600s), categories, organizer profile/stats (`trip.service.ts:56,69,115,415`, `destination.service.ts:37,109`), with prefix invalidation on booking mutations (`booking.service.ts:52-58`). Doc claim "caching" ✅.

---

## P3 — Hygiene / config

1. **`REDIS_URL` optional in prod** (`env.ts:16-19`): unset → no cache, in-memory rate limiting/lockout only (`redis.ts:12-15`). Should be required in production.
2. **Webhook out-of-order events**: a late `payment.authorized` downgrades a CAPTURED tx back to AUTHORIZED (`payment.service.ts:271-272` — unconditional `updateStatus`). Guard transitions.
3. **Webhook idempotency race**: `handleWebhook` is find-then-create (`payment.service.ts:168-199`); concurrent duplicate deliveries are saved only by the `@@unique([source, externalEventId])` (schema:727) throwing P2002 into a generic catch (`webhook.controller.ts:74-77`). Works, but intentional handling would be cleaner.
4. **Layering**: strict C→S→R holds across modules, except the inline `/sitemap-data` route in `server.ts:78-85` which uses repositories directly (exported as `sitemapDeps`, dependencies.ts:248-252).
5. **Good** (positive findings): MockPaymentService cannot run in prod — hard throw (`dependencies.ts:141-146`); FE payment verification does real HMAC `timingSafeEqual` (`payment.service.ts:85-99`); webhook raw-body + timing-safe compare ✅ (`webhook-verify.middleware.ts:22-35`); refresh tokens hashed, rotated, family-revoked on reuse with 30s grace (`auth.service.ts:137-177`); bcrypt cost 12, JWT 15m access / 7d refresh, cookie `httpOnly+secure+sameSite=strict` scoped to `/api/v1/auth` (`constants.ts COOKIE_OPTIONS`); helmet + HSTS + strict CORS allowlist + `trust proxy 1` (`server.ts:22-32`, `cors.ts`); wallet credit/debit are atomic SQL increments with `balance >= amount` guard inside `$transaction` (`wallet.repository.ts:69-144`); cashback dedup enforced by `@@unique([type, referenceModel, referenceId])` (schema:771) plus app-level check (`admin.service.ts:442-444`); Prisma pool is default (single replica, 512MB container — fine; set `connection_limit` before scaling).

---

## Claims vs Reality Scorecard

| Doc claim | Verdict | Evidence |
|---|---|---|
| Strict Controller→Service→Repository layering | ⚠️ Partial | Holds everywhere except inline sitemap route hitting repos (`server.ts:78-85`); crons use repos directly by design |
| Redis for rate limiting | ✅ | Lua sliding-window (`utils/rate-limiter.ts`), tiers wired in `server.ts:51,57` |
| Redis for caching | ✅ | `cache.service.ts` + `getOrSet` in trip/destination/category/organizer services |
| Redis as Socket.IO adapter | ❌ False | No `@socket.io/redis-adapter` anywhere; plain in-process server (`socket/index.ts:16-24`) |
| Atomic seat increment, raw SQL, version CAS, cross-column WHERE | ✅ (with caveat) | `trip.repository.ts:402-413` exactly as claimed; caveat: trip-wide version causes spurious confirm failures (P1-2), and increment isn't idempotent per booking (P1-1) |
| Webhook HMAC verification + WebhookEvent audit trail | ⚠️ Partial | Raw body + timing-safe HMAC + `@@unique` event dedup all real (`webhook-verify.middleware.ts`, `payment.service.ts:157-203`); but secret is optional → empty-key HMAC in prod (P0-3) |
| 6 cron jobs; expireStaleBookings 5min polls Razorpay first; expireHeldSeats 1min; completeTrips 30min | ✅ | Exactly 6 intervals (`cron-jobs.ts:163-170`); Razorpay poll before expiry (`cron-jobs.ts:40-56`); intervals match. Caveat: runs on every replica, no lock (P1-4) |
| Escrow released 90 days / after trip completion | ⚠️ Partial | `on_hold_until = endDate + 90d` is only a backstop on the order transfer (`booking.service.ts:366-377`); actual release is the 30-min completion cron via real Razorpay `transfers.edit on_hold:false` (`payment.service.ts:370-388`) — real payout, but it also pays out CANCELLED bookings (P0-2), and transfers are attached only in production with a real `acc_` ID (booking.service.ts:361-364) |
| Refunds go to wallet instantly | ❌ False | No refund of any kind is ever executed — `initiateRefund` has zero call sites; `cancelBooking` only notifies (P0-1) |
| Rate-limit middleware with general + auth tiers | ✅ | general/auth/otp/webhook tiers (`rate-limit.middleware.ts:108-111`), all applied; in-memory fallback when Redis is down (per-process, not cross-replica) |

**Top 3 to fix first:** P0-1 (implement the refund path), P0-2 (bookingStatus filter on escrow queries + reverse transfers on cancel), P0-4/P1-1 (atomic `PENDING_PAYMENT→CONFIRMED` status gate making confirm idempotent and un-resurrectable). These three close every money-loss hole found.
