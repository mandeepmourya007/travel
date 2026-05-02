---
description: How to build backend features for the group travel aggregator following TDD, clean architecture, and senior-level best practices
---

# Backend Development Workflow — Group Travel Aggregator

This workflow defines how to write backend code. Follow these steps **in order** for every feature/module. Never skip steps. Think like a senior architect — plan first, test first, implement last.

---

## Pre-Requisites

Before starting any backend work, ensure:
1. You have read `docs/engineering/tech-stack.md` for architecture, folder structure, and patterns.
2. You have read `docs/engineering/tech-stack.md` Section 1 — **Design Patterns (GoF Classification)** — to understand which pattern to apply where.
3. You have read `docs/mvp/mvp-plan.md` for feature scope and database schema.
4. The monorepo is set up with `apps/api/` (Express + TypeScript) and `packages/shared/`.

---

## Step 1: Understand the Feature

Before writing ANY code, answer these questions:

1. **What is the feature?** (e.g., "Trip search with filters")
2. **Who uses it?** (Traveler / Organizer / Admin)
3. **What API endpoints are needed?** (Check `docs/engineering/tech-stack.md` Section 4 — API Design)
4. **What DB tables are involved?** (Check Prisma schema in Section 10)
5. **What validations are needed?** (Input types, required fields, business rules)
6. **What errors can occur?** (Not found, unauthorized, validation, payment failure)
7. **Are there side effects?** (Send email, trigger webhook, update related records)

Write a brief plan as a comment at the top of your first test file before proceeding.

---

## Step 2: Define Types First (packages/shared)

Create or update shared types that both FE and BE will use.

**Location:** `packages/shared/src/types/`

```
Rules:
- One type file per domain: user.types.ts, trip.types.ts, booking.types.ts
- Use TypeScript interfaces for data shapes, enums for fixed values
- Export DTOs (Data Transfer Objects) for API request/response
- Never use `any` — use `unknown` with type guards if needed
- Add JSDoc comments for non-obvious fields
```

**Pattern:**
```typescript
// packages/shared/src/types/trip.types.ts

export interface TripSummary {
  id: string
  title: string
  slug: string
  destination: { id: string; name: string; slug: string }  // FK relation
  tripType: TripType
  bookingMode: BookingMode  // INSTANT | REQUEST_BASED
  pricePerPerson: number    // in whole rupees (₹4500 = 4500)
  startDate: string         // ISO date
  endDate: string
  maxGroupSize: number
  currentBookings: number
  organizer: {
    businessName: string
    rating: number
    totalReviews: number
    verified: boolean
  }
  photos: string[]
}

export interface CreateTripDto {
  title: string
  destinationId: string     // FK to Destination table
  tripType: TripType
  bookingMode: BookingMode  // INSTANT | REQUEST_BASED
  description: string
  // ... all required fields
}

export interface TripFilters {
  destinationId?: string    // Filter by FK (dropdown)
  destination?: string      // Text search by name
  tripType?: TripType
  bookingMode?: BookingMode
  minPrice?: number
  maxPrice?: number
  startDate?: string
  endDate?: string
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'date' | 'popularity'
  page?: number
  limit?: number
}
```

---

## Step 3: Write Zod Validation Schema

Create request validation schemas BEFORE writing any route or controller.

**Location:** `apps/api/src/validators/`

```
Rules:
- One schema file per domain: trip.schema.ts, booking.schema.ts
- Use Zod for runtime validation
- Schema should match the DTO from Step 2
- Add .transform() for sanitization (trim strings, lowercase emails)
- Add custom error messages for user-facing fields
```

**Pattern:**
```typescript
// apps/api/src/validators/trip.schema.ts

import { z } from 'zod'

export const createTripSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100).trim(),
  destinationId: z.string().cuid(),
  tripType: z.enum(['ADVENTURE', 'WEEKEND', 'TREKKING', 'BEACH', 'CULTURAL', 'ROAD_TRIP']),
  bookingMode: z.enum(['INSTANT', 'REQUEST_BASED']).default('INSTANT'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  pricePerPerson: z.number().int().positive().min(100, 'Minimum price is ₹100'),
  minGroupSize: z.number().int().min(2),
  maxGroupSize: z.number().int().max(50),
  cancellationPolicy: z.enum(['FLEXIBLE', 'MODERATE', 'STRICT']).default('FLEXIBLE'),
}).refine(
  data => new Date(data.endDate) > new Date(data.startDate),
  { message: 'End date must be after start date', path: ['endDate'] }
).refine(
  data => data.maxGroupSize >= data.minGroupSize,
  { message: 'Max group size must be >= min group size', path: ['maxGroupSize'] }
)

export const tripFiltersSchema = z.object({
  destinationId: z.string().cuid().optional(),
  destination: z.string().optional(),
  tripType: z.enum(['ADVENTURE', 'WEEKEND', 'TREKKING', 'BEACH', 'CULTURAL', 'ROAD_TRIP']).optional(),
  bookingMode: z.enum(['INSTANT', 'REQUEST_BASED']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  startDate: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'rating', 'date', 'popularity']).default('date'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
```

