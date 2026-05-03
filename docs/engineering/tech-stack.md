# Group Travel Aggregator — Technical Specification

A senior architect-level tech spec for building a scalable, maintainable group travel aggregator. Designed for solo development with future team onboarding in mind.

---

## 1. Architecture Overview

### System Architecture (Monorepo → Modular)

```
                    ┌──────────────┐
                    │   CLIENTS    │
                    │  (Browser)   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   VERCEL     │
                    │  (CDN/Edge)  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼─────┐ ┌───▼────┐ ┌────▼─────┐
       │  NEXT.JS   │ │  API   │ │ SOCKET.IO│
       │  Frontend  │ │ Server │ │  (Chat)  │
       │  (SSR/SSG) │ │Express │ │          │
       └────────────┘ └───┬────┘ └────┬─────┘
                          │           │
                    ┌─────▼───────────▼────┐
                    │     PostgreSQL        │
                    │     (Supabase/Neon)   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼──────────────┐
              │                │              │
       ┌──────▼─────┐  ┌──────▼─────┐ ┌─────▼──────┐
       │  Razorpay  │  │ Cloudinary │ │   Redis    │
       │  (Escrow)  │  │  (Images)  │ │  (Cache)   │
       └────────────┘  └────────────┘ └────────────┘
```

### Design Principles

| Principle | What It Means For Us |
|-----------|---------------------|
| **Separation of Concerns** | FE renders, BE processes, DB stores. No business logic in controllers. |
| **Service Layer Pattern** | All business logic lives in `/services`. Controllers are thin — they only parse request and call services. |
| **Repository Pattern** | DB queries live in `/repositories`. Services never write raw SQL or Prisma queries directly. |
| **Dependency Injection** | Services receive their dependencies (repos, external clients) — makes testing easy. |
| **Fail Fast, Fail Loud** | Validate inputs at the edge (Zod schemas). Throw typed errors. Never silently swallow errors. |
| **Convention over Configuration** | Consistent naming, folder structure, file patterns. A new developer should know where to look without asking. |

### Design Patterns (GoF Classification)

> Every pattern below is actively used in this codebase. This section maps each GoF pattern
> to its **exact location** so any developer can find the implementation instantly.
> Same patterns used by Swiggy, Zomato, Razorpay, and MMT backends.

#### Creational Patterns

| Pattern | Where Used | File(s) | Why |
|---------|-----------|---------|-----|
| **Singleton** | Prisma client instance (one per process, shared globally) | `lib/prisma.ts` | Prevents connection pool exhaustion; Next.js hot-reload safe via `globalForPrisma` |
| **Singleton** | Redis client (one ioredis TCP connection) | `config/redis.ts` | Single connection reused across rate limiting, caching, Socket.IO adapter |
| **Singleton** | Pino logger (one instance, child loggers per request) | `utils/logger.ts` | Consistent config, base fields (service name, env) attached once |
| **Factory Method** | Query key factories — `tripKeys.list(filters)`, `bookingKeys.detail(id)` | `lib/query-keys.ts` | Produces consistent cache keys; TanStack Query invalidation relies on key shape |
| **Factory Method** | Error class hierarchy — `new NotFoundError('Trip')` produces 404 with code | `errors/*.error.ts` | Each subclass is a factory that constructs the correct statusCode + error code |
| **Factory Method** | Test data factories — `createTestTrip()`, `createTestBooking()` | `tests/helpers/factories.ts` | Generates valid test objects with sensible defaults; overridable per test |
| **Builder** | Prisma query builder — `buildWhereClause()` assembles filters step by step | `repositories/trip.repository.ts` | Dynamically constructs complex WHERE clause from optional filter params |
| **Builder** | Zod schema composition — `.refine()` chains build validation rules | `validators/trip.schema.ts` | Composes cross-field validations (endDate > startDate, max >= min) |

#### Structural Patterns

| Pattern | Where Used | File(s) | Why |
|---------|-----------|---------|-----|
| **Facade** | `BookingService` — hides orchestration of 5 subsystems behind `createBooking()` | `services/booking.service.ts` | Caller doesn't need to know about TripRepo, PaymentService, NotificationService, TripRequestRepo, Logger |
| **Facade** | `UploadService` — hides Cloudinary SDK complexity behind `generateSignature()` | `services/upload.service.ts` | FE calls one endpoint, gets back everything needed for direct Cloudinary upload |
| **Adapter** | Axios `apiClient` — adapts raw HTTP into typed, intercepted API calls | `lib/api-client.ts` | Wraps Axios with auth token injection, refresh logic, error transformation to `AppApiError` |
| **Adapter** | Razorpay SDK — adapts raw Razorpay REST API into typed escrow methods | `config/razorpay.ts`, `services/payment.service.ts` | SDK handles HMAC signing, error mapping; our code calls `createEscrowOrder()` |
| **Decorator** | Prisma Client Extensions `$extends()` — decorates base client with soft-delete | `lib/prisma.ts` | Transparently adds `isDeleted: false` to all reads, intercepts delete → soft-delete |
| **Decorator** | `asyncHandler()` wraps controller methods with try-catch | `utils/async-handler.ts` | Adds error-catching behavior to any async Express handler without modifying it |
| **Proxy** | Rate limiting middleware — sits in front of real handler, gates access | `middleware/rate-limit.middleware.ts` | Controls access to the real resource; returns 429 if limit exceeded |
| **Proxy** | Auth middleware — validates JWT before allowing access to protected routes | `middleware/auth.middleware.ts` | Protection proxy; attaches `req.user` or throws 401 |
| **Composite** | Express middleware pipeline — chain of functions composed into a single handler | `routes/*.routes.ts` | `router.get('/trips', rateLimitMw, authMw, validateMw, controller.getTrips)` |
| **Repository** | Data access abstraction — services call repos, never Prisma directly | `repositories/*.repository.ts` | Isolates DB layer; swap Prisma for Drizzle without touching services |

#### Behavioral Patterns

| Pattern | Where Used | File(s) | Why |
|---------|-----------|---------|-----|
| **Chain of Responsibility** | Express middleware pipeline — each middleware decides to pass or halt | `server.ts` middleware stack | Request flows: RequestID → RateLimit → CORS → Logger → Auth → Role → Validate → Controller → ErrorHandler |
| **Strategy** | Sort strategy — `buildOrderBy(sort)` switches behavior based on input | `repositories/trip.repository.ts` | `price_asc`, `price_desc`, `rating`, `date`, `popularity` — each is a different sort strategy |
| **Strategy** | Cancellation policy — `FLEXIBLE`, `MODERATE`, `STRICT` determine refund rules | `services/booking.service.ts` | Enum selects which refund calculation strategy to apply |
| **Strategy** | Booking mode — `INSTANT` vs `REQUEST_BASED` changes the booking flow | `services/booking.service.ts` | Strategy determines if approval check is needed before payment |
| **Strategy** | Rate limit tiers — `generalRateLimit`, `authRateLimit`, `webhookRateLimit` | `middleware/rate-limit.middleware.ts` | Different sliding window strategies for different endpoint types |
| **Observer** | Socket.IO events — `socket.on('message:send')`, `io.emit('message:new')` | `socket/handlers/chat.handler.ts` | Pub/sub: message sender publishes, all room members receive notification |
| **Observer** | `res.on('finish', ...)` — response event triggers request logging | `middleware/request-logger.middleware.ts` | Observer listens for response completion to calculate and log duration |
| **Observer** | TanStack Query `onSuccess` callbacks — mutation triggers cache invalidation | `hooks/use-booking.ts` | Creating a booking triggers invalidation of trip detail + trip lists + my bookings |
| **Template Method** | Soft-delete mixin — every model follows the same 5-field template | `db-design.md` Section 1 | `isActive`, `isDeleted`, `createdAt`, `updatedAt`, `deletedAt` — invariant structure, model-specific fields vary |
| **Template Method** | 4-state rendering pattern — every data component follows loading/error/empty/data | `build-frontend.md` Step 6 | Skeleton → ErrorState → EmptyState → ActualComponent — template is fixed, content varies |
| **Command** | Mutation hooks encapsulate actions with execute + undo capabilities | `hooks/use-booking.ts` | `useCreateBooking()` is a command object: `mutationFn` = execute, `onSuccess` = post-action, `onError` = handle failure |
| **Iterator** | Cursor/offset pagination in repository `search()` methods | `repositories/trip.repository.ts` | `skip` + `take` iterates through result set without loading everything |
| **Mediator** | `BookingService.confirmBooking()` coordinates between multiple subsystems | `services/booking.service.ts` | Mediates between BookingRepo (status update), TripRepo (atomic seat increment), PaymentService (capture), NotificationService (email) |

#### Frontend-Specific Patterns

