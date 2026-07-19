---
title: Payments & Webhooks
created: 2026-07-10
type: permanent
tags:
  - codebase/api
  - payments
---

# Payments & Webhooks

Multi-gateway payments via ==Strategy + Factory registry== built in `apps/api/src/config/dependencies.ts`. Active gateway chosen by `PAYMENT_GATEWAY` env (default `razorpay`); falls back to `MockPaymentGateway` in non-prod when unconfigured, ==throws at startup in prod==. The registry keeps **all** configured gateways so refunds/webhooks route to the originating provider (`resolveProviderFromTx` reads `PaymentTransaction.provider`).

## The Gateway Contract

`apps/api/src/providers/payment/payment-gateway.interface.ts` — `IPaymentGateway`:
`createOrder`, `capturePayment`, `verifyClientCallback`, `checkOrderStatus`, `fetchPaymentIdForOrder`, `initiateRefund`, `fetchTransferId`, `releaseTransferHold`, `createPayoutAccount`, `verifyAndParseWebhook`, `normalizeEventType`.

> [!warning] Contract Rules
> All amounts are in ==paise==. `verifyAndParseWebhook` MUST throw on a bad signature. Status vocabularies are normalized in `providers/payment/payment.constants.ts`.

## Providers

### Razorpay (`razorpay.gateway.ts`, config `config/razorpay.ts`)
- Route **linked accounts** for organizers; transfers created with `on_hold` = SafePay escrow.
- Escrow released by [[Background Jobs & Realtime#Cron Jobs|cron]] `complete-trips-safepay` via `releaseTransferHold`.
- `createPayoutAccount` requires `params.pan` — Razorpay's Route API rejects `business_type: 'individual'` linked accounts without `legal_info.pan` (400). Same requirement as Cashfree's vendor KYC guard.
- The `razorpay` SDK throws plain objects (`{ statusCode, error: {...} }`), not `Error` instances, which breaks Sentry's cause-chain linking. `toGatewayError()` normalizes these into real `Error`s before wrapping in `PaymentError` so the underlying Razorpay failure reason is visible in Sentry.

### Cashfree (`cashfree.gateway.ts`, config `config/cashfree.ts`)
- Base URLs: sandbox `https://sandbox.cashfree.com/pg`, prod `https://api.cashfree.com/pg`; API version ==`2025-01-01`==; gated by `isCashfreeConfigured()`.
- **Easy Split**: `createOrder` includes `order_splits[]` for the organizer payout; `createPayoutAccount` creates an Easy Split vendor (`POST /easy-split/vendors`, stored as `OrganizerProfile.cashfreeVendorId`).
- `capturePayment` is a **no-op** (auto-captured); `releaseTransferHold` is a **no-op** (settlement via vendor `schedule_option` — T+1 / instant).
- `initiateRefund` performs pro-rata split reversal.
- Webhook signature: HMAC-SHA256 of `timestamp + rawBody`, base64, header `x-webhook-signature`.

## Order Flow

```mermaid
graph TD
    A[POST /bookings - create booking] --> B[paymentService.createOrder]
    B --> C[Client checkout - Razorpay/Cashfree JS SDK]
    C --> D{Confirmation path}
    D -->|Client callback| E[POST /bookings/:id/verify-payment - verifyClientCallback]
    D -->|Gateway webhook| F[POST /webhooks/:provider]
    E --> G[bookingService.confirmBooking]
    F --> G
    G --> H[Capture + wallet deduction + seat confirm]
    H --> I[Escrow held - SafePay]
    I --> J[Cron: complete-trips-safepay releases after trip completion]
```

Manual reconciliation: `POST /bookings/:id/sync-payment` polls the gateway and repairs state. Instant bookings expire after ==60 minutes== unpaid (cron polls the gateway before expiring and can `recoverPaidBooking` if a webhook was missed).

## Webhook Handling

- Routes: `POST /api/v1/webhooks/razorpay` and `/cashfree`, mounted with `express.raw()` ==before the JSON parser== + `webhookRateLimit`. Each mounts only if its `*_WEBHOOK_SECRET` is set.
- `webhook.controller.ts` responds **200 immediately**, then processes asynchronously via `setImmediate()`:
  1. `paymentService.handleWebhook` — verify signature, record [[Database Schema#Auth & Audit|WebhookEvent]], idempotency via *unique(source, externalEventId)* (duplicates skipped).
  2. `processWebhookEvent` — dispatch by normalized event type.
  3. On `PAYMENT_AUTHORIZED` / `ORDER_PAID`: resolve booking from order id → `bookingService.confirmBooking`.
  4. On `REFUND_PROCESSED`: mark both the PAYMENT and REFUND `PaymentTransaction` rows as `REFUNDED`, transition `Booking.bookingStatus` → `REFUNDED`, and fire a `REFUND_PROCESSED` notification (IN_APP + EMAIL + WHATSAPP) to the traveler.

> [!tip] No Queue System
> There is **no BullMQ** — webhook processing is `setImmediate` async. Idempotency + the sync-payment endpoint + recovery crons are the safety net.

## Refunds

- Refund percent from [[Product Domain#Refund Policy Matrix|cancellation policy matrix]] (`@travel/shared` `calculateRefundPercent`).
- A refund creates a single `REFUND` PaymentTransaction — enforced by a ==DB partial-unique index== (one REFUND per booking).
- Cashfree refunds reverse splits pro-rata; Razorpay refunds via API.
- When the `REFUND_PROCESSED` webhook fires, `PaymentService.handleRefundProcessed` (via `setPostConstruct`-injected `BookingRepository` and `NotificationService`) also: (1) sets `Booking.bookingStatus = REFUNDED`; (2) sends a `REFUND_PROCESSED` notification (email + in-app + WhatsApp) to the traveler with the refund amount and trip title; (3) if no `REFUND` tx exists for the booking (externally-triggered refund via gateway dashboard), creates one with `status = REFUNDED` so the traveler can see it in their payment history.
- The `BOOKING_CANCELLED` email includes the refund amount, a "4–5 working days" processing-time note, and a link to `/cancellation-policy`.
- The `REFUND_PROCESSED` email uses a dedicated HTML template (not the generic fallback) showing the refund amount and a link to `/my-payments`.
- `PaymentService.setPostConstruct(bookingRepo, notificationService)` is called in `dependencies.ts` after `notificationService` is instantiated — this late-bind avoids the `paymentService ↔ bookingService ↔ notificationService` construction cycle.

## Organizer Deposit/Balance Payout (Cashfree Easy Split)

- Money model (`packages/shared/src/utils/payout.ts` `calculatePayoutSplit`): entitlement `E = round(baseAmount * (1 - commissionRate/100))`; deposit `D = round(E * ORGANIZER_DEPOSIT_PERCENT/100)` released at booking time (non-refundable); balance `B = E - D` held until the refund cliff passes. `assertPayoutSafe` guards `D <= platformRetained` before any deposit is attached to a gateway order.
- **168h/7-day boundary**: `calculatePayoutSplit`'s `refundWindowClosed` is derived by calling `calculateRefundPercent(cancellationPolicy, hoursUntilTrip) === 0` (from `refund.ts`) rather than reimplementing the cliff comparison — this keeps the payout-split module and the refund module in permanent agreement at exactly the 168h boundary (previously payout.ts used `<=` while refund.ts used `>=`, disagreeing at exactly 168h).
- **Frozen startDate snapshot**: the `DEPOSIT_RELEASE` `PaymentTransaction.metadata.computedSplit` includes the trip's `startDate` (ISO string) *as it was at deposit-release time*. `BookingService.cancelBooking` looks up this frozen date (via a `DEPOSIT_RELEASE` tx for the booking) and computes `hoursUntilTrip`/refund percent against it instead of the live `trip.startDate` when present — this prevents an organizer's later reschedule (`TripService.updateTrip`) from manufacturing refund eligibility the platform never reserved money for. Falls back to the live `trip.startDate` when no `DEPOSIT_RELEASE` row exists (Razorpay bookings, or Cashfree bookings with no vendor linked).
- **Atomic ledger write**: the `DEPOSIT_RELEASE` row is written in the SAME Prisma `$transaction` as the `Booking` + `PAYMENT` `PaymentTransaction` create (`BookingRepository.createWithPaymentTx`'s `depositRelease` param), not as a separate post-transaction call — this closes the crash window where a booking could exist with no `DEPOSIT_RELEASE` row (a stranded balance the cron and `cancelBooking`'s frozen-startDate lookup both depend on). `PayoutService.releaseDeposit` still exists for other callers but is no longer invoked from the create-booking path.
- **Balance-release eligibility** (`PaymentTransactionRepository.findBalanceReleaseEligibleBookings`, driven by the `release-cashfree-balances` cron): eligible bookings are `CONFIRMED`/`COMPLETED`, OR `CANCELLED` **with no `REFUND` PaymentTransaction** (the 0%-refund cancellation case — no refund was ever issued, so the organizer is entitled to the full balance). A `CANCELLED` booking that DOES have a `REFUND` tx (the >0%-refund case) is never eligible — that balance was never earned and stays held permanently.

## Frontend Side

- SDK loaders: `apps/web/src/lib/razorpay.ts`, `apps/web/src/lib/cashfree.ts`.
- Return handler page: `/payment-complete` → [[Frontend Routes Reference]].
- Hooks: `use-create-booking`, `use-verify-payment`, `use-sync-payment` → [[Data Fetching & State]].

> [!warning] Cashfree Go-Live
> Before declaring the Cashfree integration production-ready, walk the go-live checklist in `.claude/skills/cashfree-skills/pg/go-live/SKILL.md` (domain whitelisting, webhook signature verification, env-var swap, backend re-verify, dead-code cleanup).

Related: [[API Backend]] · [[Database Schema]] · [[Background Jobs & Realtime]] · [[Environment & Deployment]]