---

## Step 4: Write Tests FIRST (TDD — Red Phase)

Write failing tests BEFORE implementing the service or controller.

**Location:**
- Unit tests: `apps/api/src/services/__tests__/` (co-located) or `apps/api/tests/unit/services/`
- Integration tests: `apps/api/tests/integration/routes/`

### 4a. Unit Tests (Service Layer)

Test business logic in isolation. Mock the repository.

```
Rules:
- Test file naming: <service-name>.service.test.ts
- Use describe/it blocks, group by method
- Test: happy path, edge cases, error cases
- Mock repositories and external services (Razorpay, email)
- Never hit a real database in unit tests
- Use factory functions for test data (tests/helpers/factories.ts)
```

**Pattern:**
```typescript
// tests/unit/services/booking.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingService } from '@/services/booking.service'
import { createMockTrip, createMockUser } from '../../helpers/factories'

describe('BookingService', () => {
  let bookingService: BookingService
  let mockBookingRepo: any
  let mockTripRepo: any
  let mockPaymentService: any

  beforeEach(() => {
    mockBookingRepo = { create: vi.fn(), findById: vi.fn() }
    mockTripRepo = { findById: vi.fn(), incrementBookings: vi.fn() }
    mockPaymentService = { createEscrowOrder: vi.fn() }
    bookingService = new BookingService(mockBookingRepo, mockTripRepo, mockPaymentService)
  })

  describe('createBooking', () => {
    it('should create a booking for a valid trip with available seats', async () => {
      // Arrange
      const trip = createMockTrip({ maxGroupSize: 20, currentBookings: 10 })
      mockTripRepo.findById.mockResolvedValue(trip)
      mockPaymentService.createEscrowOrder.mockResolvedValue({ id: 'order_123' })
      mockBookingRepo.create.mockResolvedValue({ id: 'booking_1', status: 'PENDING_PAYMENT' })

      // Act
      const result = await bookingService.createBooking('user_1', {
        tripId: trip.id,
        numTravelers: 1,
      })

      // Assert
      expect(result.id).toBe('booking_1')
      expect(mockPaymentService.createEscrowOrder).toHaveBeenCalledWith(trip.pricePerPerson)
      expect(mockBookingRepo.create).toHaveBeenCalled()
    })

    it('should throw ValidationError when trip is fully booked', async () => {
      const trip = createMockTrip({ maxGroupSize: 20, currentBookings: 20 })
      mockTripRepo.findById.mockResolvedValue(trip)

      await expect(
        bookingService.createBooking('user_1', { tripId: trip.id, numTravelers: 1 })
      ).rejects.toThrow('Trip is fully booked')
    })

    it('should throw NotFoundError when trip does not exist', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(
        bookingService.createBooking('user_1', { tripId: 'nonexistent', numTravelers: 1 })
      ).rejects.toThrow('Trip not found')
    })
  })
})
```

### 4b. Integration Tests (API Routes)

Test the full HTTP request → response cycle with a real test database.

```
Rules:
- Use supertest to call Express routes
- Use a test database (separate from dev)
- Seed data before tests, clean up after
- Test: status codes, response shape, auth guards, validation errors
```