| Pattern | Where Used | File(s) | Why |
|---------|-----------|---------|-----|
| **Provider Pattern** | React Context providers wrap app (Auth, QueryClient, Theme) | `app/layout.tsx`, `providers/` | Dependency injection for React tree — any child can access auth state, query client |
| **Custom Hook Pattern** | All data fetching encapsulated in hooks — `useTrips()`, `useBooking()` | `hooks/use-*.ts` | Separates data fetching logic from UI; reusable across pages |
| **Compound Component** | Form components with React Hook Form + Zod — form ↔ field ↔ error coupling | `components/booking/booking-form.tsx` | Parent form manages state, children (fields, errors) are coordinated |
| **Render Props / Children** | Error boundary with `fallback` prop | `components/shared/error-boundary.tsx` | Parent provides error UI via prop; boundary handles when to show it |
| **HOC (Higher-Order Component)** | `asyncHandler()` wraps a function to add error handling behavior | `utils/async-handler.ts` | Classic HOC: takes a function, returns an enhanced function |

### Pattern Usage Rules

```
RULE 1: Never skip the Service layer.
  ❌ Controller → Repository (direct DB access)
  ✅ Controller → Service → Repository

RULE 2: Never put business logic in a Repository.
  ❌ bookingRepo.createAndNotify()
  ✅ bookingService.createBooking() → bookingRepo.create() + notificationService.send()

RULE 3: Use Factory for anything that needs consistent construction.
  ❌ queryKey: ['trips', 'list', filters]  (inline string, easy to typo)
  ✅ queryKey: tripKeys.list(filters)      (factory, one source of truth)

RULE 4: Use Strategy when behavior varies by type/enum.
  ❌ if (mode === 'INSTANT') { ... } else if (mode === 'REQUEST') { ... }  (in controller)
  ✅ Service method checks mode internally — controller just calls createBooking()

RULE 5: Use Facade when orchestrating 3+ subsystems.
  ❌ Controller calls tripRepo, then paymentService, then notificationService
  ✅ Controller calls bookingService.createBooking() — facade handles orchestration

RULE 6: Use Singleton for expensive resources.
  ❌ const prisma = new PrismaClient()  (inside every request handler)
  ✅ Export one instance from lib/prisma.ts, import everywhere
```

---

## 2. Monorepo Structure

```
travel-app/
├── apps/
│   ├── web/                          # Next.js Frontend
│   │   ├── public/
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── favicon.ico
│   │   ├── src/
│   │   │   ├── app/                  # Next.js App Router (pages)
│   │   │   │   ├── (auth)/           # Route group: auth pages
│   │   │   │   │   ├── login/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── signup/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── (main)/           # Route group: public pages
│   │   │   │   │   ├── page.tsx              # Home
│   │   │   │   │   ├── trips/
│   │   │   │   │   │   ├── page.tsx          # Search/listing
│   │   │   │   │   │   ├── [slug]/
│   │   │   │   │   │   │   └── page.tsx      # Trip detail
│   │   │   │   │   │   └── compare/
│   │   │   │   │   │       └── page.tsx      # Comparison
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── (dashboard)/      # Route group: authenticated
│   │   │   │   │   ├── my-trips/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── bookings/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── trip-requests/
│   │   │   │   │   │   └── page.tsx       # My join requests (traveler)
│   │   │   │   │   ├── notifications/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── messages/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── (organizer)/      # Route group: organizer pages
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── trips/
│   │   │   │   │   │   ├── new/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       └── edit/
│   │   │   │   │   │           └── page.tsx
│   │   │   │   │   ├── bookings/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── trip-requests/
│   │   │   │   │   │   └── page.tsx       # Pending requests queue (organizer)
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── (admin)/          # Route group: admin panel
│   │   │   │   │   ├── organizers/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── disputes/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── layout.tsx        # Root layout
│   │   │   │   └── not-found.tsx
│   │   │   ├── components/           # UI Components
│   │   │   │   ├── ui/               # shadcn/ui primitives
│   │   │   │   │   ├── button.tsx
│   │   │   │   │   ├── input.tsx
│   │   │   │   │   ├── card.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── layout/           # Layout components
│   │   │   │   │   ├── header.tsx
│   │   │   │   │   ├── footer.tsx
│   │   │   │   │   ├── sidebar.tsx
│   │   │   │   │   └── mobile-nav.tsx
│   │   │   │   ├── trips/            # Trip-specific components
│   │   │   │   │   ├── trip-card.tsx
│   │   │   │   │   ├── trip-filters.tsx
│   │   │   │   │   ├── trip-comparison-table.tsx
│   │   │   │   │   ├── trip-itinerary.tsx
│   │   │   │   │   ├── trip-booking-sidebar.tsx
│   │   │   │   │   └── trip-review-card.tsx
│   │   │   │   ├── booking/
│   │   │   │   │   ├── booking-form.tsx
│   │   │   │   │   ├── price-breakdown.tsx
│   │   │   │   │   └── booking-confirmation.tsx
│   │   │   │   ├── trip-requests/     # Request-based booking components
│   │   │   │   │   ├── trip-request-card.tsx
│   │   │   │   │   ├── trip-request-form.tsx
│   │   │   │   │   └── trip-request-status-badge.tsx
│   │   │   │   ├── notifications/
│   │   │   │   │   ├── notification-bell.tsx
│   │   │   │   │   ├── notification-list.tsx
│   │   │   │   │   └── notification-item.tsx
│   │   │   │   ├── destinations/
│   │   │   │   │   ├── destination-card.tsx
│   │   │   │   │   └── destination-grid.tsx
│   │   │   │   ├── chat/
│   │   │   │   │   ├── chat-window.tsx
│   │   │   │   │   ├── message-bubble.tsx
│   │   │   │   │   └── chat-sidebar.tsx
│   │   │   │   └── shared/           # Reusable across features
│   │   │   │       ├── star-rating.tsx
│   │   │   │       ├── image-gallery.tsx
│   │   │   │       ├── loading-skeleton.tsx
│   │   │   │       ├── error-boundary.tsx
│   │   │   │       └── empty-state.tsx
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   │   ├── use-trips.ts
│   │   │   │   ├── use-booking.ts
│   │   │   │   ├── use-trip-requests.ts
│   │   │   │   ├── use-destinations.ts
│   │   │   │   ├── use-notifications.ts
│   │   │   │   ├── use-chat.ts
│   │   │   │   ├── use-auth.ts
│   │   │   │   └── use-debounce.ts
│   │   │   ├── lib/                  # Utility functions
│   │   │   │   ├── api-client.ts     # Axios/fetch wrapper
│   │   │   │   ├── query-keys.ts     # TanStack Query key factories
│   │   │   │   ├── format.ts         # Date, currency formatters
│   │   │   │   ├── seo.ts            # Meta tag generators
│   │   │   │   ├── constants.ts
│   │   │   │   └── utils.ts          # cn() and generic helpers
│   │   │   ├── types/                # Frontend-specific types
│   │   │   │   └── index.ts
│   │   │   └── styles/
│   │   │       └── globals.css
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                          # Express Backend
│       ├── src/
│       │   ├── index.ts              # App entry point
│       │   ├── server.ts             # Express app setup
│       │   ├── config/
│       │   │   ├── env.ts            # Environment variable validation (Zod)
│       │   │   ├── database.ts       # DB connection config (lib/prisma.ts)
│       │   │   ├── redis.ts          # ioredis client (TCP)
│       │   │   ├── razorpay.ts       # Razorpay client init
│       │   │   ├── cloudinary.ts     # Cloudinary config
│       │   │   └── cors.ts           # CORS whitelist
│       │   ├── routes/               # Route definitions ONLY
│       │   │   ├── index.ts          # Route aggregator
│       │   │   ├── auth.routes.ts
│       │   │   ├── trip.routes.ts
│       │   │   ├── booking.routes.ts
│       │   │   ├── trip-request.routes.ts
│       │   │   ├── destination.routes.ts
│       │   │   ├── notification.routes.ts
│       │   │   ├── upload.routes.ts
│       │   │   ├── review.routes.ts
│       │   │   ├── chat.routes.ts
│       │   │   ├── webhook.routes.ts
│       │   │   ├── organizer.routes.ts
│       │   │   └── admin.routes.ts
│       │   ├── controllers/          # Request parsing → call service → send response
│       │   │   ├── auth.controller.ts
│       │   │   ├── trip.controller.ts
│       │   │   ├── booking.controller.ts
│       │   │   ├── trip-request.controller.ts
│       │   │   ├── destination.controller.ts
│       │   │   ├── notification.controller.ts
│       │   │   ├── upload.controller.ts
│       │   │   ├── webhook.controller.ts
│       │   │   ├── review.controller.ts
│       │   │   ├── chat.controller.ts
│       │   │   ├── organizer.controller.ts
│       │   │   └── admin.controller.ts
│       │   ├── services/             # ALL business logic lives here
│       │   │   ├── auth.service.ts
│       │   │   ├── trip.service.ts
│       │   │   ├── booking.service.ts
│       │   │   ├── trip-request.service.ts
│       │   │   ├── destination.service.ts
│       │   │   ├── upload.service.ts
│       │   │   ├── review.service.ts
│       │   │   ├── chat.service.ts
│       │   │   ├── payment.service.ts
│       │   │   ├── organizer.service.ts
│       │   │   └── notification.service.ts
│       │   ├── repositories/         # DB queries ONLY
│       │   │   ├── user.repository.ts
│       │   │   ├── trip.repository.ts
│       │   │   ├── booking.repository.ts
│       │   │   ├── trip-request.repository.ts
│       │   │   ├── destination.repository.ts
│       │   │   ├── payment-transaction.repository.ts
│       │   │   ├── notification.repository.ts
│       │   │   ├── refresh-token.repository.ts
│       │   │   ├── verification-code.repository.ts
│       │   │   ├── webhook-event.repository.ts
│       │   │   ├── review.repository.ts
│       │   │   └── message.repository.ts
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts         # JWT verification
│       │   │   ├── role.middleware.ts         # Role-based access
│       │   │   ├── validate.middleware.ts     # Zod schema validation
│       │   │   ├── rate-limit.middleware.ts   # Redis-backed rate limiting
│       │   │   ├── request-id.middleware.ts   # UUID request tracing
│       │   │   ├── webhook-verify.middleware.ts # Razorpay HMAC signature verification
│       │   │   ├── error-handler.middleware.ts # Global error handler
│       │   │   └── request-logger.middleware.ts # Request/response logging
│       │   ├── validators/           # Zod schemas for request validation
│       │   │   ├── auth.schema.ts
│       │   │   ├── trip.schema.ts
│       │   │   ├── booking.schema.ts
│       │   │   ├── trip-request.schema.ts
│       │   │   ├── destination.schema.ts
│       │   │   ├── notification.schema.ts
│       │   │   └── review.schema.ts
│       │   ├── errors/               # Typed custom errors
│       │   │   ├── app-error.ts      # Base error class
│       │   │   ├── not-found.error.ts
│       │   │   ├── validation.error.ts
│       │   │   ├── auth.error.ts
│       │   │   ├── forbidden.error.ts
│       │   │   ├── conflict.error.ts
│       │   │   └── payment.error.ts
│       │   ├── utils/
│       │   │   ├── logger.ts         # Pino structured logger
│       │   │   ├── async-handler.ts  # Async error wrapper
│       │   │   ├── slug.ts           # URL slug generator
│       │   │   ├── chat-filter.ts    # Phone/UPI/Instagram detection
│       │   │   ├── cron-jobs.ts      # All scheduled tasks
│       │   │   └── constants.ts
│       │   ├── types/
│       │   │   ├── express.d.ts      # Express type extensions
│       │   │   └── index.ts
│       │   └── socket/               # Real-time chat
│       │       ├── index.ts          # Socket.IO setup
│       │       ├── handlers/
│       │       │   ├── chat.handler.ts
│       │       │   └── notification.handler.ts
│       │       └── middleware/
│       │           └── socket-auth.middleware.ts
│       ├── prisma/
│       │   ├── schema.prisma         # Database schema
│       │   ├── migrations/           # Auto-generated migrations
│       │   └── seed.ts               # Seed data for development
│       ├── tests/
│       │   ├── unit/
│       │   │   ├── services/
│       │   │   └── utils/
│       │   ├── integration/
│       │   │   ├── routes/
│       │   │   └── repositories/
│       │   └── helpers/
│       │       ├── test-db.ts
│       │       └── factories.ts      # Test data factories
│       ├── tsconfig.json
│       └── package.json
│
├── packages/                         # Shared code
│   └── shared/
│       ├── src/
│       │   ├── types/                # Types shared between FE & BE
│       │   │   ├── user.types.ts
│       │   │   ├── trip.types.ts
│       │   │   ├── booking.types.ts
│       │   │   ├── trip-request.types.ts
│       │   │   ├── destination.types.ts
│       │   │   ├── notification.types.ts
│       │   │   ├── review.types.ts
│       │   │   └── api-response.types.ts
│       │   ├── constants/
│       │   │   ├── trip-types.ts
│       │   │   ├── booking-status.ts
│       │   │   └── roles.ts
│       │   └── validators/           # Shared Zod schemas (FE + BE)
│       │       ├── trip.schema.ts
│       │       └── booking.schema.ts
│       ├── tsconfig.json
│       └── package.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + test on PR
│       └── deploy.yml                # Auto-deploy on merge to main
├── .env.example                      # Template for env vars
├── .eslintrc.js                      # Shared ESLint config
├── .prettierrc                       # Shared Prettier config
├── turbo.json                        # Turborepo config
├── package.json                      # Root package.json (workspaces)
└── README.md
```

