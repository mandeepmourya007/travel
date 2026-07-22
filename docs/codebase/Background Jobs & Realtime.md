---
title: Background Jobs & Realtime
created: 2026-07-10
type: permanent
tags:
  - codebase/api
  - jobs
  - realtime
---

# Background Jobs & Realtime

## Cron Jobs

Defined in `apps/api/src/utils/cron-jobs.ts`, started from `src/index.ts` via `startCronJobs(cronDeps)`.

> [!info] Implementation Notes
> Plain `setInterval` (the `node-cron` dependency is unused). Each job wraps in a ==Redis distributed lock== (`utils/redis-lock.ts` `withLock`, falls back to direct run without Redis) and a Sentry `withMonitor` check-in.

| Job | Interval | Purpose |
| :--- | :---: | :--- |
| expire-stale-bookings | 5m | Polls gateway before expiring unpaid bookings; recovers paid-but-webhook-missed; releases seats |
| expire-stale-requests | 5m | Expire APPROVED trip requests past `approvalExpiresAt` (48h) |
| sweep-orphaned-bookings | 30m | Revert CONFIRMED-without-capture bookings after 30m |
| cleanup-expired-codes | 1h | Purge expired verification codes |
| cleanup-stale-tokens | 1h | Purge expired/revoked refresh tokens |
| cleanup-webhook-events | 24h | Purge terminal [[Database Schema#Auth & Audit|WebhookEvent]] rows > 90 days |
| complete-trips-safepay | 30m | Complete ended trips + release [[Payments & Webhooks|SafePay escrow]] |
| release-cashfree-balances | 30m | Release held BALANCE tranche for Cashfree bookings past the 7-day refund cliff — see below |
| expire-held-seats | 1m | Release seat holds past 10 minutes |
| reconcile-wallets | 1h | Wallet drift detection (logs only, no auto-fix) |
| trip-reminders | 1h | Reminders in the 24–48h pre-trip window (durable dedup via `tripReminderSentAt`) |
| expire-wallet-credits | 6h | Void expired credits + warn ones approaching expiry (7-day warning) |
| update-trending-scores | 2h (+ once at startup) | Recompute `Trip.trendingScore` via booking-velocity strategy |
| keepAlive | 14m | Ping `RENDER_EXTERNAL_URL/health` (prod only, Render free-tier keepalive) |

> [!info] release-cashfree-balances (mirrors complete-trips-safepay)
> Same `withLock` distributed-lock + `Sentry.withMonitor` wrapper as the other jobs. Queries `PaymentTransactionRepository.findBalanceReleaseEligibleBookings(cutoffDate)` where `cutoffDate = now + REFUND_CLIFF_DAYS (7 days)`, matching `trip.startDate <= cutoffDate` — i.e. the trip's refund cliff has already passed. Eligible bookings are Cashfree, `CONFIRMED`/`COMPLETED`/`CANCELLED`, have a `DEPOSIT_RELEASE` tx, and either haven't already had a `BALANCE_RELEASE` written, or (for `CANCELLED`) haven't had a `REFUND` issued (a refunded cancellation's balance was never earned and stays held permanently). For each eligible booking calls `PayoutService.releaseBalance(bookingId)`, which never throws — per-booking try/catch in the cron is a last-resort guard only, mirroring `TripLifecycleService.releaseSafePayForTrip`'s per-item error isolation so one booking's gateway failure can't stop the batch. See [[Payments & Webhooks]] for the deposit/balance money-flow rationale.

## Socket.IO

Server: `apps/api/src/socket/index.ts` — ==Redis adapter== (`@socket.io/redis-adapter`) for multi-node broadcasts, in-memory fallback. Auth: JWT in `handshake.auth.token` via `socket/middleware/socket-auth.middleware.ts`. On connect the socket joins room `user:<id>`.

### Chat events (`handlers/chat.handler.ts`)

| Client → Server | Server → Client |
| :--- | :--- |
| `chat:join` / `chat:leave` | `chat:error` |
| `chat:send` *(with ack, `clientMsgId` idempotency)* | `chat:typing-indicator` |
| `chat:typing` / `chat:stop-typing` | `chat:read-receipt` |
| `chat:read` | `chat:reaction-update` |
| `chat:react` / `chat:unreact` | |

### Presence (`handlers/presence.handler.ts`)
`presence:online` / `presence:offline` broadcasts; `presence:check` → `presence:status`; offline on disconnect.

Client side: `apps/web/src/lib/socket.ts` (`connectSocket(token)`, `getSocket`, `disconnectSocket`; URL from `NEXT_PUBLIC_SOCKET_URL`) + `socket-connector` shared component and `chat.store.ts` → [[Data Fetching & State#Zustand Stores]].

## Notifications

`notification.service.ts` — multi-channel dispatcher with a default channel map per `NotificationType`, fanning out to providers:

- **in-app** (`in-app-notification.provider.ts`) — DB row + socket emit to `user:<id>`
- **email** — Resend (`resend-email.provider.ts`) if `RESEND_API_KEY`, else Nodemailer SMTP, else mock
- **sms** / **push** — stub/log providers for now

Templates in `src/templates/index.ts`. 18 notification types defined in [[Shared Package#Constants]] (`NOTIFICATION_TYPE`); channels `IN_APP | EMAIL | SMS | PUSH`.

> [!warning] Known Drift
> The shared `NotificationType` **type union** (16 members) is missing `DOCUMENT_REUPLOAD_REQUIRED` and `WALLET_CREDIT_EXPIRING`, which exist in the constant (18) and the Prisma enum (20). See [[Shared Package#Known Inconsistencies]].

Related: [[API Backend]] · [[Payments & Webhooks]] · [[Database Schema]]
