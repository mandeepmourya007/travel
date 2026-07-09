---
name: travel-auth-security
description: >-
  travel (Safarnama/TripCompare) auth chain, role model, ownership scoping,
  payment/webhook security, and output-sanitization rules. Use before adding
  or reviewing protected routes, payment/webhook handlers, chat features, or
  any endpoint that returns user/organizer/booking data.
paths:
  - apps/api/src/middleware/**
  - apps/api/src/routes/**
  - apps/api/src/providers/payment/**
  - apps/api/src/utils/chat-filter.ts
---

# Travel Auth & Security

**Read this skill before** writing or reviewing route handlers in `apps/api/src/routes/` + `controllers/`, middleware in `apps/api/src/middleware/`, payment/webhook code in `apps/api/src/providers/payment/`, or chat handlers in `src/socket/handlers/`.

**Source of truth:** `apps/api/src/middleware/auth.middleware.ts`, `role.middleware.ts`, `webhook-verify.middleware.ts`, `apps/api/src/utils/chat-filter.ts`, `apps/api/src/routes/booking.routes.ts` (reference route file), `docs/codebase/Auth & Security.md`, `docs/codebase/Payments & Webhooks.md`, `docs/codebase/Product Domain.md`.

This app has **no Cognito, no company/tenant concept, no per-tenant API keys, no CORS-per-tenant surface**. Auth is JWT-based (access + rotating refresh token), roles are TRAVELER/ORGANIZER/ADMIN, and "isolation" means **ownership scoping**, not tenant partitioning. Do not port oprag's `requireAuthenticatedWorkspace`/`requireAuthenticatedProject`/membership-role-rank model as-is — this section documents the real equivalent.

---

## 1. Auth chain (exact sequence)

No API-gateway JWT authorizer — the Express app verifies everything in-process.

### Step 1 — `authMiddleware`

```typescript
// createAuthMiddleware(authService) — apps/api/src/middleware/auth.middleware.ts
const header = req.headers.authorization        // must be "Bearer <token>"
const payload = authService.verifyAccessToken(token)
req.user = payload                                // { userId, role }
```
- Access token: JWT HS256, `JWT_SECRET` (min 32 chars), **15-minute** expiry.
- Refresh token: **7 days**, stored hashed in `RefreshToken` (with `familyId`, device info, IP), delivered as an **HttpOnly cookie** — never in a JSON body or localStorage.
- Also enriches the AsyncLocalStorage request-context store (`store.userId`, `store.role`, `store.logger`) so `getLogger()` carries user context automatically — never re-derive `userId`/`role` manually elsewhere.
- Missing/invalid header → `AuthError` (401).

### Step 2 — `requireRole(...roles)`

```typescript
// apps/api/src/middleware/role.middleware.ts
export function requireRole(...roles: UserRole[]) {
  return (req, _res, next) => {
    if (!req.user) return next(new AuthError('Not authenticated'))
    if (!roles.includes(req.user.role)) return next(new ForbiddenError('Insufficient permissions'))
    next()
  }
}
```
Roles come from `packages/shared/src/constants/roles.ts`: `USER_ROLES = ['TRAVELER', 'ORGANIZER', 'ADMIN']`, `USER_ROLE.<X>` object form, `TRAVELER_ROLES = [TRAVELER, ADMIN]`.

> [!important] Admin impersonation
> `TRAVELER_ROLES` deliberately includes `ADMIN` — traveler-facing routes are guarded with `requireRole(...TRAVELER_ROLES)` so admins can hit traveler endpoints (support/debugging). This is intentional, not a bug — don't "fix" it by removing ADMIN from traveler route guards.

Canonical wiring (`booking.routes.ts` pattern, see `apps/api/CLAUDE.md`):

```typescript
router.post(
  '/',
  someRateLimit,
  authMiddleware,
  requireRole('ORGANIZER', 'ADMIN'),
  validate(createXSchema),
  controller.createX,
)
```

### Step 3 — Ownership checks (the part `requireRole` does NOT cover)

`requireRole` only checks role membership, never resource ownership. There is no `requireAuthenticatedProject`-style helper that re-fetches and asserts ownership generically — **every service method that touches a specific booking/trip/wallet must do its own ownership check**, using `req.user!.userId` (never an ID from the request body):

```typescript
// trip.service.ts pattern — repeated at every organizer-mutation call site
const profile = await this.organizerProfileRepo.findByUserId(userId)
if (!profile || trip.organizerId !== profile.id) {
  throw new ForbiddenError('You can only manage your own trips')
}
```
```typescript
// booking.repository.ts pattern — owner FK baked into the WHERE clause itself
private buildUserWhere(userId: string, tab?: string): Prisma.BookingWhereInput {
  return { userId, isDeleted: false, ...tabFilter }   // userId REQUIRED — IDOR prevention
}
```

Two equally valid patterns, pick based on where the check is cheapest:
- **Repository-level**: bake the owning FK into `WHERE` so a mismatched ID returns zero rows (safe default, avoids ever fetching another user's row).
- **Service-level**: fetch the resource, then compare its owning FK to `req.user!.userId`/the caller's `OrganizerProfile.id`, throw `ForbiddenError`.

Wrong-owner access should generally look like **404 (not found)** to the caller when existence itself is sensitive, and `ForbiddenError` (403) when the resource's existence is already public (e.g. a published trip listing) but the mutation isn't allowed — follow whichever the existing sibling handler in the same file does; don't invent a third convention.

---

## 2. Role model — what replaces oprag's member/admin/owner rank

There is **no numeric role-rank hierarchy** here (no `member(1) < admin(2) < owner(3)`). The three roles are largely disjoint by domain, not layered:

| Role | Scope |
| :--- | :--- |
| **TRAVELER** | Own bookings, own wallet, own reviews, chat as traveler. Never another traveler's data. |
| **ORGANIZER** | Own `OrganizerProfile` and everything hanging off it (trips, vehicle layouts, bookings *for those trips*, earnings, review replies). Never another organizer's trips. |
| **ADMIN** | Everything, platform-wide — organizer verification, all bookings/payments, cashback issuance, chat moderation. Also inherits `TRAVELER_ROLES` access for impersonation/support. |

There is no "assign owner role" concept, no per-workspace membership table — role is a single column on `User`, set at signup/invite time and changed only by an admin action (organizer invite flow, `apps/api/src/routes/... invite...`).

---

## 3. Payment & webhook security

Payments go through a `IPaymentGateway` interface (`apps/api/src/providers/payment/payment-gateway.interface.ts`) implemented by `RazorpayGateway` and `CashfreeGateway`, selected by `PAYMENT_GATEWAY` env — **never call the Razorpay/Cashfree SDKs directly from a service**. All amounts are paise (`Int`).

### Webhook signature verification

- Routes mount `express.raw()` **before** the JSON body parser, then `webhookRateLimit`, then signature verification, then the controller. Getting the raw-body-before-json-parser ordering wrong silently breaks signature verification (Express will have already consumed/reparsed the body).
- Razorpay: `webhook-verify.middleware.ts` — HMAC-SHA256 of the raw body with `x-razorpay-signature`, compared via `crypto.timingSafeEqual` (never `===` on digests — timing attack). Missing header or bad signature → `AuthError` (401), never a silent skip.
- Cashfree: HMAC-SHA256 of `timestamp + rawBody`, base64, header `x-webhook-signature`, verified inside `CashfreeGateway.verifyAndParseWebhook` (contract requires it **throw** on a bad signature — never return a falsy "invalid" value that a caller could forget to check).
- Each webhook route only mounts if its corresponding `*_WEBHOOK_SECRET` env var is set — don't add a webhook route that's reachable with no secret configured.
- Idempotency: every processed webhook is recorded in `WebhookEvent` with a unique `(source, externalEventId)` constraint; duplicates must be skipped, not reprocessed (an event replayed by the gateway must not double-capture a payment or double-issue a refund).
- The controller responds **200 immediately** and processes via `setImmediate()` — there's no queue (no BullMQ). Any new webhook handler must follow this ack-then-process shape so the gateway doesn't retry due to a slow synchronous handler.

### Escrow (SafePay) and refunds — correctness, not just auth

- Funds are held at the gateway (Razorpay Route `on_hold` transfer / Cashfree Easy Split scheduling) and released to the organizer only after trip completion **plus a 90-day safety buffer**, via the `complete-trips-safepay` cron calling `releaseTransferHold`. Never release escrow synchronously from a booking-confirmation or trip-completion request handler — it is cron-driven for a reason (buffer window, batch reconciliation).
- Refund percentage is derived from the trip's `cancellationPolicy` via `calculateRefundPercent` in `packages/shared/src/utils/refund.ts` (FLEXIBLE 100%/50%, MODERATE 50%/0%, STRICT 0%/0% depending on the ≥48h/<48h cutoff) — never hardcode a refund percentage inline; always call the shared function so policy changes stay in one place.
- A `REFUND` `PaymentTransaction` is constrained to **one per booking** by a raw-SQL partial-unique index (not visible in `schema.prisma`'s declarative blocks) — don't assume you can safely retry a refund creation without checking whether one already exists first.
- `resolveProviderFromTx` reads `PaymentTransaction.provider` to route refunds/webhooks to the gateway that actually processed the original payment — never assume "whatever `PAYMENT_GATEWAY` env says today" when acting on a historical transaction; a booking paid via Razorpay must always refund via Razorpay even if the platform has since switched default gateways.

### Manual reconciliation

`POST /bookings/:id/sync-payment` polls the gateway and repairs state — this exists because there's no queue/retry infra; any new payment code path that can silently drift from gateway truth should have (or reuse) an equivalent reconciliation path, not just rely on the webhook arriving.

---

## 4. Chat anti-leakage filter

`apps/api/src/utils/chat-filter.ts` — `filterChatMessage(content)` blocks phone numbers (`+91` + 10-digit), UPI handles, WhatsApp links, email addresses, generic URLs, and Instagram-style handles via regex, replacing matches with `[contact info hidden]` and setting `isFlagged: true`. Flagged messages surface at `/admin/chat` for moderation.

Rules for anything that writes a `Message`:
- Always run new message content through `filterChatMessage` before persisting/broadcasting — never let raw content reach the other party unfiltered, even for "trusted" senders (organizers can leak contact info just as easily as travelers).
- `originalContent` is only populated when flagged (kept for admin moderation) — don't expose `originalContent` to the two chat participants, only to admin-facing endpoints.
- If you add a new leakable-info pattern (e.g. a new messaging app link format), add a regex here rather than duplicating filtering logic elsewhere — this is the single point of enforcement, and Socket.IO message handlers (`src/socket/handlers/`) must call the same function the REST message endpoints use.

---

## 5. Output sanitization — what must never leave the API

There's no `sanitize*` helper library like oprag's `@oprag/api-contract` sanitizers — sanitization here is done by **`select`-ing only safe fields in the repository** (see `travel-prisma-patterns` skill §2) rather than a post-fetch strip step. When adding a new endpoint or repository method that returns a `User`/`OrganizerProfile`/payment row, explicitly enumerate the `select`, don't `include`/return the raw model, and never allow these fields to reach a JSON response:

| Never return | Where it lives |
| :--- | :--- |
| `passwordHash` | `User` |
| Raw refresh token value (only the **hash** is stored; the plaintext exists only in the HttpOnly cookie at issuance) | `RefreshToken.tokenHash` |
| `googleId` (internal OAuth linkage, not needed by any client view) | `User` |
| Full webhook `headers`/`payload` blobs to non-admin callers | `WebhookEvent` |
| Gateway secrets / webhook signing secrets (`*_WEBHOOK_SECRET`, API keys) | env vars — never logged or echoed in error responses either |
| `razorpayAccountId` / `cashfreeVendorId` internals beyond what the organizer's own settings page needs | `OrganizerProfile` |
| Other users' `email`/`phone` on public-facing endpoints (e.g. a trip listing must not leak the organizer's personal phone, only business-facing fields) | various |

Also note: this schema already draws a distinction between the internal Prisma primary key and any "reference" fields — `WalletTransaction.referenceId`/`referenceModel` are polymorphic pointers used internally; don't expose them as if they were a stable public identifier for a different resource type without checking what they point to.

Errors: never leak Prisma internals (constraint names, raw SQL), JWT secrets, or gateway credentials in an error message returned to the client (see `apps/api/CLAUDE.md` error-handling table) — throw the appropriate `AppError` subclass and let `error-handler.middleware.ts` shape the response.

---

## 6. What replaced oprag's CORS/API-key surface

There is no public embed/widget API with per-project API keys here. The real surfaces:

| Surface | Auth | Notes |
| :--- | :--- | :--- |
| Dashboard/traveler/organizer REST API | `Authorization: Bearer <JWT>` via `authMiddleware` | 15-min access token, in-memory only on the frontend (never persisted — XSS mitigation) |
| Refresh | HttpOnly cookie, `POST /auth/refresh` | Rotates within a `familyId`; reuse of a revoked token can burn the whole family |
| Webhooks (`/webhooks/razorpay`, `/webhooks/cashfree`) | Gateway HMAC signature, not JWT | See §3 |
| CORS | `CLIENT_URL` + `ALLOWED_ORIGINS` allowlist (`config/cors.ts`) | No per-tenant/per-project origin list — one allowlist for the whole API |
| Socket.IO | Same JWT verified at socket-auth time, attached to the socket — never trust `userId`/`role` from a socket payload | `src/socket/middleware/` |

---

## 7. Common mistakes

1. **Trusting a role/userId/ownerId from the request body** — `req.user!.userId`/`req.user!.role` (set by `authMiddleware` from the verified JWT) is the only trustworthy source; a client-supplied `userId` in a POST body for "which user this booking belongs to" must be ignored.
2. **Confusing `requireRole` with an ownership check** — `requireRole('ORGANIZER')` proves the caller is *some* organizer, not that they own *this* trip/booking. Every mutation on a specific resource needs an explicit ownership check in the service (or an owner-FK-scoped repository query).
3. **Removing ADMIN from a traveler-route guard** — `TRAVELER_ROLES` including ADMIN is intentional (impersonation/support), not a leftover bug.
4. **Skipping signature verification order** — webhook routes must have `express.raw()` mounted before the JSON parser and before the signature-verify middleware; reordering breaks signature checks silently (wrong bytes get HMAC'd).
5. **Releasing escrow or issuing a refund synchronously from a request handler** instead of going through the cron/gateway-mediated flow — breaks the 90-day buffer and reconciliation guarantees.
6. **Returning a full Prisma model** (`include` everything, no `select`) from a new endpoint — easy way to leak `passwordHash`, `tokenHash`, or webhook payloads by accident.
7. **Bypassing the chat filter** for a new message-sending path (e.g. a new Socket.IO event or bulk-import script) — any code that persists `Message.content` must go through `filterChatMessage` first.
8. **Hardcoding a refund percentage** instead of calling `calculateRefundPercent` from `packages/shared/src/utils/refund.ts`.

## Pre-ship security checklist

- [ ] Every protected route has `authMiddleware`, and `requireRole(...)` where the endpoint is role-restricted.
- [ ] Every resource-specific mutation/read has an explicit ownership check (repository-level owner-FK in `WHERE`, or service-level compare against `req.user!.userId`) — not just a role check.
- [ ] New repository `select`/`include` shapes exclude `passwordHash`, `tokenHash`, raw webhook payloads, gateway secrets.
- [ ] New webhook routes: raw body before JSON parser, signature verified with `timingSafeEqual`/gateway SDK, only mounted when the secret env var is set, idempotent via `WebhookEvent` unique constraint.
- [ ] Refund/escrow logic calls the shared `calculateRefundPercent` and goes through the cron/gateway flow, not an ad hoc synchronous release.
- [ ] Any new chat-sending code path calls `filterChatMessage` before persisting/broadcasting.
- [ ] No Prisma internals, secrets, or JWT details in an error response — uses an `AppError` subclass.
- [ ] Socket handlers derive `userId`/`role` from the authenticated socket, never from the incoming payload.