### Why This Structure?

| Decision | Reasoning |
|----------|-----------|
| **Monorepo (Turborepo)** | Shared types, one `git clone`, one CI pipeline. Easy for solo dev, scales to team. |
| **Separate `apps/web` + `apps/api`** | FE and BE can be deployed independently. New dev can work on one without touching the other. |
| **`packages/shared`** | Types and constants used by both FE and BE. Change once, updates everywhere. Zero drift. |
| **Route groups `(auth)`, `(main)`, `(dashboard)`** | Next.js App Router groups — separate layouts per section without URL nesting. |
| **Feature-based components** | `components/trips/`, `components/booking/` — not `components/Button`, `components/Card`. Find trip-related code in one place. |

---

## 3. Frontend Spec

### Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 14.x | Framework (App Router, SSR/SSG for SEO) |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | latest | Component primitives (Button, Card, Dialog, etc.) |
| Lucide React | latest | Icons |
| React Hook Form | 7.x | Form handling |
| Zod | 3.x | Form + API validation |
| TanStack Query | 5.x | Server state management (caching, refetching) |
| Zustand | 4.x | Client state (minimal — chat, UI state only) |
| date-fns | 3.x | Date formatting |
| next-seo | latest | SEO meta tags |
| nuqs | latest | URL search params state (filters) |

### Component Pattern

Every component follows this structure:

```typescript
// components/trips/trip-card.tsx

// 1. Imports (external → internal → types → styles)
import { Card, CardContent } from '@/components/ui/card'
import { StarRating } from '@/components/shared/star-rating'
import type { TripSummary } from '@shared/types/trip.types'

// 2. Props interface (always explicit, never inline)
interface TripCardProps {
  trip: TripSummary
  onCompare?: (tripId: string) => void
  isSelected?: boolean
}

// 3. Component (named export, never default)
export function TripCard({ trip, onCompare, isSelected = false }: TripCardProps) {
  // hooks first
  // derived state
  // handlers
  // render
  return (
    <Card className={cn('...', isSelected && 'ring-2 ring-primary')}>
      <CardContent>
        {/* ... */}
      </CardContent>
    </Card>
  )
}
```

### Rules

| Rule | Why |
|------|-----|
| Named exports only | Easier to refactor, better IDE support, no accidental renames |
| No `any` type | TypeScript strict mode. Use `unknown` + type guards if needed. |
| Props interface above component | Readable. New dev sees the contract first. |
| Hooks at the top | Consistent order: hooks → derived state → handlers → return |
| `cn()` for conditional classes | From shadcn/ui utils — merge Tailwind classes cleanly |
| No inline styles | Tailwind only. Exception: dynamic values (e.g., `style={{ width: `${percent}%` }}`) |
| Co-locate tests | `trip-card.test.tsx` next to `trip-card.tsx` for unit tests |

### Query Key Factory (Cache Invalidation Pattern)

> Used by all major React apps (Vercel dashboard, Swiggy merchant panel).
> Ensures consistent cache keys across hooks — no stale data after mutations.

```typescript
// lib/query-keys.ts — single source of truth for all query keys
export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (filters: TripFilters) => [...tripKeys.lists(), filters] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (slug: string) => [...tripKeys.details(), slug] as const,
}

export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingKeys.all, 'list'] as const,
  list: (filters?: BookingFilters) => [...bookingKeys.lists(), filters] as const,
  detail: (id: string) => [...bookingKeys.all, 'detail', id] as const,
}

export const tripRequestKeys = {
  all: ['tripRequests'] as const,
  lists: () => [...tripRequestKeys.all, 'list'] as const,
  list: (filters?: TripRequestFilters) => [...tripRequestKeys.lists(), filters] as const,
  forTrip: (tripId: string) => [...tripRequestKeys.all, 'trip', tripId] as const,
}

export const destinationKeys = {
  all: ['destinations'] as const,
  list: () => [...destinationKeys.all, 'list'] as const,
  detail: (slug: string) => [...destinationKeys.all, 'detail', slug] as const,
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
}
```

### Data Fetching Pattern

```typescript
// hooks/use-trips.ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from '@/lib/query-keys'
import type { TripSummary } from '@shared/types/trip.types'

export function useTrips(filters: TripFilters) {
  return useQuery({
    queryKey: tripKeys.list(filters),    // Factory pattern — consistent keys
    queryFn: () => apiClient.get<TripSummary[]>('/trips', { params: filters }),
    staleTime: 5 * 60 * 1000,           // 5 min cache
  })
}

// Usage in page:
export default function TripsPage() {
  const filters = useSearchParams() // from nuqs
  const { data, isLoading, error } = useTrips(filters)

  if (isLoading) return <TripListSkeleton />
  if (error) return <ErrorState message={error.message} />
  if (!data?.length) return <EmptyState message="No trips found" />

  return <TripGrid trips={data} />
}
```

### SEO Strategy (Built Into Architecture)