**Pattern:**
```typescript
// tests/integration/routes/trip.routes.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '@/server'
import { setupTestDB, teardownTestDB, seedTrips } from '../../helpers/test-db'

describe('GET /api/v1/trips', () => {
  beforeAll(async () => {
    await setupTestDB()
    await seedTrips()
  })

  afterAll(async () => {
    await teardownTestDB()
  })

  it('should return paginated trip list', async () => {
    const res = await request(app).get('/api/v1/trips').query({ page: 1, limit: 10 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.pagination).toHaveProperty('total')
    expect(res.body.pagination).toHaveProperty('totalPages')
  })

  it('should filter by destination name', async () => {
    const res = await request(app).get('/api/v1/trips').query({ destination: 'Goa' })

    expect(res.status).toBe(200)
    res.body.data.forEach((trip: any) => {
      expect(trip.destination.name.toLowerCase()).toContain('goa')
    })
  })

  it('should filter by bookingMode', async () => {
    const res = await request(app).get('/api/v1/trips').query({ bookingMode: 'REQUEST_BASED' })

    expect(res.status).toBe(200)
    res.body.data.forEach((trip: any) => {
      expect(trip.bookingMode).toBe('REQUEST_BASED')
    })
  })

  it('should return 400 for invalid filter values', async () => {
    const res = await request(app).get('/api/v1/trips').query({ minPrice: 'abc' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
```

---

## Step 5: Implement Repository (DB Layer)

Now write the database queries.

**Location:** `apps/api/src/repositories/`

```
Rules:
- One repository per DB entity
- Constructor receives PrismaClient instance
- ONLY Prisma queries here — no business logic
- Return raw Prisma types (service will transform if needed)
- Use transactions for multi-table writes
- Build dynamic where clauses for search/filter queries
- Add pagination helper (offset + limit)
```

**Pattern:**
```typescript
// apps/api/src/repositories/trip.repository.ts

import { PrismaClient, Prisma } from '@prisma/client'

export class TripRepository {
  constructor(private prisma: PrismaClient) {}

  async findBySlug(slug: string) {
    return this.prisma.trip.findFirst({
      where: { slug, isDeleted: false },
      include: {
        organizer: {
          select: { id: true, businessName: true, rating: true, totalReviews: true },
        },
      },
    })
  }

  async search(filters: TripFilters, pagination: { offset: number; limit: number }) {
    const where = this.buildWhere(filters)
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: this.buildOrderBy(filters.sort),
        include: { organizer: { select: { businessName: true, rating: true } } },
      }),
      this.prisma.trip.count({ where }),
    ])
    return { data, total }
  }

  private buildWhere(filters: TripFilters): Prisma.TripWhereInput {
    return {
      isDeleted: false,
      status: 'ACTIVE',
      ...(filters.destinationId && { destinationId: filters.destinationId }),
      ...(filters.destination && {
        destination: { name: { contains: filters.destination, mode: 'insensitive' } },
      }),
      ...(filters.bookingMode && { bookingMode: filters.bookingMode }),
      ...(filters.minPrice && { pricePerPerson: { gte: filters.minPrice } }),
      ...(filters.maxPrice && { pricePerPerson: { lte: filters.maxPrice } }),
      ...(filters.startDate && { startDate: { gte: new Date(filters.startDate) } }),
      ...(filters.tripType && { tripType: filters.tripType }),
    }
  }

  private buildOrderBy(sort?: string): Prisma.TripOrderByWithRelationInput {
    switch (sort) {
      case 'price_asc': return { pricePerPerson: 'asc' }
      case 'price_desc': return { pricePerPerson: 'desc' }
      case 'rating': return { organizer: { rating: 'desc' } }
      case 'popularity': return { currentBookings: 'desc' }
      default: return { startDate: 'asc' }
    }
  }
}
```

---

## Step 6: Implement Service (Business Logic)

Write the business logic. This is where the real work happens.

**Location:** `apps/api/src/services/`

```
Rules:
- Constructor receives repositories + external services (dependency injection)
- All business rules and validations here
- Throw typed errors (NotFoundError, ValidationError, etc.)
- Log important business events (booking created, payment received)
- Never access Request/Response objects — services are framework-agnostic
- Return clean DTOs, not raw DB models
```

