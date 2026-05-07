# Project Mind Map — TripCompare (Group Travel Aggregator)

> **Visual text-based mind map** for quick orientation. For details, see `PROJECT_REFERENCE.md`.

---

## Top-Level Overview

```
                            ┌─────────────────────┐
                            │    TripCompare       │
                            │  Group Travel Agg.   │
                            │  (Pune, India)       │
                            └─────────┬───────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
      ┌───────▼──────┐       ┌───────▼──────┐       ┌───────▼──────┐
      │   apps/api   │       │   apps/web   │       │ packages/    │
      │  Express BE  │       │  Next.js FE  │       │   shared     │
      │  Port 4000   │       │  Port 3000   │       │ Types+Zod    │
      └──────────────┘       └──────────────┘       └──────────────┘
```

---

## User Roles & Capabilities

```
                         ┌──────────┐
                         │  USERS   │
                         └────┬─────┘
              ┌───────────────┼───────────────┐
              │               │               │
       ┌──────▼─────┐  ┌─────▼──────┐  ┌─────▼────┐
       │  TRAVELER   │  │ ORGANIZER  │  │  ADMIN   │
       └──────┬──────┘  └─────┬──────┘  └─────┬────┘
              │               │               │
  ┌───────────┤     ┌─────────┤      ┌────────┤
  │ Browse    │     │ Create  │      │ Flag   │
  │ Book      │     │  Trips  │      │  Chats │
  │ Pay       │     │ Manage  │      │ View   │
  │ Review    │     │ Bookings│      │  All   │
  │ Chat      │     │ Respond │      │ Payments│
  │ Wallet    │     │  Reqs   │      │ Verify │
  │ Compare   │     │ Reply   │      │  Orgs  │
  └───────────┘     │ Reviews │      └────────┘
                    │ Chat    │
                    │ Payments│
                    └─────────┘
```

---