```typescript
// app/(main)/trips/[slug]/page.tsx

import { Metadata } from 'next'

// Dynamic SEO — runs at build/request time
// NOTE: In Next.js 15+, params is a Promise (breaking change from 14)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const trip = await getTripBySlug(slug)
  return {
    title: `${trip.title} - ₹${trip.pricePerPerson} | TripCompare`,
    description: `${trip.destination.name} group trip, ${trip.startDate}–${trip.endDate}. Book safely with escrow.`,
    openGraph: {
      images: [trip.photos[0]],
    },
  }
}
```

### Error Boundary Strategy (FE)

Three layers of error handling on the frontend:

```
Layer 1: Route-level Error Boundaries (Next.js error.tsx)
  → Catches unhandled errors per route group
  → Shows full-page error state with retry

Layer 2: Component-level Error Boundaries
  → Wraps individual features (trip card grid, chat window)
  → Isolates failures — one broken card doesn't crash the page

Layer 3: Data-fetching Error States
  → TanStack Query onError → show inline error messages
  → Per-component loading/error/empty states
```

```typescript
// app/(main)/trips/error.tsx — Route-level error boundary (Next.js convention)

'use client'

export default function TripsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="text-5xl">😵</div>
      <h2 className="text-2xl font-display font-bold text-neutral-900">
        Something went wrong
      </h2>
      <p className="text-neutral-600 text-center max-w-md">
        We couldn&apos;t load the trips. This is probably temporary.
      </p>
      <button onClick={reset} className="btn-primary">
        Try Again
      </button>
    </div>
  )
}
```

```typescript
// components/shared/error-boundary.tsx — Reusable component-level boundary

'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    // Log to error tracking service (e.g., Sentry)
    console.error('ErrorBoundary caught:', error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 rounded-xl bg-error-50 border border-error-200 text-center">
          <p className="text-error-700 font-medium">Something went wrong loading this section.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Usage:
// <ErrorBoundary fallback={<TripCardError />}>
//   <TripCardGrid trips={trips} />
// </ErrorBoundary>
```

```typescript
// components/shared/data-states.tsx — Loading, Empty, Error inline states

interface DataStateProps {
  message?: string
  onRetry?: () => void
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-500 rounded-full" />
    </div>
  )
}

export function EmptyState({ message = 'Nothing here yet' }: DataStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="text-4xl">🏝️</div>
      <p className="text-neutral-500 text-center">{message}</p>
    </div>
  )
}

export function ErrorState({ message = 'Failed to load', onRetry }: DataStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="text-4xl">😕</div>
      <p className="text-neutral-600 font-medium">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          Try again
        </button>
      )}
    </div>
  )
}

// Usage pattern in any page/component:
// const { data, isLoading, error, refetch } = useTrips(filters)
// if (isLoading) return <LoadingState />
// if (error) return <ErrorState message={error.message} onRetry={refetch} />
// if (!data?.length) return <EmptyState message="No trips found for your search" />
```

---

## 4. Backend Spec

### Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| Express | 4.x | HTTP framework |
| TypeScript | 5.x | Type safety |
| Prisma | 5.x | ORM + migrations |
| Zod | 3.x | Request validation |
| jsonwebtoken | 9.x | JWT auth |
| bcrypt | 5.x | Password hashing |
| razorpay | 2.x | Payment SDK |
| socket.io | 4.x | Real-time chat |
| pino | 9.x | Structured JSON logging (fastest Node.js logger) |
| pino-pretty | latest | Dev-only log formatting |
| helmet | 7.x | Security headers |
| cors | 2.x | CORS handling |
| express-rate-limit | 7.x | Rate limiting |
| multer | 1.x | File uploads |
| node-cron | 3.x | Scheduled jobs (escrow release, reminders) |
| ioredis | 5.x | Redis client (TCP — rate limiting, cache, Socket.IO adapter) |
| crypto | built-in | SHA-256 hashing for refresh tokens + webhook signatures |
| cloudinary | 2.x | Signed upload URL generation (images never route through Express) |
| uuid | 10.x | Request ID generation for distributed tracing |

### API Design (RESTful)

```
BASE URL: /api/v1

HEALTH
  GET    /health                   # Health check (DB + Redis connectivity, uptime)

AUTH
  POST   /auth/signup              # Register (traveler or organizer)
  POST   /auth/login               # Login → returns JWT
  POST   /auth/google              # Google OAuth
  POST   /auth/refresh             # Refresh token
  POST   /auth/forgot-password     # Request reset
  POST   /auth/reset-password      # Reset with token

TRIPS (Public)
  GET    /trips                    # List/search (with filters, pagination)
  GET    /trips/:slug              # Trip detail by slug
  GET    /trips/compare?ids=a,b,c  # Comparison data

TRIPS (Organizer)
  POST   /trips                    # Create trip
  PUT    /trips/:id                # Update trip
  PATCH  /trips/:id/status         # Publish/unpublish/cancel
  DELETE /trips/:id                # Soft delete (draft only)

BOOKINGS
  POST   /bookings                 # Create booking + initiate payment
  GET    /bookings                 # My bookings (traveler)
  GET    /bookings/:id             # Booking detail
  PATCH  /bookings/:id/cancel      # Cancel booking → trigger refund
  
BOOKINGS (Organizer)
  GET    /organizer/bookings       # Bookings for my trips
  PATCH  /organizer/bookings/:id/confirm  # Confirm booking

TRIP REQUESTS (Request-Based booking mode)
  POST   /trip-requests              # Traveler requests to join a REQUEST_BASED trip
  GET    /trip-requests              # My requests (traveler — with status filter)
  GET    /organizer/trip-requests    # Requests for my trips (organizer — pending queue)
  PATCH  /organizer/trip-requests/:id/respond  # Approve or reject (body: { action, responseNote })

DESTINATIONS (Public)
  GET    /destinations               # All destinations (for dropdowns + homepage grid)
  GET    /destinations/:slug         # Destination detail + SEO page (/destinations/goa)

DESTINATIONS (Admin)
  POST   /admin/destinations         # Create new destination
  PUT    /admin/destinations/:id     # Update destination
  DELETE /admin/destinations/:id     # Soft-delete destination

NOTIFICATIONS
  GET    /notifications              # My notifications (paginated, filterable by read/unread)
  PATCH  /notifications/:id/read     # Mark single notification as read
  PATCH  /notifications/read-all     # Mark all as read
  GET    /notifications/unread-count # Badge count for notification bell

PAYMENTS (Webhooks)
  POST   /webhooks/razorpay        # Razorpay webhook handler (separate middleware chain)

REVIEWS
  POST   /reviews                  # Submit review (post-trip only, one per booking)
  GET    /reviews?tripId=xxx       # Reviews for a trip
  GET    /reviews?organizerId=xxx  # Reviews for an organizer

CHAT
  GET    /conversations            # My conversations
  GET    /conversations/:id/messages  # Message history (paginated)
  # Real-time messaging via Socket.IO (not REST)

ORGANIZER
  GET    /organizer/profile        # My organizer profile
  PUT    /organizer/profile        # Update profile
  GET    /organizer/stats          # Dashboard stats
  GET    /organizer/payments       # Payment history

UPLOADS (Signed URLs)
  POST   /uploads/signature        # Generate Cloudinary signed upload params
                                   # Returns: { signature, timestamp, apiKey, cloudName, folder }
                                   # FE uploads directly to Cloudinary, sends back URL

ADMIN
  GET    /admin/organizers         # All organizers (pending/approved)
  PATCH  /admin/organizers/:id/verify  # Approve/reject organizer
  GET    /admin/disputes           # Active disputes
  GET    /admin/stats              # Platform stats
```

### CORS Configuration (Production-Safe)

```typescript
// config/cors.ts
import cors from 'cors'
import { env } from './env'

const allowedOrigins = [env.CLIENT_URL]
if (env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:3000')
}

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  credentials: true,           // Required for httpOnly cookie auth
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  maxAge: 86400,               // Cache preflight for 24h
}

// Usage in server.ts:
// app.use(cors(corsOptions))
```

### Request → Response Flow

```
STANDARD ROUTES (user-facing):
  Request
    → Request ID Middleware (generate UUID per request)
    → Rate Limit Middleware (Redis-backed sliding window via ioredis)
    → CORS Middleware (origin whitelist)
    → Request Logger Middleware (structured Pino logs)
    → Auth Middleware (JWT verification)
    → Role Middleware (check permission)
    → Validate Middleware (Zod schema)
    → Controller → Service → Repository → Response
    → Error Handler Middleware (catches all thrown errors)

WEBHOOK ROUTES (Razorpay callbacks — DIFFERENT pipeline):
  POST /api/v1/webhooks/razorpay
    → express.raw({ type: 'application/json' })  // Raw body for HMAC signature
    → Webhook Rate Limit (50 req/min, separate from user limits)
    → Verify Razorpay Signature Middleware (HMAC-SHA256)
    → Controller → Service → Response
    → Error Handler Middleware

  DO NOT apply to webhooks: cors, auth middleware, role middleware, standard JSON parser.
  Razorpay authenticates via HMAC signature, not JWT.
```

### Controller Pattern (Thin Controllers)

