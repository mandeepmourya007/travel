# Project Reference — Group Travel Aggregator (TripCompare)

> **Purpose:** Single-source-of-truth for any LLM (Claude, Windsurf Cascade, etc.) to understand the entire codebase in one read. Covers architecture, tech stack, file map, DB schema, API surface, frontend structure, conventions, and dev workflows.

---

## 1. What Is This Project?

A **group travel aggregator** (brand: *TripCompare*) built for the Indian market (Pune-first). Travelers discover, compare, and book curated group trips from verified organizers. Key differentiators:

- **Escrow-protected payments** via Razorpay (hold → release after trip)
- **Anti-leakage chat filter** (blocks phone/UPI/email/URL sharing between traveler ↔ organizer)
- **Wallet system** (refunds, cashback, booking deductions)
- **Trip comparison** (side-by-side compare up to 3 trips)
- **Request-based & instant booking modes**
- **Real-time chat** via Socket.IO (trip chat + admin support)

### User Roles

| Role | Capabilities |
|------|-------------|
| **TRAVELER** | Browse trips, book (with seat selection), pay, review, chat with organizer, wallet, notifications |
| **ORGANIZER** | Create/manage trips, vehicle/seat layouts, approve requests, view bookings/payments, reply to reviews, chat, notifications |
| **ADMIN** | Dashboard (stats + charts), approve/reject organizers, manage bookings, issue cashback, flag/close chats, view all payments, notifications |

---

## 2. Monorepo Structure

```
travel/                          ← Root (npm workspaces + Turborepo)
├── apps/
│   ├── api/                     ← Express.js backend (REST + Socket.IO)
│   └── web/                     ← Next.js 14 frontend (App Router)
├── packages/
│   └── shared/                  ← Shared types, Zod validators, constants
├── docker/                      ← Dockerfiles + Nginx config
├── scripts/                     ← deploy-prod.sh, docker-up.sh, docker-down.sh
├── docs/                        ← Engineering docs, FE specs, wallet plan
├── .windsurf/workflows/         ← 5 dev workflows (build-backend, build-frontend, etc.)
├── turbo.json                   ← Turborepo pipeline config
├── docker-compose.yml           ← Dev (Postgres, Redis, API, Web, Seed)
├── docker-compose.prod.yml      ← Production (Nginx reverse proxy, SSL)
└── .windsurfrules               ← 19 coding rules (MUST follow)
```

### Package Names

| Package | npm name | Path |
|---------|----------|------|
| Backend API | `@travel/api` | `apps/api` |
| Frontend Web | `@travel/web` | `apps/web` |
| Shared | `@travel/shared` | `packages/shared` |

---

## 3. Tech Stack

### Backend (`apps/api`)

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥ 20, TypeScript 5.5 strict |
| Framework | Express 4 |
| ORM | Prisma 5 (PostgreSQL 15) |
| Cache/Rate-limit | Redis 7 (ioredis) |
| Auth | JWT (access + refresh), bcrypt, Google OAuth, Firebase Phone Auth |
| Payments | Razorpay SDK (orders, webhooks, refunds) + MockPaymentService for dev |
| Real-time | Socket.IO 4 |
| Email | Nodemailer (prod) / MockEmailProvider (dev) |
| OTP | MSG91 (prod) / MockOtpProvider (dev) |
| Images | Cloudinary (direct upload with signed URLs) |
| Logger | Pino + pino-pretty |
| Validation | Zod (shared schemas) |
| Testing | Vitest + Supertest |
| Dev runner | tsx watch |

### Frontend (`apps/web`)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, client-side rendering) |
| Language | TypeScript 5.5 strict |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix primitives) |
| State (server) | TanStack Query 5 (query key factories) |
| State (client) | Zustand 4 (auth store, chat store, loading store) |
| Forms | React Hook Form + @hookform/resolvers + Zod |
| Icons | Lucide React |
| HTTP Client | Axios (with interceptors for auth refresh) |
| Real-time | socket.io-client |
| Toast | Sonner |
| Carousel | Embla Carousel |
| Date | date-fns |
| URL State | nuqs |
| Testing | Vitest + Testing Library + MSW + Playwright |
| Fonts | Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (prices) |

### Shared (`packages/shared`)

- **Types** (`src/types/`): 17 type files — auth, user, trip, booking, payment, wallet, review, chat, destination, notification, organizer, trip-request, upload, api-response, **vehicle**, **admin**
- **Validators** (`src/validators/`): 14 Zod schema files — one per domain + common, **vehicle**, **admin**, **notification**
- **Constants** (`src/constants/`): 9 files — roles, booking-status, review, trip-types, **vehicle**, **notification**, **verification-status**, **wallet**

---

## 4. Backend Architecture

### Layered Pattern (Mandatory)

```
Request → Middleware → Controller → Service → Repository → Prisma → PostgreSQL
                                      ↓
                                   Providers (OTP, Email, Payment)
```

**Rules:**
- Controllers: thin (max ~15 lines), parse request + call service + send response
- Services: all business logic (max ~30 lines per method)
- Repositories: all DB queries (raw Prisma)
- Never skip a layer (Controller → Repository is forbidden)
- Dependency Injection via constructor

### Dependency Injection (DI)

