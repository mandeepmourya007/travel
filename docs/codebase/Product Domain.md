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

## User Roles

| Role | Capabilities |
| :--- | :--- |
| **TRAVELER** | Browse/compare/book trips, seat selection, pay, review (5 rating dimensions), chat with organizer, wallet, notifications |
| **ORGANIZER** | Create/manage trips (draft → publish, edit history), vehicle/seat layouts, approve/reject requests, bookings/payments/earnings views, reply to reviews, chat |
| **ADMIN** | Dashboard with stats/charts, approve/reject organizers (Aadhaar/PAN document review), booking oversight, issue cashback, moderate flagged chats, view all payments |

> [!info] Admin Impersonation
> `TRAVELER_ROLES = [TRAVELER, ADMIN]` in [[Shared Package#Constants|shared constants]] — admins are allowed on traveler pages/endpoints.

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

Implemented in `packages/shared/src/utils/refund.ts` (`calculateRefundPercent`):

| Policy | ≥ 48h before trip | < 48h before trip |
| :--- | :---: | :---: |
| FLEXIBLE | 100% | 50% |
| MODERATE | 50% | 0% |
| STRICT | 0% | 0% |

## Existing Docs Inventory (`docs/`)

- `FEATURES.md` — feature overview by role; `PROJECT_REFERENCE.md` — older LLM reference (partly stale); `PITCH.md` — sales/investor scripts; `PROJECT_MINDMAP.md`; `qa-organizer-flows.md` / `qa-traveler-flows.md` — QA flows.
- `audit/` — repo audit @ `9a9c643` (2026-06-12). `engineering/` — db-design, tech-stack, wallet/seat-layout plans + ~16 FE feature specs in `fe/`. `mvp/mvp-plan.md`. `rnd/` — market research, Local Intel, viral features.

Related: [[Codebase Overview]] · [[Database Schema]] · [[Payments & Webhooks]]