```typescript
// controllers/trip.controller.ts

export class TripController {
  constructor(private tripService: TripService) {}

  getTrips = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as TripFilters
    const trips = await this.tripService.searchTrips(filters)
    
    res.json({
      success: true,
      data: trips.data,
      pagination: trips.pagination,
    })
  })

  getTripBySlug = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params
    const trip = await this.tripService.getTripBySlug(slug)
    
    res.json({
      success: true,
      data: trip,
    })
  })
}
```

### Service Pattern (All Business Logic Here)

```typescript
// services/booking.service.ts

export class BookingService {
  constructor(
    private bookingRepo: BookingRepository,
    private tripRepo: TripRepository,
    private tripRequestRepo: TripRequestRepository,
    private paymentService: PaymentService,
    private notificationService: NotificationService,
    private logger: Logger,
  ) {}

  async createBooking(userId: string, dto: CreateBookingDto): Promise<Booking> {
    // 1. Check trip exists and is active
    const trip = await this.tripRepo.findById(dto.tripId)
    if (!trip) throw new NotFoundError('Trip not found')
    if (trip.status !== 'ACTIVE') throw new ValidationError('Trip is not accepting bookings')

    // 2. Check booking mode — REQUEST_BASED trips need approved TripRequest first
    if (trip.bookingMode === 'REQUEST_BASED') {
      const approvedRequest = await this.tripRequestRepo.findApprovedForUser(dto.tripId, userId)
      if (!approvedRequest) {
        throw new ValidationError('This trip requires organizer approval before booking. Submit a join request first.')
      }
      if (approvedRequest.approvalExpiresAt && approvedRequest.approvalExpiresAt < new Date()) {
        throw new ValidationError('Your approval has expired. Please submit a new request.')
      }
    }

    // 3. Check booking deadline (default: startDate - 24h if not set)
    const deadline = trip.bookingDeadline || new Date(trip.startDate.getTime() - 24 * 60 * 60 * 1000)
    if (new Date() > deadline) {
      throw new ValidationError('Booking deadline has passed for this trip')
    }

    // 4. Check available seats (only CONFIRMED bookings count)
    if (trip.currentBookings >= trip.maxGroupSize) {
      throw new ValidationError('Trip is fully booked')
    }

    // 5. Calculate price (in whole rupees)
    const amount = this.calculateAmount(trip, dto)

    // 6. Create Razorpay order (escrow)
    const razorpayOrder = await this.paymentService.createEscrowOrder(amount)

    // 7. Create booking record (PENDING_PAYMENT — does NOT increment currentBookings)
    const booking = await this.bookingRepo.create({
      userId,
      tripId: dto.tripId,
      amount,
      razorpayOrderId: razorpayOrder.id,
      bookingStatus: 'PENDING_PAYMENT',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),  // Expires in 30 minutes
    })

    // 8. Log
    this.logger.info('Booking created (pending payment)', {
      bookingId: booking.id, tripId: dto.tripId, userId, amount,
    })

    return booking
  }

  /**
   * Called by webhook handler after Razorpay payment.captured event.
   * Atomically increments currentBookings to prevent race conditions.
   */
  async confirmBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.findById(bookingId)
    if (!booking) throw new NotFoundError('Booking not found')
    if (booking.bookingStatus !== 'PENDING_PAYMENT') {
      throw new ValidationError('Booking is not in PENDING_PAYMENT state')
    }

    // ATOMIC: Increment currentBookings ONLY if seats are still available
    // Uses Prisma $transaction with row-level check to prevent race conditions
    const result = await this.tripRepo.atomicIncrementBookings(
      booking.tripId,
      booking.numTravelers,
    )

    if (!result) {
      // Race condition: seats filled between payment init and confirmation
      await this.paymentService.initiateRefund(booking.razorpayPaymentId!)
      await this.bookingRepo.updateStatus(bookingId, 'REFUNDED')
      this.logger.warn('Auto-refund: seats filled during payment', {
        bookingId, tripId: booking.tripId,
      })
      throw new ValidationError('Trip became fully booked. Automatic refund initiated.')
    }

    // Update booking status
    const confirmed = await this.bookingRepo.updateStatus(bookingId, 'CONFIRMED')

    // Notify
    await this.notificationService.sendBookingConfirmation(confirmed)
    this.logger.info('Booking confirmed', { bookingId, tripId: booking.tripId })

    return confirmed
  }
}
```

### Atomic Seat Update (Race Condition Prevention)

> **Why raw SQL?** Prisma's query builder cannot reference one column against another in a `WHERE`
> clause (e.g., `currentBookings + N <= maxGroupSize`). Only `$executeRaw` supports this.
> This is the same atomic pattern used by MMT/Cleartrip for seat inventory.

```typescript
// repositories/trip.repository.ts

/**
 * Atomically increments currentBookings with optimistic locking.
 * Returns true if update succeeded, false if seats full or version conflict.
 *
 * - Cross-column comparison in WHERE prevents overbooking
 * - Version check prevents lost updates from concurrent requests
 * - Single SQL statement = atomic at the DB level
 */
async atomicIncrementBookings(
  tripId: string,
  count: number,
  expectedVersion: number,
): Promise<boolean> {
  const result = await this.prisma.$executeRaw`
    UPDATE "Trip"
    SET "currentBookings" = "currentBookings" + ${count},
        "version" = "version" + 1,
        "updatedAt" = NOW()
    WHERE "id" = ${tripId}
      AND "isDeleted" = false
      AND "status" = 'ACTIVE'
      AND "currentBookings" + ${count} <= "maxGroupSize"
      AND "version" = ${expectedVersion}
  `
  return result > 0  // true = success, false = no seats or version conflict (race-safe)
}
```

### Cron Job: Expire Stale Bookings

```typescript
// utils/cron-jobs.ts

import cron from 'node-cron'
import { logger } from './logger'

export function registerCronJobs(bookingRepo: BookingRepository, tripRepo: TripRepository) {

  // Run every 5 minutes: expire PENDING_PAYMENT bookings older than 30min
  cron.schedule('*/5 * * * *', async () => {
    try {
      const expired = await bookingRepo.expireStalePendingBookings()
      if (expired.count > 0) {
        logger.info(`Expired ${expired.count} stale PENDING_PAYMENT bookings`)
      }
    } catch (error) {
      logger.error('Cron: expire bookings failed', { error })
    }
  })
}

// In repository:
// repositories/booking.repository.ts
async expireStalePendingBookings() {
  return this.prisma.booking.updateMany({
    where: {
      bookingStatus: 'PENDING_PAYMENT',
      expiresAt: { lt: new Date() },
      isDeleted: false,
    },
    data: {
      bookingStatus: 'EXPIRED',
      isActive: false,
    },
  })
}
```

### Cron Job: Expire Approved TripRequests

```typescript
// Approved but unpaid requests expire after the payment window (48h default)
cron.schedule('*/15 * * * *', async () => {
  try {
    const expired = await tripRequestRepo.expireStaleApprovals()
    if (expired.count > 0) {
      logger.info(`Expired ${expired.count} stale approved trip requests`)
    }
  } catch (error) {
    logger.error('Cron: expire trip requests failed', { error })
  }
})

// In repository:
// repositories/trip-request.repository.ts
async expireStaleApprovals() {
  return this.prisma.tripRequest.updateMany({
    where: {
      status: 'APPROVED',
      approvalExpiresAt: { lt: new Date() },
      isDeleted: false,
    },
    data: { status: 'EXPIRED' },
  })
}
```

### Cron Job: Cleanup Expired Refresh Tokens

```typescript
// Run daily: remove expired refresh tokens older than 30 days
cron.schedule('0 3 * * *', async () => {
  try {
    const deleted = await refreshTokenRepo.deleteExpired()
    if (deleted.count > 0) {
      logger.info(`Cleaned up ${deleted.count} expired refresh tokens`)
    }
  } catch (error) {
    logger.error('Cron: cleanup refresh tokens failed', { error })
  }
})
```

### Health Check Endpoint

```typescript
// routes/health.routes.ts

import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()

router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now()
  const checks: Record<string, 'ok' | 'error'> = {}

  // Check DB connectivity
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
  }

  // Check Redis connectivity (if available)
  try {
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  const isHealthy = Object.values(checks).every(v => v === 'ok')

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    responseTime: `${Date.now() - startTime}ms`,
    checks,
  })
})

export { router as healthRoutes }

// Mount OUTSIDE /api/v1 — no auth needed:
// app.use(healthRoutes)  // GET /health
```

### Repository Pattern (DB Queries Only)