All wiring happens in **`apps/api/src/config/dependencies.ts`**:
1. Instantiate all repositories (pass `prisma`)
2. Instantiate all services (pass repos + config)
3. Instantiate all controllers (pass services)
4. Create route factories (pass controllers + middleware)
5. Export named route routers for `server.ts`

### File Map — Backend

```
apps/api/src/
├── index.ts                    ← Entry point: HTTP server, Socket.IO, cron jobs, graceful shutdown
├── server.ts                   ← Express app factory (middleware pipeline + route mounting)
├── config/
│   ├── dependencies.ts         ← DI composition root
│   ├── env.ts                  ← Zod-validated environment variables
│   ├── cors.ts                 ← CORS options
│   ├── firebase.ts             ← Firebase Admin SDK init
│   ├── razorpay.ts             ← Razorpay client init
│   └── redis.ts                ← Redis connection
├── controllers/                ← 15 controllers
│   ├── auth.controller.ts      ← Login, signup, refresh, logout, google-auth, me
│   ├── otp.controller.ts       ← Send OTP, verify OTP
│   ├── firebase-auth.controller.ts ← Firebase phone auth
│   ├── trip.controller.ts      ← CRUD trips, publish, toggle bookings, edit history
│   ├── destination.controller.ts
│   ├── booking.controller.ts   ← Create booking, cancel, list for trip
│   ├── chat.controller.ts      ← Conversations, messages, reactions, flagged
│   ├── review.controller.ts    ← Create/edit review, organizer reply
│   ├── wallet.controller.ts    ← Balance, transactions, cashback history
│   ├── payment-history.controller.ts ← Payment history for traveler/organizer/admin
│   ├── upload.controller.ts    ← Cloudinary signature
│   ├── webhook.controller.ts   ← Razorpay webhook handler
│   ├── admin.controller.ts     ← Organizer approvals, stats, bookings, cashback
│   ├── notification.controller.ts ← List, unread count, mark read
│   └── vehicle.controller.ts   ← Vehicle CRUD, seat maps, hold seats
├── services/                   ← 17 services (all business logic)
│   ├── auth.service.ts         ← Register, login, JWT issue/verify, Google OAuth
│   ├── otp.service.ts          ← OTP generation, verification, rate limiting
│   ├── firebase-auth.service.ts
│   ├── trip.service.ts         ← Trip CRUD, filters, publish, booking toggle, edit history
│   ├── destination.service.ts
│   ├── booking.service.ts      ← Create booking (escrow + seat hold), cancel with refund, confirm (seat assign)
│   ├── chat.service.ts         ← Conversation creation, messaging, anti-leakage filter, reactions
│   ├── review.service.ts       ← Create/edit review, organizer reply, rating aggregation
│   ├── wallet.service.ts       ← Balance, credit, debit, transaction history, cashback
│   ├── payment.service.ts      ← Razorpay order creation, webhook processing, refund, escrow release
│   ├── mock-payment.service.ts ← Dev-mode payment simulation
│   ├── payment-history.service.ts
│   ├── upload.service.ts       ← Cloudinary signature generation
│   ├── admin.service.ts        ← Organizer approvals, platform stats, bookings, cashback issuance
│   ├── notification.service.ts ← Create/list/mark-read in-app notifications
│   ├── trip-lifecycle.service.ts ← Auto-complete trips, escrow release (cron-driven)
│   └── vehicle.service.ts      ← Vehicle CRUD, seat hold/confirm/release/expire
├── repositories/               ← 17 repositories (Prisma queries only)
│   ├── user.repository.ts
│   ├── refresh-token.repository.ts
│   ├── trip.repository.ts
│   ├── destination.repository.ts
│   ├── organizer-profile.repository.ts
│   ├── booking.repository.ts
│   ├── trip-request.repository.ts
│   ├── payment-transaction.repository.ts
│   ├── webhook-event.repository.ts
│   ├── verification-code.repository.ts
│   ├── review.repository.ts
│   ├── wallet.repository.ts
│   ├── conversation.repository.ts
│   ├── message.repository.ts
│   ├── trip-edit-history.repository.ts
│   ├── notification.repository.ts  ← In-app notification CRUD
│   └── vehicle.repository.ts       ← TripVehicle + VehicleSeat CRUD, atomic seat status SQL
├── routes/                     ← 15 route files (Express Router factories)
│   ├── auth.routes.ts
│   ├── firebase-auth.routes.ts
│   ├── health.routes.ts        ← GET /health, GET /health/db, GET /health/redis
│   ├── trip.routes.ts
│   ├── destination.routes.ts
│   ├── booking.routes.ts
│   ├── chat.routes.ts
│   ├── review.routes.ts
│   ├── wallet.routes.ts
│   ├── payment.routes.ts
│   ├── upload.routes.ts
│   ├── webhook.routes.ts       ← Raw body, HMAC verification, no auth
│   ├── admin.routes.ts         ← All behind authMiddleware + requireRole('ADMIN')
│   ├── notification.routes.ts  ← Authenticated notification endpoints
│   └── vehicle.routes.ts       ← Organizer vehicle CRUD + traveler seat selection
├── middleware/
│   ├── auth.middleware.ts       ← JWT verification → req.user
│   ├── role.middleware.ts       ← Role-based access control
│   ├── validate.middleware.ts   ← Zod schema validation (body, query, params)
│   ├── error-handler.middleware.ts ← Global error → API error response
│   ├── rate-limit.middleware.ts ← General + auth-specific rate limits
│   ├── pino-http.middleware.ts ← pino-http + ALS request logging & tracing
│   └── webhook-verify.middleware.ts ← HMAC signature verification
├── providers/
│   ├── otp-provider.interface.ts
│   ├── mock-otp.provider.ts
│   ├── msg91-otp.provider.ts
│   ├── email-provider.interface.ts
│   ├── mock-email.provider.ts
│   └── nodemailer-email.provider.ts
├── socket/
│   ├── index.ts                ← Socket.IO server setup
│   ├── middleware/
│   │   └── socket-auth.middleware.ts ← JWT auth for socket connections
│   └── handlers/
│       ├── chat.handler.ts     ← Message send/receive, typing, read receipts
│       └── presence.handler.ts ← Online/offline status
├── utils/
│   ├── async-handler.ts        ← Wraps async route handlers (no try-catch in controllers)
│   ├── chat-filter.ts          ← Anti-leakage regex filter
│   ├── constants.ts            ← Business constants (escrow days, max group size, etc.)
│   ├── cron-jobs.ts            ← 6 background jobs (see table below)
│   ├── email.ts
│   ├── logger.ts               ← Pino logger instance
│   ├── phone.ts                ← Phone number normalization
│   └── rate-limiter.ts         ← Redis-backed rate limiter
├── errors/                     ← Typed error classes (NotFoundError, ForbiddenError, etc.)
├── lib/
│   └── prisma.ts               ← Prisma client singleton
└── types/
    ├── express.d.ts            ← Express Request augmentation (req.user)
    └── razorpay.types.ts       ← RazorpayPaymentEntity, RazorpayWebhookPayload, StoredWebhookEvent
```