## Backend Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Express Server                             │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Helmet   │  │  CORS    │  │Rate Limit│  │ Logger   │           │
│  │(security)│  │          │  │ (Redis)  │  │ (Pino)   │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       └──────────────┴──────────────┴──────────────┘                │
│                            │                                        │
│  ┌─────────────────────────▼─────────────────────────────────────┐  │
│  │                    ROUTE LAYER (12 routes)                    │  │
│  │  auth • trips • bookings • payments • wallet • reviews       │  │
│  │  chat • destinations • uploads • webhooks • health           │  │
│  └─────────────────────────┬─────────────────────────────────────┘  │
│                            │                                        │
│  ┌─────────────────────────▼─────────────────────────────────────┐  │
│  │              MIDDLEWARE (validate + auth + role)               │  │
│  │  Zod validation │ JWT auth │ Role check │ Webhook HMAC       │  │
│  └─────────────────────────┬─────────────────────────────────────┘  │
│                            │                                        │
│  ┌─────────────────────────▼─────────────────────────────────────┐  │
│  │                 CONTROLLER LAYER (12 controllers)             │  │
│  │  Thin: parse request → call service → send response          │  │
│  └─────────────────────────┬─────────────────────────────────────┘  │
│                            │                                        │
│  ┌─────────────────────────▼─────────────────────────────────────┐  │
│  │                  SERVICE LAYER (13 services)                  │  │
│  │  ALL business logic lives here                                │  │
│  │  auth • trip • booking • payment • wallet • review • chat    │  │
│  │  otp • destination • upload • payment-history • firebase     │  │
│  └─────────────────────────┬─────────────────────────────────────┘  │
│                            │                                        │
│  ┌─────────────────────────▼─────────────────────────────────────┐  │
│  │               REPOSITORY LAYER (15 repositories)              │  │
│  │  ALL DB queries (Prisma only) — never in services             │  │
│  └─────────────────────────┬─────────────────────────────────────┘  │
│                            │                                        │
│  ┌─────────────────────────▼─────────────────────────────────────┐  │
│  │                    Prisma ORM → PostgreSQL                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │  Socket.IO Server   │  │  Cron Jobs (4) │  │   Providers     │  │
│  │  Chat + Presence    │  │  Expire stale  │  │  OTP (MSG91)    │  │
│  │  JWT auth           │  │  bookings/reqs │  │  Email (SMTP)   │  │
│  │                     │  │  Cleanup tokens│  │  Payment (Rzp)  │  │
│  └─────────────────────┘  └────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Next.js 14 (App Router)                      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    PROVIDERS (root)                         │  │
│  │  QueryClient • GoogleOAuth • CompareQueue • Toast • Loader │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │                     PAGE ROUTES                             │  │
│  │                                                             │  │
│  │  PUBLIC              TRAVELER           ORGANIZER   ADMIN   │  │
│  │  ─────              ────────           ─────────   ─────   │  │
│  │  /                  /my-bookings       /dashboard  /admin/  │  │
│  │  /trips             /my-payments       /dashboard/  chat   │  │
│  │  /trips/[slug]      /wallet             trips      /admin/  │  │
│  │  /trips/compare     /messages          /dashboard/  payments│  │
│  │  /login             /profile            trips/              │  │
│  │  /signup                                create              │  │
│  │  /onboarding                           /dashboard/          │  │
│  │  /organizers/[id]                       requests            │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │                    COMPONENTS                               │  │
│  │                                                             │  │
│  │  ui/ (29)        shared/ (24)      domain/                  │  │
│  │  ────────        ──────────        ────────                 │  │
│  │  Button          AuthGuard         trips/ (31)              │  │
│  │  Card            RoleGuard         booking/ (4)             │  │
│  │  Dialog          DataStates        bookings/ (9)            │  │
│  │  Select          Pagination        chat/ (12)               │  │
│  │  Tabs            Modal             dashboard/ (9)           │  │
│  │  Form            Toast             payments/ (9)            │  │
│  │  ...             Spinner           wallet/ (6)              │  │
│  │                  PhoneInput        profile/ (5)             │  │
│  │                  StarRating        auth/ (10)               │  │
│  │                                    home/ (4)                │  │
│  │                                    layout/ (3)              │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │                   HOOKS (43 custom)                         │  │
│  │  Every hook wraps apiClient + TanStack Query               │  │
│  │  Components NEVER call apiClient directly                   │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │                     DATA LAYER                              │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ TanStack    │  │   Zustand    │  │   API Client     │  │  │
│  │  │ Query 5     │  │   Stores     │  │   (Axios)        │  │  │
│  │  │             │  │              │  │                   │  │  │
│  │  │ Server      │  │ auth.store   │  │ Auto JWT attach  │  │  │
│  │  │ state cache │  │ chat.store   │  │ Auto 401 refresh │  │  │
│  │  │ Query key   │  │ loading.store│  │ Error extraction  │  │  │
│  │  │ factories   │  │              │  │ Loading overlay   │  │  │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Map