```typescript
// repositories/trip.repository.ts

export class TripRepository {
  constructor(private prisma: PrismaClient) {}

  async findBySlug(slug: string) {
    return this.prisma.trip.findFirst({
      where: { slug, isDeleted: false },
      include: {
        organizer: {
          select: { id: true, businessName: true, rating: true, totalReviews: true },
        },
        reviews: {
          where: { isDeleted: false },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  }

  async search(filters: TripFilters, pagination: Pagination) {
    const where = this.buildWhereClause(filters)
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: this.buildOrderBy(filters.sort),
      }),
      this.prisma.trip.count({ where }),
    ])
    return { data, total }
  }

  private buildWhereClause(filters: TripFilters): Prisma.TripWhereInput {
    return {
      isDeleted: false,  // Soft-delete: always exclude deleted records
      status: 'ACTIVE',
      // Destination: search by FK (dropdown) or by name (text search)
      ...(filters.destinationId && { destinationId: filters.destinationId }),
      ...(filters.destination && {
        destination: { name: { contains: filters.destination, mode: 'insensitive' } },
      }),
      ...(filters.minPrice && { pricePerPerson: { gte: filters.minPrice } }),
      ...(filters.maxPrice && { pricePerPerson: { lte: filters.maxPrice } }),
      ...(filters.startDate && { startDate: { gte: new Date(filters.startDate) } }),
      ...(filters.tripType && { tripType: filters.tripType }),
      ...(filters.bookingMode && { bookingMode: filters.bookingMode }),
    }
  }
}
```

---

## 5. Error Handling Architecture

### Custom Error Classes

```typescript
// errors/app-error.ts

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string,           // Machine-readable: 'TRIP_NOT_FOUND'
    public isOperational: boolean = true,  // true = expected error, false = bug
  ) {
    super(message)
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND')
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: ZodError) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}

export class PaymentError extends AppError {
  constructor(message: string, public razorpayError?: unknown) {
    super(message, 502, 'PAYMENT_FAILED')
  }
}
```

### Global Error Handler

```typescript
// middleware/error-handler.middleware.ts

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // 1. Log the error
  if (err instanceof AppError && err.isOperational) {
    logger.warn('Operational error', {
      code: err.code,
      message: err.message,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    })
  } else {
    // Unexpected error — this is a bug
    logger.error('Unexpected error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    })
  }

  // 2. Send response
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && err.details && {
          details: err.details.errors,
        }),
      },
    })
  }

  // Unknown error — don't leak details
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    },
  })
}
```

### Async Handler (No try-catch boilerplate)

```typescript
// utils/async-handler.ts

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
```

### Standard API Response Format

```typescript
// SUCCESS
{
  "success": true,
  "data": { ... },
  "pagination": {                  // Only for list endpoints
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}

// ERROR
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",    // Machine-readable (for FE switch statements)
    "message": "Trip is fully booked",  // Human-readable
    "details": [...]               // Only for validation errors
  }
}
```

---

## 6. Logging Strategy

### Logger Setup (Pino — fastest Node.js logger)

```typescript
// utils/logger.ts

import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,  // JSON in production (for log aggregation)
  base: {
    service: 'travel-api',
    env: process.env.NODE_ENV,
  },
})
```

### What to Log (and What NOT to)

| Log Level | When | Example |
|-----------|------|---------|
| **error** | Unexpected failures, bugs | DB connection lost, unhandled exception |
| **warn** | Operational errors, suspicious activity | Invalid JWT, rate limit hit, chat filter triggered |
| **info** | Business events | Booking created, payment received, trip published |
| **debug** | Dev-only detail | Query params, service inputs (NEVER in production) |

| NEVER Log | Why |
|-----------|-----|
| Passwords, tokens | Security |
| Full credit card numbers | PCI compliance |
| Aadhaar numbers | Privacy law (India) |
| Raw request bodies with PII | GDPR/privacy |

### Request Logging Middleware

```typescript
// middleware/request-logger.middleware.ts

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || 'anonymous',
      ip: req.ip,
    }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`)
  })

  next()
}
```

**Result:** Every request produces a structured log like:
```
INFO [travel-api] GET /api/v1/trips 200 45ms userId=usr_abc123
```

Easy to filter, search, and debug in production.

---

## 7. Auth & Security

### Auth Flow

```
SIGNUP:
  Email/Phone + Password → Hash with bcrypt(12 rounds) → Store in DB → Generate tokens

LOGIN:
  Email/Phone + Password → Verify bcrypt → Generate access + refresh tokens

GOOGLE OAUTH:
  Google token → Verify with Google API → Find/create user → Generate tokens

JWT STRUCTURE:
  Access Token:  { userId, role, exp: 15min }  — sent in Authorization header
  Refresh Token: Random 64-byte string          — stored in httpOnly secure cookie
```

### Refresh Token Security (SHA-256 — Never Store Raw)

> **Why hash?** If DB is compromised, attacker gets hashed tokens = useless.
> Same approach used by Auth0, Supabase, and major Indian fintech platforms.

```typescript
// services/auth.service.ts
import crypto from 'crypto'

// GENERATE: Create random token, hash before storing
async generateRefreshToken(userId: string, req: Request): Promise<string> {
  const rawToken = crypto.randomBytes(64).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  await this.refreshTokenRepo.create({
    userId,
    tokenHash,                                   // Store ONLY the hash
    deviceInfo: req.headers['user-agent'] || null,
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),  // 7 days
  })

  return rawToken  // Send raw token to client in httpOnly cookie
}

// VERIFY: Hash the cookie value, look up in DB
async verifyRefreshToken(rawToken: string): Promise<RefreshToken> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const token = await this.refreshTokenRepo.findByHash(tokenHash)

  if (!token) throw new AuthError('Invalid refresh token')
  if (token.revokedAt) throw new AuthError('Token has been revoked')
  if (token.expiresAt < new Date()) throw new AuthError('Token expired')

  return token
}

// REVOKE: On logout, revoke all user sessions
async revokeAllSessions(userId: string): Promise<void> {
  await this.refreshTokenRepo.revokeAllForUser(userId)
}
```

**Cookie settings:**
```typescript
res.cookie('refreshToken', rawToken, {
  httpOnly: true,       // Not accessible via JavaScript
  secure: true,         // HTTPS only
  sameSite: 'strict',   // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  path: '/api/v1/auth/refresh',      // Only sent to refresh endpoint
})
```

### Role-Based Access Control

```typescript
// middleware/role.middleware.ts

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthError('Not authenticated')
    if (!roles.includes(req.user.role)) {
      throw new AuthError('Insufficient permissions')
    }
    next()
  }
}

// Usage in routes:
router.post('/trips', auth, requireRole('ORGANIZER'), validate(createTripSchema), tripController.create)
router.get('/admin/stats', auth, requireRole('ADMIN'), adminController.getStats)
```

### Security Checklist (MVP)

| Security Measure | Implementation |
|-----------------|----------------|
| Input validation | Zod schemas on every endpoint |
| SQL injection | Prisma ORM (parameterized queries) |
| XSS | React auto-escapes, helmet headers |
| CSRF | SameSite cookies, Origin check |
| Rate limiting | express-rate-limit (100 req/min general, 5/min for auth) |
| Password storage | bcrypt with salt rounds = 12 |
| JWT security | Short-lived access (15min), httpOnly refresh cookie |
| File upload | Multer with size limit (5MB), type whitelist (jpg, png, webp) |
| HTTPS | Enforced via Vercel/hosting |
| Secrets | `.env` only, never in code. Validated with Zod at startup. |

---

## 8. Payments — Razorpay Escrow

### Payment Flow

```
1. User clicks "Book Now"
   → FE sends POST /api/v1/bookings

2. BE creates Razorpay Order (Route/Escrow mode)
   → Returns orderId to FE

3. FE opens Razorpay checkout modal
   → User pays (UPI/Card/Net Banking)

4. Razorpay sends webhook to POST /api/v1/webhooks/razorpay
   → BE verifies signature
   → Updates booking status to CONFIRMED
   → Money is HELD in escrow (not yet transferred to organizer)

5. Trip happens

6. After trip completion (admin/auto trigger):
   → BE calls Razorpay Transfer API
   → Money released to organizer's linked account
   → Booking status → COMPLETED

CANCELLATION:
   → Before trip: Full/partial refund via Razorpay Refund API
   → Escrow amount returned to user
```

### Webhook Handler (Idempotent)

```typescript
// services/payment.service.ts

async handleWebhook(body: any, signature: string): Promise<void> {
  // 1. Verify signature (CRITICAL — prevents fake webhooks)
  const isValid = Razorpay.validateWebhookSignature(
    JSON.stringify(body),
    signature,
    process.env.RAZORPAY_WEBHOOK_SECRET
  )
  if (!isValid) throw new AuthError('Invalid webhook signature')

  // 2. Idempotency check — prevent duplicate processing
  const eventId = body.event_id
  const existing = await this.webhookRepo.findByEventId(eventId)
  if (existing) {
    this.logger.info('Duplicate webhook, skipping', { eventId })
    return
  }

  // 3. Process based on event type
  switch (body.event) {
    case 'payment.captured':
      await this.handlePaymentCaptured(body.payload)
      break
    case 'refund.processed':
      await this.handleRefundProcessed(body.payload)
      break
  }

  // 4. Record webhook (for idempotency + audit)
  await this.webhookRepo.create({ eventId, event: body.event, payload: body })
}
```

---

## 9. Real-Time Chat (Anti-Leakage)

### Socket.IO Architecture

```typescript
// socket/index.ts