### Background Jobs (`utils/cron-jobs.ts`)

| Job | Interval | Purpose |
|-----|----------|---------|
| `expireStaleBookings` | 5 min | Expire PENDING_PAYMENT bookings past expiresAt (polls Razorpay first) |
| `expireStaleRequests` | 5 min | Expire APPROVED trip requests past approval window |
| `cleanupExpiredCodes` | 1 hour | Delete verification codes expired > 24h |
| `cleanupStaleTokens` | 1 hour | Delete refresh tokens expired > 30 days |
| `completeTripsAndReleaseEscrow` | 30 min | Auto-complete ACTIVE/FULL trips past endDate → COMPLETED, release escrow holds |
| `expireHeldSeats` | 1 min | Expire HELD vehicle seats whose hold window has passed |

---

## 5. API Endpoints

### Auth (`/api/v1/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/signup` | No | Register (email + password) |
| POST | `/login` | No | Login (email + password) |
| POST | `/google` | No | Google OAuth login |
| POST | `/refresh` | Cookie | Refresh access token |
| POST | `/logout` | Yes | Revoke refresh token |
| GET | `/me` | Yes | Get current user profile |
| PATCH | `/me` | Yes | Update profile |
| POST | `/me/onboarding` | Yes | Complete onboarding (role selection, organizer profile) |
| POST | `/firebase/phone` | No | Firebase phone auth (if configured) |

### OTP (under `/api/v1/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/otp/send` | No | Send OTP via SMS/email |
| POST | `/otp/verify` | No | Verify OTP and login/register |
| POST | `/otp/email/send` | No | Send email OTP |
| POST | `/otp/email/verify` | No | Verify email OTP |

### Trips (`/api/v1/trips`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | List trips (filters, pagination, sorting) |
| GET | `/:slug` | No | Get trip by slug (includes organizer, reviews) |
| POST | `/` | Organizer | Create trip |
| PATCH | `/:id` | Organizer | Update trip |
| DELETE | `/:id` | Organizer | Soft-delete trip |
| POST | `/:id/publish` | Organizer | Publish draft trip |
| PATCH | `/:id/toggle-bookings` | Organizer | Enable/disable bookings |
| GET | `/my/trips` | Organizer | List organizer's own trips |
| GET | `/:id/edit-history` | Organizer | Trip edit history |
| GET | `/:id/bookings` | Organizer | List bookings for a trip |
| GET | `/:id/bookings/summary` | Organizer | Booking summary stats |
| GET | `/:id/requests` | Organizer | List trip requests |
| POST | `/:id/requests` | Traveler | Create trip request |
| PATCH | `/:id/requests/:requestId/respond` | Organizer | Approve/reject request |
| GET | `/requests/my` | Traveler | My pending requests |
| GET | `/requests/all-pending` | Organizer | All pending requests across trips |

### Bookings (`/api/v1/bookings`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Traveler | Create booking (initiates payment) |
| GET | `/my` | Traveler | My bookings (with filters) |
| GET | `/my/summary` | Traveler | Booking summary stats |
| GET | `/my/trip-status/:tripId` | Traveler | My booking status for a trip |
| POST | `/:id/cancel` | Traveler/Org | Cancel booking (refund per policy) |

