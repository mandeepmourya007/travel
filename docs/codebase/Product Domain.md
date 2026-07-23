---
title: Product Domain
created: 2026-07-10
type: permanent
tags:
  - codebase/product
  - domain
---

# Product Domain

**Safarnama / TripCompare** — a marketplace for curated group trips in India (Pune-first launch). Organizers who currently run their businesses on WhatsApp + UPI + Google Sheets get a storefront; travelers get discovery, comparison, and ==payment protection==.

## Differentiators

- **SafePay escrow** — funds held at the gateway (Razorpay Route `on_hold` transfers / Cashfree Easy Split scheduling) and released to the organizer only after trip completion, with a ==90-day safety buffer==. See [[Payments & Webhooks]].
- **Anti-leakage chat filter** — blocks phone/UPI/email/URL sharing in chat to keep transactions on-platform (`apps/api/src/utils/chat-filter.ts`).
- **In-app wallet** — refunds, cashback (default 5%), booking deductions, promotional credits with ==90-day expiry==.
- **Trip comparison** — side-by-side compare of up to **3** trips.
- **Dual booking modes** — `INSTANT` and `REQUEST_BASED` (organizer approves, approval expires in 48h). ==Temporarily disabled==: `REQUEST_BASED_BOOKING_ENABLED = false` in [[Shared Package#Constants|shared constants]] currently blocks choosing `REQUEST_BASED` on new trip creation and blocks switching an existing trip into it; already-existing request-based trips keep working unaffected (still accept/respond to `TripRequest`s normally). Reversible by flipping the flag to `true`.
- **Visual seat maps** — organizer builds vehicle layouts; travelers pick seats (10-minute holds).
- **Real-time chat** — Socket.IO trip chat + admin support conversations.
- **Reseller markup links** — organizer generates a shareable "main link" per (trip, reseller); the reseller (a `TRAVELER` with `User.isReseller=true` — NOT a new role) generates "sublinks" off it, each carrying its own markup on top of the trip's real price. Traveler pays base+markup; markup is ==track-only== (never paid out, never folded into the organizer commission split). See "Reseller Markup Links" below.

## User Roles

| Role | Capabilities |
| :--- | :--- |
| **TRAVELER** | Browse/compare/book trips, seat selection, pay, review (5 rating dimensions), chat with organizer, wallet, notifications |
| **ORGANIZER** | Create/manage trips (draft → publish, edit history), vehicle/seat layouts, approve/reject requests, bookings/payments/earnings views, reply to reviews, chat |
| **ADMIN** | Dashboard with stats/charts, approve/reject organizers (Aadhaar/PAN document review), booking oversight, issue cashback, moderate flagged chats, view all payments |

> [!info] Admin Impersonation
> `TRAVELER_ROLES = [TRAVELER, ADMIN]` in [[Shared Package#Constants|shared constants]] — admins are allowed on traveler pages/endpoints.

> [!important] Contact verification is booking-scoped, not account-mandatory
> The prior mandatory account-level phone-verification policy (every user forced to `User.phoneVerified === true` at login) has been retired. The business need it served — a reachable WhatsApp number — is now collected **per booking**, right after that booking's payment succeeds, since the reachable number for a trip may belong to someone other than the account owner (e.g. booking on behalf of a friend). The verified contact lives on that booking's own `TravelerDetail.phoneVerified`, never on `User.phoneVerified`. The authenticated `POST /auth/otp/attach/send` + `/verify` pair (account-level, optional) still exists as a profile-page convenience, unrelated to this booking-scoped requirement. See [[Auth & Security#Post-Payment Booking Contact Verification]].

## Core Feature Areas

- **Trips** — categories (admin-managed `TripCategory` + organizer `TripTypeRequest`), destinations, itineraries, transfer points (pickup/drop), early-bird pricing, trending scores.
- **Bookings & Trip Requests** — instant bookings expire after 60 min unpaid; request-based flow converts approved requests to bookings.
- **Payments** — multi-gateway (Razorpay default, Cashfree selectable), escrow release, refunds by cancellation policy.
- **Wallet & Cashback** — admin-issued and automatic cashback, credit expiry with reminder notifications.
- **Reviews** — one per booking, 5 dimensions (overall, organization, value, safety, accuracy), 30-day edit window, organizer replies.
- **Organizer verification** — 3 required docs (`aadhaarFront`, `aadhaarBack`, `panCard`), per-document review, bank account linking for payouts.
- **Chat & Notifications** — trip chat, admin support, 18 notification types across IN_APP / EMAIL / SMS / PUSH channels.

## Business Model

Free to list for organizers (zero upfront cost, no lock-in). Platform takes ==10% commission== (`PLATFORM_COMMISSION_PERCENT`, per-organizer override via `OrganizerProfile.commissionRate`) on protected payments; cashback drives retention.

## Refund Policy Matrix

Implemented in `packages/shared/src/utils/refund.ts` (`calculateRefundPercent`). ==Day-based cliff (replaces the old 48h/100-50-0 tiers)==: the refund window closes `REFUND_CLIFF_DAYS` (7 days) before trip start, deliberately aligned with the organizer deposit/balance payout split below so no refund issued under this policy can ever require a clawback from the organizer.

| Policy | ≥ 7 days before trip | < 7 days before trip |
| :--- | :---: | :---: |
| FLEXIBLE | `MAX_REFUND_PERCENT` (50%) | 0% |
| MODERATE | `MAX_REFUND_PERCENT` (50%) | 0% |
| STRICT | 0% | 0% |

Unrecognised/missing policy also resolves to 0% (fail-safe default).

## Organizer Deposit / Balance Payout

- **Non-refundable deposit at booking time.** For Cashfree bookings, the organizer's commission-adjusted entitlement (`E = round(baseAmount * (1 - commissionRate/100))`) is split into a **deposit** (`ORGANIZER_DEPOSIT_PERCENT` = 50% of entitlement, released immediately, non-refundable) and a **balance** (the remaining 50%, held in escrow). Implemented by `calculatePayoutSplit` in [[Shared Package#Utils|shared payout utils]].
- **Balance released at the refund cliff or on a 0%-refund cancellation.** The held balance is released to the organizer once the trip's 7-day refund cliff passes (booking is `CONFIRMED`/`COMPLETED`), or immediately for a `CANCELLED` booking where no refund was ever issued (the 0%-refund case under the matrix above) — since that money was never promised back to the traveler. A `CANCELLED` booking that *did* get a refund never releases its balance; that portion stays held permanently. See the `release-cashfree-balances` cron in [[Background Jobs & Realtime]] and the money-flow detail in [[Payments & Webhooks]].
- **Safety invariant**: `ORGANIZER_DEPOSIT_PERCENT <= 100 - MAX_REFUND_PERCENT` always, asserted at booking time by `assertPayoutSafe` — the platform never releases more to the organizer than the guaranteed-non-refundable share, so a cancellation refund can never need a clawback.
- Razorpay bookings are unaffected — this deposit/balance split is Cashfree-only (Razorpay keeps the existing SafePay `ESCROW_RELEASE` all-at-once-on-completion model).

## Reseller Markup Links

- **Not a new role.** A reseller is a normal `TRAVELER` with `User.isReseller` flipped `true` when an organizer names them (by email) on a `ResellerMainLink`. Reseller endpoints are guarded by `requireRole('TRAVELER','ADMIN')` — the `isReseller` check happens in `ResellerService`, not `requireRole` (it can't express a flag on a shared role).
- **The tuple**: organizer generates a `ResellerMainLink` per `(trip, reseller)` — now unique per pairing (`@@unique([tripId, resellerId])`), one row max per (trip, reseller). The reseller opens the main link and generates multiple `ResellerSublink`s off it, each with its own `markupAmount` (rupees, per person). A traveler opens a sublink → sees base+markup → books at that price.
- **Main link is purely internal — invite-based mental model, never user-visible.** `ResellerMainLink` is never shown as a token, a "link", or a listable entity to any role (organizer, reseller, or admin). `POST /reseller/main-links` is framed as the organizer's **"Invite Reseller"** action (trip + reseller email in, nothing else) and is **idempotent**: re-inviting the same (trip, reseller) pair is a safe no-op that returns the existing link rather than erroring or creating a duplicate row — matching the "organizer sends an invite" mental model, where re-sending shouldn't fail just because it already went out (`ResellerService.generateMainLink` check-then-creates, and additionally catches the P2002 a concurrent duplicate invite would raise). What each role actually sees:
  - **Organizer**: a flat "resellers invited for my trips" list (`GET /reseller/main-links`, same endpoint as before, now enriched with `bookingCount`/`totalMarkupAmount` via the same sum-of-sums aggregation used by `/main-links/mine`) — trip, reseller, sublink count, bookings, earnings. No main-link token ever rendered.
  - **Admin**: only the sublink-level Leads table (`GET /reseller/admin/leads`) — the "Main Links" admin view was removed entirely; reseller/organizer columns on the Leads row already answer "who invited whom."
  - **Reseller**: unchanged — sees trips shared with them (`GET /reseller/main-links/mine`) and drills into "Generate New Link"/sublinks; the `mainLinkToken` is used only as opaque plumbing passed to `POST /reseller/sublinks`, never rendered as visible text.
- **v1 limitation**: `generateMainLink` requires the named reseller to already have an account (`NotFoundError` if the email doesn't match an existing user) — no user is created on their behalf.
- **Price is server-authoritative.** The client sends only an opaque `sublinkToken` (never a price). `BookingService.createBooking` resolves markup in this order: (a) an explicit `sublinkToken` whose sublink's `tripId` matches → use it; else (b) a prior `SublinkAttribution` for `(userId, tripId)` → use its sublink; else (c) markup = 0 (byte-identical to a non-reseller booking).
- **Attribution is last-wins**: `SublinkAttribution` has `@@unique([userId, tripId])`, written via upsert — a newer sublink for the same user+trip overwrites the earlier one. This is what makes the marked-up price survive across page refresh, login, and a second device with no `?ref=` URL.
- **Commission split is base-only — everywhere money moves.** `totalAmount = baseTotal + markupTotal` (customer pays both), but `vendorAmountPaise` at booking time, the `ESCROW_RELEASE` ledger amount in `TripLifecycleService.resolveAndRelease`, and the auto-cashback basis in `TripLifecycleService.sendPostCompletionSideEffects` are all computed from `totalAmount - markupAmount` (base only) — the markup has no payout counterpart, so folding it into any of these would over-pay the organizer or over-fund cashback from money the platform never actually collected for that purpose. `Booking.markupAmount` is a frozen snapshot (`markupPerPerson × numTravelers`) at booking time, never recomputed later even if the sublink's markup is edited afterwards, and defaults to `0` for non-reseller bookings so all three calculations are byte-identical to the pre-reseller behavior in that case.
- **Public resolve** (`GET /reseller/sublinks/resolve/:token`) returns only the merged, undifferentiated price for an active sublink on a published/non-hidden trip: `tripId`, `tripSlug`, `effectivePrice`, `resellerName?`. It deliberately omits `basePrice`/`markupAmount` — even though this response is now resolved entirely client-side (see `TripDetailClient`/`useSublinkResolve` — trip-detail `page.tsx` no longer reads `?ref` server-side, since doing so on a statically-generated/ISR route forced a `DYNAMIC_SERVER_USAGE` bailout that 500'd every trip page in production), any base/markup breakdown here would still let a traveler view-source their way to the exact markup. Never leaks the organizer's identity or the reseller's email either. Authenticated organizer/reseller/admin-facing DTOs (main links, sublinks, leads) correctly keep the full breakdown since those views are authorized.
- **Leads/earnings aggregation counts only earned revenue.** `bookingCount`/`totalMarkupAmount` (organizer main-links, reseller main-links, and the leads table alike) are summed only across bookings with `bookingStatus IN (CONFIRMED, COMPLETED)` — a `PENDING_PAYMENT` (unpaid), `CANCELLED`, `EXPIRED`, or `REFUNDED` booking never generated collected markup revenue and must not inflate these figures.
- See [[Database Schema#Reseller]] for the model shapes and [[API Routes Reference#Reseller]] for the endpoint table.

## Existing Docs Inventory (`docs/`)

- `FEATURES.md` — feature overview by role; `PROJECT_REFERENCE.md` — older LLM reference (partly stale); `PITCH.md` — sales/investor scripts; `PROJECT_MINDMAP.md`; `qa-organizer-flows.md` / `qa-traveler-flows.md` — QA flows.
- `audit/` — repo audit @ `9a9c643` (2026-06-12). `engineering/` — db-design, tech-stack, wallet/seat-layout plans + ~16 FE feature specs in `fe/`. `mvp/mvp-plan.md`. `rnd/` — market research, Local Intel, viral features.

Related: [[Codebase Overview]] · [[Database Schema]] · [[Payments & Webhooks]]