export function initSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: corsOptions.origin,    // Reuse CORS whitelist from config/cors.ts
      credentials: true,
    },
    adapter: createAdapter(redis),   // Redis adapter for horizontal scaling
  })

  // Auth middleware — verify JWT before connection
  io.use(socketAuthMiddleware)

  io.on('connection', (socket) => {
    const userId = socket.data.userId

    // Join user's rooms (one per conversation)
    socket.on('join:conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`)
    })

    // Handle new message
    socket.on('message:send', async (data) => {
      const { conversationId, content } = data

      // ANTI-LEAKAGE: Filter message content
      const filterResult = chatFilter.scan(content)
      if (filterResult.blocked) {
        socket.emit('message:blocked', {
          reason: 'Sharing contact details is not allowed on this platform.',
        })
        logger.warn('Chat filter triggered', {
          userId, conversationId,
          triggerType: filterResult.type,  // 'phone' | 'upi' | 'instagram' | 'email'
        })
        return
      }

      // Save and broadcast
      const message = await messageRepo.create({
        conversationId, senderId: userId, content,
        isFlagged: filterResult.suspicious,
      })
      io.to(`conversation:${conversationId}`).emit('message:new', message)
    })
  })
}
```

### Chat Content Filter

```typescript
// utils/chat-filter.ts

const PHONE_REGEX = /(\+91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}/g
const UPI_REGEX = /[a-zA-Z0-9._-]+@(upi|paytm|oksbi|okicici|okaxis|ybl|apl|ibl)/gi
const INSTAGRAM_REGEX = /@[a-zA-Z0-9._]{1,30}|instagram\.com\/[a-zA-Z0-9._]+/gi
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const WHATSAPP_REGEX = /whatsapp|whats\s?app|wa\.me/gi

// Also catches obfuscation: "nine eight seven six..." or "9 8 7 6..."
const SPELLED_NUMBERS_REGEX = /(zero|one|two|three|four|five|six|seven|eight|nine)[\s,.-]*/gi

export function scan(content: string): FilterResult {
  if (PHONE_REGEX.test(content)) return { blocked: true, type: 'phone' }
  if (UPI_REGEX.test(content)) return { blocked: true, type: 'upi' }
  if (INSTAGRAM_REGEX.test(content)) return { blocked: true, type: 'instagram' }
  if (EMAIL_REGEX.test(content)) return { blocked: true, type: 'email' }
  if (WHATSAPP_REGEX.test(content)) return { blocked: true, type: 'whatsapp' }

  // Suspicious but not blocked (admin review)
  if (SPELLED_NUMBERS_REGEX.test(content)) return { blocked: false, suspicious: true, type: 'possible_phone' }

  return { blocked: false, suspicious: false }
}
```

---

## 9b. Redis Cache & Rate Limiting

> **Why Redis?** Production platforms (Swiggy, Zomato) use Redis for rate limiting, caching, and
> session management. Without Redis, `express-rate-limit` uses in-memory storage — breaks with
> multiple server instances. We use ioredis (TCP) connecting to a Docker Redis container in dev
> and a managed Redis instance in production.

### Redis Client Setup

```typescript
// config/redis.ts
import IORedis from 'ioredis'
import { logger } from '../utils/logger'

function createRedisClient(): IORedis | null {
  const url = process.env.REDIS_URL
  if (!url) {
    logger.warn('REDIS_URL not set — rate limiting and caching disabled')
    return null
  }
  const client = new IORedis(url, { maxRetriesPerRequest: 3 })
  client.on('connect', () => logger.info('Redis: connected'))
  client.on('error', (err: Error) => logger.error({ error: err.message }, 'Redis connection error'))
  return client
}

export const redis = createRedisClient()
```

### Rate Limiting (Redis-Backed)

```typescript
// utils/rate-limiter.ts — Atomic sliding window via Redis sorted sets + Lua
export class SlidingWindowRateLimiter {
  constructor(private redis: IORedis, private prefix: string, private max: number, private windowMs: number) {}
  async limit(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }>
}

// middleware/rate-limit.middleware.ts
import { redis } from '../config/redis'
import { SlidingWindowRateLimiter } from '../utils/rate-limiter'

function createRateLimiter(prefix: string, maxRequests: number, windowSeconds: number) {
  if (!redis) return (_req, _res, next) => next()  // graceful fallback
  const limiter = new SlidingWindowRateLimiter(redis, prefix, maxRequests, windowSeconds * 1000)
  return async (req, res, next) => {
    const { success, limit, remaining, reset } = await limiter.limit(req.ip || 'unknown')
    res.setHeader('X-RateLimit-Limit', limit)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', reset)
    if (!success) return res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: '...' } })
    next()
  }
}

export const generalRateLimit = createRateLimiter('general', 100, 60)
export const authRateLimit    = createRateLimiter('auth', 10, 60)
export const otpRateLimit     = createRateLimiter('otp', 5, 60)
export const webhookRateLimit = createRateLimiter('webhook', 50, 60)
```

### Cache Patterns

```typescript
// Trip listing cache (5 min TTL) — reduces DB load on homepage
async function getCachedTrips(filters: TripFilters): Promise<TripSummary[] | null> {
  const cacheKey = `trips:${JSON.stringify(filters)}`
  return redis.get<TripSummary[]>(cacheKey)
}

async function setCachedTrips(filters: TripFilters, data: TripSummary[]): Promise<void> {
  const cacheKey = `trips:${JSON.stringify(filters)}`
  await redis.set(cacheKey, data, { ex: 300 })  // 5 min TTL
}

// Invalidate on trip create/update/delete
async function invalidateTripCache(): Promise<void> {
  const keys = await redis.keys('trips:*')
  if (keys.length) await redis.del(...keys)
}

// Destination list cache (1 hour TTL — rarely changes)
// Notification unread count cache (1 min TTL — frequent reads)
```

---

## 9c. Image Upload (Cloudinary Direct Upload)

> **Rule: Images NEVER route through the Express server.** FE uploads directly to Cloudinary
> using a signed upload URL generated by BE. Same pattern as Instagram, Airbnb, OYO.

### Upload Flow

```
1. FE requests signed upload params: POST /api/v1/uploads/signature
2. BE generates Cloudinary signature (with folder, size limits, allowed formats)
3. FE uploads directly to Cloudinary (client-side, no Express bandwidth)
4. Cloudinary returns URL + public_id
5. FE sends Cloudinary URL(s) to BE in the trip create/update request
6. BE validates URL is from Cloudinary domain (prevent arbitrary URLs)
```

### Signed Upload Generator

```typescript
// services/upload.service.ts
import { v2 as cloudinary } from 'cloudinary'
import { env } from '@/config/env'

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
})