### Payments (`/api/v1/payments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/my` | Traveler | My payment history |
| GET | `/my/summary` | Traveler | Payment summary |
| GET | `/trip/:tripId` | Organizer | Trip payment history |
| GET | `/trip/:tripId/summary` | Organizer | Trip payment summary |
| GET | `/admin` | Admin | All payments |
| GET | `/admin/summary` | Admin | Platform-wide payment summary |

### Wallet (`/api/v1/wallet`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | Wallet balance + stats |
| GET | `/transactions` | Yes | Transaction history (filtered, paginated) |
| GET | `/cashback` | Yes | Cashback history with trip names |
| POST | `/admin/:userId/credit` | Admin | Admin credit to user wallet |
| POST | `/admin/:userId/debit` | Admin | Admin debit from user wallet |

### Reviews (`/api/v1/reviews`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trip/:tripId` | No | List reviews for a trip |
| POST | `/` | Traveler | Create review (must have completed booking) |
| PATCH | `/:id` | Traveler | Edit review |
| GET | `/my/booking/:bookingId` | Traveler | My review for a booking |
| POST | `/:id/reply` | Organizer | Organizer reply to review |

### Chat (`/api/v1/chat`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/conversations/trip/:tripId` | Traveler | Start/get trip chat with organizer |
| POST | `/conversations/support` | Yes | Start admin support chat |
| GET | `/conversations` | Yes | List conversations |
| GET | `/conversations/:id/messages` | Yes | Messages (paginated) |
| GET | `/conversations/:id/messages/search` | Yes | Search messages |
| POST | `/conversations/:id/messages` | Yes | Send message |
| POST | `/conversations/:id/messages/:msgId/reactions` | Yes | Add reaction |
| DELETE | `/conversations/:id/messages/:msgId/reactions/:emoji` | Yes | Remove reaction |
| PATCH | `/conversations/:id/close` | Admin | Close conversation |
| GET | `/unread-count` | Yes | Total unread message count |
| GET | `/flagged` | Admin | Flagged messages |

### Webhooks (`/api/v1/webhooks`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/razorpay` | HMAC | Razorpay payment webhooks |

### Destinations (`/api/v1/destinations`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | List destinations |
| POST | `/` | Admin | Create destination |

### Uploads (`/api/v1/uploads`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/signature` | Yes | Get Cloudinary upload signature |

### Admin (`/api/v1/admin`)

All routes require `authMiddleware` + `requireRole('ADMIN')`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/organizers` | Paginated organizer approval queue (filterable) |
| GET | `/organizers/:id` | Organizer detail |
| PATCH | `/organizers/:id/status` | Approve/reject organizer (sends notification) |
| GET | `/stats` | Platform overview stats + chart data |
| GET | `/bookings` | Admin booking list (search + filter) |
| GET | `/bookings/:id` | Booking detail with travelers + payments |
| GET | `/cashback/trips` | Completed trips with cashback stats |
| GET | `/cashback/trips/:tripId` | Trip travelers with cashback status |
| POST | `/cashback/issue` | Issue cashback (validates trip COMPLETED, no duplicate, amount cap) |
| GET | `/cashback/by-user` | Cashback grouped by user |
| GET | `/cashback/by-user/:userId` | Per-user cashback detail |
| GET | `/cashback/by-trip` | Cashback grouped by trip |

### Vehicle & Seats (`/api/v1/trips`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:tripId/vehicle` | Organizer | Create vehicle with seat layout |
| PUT | `/:tripId/vehicle/:vehicleId` | Organizer | Update vehicle |
| DELETE | `/:tripId/vehicle/:vehicleId` | Organizer | Delete vehicle |
| GET | `/:tripId/vehicle` | Organizer | Organizer seat map (multi-vehicle) |
| GET | `/:tripId/vehicles` | Organizer | List all vehicles for trip |
| GET | `/:tripId/seats` | No | Traveler seat map (public, multi-vehicle) |
| POST | `/:tripId/seats/hold` | Yes | Hold seats for booking |