**Checklist per method:**
1. Validate business rules (not input validation — that's in middleware)
2. Fetch required data from repository
3. Apply business logic
4. Call external services if needed (payment, notification)
5. Persist via repository
6. Log the event
7. Return result

---

## Step 7: Implement Controller (Thin Layer)

Controllers only parse the request and call the service.

**Location:** `apps/api/src/controllers/`

```
Rules:
- NEVER put business logic in controllers
- Parse params, query, body from request
- Call one service method
- Return standardized response: { success: true, data: ... }
- Wrap with asyncHandler (no try-catch needed)
- Max 10-15 lines per controller method
```

**Pattern:**
```typescript
// apps/api/src/controllers/trip.controller.ts

import { Request, Response } from 'express'
import { asyncHandler } from '@/utils/async-handler'
import { TripService } from '@/services/trip.service'

export class TripController {
  constructor(private tripService: TripService) {}

  searchTrips = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query  // Already validated by middleware
    const result = await this.tripService.searchTrips(filters)
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  getTripBySlug = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.getTripBySlug(req.params.slug)
    res.json({ success: true, data: trip })
  })

  createTrip = asyncHandler(async (req: Request, res: Response) => {
    const organizerId = req.user!.organizerProfileId
    const trip = await this.tripService.createTrip(organizerId, req.body)
    res.status(201).json({ success: true, data: trip })
  })
}
```

---

## Step 8: Define Routes

Wire up the controller to Express routes with middleware.

**Location:** `apps/api/src/routes/`

```
Rules:
- One route file per domain
- Apply middleware in this order: auth → role → validate → controller
- Use Express Router
- Aggregate all routes in routes/index.ts
```

**Pattern:**
```typescript
// apps/api/src/routes/trip.routes.ts

import { Router } from 'express'
import { auth } from '@/middleware/auth.middleware'
import { requireRole } from '@/middleware/role.middleware'
import { validate } from '@/middleware/validate.middleware'
import { createTripSchema, tripFiltersSchema } from '@/validators/trip.schema'
import { tripController } from '@/config/dependencies'

const router = Router()

// Public
router.get('/', validate(tripFiltersSchema, 'query'), tripController.searchTrips)
router.get('/:slug', tripController.getTripBySlug)

// Organizer only
router.post('/', auth, requireRole('ORGANIZER'), validate(createTripSchema), tripController.createTrip)
router.put('/:id', auth, requireRole('ORGANIZER'), validate(updateTripSchema), tripController.updateTrip)

export { router as tripRoutes }
```

---

## Step 9: Run Tests (TDD — Green Phase)

Run the tests written in Step 4. They should now pass.

```bash
# Run all tests
// turbo
npm run test

# Run specific test file
npm run test -- booking.service.test.ts

# Run with coverage
npm run test -- --coverage
```

**Checklist:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No `any` type warnings
- [ ] No ESLint errors (`npm run lint`)
- [ ] TypeScript compiles cleanly (`npm run type-check`)

---

## Step 10: Refactor (TDD — Refactor Phase)

Now that tests pass, clean up the code.

```
Checklist:
- [ ] No duplicate code — extract shared logic to utils
- [ ] Service methods are < 30 lines (split if longer)
- [ ] Controller methods are < 15 lines
- [ ] All error paths throw typed AppError subclasses
- [ ] Business events are logged (info level)
- [ ] No console.log — use logger only
- [ ] Types are strict — no `any`, no type assertions unless documented
- [ ] Constants are in constants.ts, not magic numbers/strings in code
```

---

## Module Build Order (Follow This Sequence)

Build modules in this order — each builds on the previous:

| Order | Module | Depends On | Key Patterns Used |
|-------|--------|-----------|------------------|
| 1 | **Project Setup** | Nothing | **Singleton** (Prisma, Redis, Logger), env validation |
| 2 | **Error Handling** | Setup | **Factory Method** (error classes), **Decorator** (asyncHandler), **Chain of Responsibility** (error handler middleware) |
| 3 | **Logging** | Setup | **Singleton** (Pino logger), **Observer** (res.on finish) |
| 4 | **Auth** | Errors, Logging | **Proxy** (auth middleware), **Strategy** (JWT vs Google OAuth) |
| 5 | **Destinations** | Setup | **Repository**, **Facade** (DestinationService) |
| 6 | **Trips (Read)** | Auth, Destinations | **Repository**, **Builder** (buildWhereClause), **Strategy** (buildOrderBy), **Iterator** (pagination) |
| 7 | **Trips (Write) + Upload** | Auth, Destinations | **Facade** (UploadService hides Cloudinary), **Adapter** (Cloudinary SDK) |
| 8 | **Bookings (Instant)** | Trips, Auth | **Facade** (BookingService), **Mediator** (coordinates 5 subsystems), **Strategy** (cancellation policy) |
| 9 | **Trip Requests** | Trips, Auth | **Strategy** (INSTANT vs REQUEST_BASED booking mode), **Observer** (notification on status change) |
| 10 | **Bookings (Request-Based)** | Bookings, Requests | **Strategy** (bookingMode check), **Template Method** (same booking flow, different entry gate) |
| 11 | **Notifications** | Auth | **Observer** (event-driven push), **Factory** (notification type determines template) |
| 12 | **Reviews** | Bookings | **Repository**, guards (only completed bookings) |
| 13 | **Chat** | Auth | **Observer** (Socket.IO pub/sub), **Strategy** (content filter rules) |
| 14 | **Organizer Dashboard** | Trips, Bookings | **Facade** (aggregation service), **Repository** |
| 15 | **Admin Panel** | All above | **Proxy** (admin role middleware), **Facade** |

---

## Dependency Wiring Pattern

Wire all dependencies in a single file. No scattered `new` calls.

**Location:** `apps/api/src/config/dependencies.ts`

```typescript
// apps/api/src/config/dependencies.ts

import { PrismaClient } from '@prisma/client'
import { logger } from '@/utils/logger'

// ── Singletons ─────────────────────────────────────────
const prisma = new PrismaClient()  // Singleton: one connection pool per process
// Redis and Logger are singletons imported from their own modules

// ── Repositories (Data Access Layer) ───────────────────
const userRepo = new UserRepository(prisma)
const tripRepo = new TripRepository(prisma)
const bookingRepo = new BookingRepository(prisma)
const tripRequestRepo = new TripRequestRepository(prisma)
const destinationRepo = new DestinationRepository(prisma)
const paymentTransactionRepo = new PaymentTransactionRepository(prisma)
const notificationRepo = new NotificationRepository(prisma)
const refreshTokenRepo = new RefreshTokenRepository(prisma)
const reviewRepo = new ReviewRepository(prisma)
const messageRepo = new MessageRepository(prisma)
const webhookEventRepo = new WebhookEventRepository(prisma)

// ── External Adapters (Adapter Pattern) ────────────────
const paymentService = new PaymentService(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, logger)
const uploadService = new UploadService()  // Facade over Cloudinary SDK

// ── Services (Facade + Mediator Pattern) ───────────────
const authService = new AuthService(userRepo, refreshTokenRepo, logger)
const destinationService = new DestinationService(destinationRepo, logger)
const tripService = new TripService(tripRepo, destinationRepo, logger)
const bookingService = new BookingService(
  bookingRepo, tripRepo, tripRequestRepo, paymentService,
  notificationService, logger  // Facade: hides 5 subsystems
)
const tripRequestService = new TripRequestService(tripRequestRepo, tripRepo, notificationService, logger)
const notificationService = new NotificationService(notificationRepo, logger)
const reviewService = new ReviewService(reviewRepo, bookingRepo, tripRepo, logger)
const chatService = new ChatService(messageRepo, logger)

// ── Controllers (Thin — delegate to services) ──────────
export const authController = new AuthController(authService)
export const destinationController = new DestinationController(destinationService)
export const tripController = new TripController(tripService)
export const bookingController = new BookingController(bookingService)
export const tripRequestController = new TripRequestController(tripRequestService)
export const notificationController = new NotificationController(notificationService)
export const uploadController = new UploadController(uploadService)
export const reviewController = new ReviewController(reviewService)
export const chatController = new ChatController(chatService)
```

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Route | `<domain>.routes.ts` | `trip.routes.ts` |
| Controller | `<domain>.controller.ts` | `trip.controller.ts` |
| Service | `<domain>.service.ts` | `trip.service.ts` |
| Repository | `<domain>.repository.ts` | `trip.repository.ts` |
| Validator | `<domain>.schema.ts` | `trip.schema.ts` |
| Error | `<name>.error.ts` | `not-found.error.ts` |
| Middleware | `<name>.middleware.ts` | `auth.middleware.ts` |
| Unit test | `<source>.test.ts` | `booking.service.test.ts` |
| Integration test | `<domain>.routes.test.ts` | `trip.routes.test.ts` |
| Types (shared) | `<domain>.types.ts` | `trip.types.ts` |
| Config | `<name>.ts` | `env.ts`, `database.ts` |

---

## MANDATORY: Code Comments for Every Method

Every public method in services and repositories MUST have a JSDoc comment. This is enforced during code review.

### Service Methods — Full JSDoc

```typescript
/**
 * Toggles the `acceptingBookings` flag on an ACTIVE trip.
 * Only the trip owner can toggle. Non-ACTIVE trips throw ValidationError.
 * When bookings are closed, travelers cannot create new bookings or requests.
 *
 * @throws NotFoundError — trip doesn't exist
 * @throws ForbiddenError — user doesn't own the trip
 * @throws ValidationError — trip is not ACTIVE
 */
async toggleBookings(userId: string, tripId: string) {
```

### Repository Methods — Query-focused JSDoc

```typescript
/**
 * Calculates net revenue for an organizer across all their trips.
 *
 * Revenue = SUM(CAPTURED PAYMENT transactions) - SUM(CAPTURED REFUND transactions)
 *
 * Filters: status=CAPTURED, booking.trip.organizerId, isDeleted=false
 * Used by: TripService.getOrganizerStats()
 *
 * Edge cases:
 * - Returns 0 if no payments exist (_sum.amount is null → defaults to 0)
 * - INITIATED/FAILED payments are excluded
 * - ESCROW_RELEASE is excluded (platform payout)
 */
async calculateOrganizerRevenue(organizerId: string): Promise<number> {
```

### Comment Rules

```
- EVERY public method: full JSDoc with description + @throws
- Private methods: single-line comment explaining "why"
- Business formulas: always document the formula in the JSDoc
- Edge cases: list them explicitly in the comment
- DO NOT comment obvious code (e.g., "// get the trip" above findById)
- DO comment non-obvious decisions (e.g., "// Use brightness filter because error-600 token doesn't exist")
- Stale comments are worse than no comments — update when code changes
```

---

## MANDATORY: Test Case Standards

### Test Structure Rules

```
- One describe block per public service method
- Happy path ALWAYS first test in each describe
- Test names follow: "should <expected outcome> when <condition>"
- Use Arrange → Act → Assert pattern in every test
- Each test is independent — no shared mutable state between tests
- Use vi.clearAllMocks() in beforeEach
```

### Minimum Coverage Per Method

```
Every public service method MUST have:
1. ✅ Happy path (valid input → correct output + side effects)
2. ✅ Not-found case (entity missing → NotFoundError)
3. ✅ Authorization case (wrong owner/role → ForbiddenError)
4. ✅ Validation case (invalid state → ValidationError)
5. ✅ Edge cases (zero, empty, null, boundary values)

For aggregation methods (stats, revenue), also:
6. ✅ Zero/empty result
7. ✅ Negative values (refunds > payments)

For mutations (create/update/delete), also:
8. ✅ Side effects verified (logger.info called, related records updated)
```

### Test Naming — Good vs Bad

```
✅ "should return stats with revenue from CAPTURED payments minus refunds"
✅ "should throw ForbiddenError when toggling another organizer's trip"
✅ "should return zero revenue when organizer has no payments"

❌ "test revenue"
❌ "works correctly"
❌ "error case"
```

### Test Data Rules

```
- Use factory functions (tests/helpers/factories.ts) or inline mockData objects
- Override only fields relevant to the test: { ...mockTrip, status: 'COMPLETED' }
- Use deterministic dates: new Date('2025-06-01'), not Date.now()
- Never hardcode real credentials or PII
- Mock return values must match real Prisma shapes
```

---

## Common Mistakes to AVOID

| Mistake | Correct Approach |
|---------|-----------------|
| Business logic in controller | Move to service |
| Raw Prisma calls in service | Move to repository |
| `try-catch` in every controller | Use asyncHandler wrapper |
| `console.log` for debugging | Use structured logger |
| Hardcoded strings/numbers | Use constants file |
| `any` type | Use proper types or `unknown` |
| Skipping input validation | Zod schema on every endpoint |
| Testing implementation details | Test behavior and outcomes |
| One massive test file | Group by describe blocks per method |
| Returning raw DB models in API | Map to DTOs in service |
| Storing passwords in plain text | bcrypt with salt rounds ≥ 12 |
| Logging PII (Aadhaar, passwords) | Redact sensitive fields |

---

## Quick Reference: Where Does This Code Go?

| "I need to..." | File Location |
|----------------|---------------|
| Add a new API endpoint | `routes/<domain>.routes.ts` |
| Parse request data | `controllers/<domain>.controller.ts` |
| Add a business rule | `services/<domain>.service.ts` |
| Write a DB query | `repositories/<domain>.repository.ts` |
| Validate request input | `validators/<domain>.schema.ts` |
| Add a custom error | `errors/<name>.error.ts` |
| Check user auth/role | `middleware/auth.middleware.ts` or `role.middleware.ts` |
| Share types with FE | `packages/shared/src/types/<domain>.types.ts` |
| Add a new constant | `packages/shared/src/constants/` or `apps/api/src/utils/constants.ts` |
| Filter chat messages | `utils/chat-filter.ts` |
| Handle Razorpay webhooks | `services/payment.service.ts` |
| Add a scheduled job | `utils/cron-jobs.ts` |