```
┌───────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL 15                                   │
│                                                                       │
│  ┌─────────┐ 1:1 ┌──────────────────┐ 1:N ┌──────────┐              │
│  │  User   │─────│ OrganizerProfile │─────│   Trip   │              │
│  │         │     └──────────────────┘     │          │              │
│  │ TRAVELER│                               │ DRAFT    │              │
│  │ORGANIZER│ 1:1 ┌────────┐               │ ACTIVE   │              │
│  │ ADMIN   │─────│ Wallet │               │ FULL     │              │
│  └────┬────┘     └───┬────┘               │COMPLETED │              │
│       │              │                     │CANCELLED │              │
│       │         1:N  │                     └────┬─────┘              │
│       │    ┌─────────▼──────────┐               │                    │
│       │    │ WalletTransaction  │     ┌─────────┼──────────┐        │
│       │    │ REFUND|CASHBACK    │     │         │          │        │
│       │    │ BOOKING_DEDUCTION  │     │    1:N  │     1:N  │        │
│       │    └────────────────────┘     │         │          │        │
│       │                          ┌────▼───┐ ┌───▼────┐ ┌──▼──────┐ │
│  1:N  │                          │Booking │ │Review  │ │TripReq  │ │
│  ┌────▼─────────────┐            │        │ │        │ │ PENDING │ │
│  │ Booking          │            │PENDING │ │1-5 star│ │APPROVED │ │
│  │ (+ TravelerDtl)  │◄───────── │CONFIRM │ │comment │ │REJECTED │ │
│  │ (+ PaymentTx)    │           │CANCEL  │ │photos  │ │ EXPIRED │ │
│  └──────────────────┘           │REFUNDED│ └────────┘ │CONVERTED│ │
│                                  │EXPIRED │             └─────────┘ │
│                                  └────────┘                          │
│                                                                       │
│  ┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐      │
│  │  Conversation   │────│   Message    │    │  Destination    │      │
│  │  TRIP_CHAT      │1:N │ TEXT|IMAGE   │    │  name, state    │      │
│  │  ADMIN_SUPPORT  │    │ FILE|SYSTEM  │    │  slug, popular  │      │
│  └─────────────────┘    │ +reactions   │    └─────────────────┘      │
│                          │ +flagged    │                              │
│                          └──────────────┘                              │
│                                                                       │
│  ┌──────────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │ TripTransferPoint│  │  Notification  │  │  WebhookEvent       │  │
│  │ PICKUP | DROP    │  │ EMAIL|SMS|PUSH │  │  (immutable audit)  │  │
│  └──────────────────┘  └────────────────┘  └──────────────────────┘  │
│                                                                       │
│  ┌──────────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │ RefreshToken     │  │VerificationCode│  │  TripEditHistory    │  │
│  │ (hashed)         │  │ (OTP, hashed)  │  │  (snapshot audit)   │  │
│  └──────────────────┘  └────────────────┘  └──────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Feature Domain Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                       FEATURE DOMAINS                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                        AUTH                                   │   │
│  │  Phone OTP (MSG91/Firebase) • Email OTP • Google OAuth       │   │
│  │  JWT access+refresh • Role-based guards • Onboarding flow    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                       TRIPS                                   │   │
│  │  Create/Edit/Delete • Publish draft • Filter/Search/Sort     │   │
│  │  Trip types (6) • Itinerary (JSON) • Photos (Cloudinary)     │   │
│  │  Transfer points (pickup/drop) • Edit history (audit)        │   │
│  │  Early bird pricing • Cancellation policies (3 types)        │   │
│  │  Compare up to 3 trips side-by-side                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      BOOKINGS                                 │   │
│  │  Instant booking • Request-based booking                      │   │
│  │  Traveler details form • Payment flow (Razorpay)             │   │
│  │  Wallet deduction • Trip protection option                    │   │
│  │  Cancel with refund (per cancellation policy)                 │   │
│  │  Expiry cron (5min) with Razorpay poll safety net             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      PAYMENTS                                 │   │
│  │  Razorpay integration (orders, capture, refund)              │   │
│  │  Webhook processing (HMAC verified, idempotent)              │   │
│  │  MockPaymentService for development                           │   │
│  │  Payment history (traveler/organizer/admin views)            │   │
│  │  Escrow: hold → release after trip completion                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                       WALLET                                  │   │
│  │  Refund credits • Cashback • Booking deduction               │   │
│  │  Admin credit/debit • Promotional credits • Expiry           │   │
│  │  Balance (non-negative constraint) • Transaction ledger      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                       REVIEWS                                 │   │
│  │  Multi-dimension ratings (overall, organization, value,      │   │
│  │    safety, accuracy) • Comment + photos                       │   │
│  │  Organizer reply • Rating aggregation on profile             │   │
│  │  Must have completed booking to review                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                        CHAT                                   │   │
│  │  Trip chat (traveler ↔ organizer) • Admin support chat       │   │
│  │  Real-time via Socket.IO • Typing indicators • Presence      │   │
│  │  Anti-leakage filter (phone, UPI, email, URL, Instagram)     │   │
│  │  Reactions • Message search • Read receipts • Unread count   │   │
│  │  Admin: flag messages, close conversations                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Booking + Payment

```
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────────┐
│ Traveler │────▶│ Booking  │────▶│ Razorpay  │────▶│   Webhook    │
│ clicks   │     │ Service  │     │ Order     │     │  /razorpay   │
│ "Book"   │     │ creates  │     │ created   │     │  (HMAC)      │
└──────────┘     │ booking  │     └───────────┘     └──────┬───────┘
                 │(PENDING) │                              │
                 └──────────┘     ┌───────────┐     ┌──────▼───────┐
                                  │ FE opens  │     │ Payment Svc  │
                                  │ Razorpay  │────▶│ confirms     │
                                  │ Checkout  │     │ booking =    │
                                  └───────────┘     │ CONFIRMED    │
                                                    └──────────────┘
                                                           │
                                                    ┌──────▼───────┐
                                                    │ Wallet deduct│
                                                    │ (if used)    │
                                                    └──────────────┘