### Notifications (`/api/v1/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List notifications (filtered, paginated) |
| GET | `/unread-count` | Yes | Unread notification count |
| PATCH | `/read-all` | Yes | Mark all notifications as read |
| PATCH | `/:id/read` | Yes | Mark single notification as read |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/db` | Database connectivity |
| GET | `/health/redis` | Redis connectivity |
| GET | `/api/v1/sitemap-data` | Trip slugs, destination slugs, organizer IDs for sitemap |

---

## 6. Database Schema (Prisma)

### Models (22 tables)

| Model | Purpose |
|-------|--------|
| `User` | All users (TRAVELER, ORGANIZER, ADMIN) |
| `OrganizerProfile` | Business profile for organizers (linked 1:1 to User) |
| `Destination` | Trip destinations (name, state, slug) |
| `Trip` | Group trips with full details (itinerary, pricing, photos, seatSelectionEnabled) |
| `TripTransferPoint` | Pickup/drop points per trip |
| `TripVehicle` | Vehicle per trip (layout JSON + grid config, vehicle type/name) |
| `VehicleSeat` | Individual seat per vehicle (status, seatNumber, booking link) |
| `Booking` | Trip bookings (with escrow, wallet deduction, vehicleSeats relation) |
| `TravelerDetail` | Traveler info per booking/request (assignedSeat optional) |
| `TripRequest` | Request-based booking requests |
| `PaymentTransaction` | Razorpay payment/refund/escrow records |
| `Review` | Trip reviews with multi-dimension ratings |
| `Conversation` | Chat conversations (TRIP_CHAT, ADMIN_SUPPORT) |
| `Message` | Chat messages (text, image, file, system) |
| `Wallet` | User wallet with balance |
| `WalletTransaction` | Wallet credit/debit ledger (unique constraint for cashback dedup) |
| `RefreshToken` | JWT refresh tokens (hashed) |
| `VerificationCode` | OTP/email verification codes (hashed) |
| `Notification` | Push/email/SMS/in-app notifications |
| `WebhookEvent` | Immutable audit trail for webhooks |
| `TripEditHistory` | Snapshot-based trip edit audit trail |

### Key Enums

| Enum | Values |
|------|--------|
| `UserRole` | TRAVELER, ORGANIZER, ADMIN |
| `VerificationStatus` | PENDING, APPROVED, REJECTED |
| `TripStatus` | DRAFT, ACTIVE, FULL, COMPLETED, CANCELLED |
| `TripType` | ADVENTURE, WEEKEND, TREKKING, BEACH, CULTURAL, ROAD_TRIP |
| `BookingStatus` | PENDING_PAYMENT, CONFIRMED, CANCELLED, COMPLETED, REFUNDED, EXPIRED |
| `BookingMode` | INSTANT, REQUEST_BASED |
| `TripRequestStatus` | PENDING, APPROVED, REJECTED, EXPIRED, CONVERTED |
| `PaymentStatus` | INITIATED, AUTHORIZED, CAPTURED, FAILED, REFUNDED |
| `PaymentType` | PAYMENT, REFUND, ESCROW_RELEASE |
| `CancellationPolicy` | FLEXIBLE, MODERATE, STRICT |
| `Gender` | MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY |
| `ConversationType` | TRIP_CHAT, ADMIN_SUPPORT |
| `MessageType` | TEXT, IMAGE, FILE, SYSTEM |
| `ConversationStatus` | ACTIVE, ARCHIVED, CLOSED |
| `SeatCellType` | SEAT, DRIVER, EMPTY, BLOCKED |
| `SeatStatus` | AVAILABLE, HELD, BOOKED, BLOCKED |
| `NotificationType` | BOOKING_CONFIRMED, BOOKING_CANCELLED, PAYMENT_RECEIVED, ... SYSTEM_ALERT |
| `WalletTransactionType` | REFUND, CASHBACK, BOOKING_DEDUCTION, ADMIN_CREDIT, ADMIN_DEBIT, PROMOTIONAL_CREDIT, EXPIRY |

### Key Relationships

```
User 1:1 OrganizerProfile
User 1:1 Wallet
User 1:N Booking, Review, TripRequest, Message, Notification
OrganizerProfile 1:N Trip, Conversation
Trip 1:N Booking, Review, TripRequest, TripTransferPoint, Conversation, TripEditHistory, TripVehicle
Trip N:1 Destination
TripVehicle 1:N VehicleSeat
Booking 1:N PaymentTransaction, TravelerDetail, VehicleSeat
Booking 1:1 Review, TripRequest (optional)
Wallet 1:N WalletTransaction
Conversation 1:N Message
```

### Soft Delete Pattern

All domain models use `isActive`, `isDeleted`, `deletedAt` fields.
**Exceptions** (no soft delete — immutable audit): `PaymentTransaction`, `WebhookEvent`, `RefreshToken`, `VerificationCode`, `TripEditHistory`, `WalletTransaction`.

---

## 7. Frontend Architecture

### App Router Pages

```
apps/web/src/app/
├── page.tsx                     ← Home (Hero, Popular Destinations, Trending Trips, Why Book)
├── layout.tsx                   ← Root layout (fonts, Providers)
├── providers.tsx                ← QueryClient, GoogleOAuth, CompareQueue, Toast, RouteProgress
├── globals.css                  ← Design tokens, base styles, skeleton shimmer
├── sitemap.ts                   ← Dynamic sitemap generation (SEO)
├── robots.ts                    ← Robots.txt config (SEO)
├── icon.tsx / apple-icon.tsx    ← App icons (SEO)
├── global-error.tsx             ← Root error boundary
├── not-found.tsx                ← 404 page
├── (auth)/
│   ├── login/page.tsx           ← Login (phone OTP + email OTP + Google)
│   ├── signup/page.tsx          ← Signup
│   └── onboarding/page.tsx      ← Role selection + organizer profile setup
├── trips/
│   ├── page.tsx                 ← Trip listing (filters, grid, pagination)
│   ├── [slug]/
│   │   ├── page.tsx             ← Trip detail (header, itinerary, booking card, reviews, organizer)
│   │   └── book/page.tsx        ← Booking flow (traveler form → seat selection → payment)
│   ├── compare/page.tsx         ← Side-by-side trip comparison
│   └── organizers/[id]/page.tsx ← Public organizer profile
├── destinations/
│   └── [slug]/page.tsx          ← Destination detail (trips by destination)
├── dashboard/                   ← Organizer dashboard
│   ├── page.tsx                 ← Stats overview
│   ├── trips/
│   │   ├── page.tsx             ← My trips list
│   │   ├── create/page.tsx      ← Create trip form
│   │   └── [id]/
│   │       ├── page.tsx         ← Trip detail (bookings, requests, payments)
│   │       ├── edit/page.tsx    ← Edit trip
│   │       ├── vehicle/page.tsx ← Vehicle/seat layout management
│   │       ├── history/page.tsx ← Trip edit history
│   │       ├── payments/page.tsx← Trip payments
│   │       ├── reviews/page.tsx ← Trip reviews
│   │       └── users/page.tsx   ← Trip users/travelers
│   └── requests/page.tsx        ← All pending requests
├── my-bookings/page.tsx         ← Traveler's bookings list
├── my-payments/page.tsx         ← Payment history
├── wallet/page.tsx              ← Wallet balance + transactions
├── profile/page.tsx             ← User profile editor
├── messages/page.tsx            ← Chat interface (conversations + messages)
├── admin/                       ← Full admin panel
│   ├── page.tsx                 ← Dashboard (stats, charts, quick actions)
│   ├── layout.tsx               ← AuthGuard ADMIN + AdminSidebar
│   ├── organizers/page.tsx      ← Organizer approval queue (tabs: pending/approved/rejected)
│   ├── bookings/page.tsx        ← Admin booking list (search + filter)
│   ├── bookings/[id]/page.tsx   ← Booking detail (travelers + payments)
│   ├── cashback/page.tsx        ← Cashback management (3 tabs: issue, by user, by trip)
│   ├── cashback/[tripId]/page.tsx ← Issue cashback per trip
│   ├── cashback/user/[userId]/page.tsx ← Per-user cashback drill-down
│   ├── chat/page.tsx            ← Flagged messages management
│   └── payments/page.tsx        ← Admin payment dashboard
└── preview/                     ← Trip preview (organizer)
```

### Component Organization

```
apps/web/src/components/
├── ui/                          ← 29 shadcn/ui primitives (Button, Card, Dialog, etc.)
├── shared/                      ← ~30 reusable components
│   ├── auth-guard.tsx           ← Route protection (role-based)
│   ├── role-guard.tsx           ← Conditional render by role
│   ├── data-states.tsx          ← ErrorState, EmptyState components
│   ├── pagination.tsx           ← Pagination with page numbers
│   ├── modal.tsx                ← Reusable modal (SSR-safe createPortal)
│   ├── toast.tsx                ← Toast provider (Sonner wrapper)
│   ├── socket-connector.tsx     ← Socket.IO auto-connect component
│   ├── spinner.tsx, full-screen-loader.tsx, route-progress.tsx
│   ├── phone-input.tsx, email-input.tsx, number-input.tsx
│   ├── star-rating.tsx, star-rating-input.tsx
│   └── image-lightbox.tsx, avatar.tsx, alert.tsx, tooltip.tsx, tabs.tsx, progress-bar.tsx
├── layout/                      ← AppShell, Header, Footer
├── home/                        ← HeroSection, PopularDestinations, TrendingTrips, WhyBookSection
├── auth/                        ← Login/signup forms, OTP, Google auth, onboarding
├── trips/                       ← TripCard, TripGrid, TripFilters, TripDetailHeader, TripForm/*, CompareBar, ReviewCard, etc.
├── booking/                     ← TravelerForm, PriceSummary, BookingSuccess, SeatSelectionCard
├── bookings/                    ← MyBookingCard, MyBookingsList, CancelBookingModal, ReviewFormModal, PendingPaymentCard
├── dashboard/                   ← DashboardSidebar, StatCard, TripListCard, TripUsers/*
├── chat/                        ← ChatLayout, ChatWindow, ChatHeader, ConversationSidebar, MessageBubble, MessageInput, TypingIndicator, OnlineIndicator
├── payments/                    ← PaymentFilters, PaymentTransactionList, PaymentSummaryCards, StatusBadge, TypeBadge
├── wallet/                      ← WalletFilters, WalletTransactionList, WalletTxTypeBadge
├── profile/                     ← ProfileHeader, EditUserProfileForm, OrganizerProfileCard
├── vehicle/                     ← SeatCell, SeatGrid, SeatLegend, SeatMapPicker, SeatMapViewer, SeatLayoutBuilder
├── admin/                       ← AdminSidebar, ApprovalActionDialog, OrganizerApprovalCard, RevenueChart, BookingsChart, TripTypeChart
├── notifications/               ← NotificationBell (header dropdown with unread badge)
└── destinations/                ← DestinationDetailClient
```

### Custom Hooks (`apps/web/src/hooks/`)

50 custom hooks. Pattern: `useXxx()` wraps `apiClient` + TanStack Query. Components never call `apiClient` directly.

**Key hooks by domain:**
- **Auth:** `use-otp`, `use-email-otp`, `use-google-auth`, `use-firebase-phone-auth`, `use-logout`
- **Trips:** `use-trips`, `use-trip-detail`, `use-trip-summary`, `use-my-trips`, `use-create-trip`, `use-update-trip`, `use-delete-trip`, `use-publish-trip`, `use-toggle-bookings`
- **Bookings:** `use-create-booking`, `use-my-bookings`, `use-my-booking-summary`, `use-cancel-booking`, `use-trip-bookings`, `use-my-trip-booking-status`
- **Payments:** `use-payments` (my, trip, admin), `use-verify-payment`
- **Wallet:** `use-wallet` (balance + transactions + cashback)
- **Reviews:** `use-reviews` (list, create, edit, reply)
- **Chat:** `use-chat` (conversations, messages, send, typing, read, presence, reactions), `use-admin-chat`
- **Trip Requests:** `use-create-trip-request`, `use-trip-requests`, `use-respond-request`, `use-my-pending-requests`, `use-all-pending-requests`
- **Vehicle:** `use-vehicle` (seat maps, CRUD), `use-sync-vehicles`
- **Admin:** `use-admin-stats`, `use-admin-organizers` (list + approve/reject), `use-admin-bookings` (list + detail), `use-admin-cashback` (5 queries + issue mutation)
- **Notifications:** `use-notifications` (list, unread count, mark read)
- **Destinations:** `use-destinations`, `use-destination-detail`
- **Compare:** `use-compare-queue`, `use-compare-trips`
- **Upload:** `use-cloudinary-upload`, `use-upload-signature`
- **Profile:** `use-profile`, `use-organizer-stats`, `use-organizer-public-profile`
- **Utility:** `use-debounce`, `use-blocking-mutation`, `use-log-error`

### State Management

| Store | Library | Purpose |
|-------|---------|---------|
| `auth.store.ts` | Zustand (persisted) | User, accessToken, isAuthenticated, onboarding status |
| `chat.store.ts` | Zustand | Typing indicators, online presence, unread counts, optimistic messages |
| `loading.store.ts` | Zustand | Full-screen loader visibility |

### Data Fetching Pattern

```
Component → useXxx() hook → apiClient.get/post() → Axios interceptors → API
                ↓
         TanStack Query (cache, dedup, retry, invalidation)
                ↓
         Query key factory (lib/query-keys.ts)
```

**Query key factories** in `lib/query-keys.ts`: `tripKeys`, `bookingKeys`, `tripRequestKeys`, `paymentKeys`, `walletKeys`, `reviewKeys`, `chatKeys`, `destinationKeys`, `organizerKeys`, `profileKeys`, `uploadKeys`, `notificationKeys`, **`vehicleKeys`**, **`adminKeys`**

### API Client (`lib/api-client.ts`)

- Base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`)
- Auto-attaches JWT from localStorage (`travel-auth`)
- Auto-refreshes on 401 (mutex-protected, single refresh at a time)
- On refresh failure: clears auth, redirects to `/login?returnTo=...`
- Non-GET requests trigger full-screen loader
- Extracts user-friendly error messages from API error responses

---

## 8. Real-Time (Socket.IO)

### Server (`apps/api/src/socket/`)

- Attached to HTTP server (same port as Express)
- JWT auth middleware for socket connections
- **Chat handler:** join conversation rooms, send/receive messages, typing indicators, read receipts, reactions
- **Presence handler:** online/offline status tracking

### Client (`apps/web/src/lib/socket.ts`)

- Connects to `NEXT_PUBLIC_SOCKET_URL`
- Managed by `use-chat` hook and `chat.store.ts`

### Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `message:send` | Client → Server | Send message |
| `message:new` | Server → Client | New message received |
| `typing:start/stop` | Bidirectional | Typing indicators |
| `message:read` | Client → Server | Mark messages as read |
| `presence:online/offline` | Server → Client | User presence |

---

## 9. Infrastructure

### Docker (Development)

```yaml
services:
  postgres:    PostgreSQL 15-alpine (port 5432)
  redis:       Redis 7-alpine (port 6379, password: dev-redis-pass)
  api:         Express API (port 4001 → 4000 internal)
  web:         Next.js (port 3000)
  seed:        One-shot seed runner (profile: seed)
  seed-prod:   Production seed runner (profile: seed-prod)
```

### Docker (Production) — `docker-compose.prod.yml`

Adds Nginx reverse proxy with SSL termination (Let's Encrypt certbot).

### Dockerfiles

| File | Purpose |
|------|---------|
| `docker/api.Dockerfile` | Dev API image (tsx watch, mounted sources) |
| `docker/api.prod.Dockerfile` | Production API (tsx runtime — tsc rootDir issue in monorepo) |
| `docker/web.Dockerfile` | Dev web image |
| `docker/web.prod.Dockerfile` | Production web (next build, standalone) |

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/docker-up.sh` | Smart docker compose up (builds if needed) |
| `scripts/docker-down.sh` | docker compose down |
| `scripts/deploy-prod.sh` | Full production deployment script |

---

## 10. Testing

### Backend Tests (`apps/api/tests/`)

```
tests/
├── setup.ts                    ← Vitest global setup
├── unit/
│   ├── services/               ← 18 service test files (~720+ tests)
│   │   ├── auth.service.test.ts
│   │   ├── booking.service.test.ts
│   │   ├── booking-lifecycle.test.ts     ← Seat hold + cancel + lifecycle tests
│   │   ├── chat.service.test.ts
│   │   ├── trip.service.test.ts
│   │   ├── trip-users.service.test.ts
│   │   ├── trip-request-create.test.ts
│   │   ├── trip-lifecycle.service.test.ts ← Auto-complete + escrow release tests
│   │   ├── payment.service.test.ts
│   │   ├── payment-history.service.test.ts
│   │   ├── wallet.service.test.ts
│   │   ├── review.service.test.ts
│   │   ├── otp.service.test.ts
│   │   ├── destination.service.test.ts
│   │   ├── firebase-auth.service.test.ts
│   │   ├── admin.service.test.ts          ← Approvals + stats + cashback tests
│   │   ├── notification.service.test.ts
│   │   └── vehicle.service.test.ts        ← Vehicle CRUD + seat hold/confirm/release
│   ├── middleware/              ← Middleware tests (2 files)
│   ├── repositories/           ← Repository tests (2 files)
│   ├── utils/                  ← Utility tests (7 files — chat filter, etc.)
│   ├── validators/             ← Schema validation tests (2 files)
│   └── config/                 ← Config tests (1 file)
└── integration/                ← Integration tests
```

### Frontend Tests (`apps/web/src/`)

- Co-located: `component.test.tsx` next to `component.tsx`
- Test utilities: `src/test/test-utils.tsx`, `src/test/factories/`, `src/test/mocks/`
- Component tests in `__tests__/` subdirectories per component folder
- Tools: Vitest + Testing Library + MSW + Playwright (E2E)

### Test Conventions

- One `describe` per public method, happy path first
- Naming: `"should <outcome> when <condition>"`
- Arrange → Act → Assert, `vi.clearAllMocks()` in `beforeEach`
- Factory functions for test data — override only relevant fields

---

## 11. Environment Variables

### Backend (`apps/api`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 32 chars |
| `JWT_REFRESH_SECRET` | Yes | Min 32 chars |
| `REDIS_URL` | No | Redis connection (rate limiting, caching) |
| `RAZORPAY_KEY_ID` | No | Razorpay API key (uses mock if absent) |
| `RAZORPAY_KEY_SECRET` | No | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | No | Webhook HMAC verification |
| `CLOUDINARY_*` | No | Image upload (3 vars) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth |
| `MSG91_AUTH_KEY` | No | SMS OTP (uses mock if absent) |
| `MSG91_TEMPLATE_ID` | No | SMS template |
| `SMTP_*` | No | Email (4 vars, all-or-nothing) |
| `FIREBASE_*` | No | Phone auth (3 vars, all-or-nothing) |
| `CLIENT_URL` | No | Frontend URL (default: http://localhost:3000) |
| `PHONE_AUTH_STRATEGY` | No | `backend` or `firebase` (default: backend) |

### Frontend (`apps/web`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | API base URL |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client SDK (4 vars) |
| `NEXT_PUBLIC_PHONE_AUTH_STRATEGY` | `backend` or `firebase` |

---

## 12. Dev Workflows (`.windsurf/workflows/`)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `/build-backend` | Building BE features | TDD, clean architecture, service/repo/controller pattern |
| `/build-frontend` | Building FE components | Hooks + components + API integration |
| `/build-feature` | End-to-end features | Orchestrates DB → BE → FE → tests |
| `/commit-changes` | Committing code | Conventional commits, small feature-wise |
| `/review-diff` | Reviewing changes | Senior architect review checklist |

---

## 13. Key Commands

```bash
# Development (local)
npm run dev                    # Start all apps via Turborepo
npm run test                   # Run all tests
npm run lint                   # Lint all packages
npm run type-check             # TypeScript check

# Docker (development)
npm run docker:up              # Build + start containers
npm run docker:down            # Stop containers
npm run docker:seed            # Seed dev data
npm run docker:logs            # Follow logs

# API-specific
cd apps/api
npm run db:migrate             # Run Prisma migrations
npm run db:push                # Push schema without migration
npm run db:seed                # Seed database
npm run db:studio              # Open Prisma Studio
npm test                       # Run API tests

# Frontend-specific
cd apps/web
npm run dev                    # Next.js dev server
npm test                       # Run frontend tests

# Production
npm run deploy:prod            # Full production deployment
```

---

## 14. Coding Rules Summary (from `.windsurfrules`)

1. **TypeScript:** No `any`, no `as unknown as X`, strict mode, named exports only
2. **Architecture:** Controller → Service → Repository (never skip layers)
3. **API format:** `{ success, data, pagination }` / `{ success: false, error: { code, message } }`
4. **Frontend 4-state:** Every data component: Loading → Error → Empty → Data
5. **Query keys:** Factory pattern in `lib/query-keys.ts`
6. **Design system:** WCAG AA colors, skeleton shimmer (not animate-pulse), 4px spacing grid
7. **Typography:** Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (prices)
8. **Mobile-first:** Default styles = mobile, enhance with `sm:`, `md:`, `lg:`
9. **Security:** Zod validation at edge, bcrypt ≥12 rounds, hashed tokens, no PII logging
10. **Testing:** Every public method tested, factory functions for data, Arrange-Act-Assert
11. **Naming:** kebab-case files, PascalCase components, camelCase functions, SCREAMING_SNAKE constants
12. **Git:** Conventional commits, max ~300 lines per PR
13. **DB:** Soft-delete, prices in whole rupees (Int), one migration per feature
14. **No dark mode yet** (Phase 2)
15. **Images never route through Express** — Cloudinary direct upload

---

*Last updated: 2026-05-12*