export class UploadService {
  generateSignature(folder: string): CloudinarySignature {
    const timestamp = Math.round(Date.now() / 1000)
    const params = {
      timestamp,
      folder: `travel/${folder}`,  // e.g., travel/trips, travel/avatars
      allowed_formats: 'jpg,png,webp',
      max_file_size: 5_000_000,    // 5MB
      transformation: 'c_limit,w_1920,h_1080,q_auto,f_auto',  // Auto-optimize
    }
    const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET)
    return {
      signature,
      timestamp,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      folder: params.folder,
    }
  }

  // Validate that a URL is actually from Cloudinary (prevents injection of arbitrary URLs)
  validateCloudinaryUrl(url: string): boolean {
    return url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`)
  }
}
```

---

## 9d. Request Tracing (Request ID)

> Every request gets a unique ID for distributed tracing. Included in all logs and error responses.
> Essential for debugging in production — correlate FE error report with exact server log.

```typescript
// middleware/request-id.middleware.ts
import { v4 as uuidv4 } from 'uuid'

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || uuidv4()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
}

// Extend Express Request type:
// types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      requestId: string
      user?: { id: string; role: UserRole }
    }
  }
}
```

---

## 9e. API Versioning Strategy

```
CURRENT:  /api/v1/...

RULES:
- URL-based versioning (not header-based) — simpler to debug, test, and document
- v2 is created ONLY when there are breaking changes (field removal, type changes)
- Non-breaking changes (new fields, new endpoints) go in v1
- When v2 ships: v1 gets 6 months deprecation notice, then read-only, then removed
- Breaking change examples: removing a response field, changing a field type,
  restructuring nested objects
- Non-breaking examples: adding optional request params, adding response fields,
  new endpoints
```

---

## 10. Database

> **Full schema lives in [`db-design.md`](./db-design.md)** — 15 MVP tables, 13 future tables, ER diagram, index strategy, race condition patterns, normalization compliance, and CHECK constraints.
>
> This section covers the **Prisma client setup, soft-delete enforcement, and migration rules** that complement the schema.

### Prisma Client Setup (Singleton + Soft-Delete Extensions)

See `db-design.md` Section 2 for the full `lib/prisma.ts` implementation using **Prisma Client Extensions** (the modern replacement for the deprecated `prisma.$use()` middleware).

Key points:
- `basePrisma` — raw client, used only for admin/audit queries that need deleted records
- `prisma` — extended client with auto soft-delete filtering on all reads and delete interception
- Singleton pattern prevents connection leaks during Next.js hot-reload
- `SOFT_DELETE_MODELS` whitelist — audit tables (`PaymentTransaction`, `WebhookEvent`, `RefreshToken`, `VerificationCode`) are excluded

### Enums (Quick Reference)

Full enum definitions in `db-design.md` Section 4. Key enums:

| Enum | Values |
|------|--------|
| `UserRole` | TRAVELER, ORGANIZER, ADMIN |
| `TripStatus` | DRAFT, ACTIVE, FULL, COMPLETED, CANCELLED |
| `BookingStatus` | PENDING_PAYMENT, CONFIRMED, CANCELLED, COMPLETED, REFUNDED, EXPIRED |
| `BookingMode` | INSTANT, REQUEST_BASED |
| `TripRequestStatus` | PENDING, APPROVED, REJECTED, EXPIRED, CONVERTED |
| `PaymentType` | PAYMENT, REFUND, ESCROW_RELEASE |
| `PaymentStatus` | INITIATED, CAPTURED, FAILED, REFUNDED |
| `CancellationPolicy` | FLEXIBLE, MODERATE, STRICT |

### Connection Pool (Production-Tuned)

```
# .env — connection string with pool config
DATABASE_URL=postgresql://user:pass@host:5432/travel?connection_limit=10&pool_timeout=30
```

| Setting | Value | Why |
|---------|-------|-----|
| `connection_limit` | 10 | Railway single-core default is 3 — too low for concurrent bookings + webhooks + cron |
| `pool_timeout` | 30s | Fail fast if pool is exhausted, don't hang |

### Migration Rules

| Rule | Why |
|------|-----|
| Never edit a committed migration | Causes drift between dev/staging/prod |
| Add new columns as nullable first | Avoids breaking existing rows |
| `prisma migrate dev` locally | Creates migration file |
| `prisma migrate deploy` in CI/CD | Applies without prompts |
| Seed data for dev only | `prisma/seed.ts` — never in production |
| One migration per feature | Easy to revert, clear history |
| Name migrations descriptively | `add-payment-transaction-table`, not `update-db` |

### Seed Data Plan

```typescript
// prisma/seed.ts — development only
// Destinations: Goa, Manali, Lonavala, Gokarna, Rishikesh (5)
// Organizers: 2 verified accounts with profiles
// Trips: 10 (mix of INSTANT + REQUEST_BASED, various statuses)
// Bookings: 20 (mix of PENDING_PAYMENT, CONFIRMED, COMPLETED)
// Reviews: 15 with varied ratings
// Conversations: 3 with 5-10 messages each
// Notifications: 10 (mix of types and read/unread)
```

---

## 11. Testing Strategy

### Testing Pyramid

```
        ┌───────┐
        │  E2E  │       5-10 tests (critical flows only)
        │Cypress│
       ┌┴───────┴┐
       │Integration│    30-50 tests (API routes + DB)
       │  Vitest   │
      ┌┴───────────┴┐
      │    Unit      │  100+ tests (services, utils, validators)
      │   Vitest     │
      └──────────────┘
```

| Layer | Tool | What to Test |
|-------|------|-------------|
| **Unit** | Vitest | Services (business logic), utils (chat filter, slug generator), validators |
| **Integration** | Vitest + Supertest | API routes end-to-end with test DB |
| **E2E** | Cypress (Phase 2) | Booking flow, organizer listing flow |

### Test File Convention

```
services/
  booking.service.ts
  booking.service.test.ts      ← Unit test next to source

tests/
  integration/
    routes/
      trip.routes.test.ts      ← Integration test in test folder
```

### What to Test First (MVP Priority)

| Priority | Test |
|----------|------|
| 1 | Booking creation (happy path + full trip + invalid trip) |
| 2 | Payment webhook handling (valid + invalid signature + duplicate) |
| 3 | Chat filter (phone, UPI, Instagram, edge cases) |
| 4 | Trip search with filters |
| 5 | Auth (signup, login, role check) |

---

## 12. DevOps & Infrastructure

### Environment Setup

```
.env.example (committed — template)
.env.local   (NOT committed — local dev)
.env.production (set in hosting dashboard)
```

```bash
# .env.example
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/travel_dev

# Auth
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# Client
CLIENT_URL=http://localhost:3000
```

### Environment Validation (Fail at startup, not at runtime)

```typescript
// config/env.ts

import { z } from 'zod'

const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(4000),

  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  // Razorpay
  RAZORPAY_KEY_ID: z.string(),
  RAZORPAY_KEY_SECRET: z.string(),
  RAZORPAY_WEBHOOK_SECRET: z.string(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),

  // Redis (ioredis TCP)
  REDIS_URL: z.string().startsWith('redis://').optional(),

  // Client
  CLIENT_URL: z.string().url(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export const env = envSchema.parse(process.env)
// If any env var is missing → app crashes immediately with clear Zod error
```

### Hosting (Lightweight & Cheap)

| Service | What | Cost (MVP) |
|---------|------|------------|
| **Vercel** | Next.js frontend | Free (hobby tier) |
| **Railway** or **Render** | Express API + Socket.IO | Free tier → $5/mo when needed |
| **Supabase** or **Neon** | PostgreSQL | Free tier (500MB) |
| **Cloudinary** | Image storage + CDN | Free tier (25K transforms/mo) |
| **Redis** (Docker dev / managed prod) | Cache + rate limit | Free (Docker) or ~₹0-400/mo managed |
| **Total** | | **₹0-500/month** to start |

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml

name: CI
on: [pull_request]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint          # ESLint
      - run: npm run type-check    # tsc --noEmit
      - run: npm run test          # Vitest
```

---

## 13. Code Standards & Conventions

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `trip-card.tsx`, `booking.service.ts` |
| Components | PascalCase | `TripCard`, `BookingForm` |
| Functions | camelCase | `createBooking`, `handlePayment` |
| Constants | SCREAMING_SNAKE | `MAX_GROUP_SIZE`, `ESCROW_HOLD_DAYS` |
| Types/Interfaces | PascalCase | `TripSummary`, `CreateBookingDto` |
| DB tables | PascalCase (Prisma) | `OrganizerProfile`, `WebhookEvent` |
| API routes | kebab-case | `/api/v1/my-trips`, `/api/v1/organizer/bookings` |
| Env vars | SCREAMING_SNAKE | `DATABASE_URL`, `JWT_SECRET` |

### TypeScript Rules (tsconfig)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### ESLint + Prettier

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',  // Must be last
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],  // Use logger, not console.log
    'prefer-const': 'error',
    'no-var': 'error',
  },
}
```

### Git Conventions

| Rule | Format |
|------|--------|
| Branch naming | `feat/trip-search`, `fix/booking-escrow`, `chore/update-deps` |
| Commit messages | Conventional: `feat: add trip comparison page`, `fix: handle duplicate webhook` |
| PR size | Max ~300 lines changed. Smaller PRs = faster reviews. |

---

## 14. Scaling Plan (When to Refactor What)

| Trigger | Action |
|---------|--------|
| **50+ concurrent chat users** | Move Socket.IO to dedicated server, add Redis adapter for horizontal scaling |
| **10K+ trips** | Add Elasticsearch/Algolia for search (replace PostgreSQL full-text) |
| **100+ API requests/sec** | Add Redis caching layer for trip listings (5min TTL) |
| **Team grows to 3+** | Extract shared packages, add Storybook for component library |
| **Mobile app needed** | API is already separate — mobile app calls same endpoints |
| **Multi-city launch** | Add city/region to trip schema, geo-based search |

### What NOT to Build Until Needed

| Feature | When to Add |
|---------|-------------|
| Microservices | When monolith can't handle load (likely never for MVP) |
| GraphQL | When FE team needs flexible queries (REST is fine for now) |
| Kubernetes | When you have 100K+ users (Vercel/Railway auto-scales) |
| Custom analytics | When Organizer dashboard ships (Phase 2) |
| Message queue (RabbitMQ) | When webhook processing needs reliability at scale |

---

## 15. Cost Estimates By Stage

### Stage 1: MVP (0-500 users)

| Service | Monthly Cost |
|---------|-------------|
| Vercel (hobby) | ₹0 |
| Railway (free tier) | ₹0 |
| Supabase (free) | ₹0 |
| Cloudinary (free) | ₹0 |
| Domain | ₹100 |
| **Total** | **~₹100/month** |

### Stage 2: Growth (500-5,000 users)

| Service | Monthly Cost |
|---------|-------------|
| Vercel (Pro) | ₹1,700 |
| Railway (Pro) | ₹400 |
| Supabase (Pro) | ₹2,100 |
| Cloudinary (Plus) | ₹750 |
| Redis (managed) | ₹0-400 |
| SMS (MSG91) | ₹500-1,000 |
| **Total** | **~₹5,500-6,500/month** |

### Stage 3: Scale (5,000-50,000 users)

| Service | Monthly Cost |
|---------|-------------|
| Vercel (Team) | ₹4,200 |
| Railway/AWS | ₹4,000-8,500 |
| Supabase/RDS | ₹6,300 |
| Cloudinary | ₹2,500 |
| Redis | ₹2,100 |
| Monitoring (Sentry) | ₹2,200 |
| **Total** | **~₹21,000-26,000/month** |

At Stage 3 with 500+ trips/month at ₹749/booking, monthly revenue ≈ ₹3.7L+ — comfortably profitable.

---

*This spec is a living document. Update it as architecture decisions evolve. Every new developer should read this before writing their first line of code.*