```

---

## Data Flow: Auth (Phone OTP)

```
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────────┐
│  User    │────▶│ OTP Svc  │────▶│ MSG91/    │────▶│ User gets    │
│ enters   │     │ generates│     │ Firebase  │     │ SMS          │
│ phone    │     │ code     │     │ sends OTP │     └──────┬───────┘
└──────────┘     └──────────┘     └───────────┘            │
                                                    ┌──────▼───────┐
                                                    │ User enters  │
                                                    │ OTP code     │
                                                    └──────┬───────┘
                                                           │
                 ┌──────────┐     ┌───────────┐     ┌──────▼───────┐
                 │ Auth Svc │◀────│ OTP Svc   │◀────│ Verify OTP   │
                 │ issues   │     │ validates │     │ (hashed)     │
                 │ JWT pair │     │ code      │     └──────────────┘
                 └──────────┘     └───────────┘
```

---

## Infrastructure Map

```
┌──────────────────────────────────────────────────────────────────┐
│                     Docker Compose                                │
│                                                                  │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────┐              │
│  │ PostgreSQL  │  │   Redis    │  │   Nginx     │ (prod only)  │
│  │ 15-alpine   │  │  7-alpine  │  │ SSL/proxy   │              │
│  │ Port 5432   │  │ Port 6379  │  │ Port 80/443 │              │
│  └──────┬──────┘  └─────┬──────┘  └──────┬──────┘              │
│         │               │                │                      │
│         │    ┌──────────┘                │                      │
│         │    │                           │                      │
│  ┌──────▼────▼────┐              ┌───────▼──────┐              │
│  │   API Server   │◀─────────── │  Web Server  │              │
│  │  Express+IO    │   (internal)│  Next.js     │              │
│  │  Port 4000     │             │  Port 3000   │              │
│  └────────────────┘             └──────────────┘              │
│                                                                  │
│  Networks: frontend (web ↔ nginx), backend (api ↔ pg ↔ redis)   │
└──────────────────────────────────────────────────────────────────┘
```

---

## File Count Summary

| Area | Files | Tests |
|------|-------|-------|
| Backend controllers | 12 | — |
| Backend services | 13 | 13 test files (~490+ tests) |
| Backend repositories | 15 | 2 test files |
| Backend middleware | 8 | 2 test files |
| Backend routes | 12 | — |
| Backend utils | 8 | 5 test files |
| Frontend pages | ~20 routes | — |
| Frontend components | ~160 files | ~20 test files |
| Frontend hooks | 43 | 2 test files |
| Shared types | 15 | — |
| Shared validators | 11 | 1 test file |
| Shared constants | 5 | — |

---

## Quick Lookup: Where Things Live

| Need to... | Look in... |
|------------|-----------|
| Add a new API endpoint | `apps/api/src/routes/`, `controllers/`, `services/`, `repositories/` |
| Add a Zod schema | `packages/shared/src/validators/` |
| Add a shared type | `packages/shared/src/types/` |
| Add a frontend page | `apps/web/src/app/` (App Router) |
| Add a UI component | `apps/web/src/components/` |
| Add a data-fetching hook | `apps/web/src/hooks/` |
| Add a query key | `apps/web/src/lib/query-keys.ts` |
| Wire up DI | `apps/api/src/config/dependencies.ts` |
| Add a DB model | `apps/api/prisma/schema.prisma` |
| Add an env variable | `apps/api/src/config/env.ts` + `.env.example` |
| Add a cron job | `apps/api/src/utils/cron-jobs.ts` |
| Add a Socket event | `apps/api/src/socket/handlers/` |
| Check coding rules | `.windsurfrules` (19 rules) |
| Check dev workflow | `.windsurf/workflows/` (5 workflows) |

---

*Last updated: 2026-05-07*
