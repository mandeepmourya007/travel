---
description: End-to-end feature development — DB schema, BE (TDD), FE (hooks + components), integration tests. Orchestrates /build-backend and /build-frontend into a single workflow.
---

# Full-Stack Feature Development Workflow

This is the **master workflow** for building any feature end-to-end. It orchestrates the DB → BE → Shared → FE → Integration pipeline with a test-driven approach at every layer.

**Think like a senior architect:** Design first. Types first. Tests first. Code last.

---

## When to Use This Workflow

Use `/build-feature` when building a **complete feature** that spans both BE and FE, e.g.:
- "Build trip search with filters"
- "Build booking flow with Razorpay"
- "Build review system"

Use `/build-backend` or `/build-frontend` individually only when working on isolated layers.

---

## Pre-Requisites

Before starting, you MUST have read:
1. `docs/engineering/tech-stack.md` — Architecture, patterns, DB schema, error handling
2. `docs/engineering/tech-stack.md` **Section 1 — Design Patterns (GoF Classification)** — 30+ patterns mapped to exact file locations + 6 usage rules
3. `docs/mvp/mvp-plan.md` — Feature scope, wireframes, user flows
4. `docs/engineering/fe/design-system.md` — Colors, tokens, component styles, data states

---

## Overview: The 12-Step Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 1: DESIGN (Steps 1-3)                 │
│  Feature Brief → DB Schema → Shared Types + Validators          │
├─────────────────────────────────────────────────────────────────┤
│                     PHASE 2: BACKEND (Steps 4-7)                │
│  BE Tests (Red) → Repository → Service → Controller+Routes     │
│  Run Tests (Green) → Refactor                                   │
├─────────────────────────────────────────────────────────────────┤
│                     PHASE 3: FRONTEND (Steps 8-10)              │
│  Custom Hook → Component (4 states) → Page + Error Boundary    │
├─────────────────────────────────────────────────────────────────┤
│                     PHASE 4: INTEGRATION (Steps 11-12)          │
│  E2E Smoke Test → Verify Checklist → PR                        │
└─────────────────────────────────────────────────────────────────┘
```

---

# PHASE 1: DESIGN

## Step 1: Write a Feature Brief

Before ANY code, write a brief. This is the single source of truth for the feature.

**Location:** Write as a comment block at the top of your first test file.

```
FEATURE BRIEF: [Feature Name]
==================================
1. What:      [One sentence — "Trip search with destination, date, price, and type filters"]
2. Who:       [User role — Traveler / Organizer / Admin]
3. Why:       [Business value — "Core discovery flow, 80% of traveler sessions start here"]

4. API Endpoints:
   GET  /api/v1/trips?destination=Goa&minPrice=1000&sort=price_asc&page=1
   GET  /api/v1/trips/:slug

5. DB Tables:  Trip, OrganizerProfile (read-only)
6. Validations: destination (string, optional), minPrice (number, >= 0), page (int, >= 1)
7. Error Cases: No trips found (200 empty), invalid filters (400), DB down (500)
8. Side Effects: None (read-only)

9. FE Components:
   - TripFilters (client) → updates URL params
   - TripGrid (client) → fetches + renders trip cards
   - TripCard (presentational) → single trip card
   - TripCardSkeleton → loading state

10. Data Flow:
    URL params → TripFilters → useTrips(filters) → GET /trips → TripGrid → TripCard[]
```

**Rules:**
- If you can't fill out all 10 points, you don't understand the feature well enough.
- This brief takes 5 minutes and saves hours of rework.
- Keep it in code, not in a separate doc — lives with the tests.

---

## Step 2: Design / Update DB Schema

Check if the Prisma schema needs changes for this feature.

**Location:** `apps/api/prisma/schema.prisma`

### Decision Tree

```
Does this feature need new DB tables or columns?
  ├── NO → Skip to Step 3
  └── YES ↓
        │
        ├── New table? → Add model with ALL mixin fields:
        │     isActive, isDeleted, createdAt, updatedAt, deletedAt
        │
        ├── New column? → Add as NULLABLE first (don't break existing rows)
        │
        ├── New enum value? → Add to existing enum
        │
        └── New index? → Add composite index for the query pattern
```

### Schema Change Checklist

```
[ ] Model has all 5 mixin fields (isActive, isDeleted, createdAt, updatedAt, deletedAt)
[ ] New columns are nullable or have defaults
[ ] Relations use @relation with explicit names
[ ] Indexes match the query patterns in the feature brief
[ ] Price fields are Int (whole rupees, NOT paisa)
[ ] Enums cover all possible states
[ ] @@index([isDeleted]) on every model
```

### After Schema Change

```bash
// turbo
npx prisma migrate dev --name <feature-name>

// turbo
npx prisma generate
```

**Rule:** NEVER edit a migration file after it's committed. Create a new migration instead.

---

## Step 3: Define Shared Types + Validators

Create types and validators that BOTH FE and BE will use. This is the **contract** between the two layers.

**Location:** `packages/shared/src/`

### 3a. Types

```typescript
// packages/shared/src/types/<domain>.types.ts

// Response type — what the API returns
export interface TripSummary {
  id: string
  title: string
  slug: string
  destination: string
  tripType: TripType
  pricePerPerson: number    // whole rupees
  startDate: string         // ISO date
  endDate: string
  bookingDeadline?: string  // ISO date
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

// Request type — what the FE sends to the API
export interface CreateBookingDto {
  tripId: string
  numTravelers: number
  travelerDetails?: TravelerDetail[]
  tripProtection?: boolean
}

// Filter type — query params
export interface TripFilters {
  destination?: string
  tripType?: TripType
  minPrice?: number
  maxPrice?: number
  startDate?: string
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'date' | 'popularity'
  page?: number
  limit?: number
}
```

### 3b. Validators (Shared Zod Schemas)

```typescript
// packages/shared/src/validators/<domain>.schema.ts

import { z } from 'zod'

export const tripFiltersSchema = z.object({
  destination: z.string().optional(),
  tripType: z.enum(['ADVENTURE', 'WEEKEND', 'TREKKING', 'BEACH', 'CULTURAL', 'ROAD_TRIP']).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().optional(),
  startDate: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'rating', 'date', 'popularity']).default('date'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// Infer TS type from Zod schema — single source of truth
export type TripFiltersInput = z.infer<typeof tripFiltersSchema>
```

**Why shared?**
- BE uses it in `validate.middleware.ts` to reject bad requests.
- FE uses it in `React Hook Form` with `zodResolver` to validate forms before submit.
- Types are inferred from schemas — ONE source of truth, zero drift.

---

# PHASE 2: BACKEND (TDD)

> Follow `/build-backend` workflow for detailed patterns. Below is the execution sequence.

## Step 4: Write BE Tests FIRST (Red Phase)

Write failing tests BEFORE any implementation. This is non-negotiable.

### 4a. Unit Tests (Service Layer)

**Location:** `apps/api/tests/unit/services/<domain>.service.test.ts`

```typescript
// tests/unit/services/trip.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TripService } from '@/services/trip.service'
import { createMockTrip } from '../../helpers/factories'

describe('TripService', () => {
  let tripService: TripService
  let mockTripRepo: any

  beforeEach(() => {
    mockTripRepo = {
      search: vi.fn(),
      findBySlug: vi.fn(),
      atomicIncrementBookings: vi.fn(),
    }
    tripService = new TripService(mockTripRepo, mockLogger)
  })

  describe('searchTrips', () => {
    it('should return paginated trips with filters applied', async () => {
      const mockTrips = [createMockTrip(), createMockTrip()]
      mockTripRepo.search.mockResolvedValue({ data: mockTrips, total: 2 })

      const result = await tripService.searchTrips({
        destination: 'Goa',
        page: 1,
        limit: 20,
      })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
      expect(mockTripRepo.search).toHaveBeenCalledWith(
        expect.objectContaining({ destination: 'Goa' }),
        expect.objectContaining({ offset: 0, limit: 20 }),
      )
    })

    it('should return empty array when no trips match', async () => {
      mockTripRepo.search.mockResolvedValue({ data: [], total: 0 })

      const result = await tripService.searchTrips({ destination: 'Mars' })

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
    })
  })

  describe('getTripBySlug', () => {
    it('should return trip detail for valid slug', async () => {
      const mockTrip = createMockTrip({ slug: 'goa-beach-trip' })
      mockTripRepo.findBySlug.mockResolvedValue(mockTrip)

      const result = await tripService.getTripBySlug('goa-beach-trip')

      expect(result.slug).toBe('goa-beach-trip')
    })

    it('should throw NotFoundError for non-existent slug', async () => {
      mockTripRepo.findBySlug.mockResolvedValue(null)

      await expect(tripService.getTripBySlug('nonexistent'))
        .rejects.toThrow('Trip not found')
    })
  })
})
```

### 4b. Integration Tests (API Routes)

**Location:** `apps/api/tests/integration/routes/<domain>.routes.test.ts`

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

  it('should return 200 with paginated trip list', async () => {
    const res = await request(app).get('/api/v1/trips').query({ page: 1, limit: 10 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    })
  })

  it('should filter by destination (case insensitive)', async () => {
    const res = await request(app).get('/api/v1/trips').query({ destination: 'goa' })

    expect(res.status).toBe(200)
    res.body.data.forEach((trip: any) => {
      expect(trip.destination.toLowerCase()).toContain('goa')
    })
  })

  it('should return 400 for invalid filter values', async () => {
    const res = await request(app).get('/api/v1/trips').query({ minPrice: 'abc' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should exclude soft-deleted trips', async () => {
    // Soft-delete a trip in setup, verify it doesn't appear
    const res = await request(app).get('/api/v1/trips')
    const ids = res.body.data.map((t: any) => t.id)
    expect(ids).not.toContain(deletedTripId)
  })
})
```

### Test Data Factories

**Location:** `apps/api/tests/helpers/factories.ts`

```typescript
// tests/helpers/factories.ts

import { randomUUID } from 'crypto'

export function createMockTrip(overrides?: Partial<Trip>): Trip {
  return {
    id: randomUUID(),
    title: 'Goa Beach Getaway',
    slug: 'goa-beach-getaway-dec-2025',
    destination: 'Goa',
    tripType: 'BEACH',
    description: 'Amazing beach trip with group activities',
    pricePerPerson: 4500,       // whole rupees
    startDate: new Date('2025-12-06'),
    endDate: new Date('2025-12-08'),
    bookingDeadline: new Date('2025-12-04'),
    minGroupSize: 5,
    maxGroupSize: 20,
    currentBookings: 8,
    status: 'ACTIVE',
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }
}

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: randomUUID(),
    name: 'Test User',
    email: `user-${Date.now()}@test.com`,
    role: 'TRAVELER',
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }
}

export function createMockBooking(overrides?: Partial<Booking>): Booking {
  return {
    id: randomUUID(),
    bookingRef: `TRP-2025-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
    tripId: randomUUID(),
    userId: randomUUID(),
    numTravelers: 1,
    amountPaid: 4500,           // whole rupees
    bookingStatus: 'CONFIRMED',
    escrowStatus: 'HELD',
    expiresAt: null,
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }
}
```

**Run tests — they should FAIL (Red):**

```bash
// turbo
npm run test -- --run
```

---

## Step 5: Implement BE (Green Phase)

Build in this exact order. Each layer depends only on the layer below it.

```
Routes → Controller → Service → Repository → Prisma (DB)
  ↑ thin     ↑ thin      ↑ logic    ↑ queries    ↑ schema
```

### 5a. Repository (DB queries only)

**Location:** `apps/api/src/repositories/<domain>.repository.ts`

```
Rules:
- Constructor receives PrismaClient
- ONLY Prisma queries — no business logic
- ALL queries include: isDeleted: false
- Use $transaction for multi-table writes
- Return raw Prisma types
```

### 5b. Service (Business logic)

**Location:** `apps/api/src/services/<domain>.service.ts`

```
Rules:
- Constructor receives repositories + external services (DI)
- ALL business rules and validations here
- Throw typed errors (NotFoundError, ValidationError)
- Log business events (info level)
- NEVER access Request/Response — framework-agnostic
- Return clean DTOs, not raw DB models
```

### 5c. Controller (Thin — parse request, call service, send response)

**Location:** `apps/api/src/controllers/<domain>.controller.ts`

```
Rules:
- Max 10-15 lines per method
- Parse params/query/body → call service → return { success: true, data }
- Wrap with asyncHandler (no try-catch)
- NEVER put business logic here
```

### 5d. Routes (Wire middleware + controller)

**Location:** `apps/api/src/routes/<domain>.routes.ts`

```
Middleware order: auth → role → validate → controller
```

**Run tests — they should PASS (Green):**

```bash
// turbo
npm run test -- --run
```

---

## Step 6: BE Refactor Phase

```
Checklist:
[ ] No duplicate code — extract to utils
[ ] Service methods < 30 lines
[ ] Controller methods < 15 lines
[ ] All errors throw typed AppError subclasses
[ ] Business events logged (info level)
[ ] No console.log — use logger only
[ ] No `any` — strict TypeScript
[ ] Constants in constants.ts, not magic strings
[ ] All queries filter isDeleted: false
[ ] Soft-delete via Prisma middleware (never hard delete)
```

---

## Step 7: Verify BE in Isolation

Before moving to FE, verify the API works standalone.

```bash
# Run all tests
// turbo
npm run test -- --run

# Check types
// turbo
npm run type-check

# Check lint
// turbo
npm run lint

# Manual smoke test (optional)
curl http://localhost:4000/api/v1/trips?destination=Goa | jq
curl http://localhost:4000/api/v1/trips/goa-beach-getaway | jq
```

**Gate:** Do NOT proceed to FE until all BE tests pass and the API returns correct responses.

---

# PHASE 3: FRONTEND

> Follow `/build-frontend` workflow for detailed patterns. Below is the execution sequence.

## Step 8: Build Custom Hook (Data Bridge)

The hook is the bridge between API and UI. Build this BEFORE any component.

**Location:** `apps/web/src/hooks/use-<domain>.ts`

### For GET (read data):

```typescript
// hooks/use-trips.ts

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { TripSummary, TripFilters } from '@shared/types/trip.types'

export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (filters: TripFilters) => [...tripKeys.lists(), filters] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (slug: string) => [...tripKeys.details(), slug] as const,
}

export function useTrips(filters: TripFilters) {
  return useQuery({
    queryKey: tripKeys.list(filters),
    queryFn: async () => {
      const res = await apiClient.get<TripSummary[]>('/trips', { params: filters })
      return { trips: res.data, pagination: res.pagination! }
    },
    placeholderData: (prev) => prev,  // Keep previous data during filter change
  })
}
```

### For POST/PUT/DELETE (write data):

```typescript
// hooks/use-booking.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from './use-trips'
import type { Booking, CreateBookingDto } from '@shared/types/booking.types'

export function useCreateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: CreateBookingDto) =>
      apiClient.post<Booking>('/bookings', dto).then(r => r.data),

    onSuccess: (booking) => {
      // Invalidate related caches so UI stays in sync
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(booking.tripId) })
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['bookings', 'my'] })
    },
  })
}
```

### Hook Rules

| Rule | Why |
|------|-----|
| One hook file per domain | `use-trips.ts`, `use-booking.ts` — find hook by feature |
| Query key factories | Reliable cache invalidation, no typos |
| `useQuery` for GET | Auto-caching, background refetch, stale management |
| `useMutation` for POST/PUT/DELETE | No auto-retry, explicit success/error handling |
| Never `useEffect + useState` for fetching | TanStack Query handles loading/error/cache |
| `enabled: !!slug` for conditional fetches | Don't fetch until the dependency exists |
| `placeholderData` for filters/pagination | Prevents blank flash when switching pages |

---

## Step 9: Build Component (4-State Pattern)

Every data-driven component MUST handle all four states.

**Location:** `apps/web/src/components/<feature>/`

```
MANDATORY 4-STATE RENDERING:

  if (isLoading) → return <Skeleton />         // Shape-matching skeleton
  if (error)     → return <ErrorState />        // With retry button
  if (!data)     → return <EmptyState />        // With relevant CTA
  return         → <ActualComponent data />     // Happy path
```

### Component file structure:

```typescript
// components/trips/trip-grid.tsx

'use client'

// 1. External imports
import { useTrips } from '@/hooks/use-trips'
// 2. Internal imports
import { TripCard } from './trip-card'
import { TripCardSkeleton } from './trip-card-skeleton'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { ErrorBoundary } from '@/components/shared/error-boundary'
// 3. Type imports
import type { TripFilters } from '@shared/types/trip.types'

// 4. Props interface (always explicit, above component)
interface TripGridProps {
  filters: TripFilters
  onCompare?: (tripId: string) => void
  selectedTripIds?: string[]
}

// 5. Named export (never default)
export function TripGrid({ filters, onCompare, selectedTripIds = [] }: TripGridProps) {
  // 6. Hooks first
  const { data, isLoading, error, refetch } = useTrips(filters)

  // 7. Loading → Skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => <TripCardSkeleton key={i} />)}
      </div>
    )
  }

  // 8. Error → ErrorState with retry
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  // 9. Empty → EmptyState with CTA
  if (!data?.trips.length) return <EmptyState message="No trips found for your search" />

  // 10. Happy path → render data, wrap each item in ErrorBoundary
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.trips.map((trip) => (
        <ErrorBoundary key={trip.id}>
          <TripCard
            trip={trip}
            onCompare={onCompare}
            isSelected={selectedTripIds.includes(trip.id)}
          />
        </ErrorBoundary>
      ))}
    </div>
  )
}
```

### Always create a skeleton component:

```typescript
// components/trips/trip-card-skeleton.tsx

export function TripCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
      <div className="h-48 bg-neutral-200 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-neutral-200 rounded w-3/4 animate-pulse" />
        <div className="h-3 bg-neutral-200 rounded w-1/2 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-neutral-200 rounded-full animate-pulse" />
          <div className="h-6 w-20 bg-neutral-200 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}
```

---

## Step 10: Wire Up Page + Route Files

### Page (Server Component by default)

```typescript
// app/(main)/trips/page.tsx

import { TripGrid } from '@/components/trips/trip-grid'
import { TripFilters } from '@/components/trips/trip-filters'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Explore Group Trips from Pune | TripCompare',
  description: 'Compare and book group trips. Escrow protected.',
}

export default function TripsPage({ searchParams }: { searchParams: Record<string, string> }) {
  const filters = {
    destination: searchParams.destination,
    tripType: searchParams.tripType,
    sort: searchParams.sort || 'date',
    page: Number(searchParams.page) || 1,
    limit: 20,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-bold text-neutral-900 mb-6">
        Explore Group Trips
      </h1>
      <TripFilters currentFilters={filters} />
      <TripGrid filters={filters} />
    </div>
  )
}
```

### Route-level error.tsx and loading.tsx

Create BOTH files in the same folder as `page.tsx`:

```
app/(main)/trips/
├── page.tsx       ← Server component (SEO metadata)
├── loading.tsx    ← Auto-shown during route transition
└── error.tsx      ← Auto-shown on unhandled error
```

---

# PHASE 4: INTEGRATION & VERIFICATION

## Step 11: Write FE Tests

**Location:** `apps/web/src/components/<feature>/__tests__/`

### Component Test (React Testing Library + MSW)

```typescript
// components/trips/__tests__/trip-grid.test.tsx

import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TripGrid } from '../trip-grid'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const mockTrips = [
  { id: '1', title: 'Goa Beach Trip', destination: 'Goa', slug: 'goa-beach' },
  { id: '2', title: 'Manali Adventure', destination: 'Manali', slug: 'manali-adv' },
]

const server = setupServer(
  http.get('*/api/v1/trips', () => {
    return HttpResponse.json({
      success: true,
      data: mockTrips,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('TripGrid', () => {
  it('renders loading skeletons, then trip cards', async () => {
    renderWithProviders(<TripGrid filters={{}} />)
    // Skeletons visible initially
    expect(document.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0)
    // Trips appear after fetch
    await waitFor(() => expect(screen.getByText('Goa Beach Trip')).toBeInTheDocument())
  })

  it('shows error state with retry on API failure', async () => {
    server.use(
      http.get('*/api/v1/trips', () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'DB down' } },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<TripGrid filters={{}} />)
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('shows empty state when no trips match', async () => {
    server.use(
      http.get('*/api/v1/trips', () =>
        HttpResponse.json({ success: true, data: [], pagination: { total: 0 } }),
      ),
    )
    renderWithProviders(<TripGrid filters={{}} />)
    await waitFor(() => expect(screen.getByText(/no trips found/i)).toBeInTheDocument())
  })
})
```

---

## Step 12: Final Verification Checklist

### Run everything:

```bash
# Backend
// turbo
cd apps/api && npm run test -- --run && npm run type-check && npm run lint

# Frontend
// turbo
cd apps/web && npm run test -- --run && npm run type-check && npm run lint

# Full monorepo
// turbo
npm run test && npm run lint && npm run type-check
```

### Feature Completeness Checklist

```
DB LAYER:
  [ ] Schema has mixin fields (isActive, isDeleted, createdAt, updatedAt, deletedAt)
  [ ] Migration created and applied
  [ ] Indexes match query patterns
  [ ] Prices stored as whole rupees (Int)

SHARED TYPES:
  [ ] Types defined in packages/shared/src/types/
  [ ] Zod validators in packages/shared/src/validators/
  [ ] Types match actual API response shape

BACKEND:
  [ ] Unit tests pass (service layer, mocked repos)
  [ ] Integration tests pass (API routes, real test DB)
  [ ] Repository queries filter isDeleted: false
  [ ] Service throws typed errors (NotFoundError, ValidationError)
  [ ] Controller < 15 lines per method
  [ ] Business events logged (info level)
  [ ] No console.log, no `any`

FRONTEND:
  [ ] Custom hook uses query key factory
  [ ] Component renders all 4 states (loading/error/empty/data)
  [ ] Skeleton matches component shape
  [ ] Mutations invalidate related queries
  [ ] Error boundary wraps individual items (not whole page)
  [ ] Route has error.tsx and loading.tsx
  [ ] Mobile responsive
  [ ] Accessibility: labels, aria, focus states

INTEGRATION:
  [ ] FE tests pass (MSW mocking)
  [ ] Manual smoke test: FE → BE → DB round trip works
  [ ] Error scenarios tested: 400, 404, 500 responses
  [ ] Soft delete works: deleted records don't appear

DOCUMENTATION (mandatory):
  [ ] Feature doc created in docs/engineering/fe/<feature>.md
  [ ] Doc has all 7 sections (Overview, Data Flow, API, Business Rules, Edge Cases, Errors, Tests)
  [ ] Every business rule in service layer is documented
  [ ] Every tested edge case is listed in the Edge Cases table

CODE COMMENTS (mandatory):
  [ ] Every public service method has JSDoc (description + @throws)
  [ ] Every public repository method has JSDoc (query purpose + filters + edge cases)
  [ ] Every custom hook has JSDoc (query key + invalidation targets + error handling)
  [ ] Controller methods have single-line JSDoc (HTTP method + path)
  [ ] No stale comments — all comments match current code

TESTS (mandatory):
  [ ] One describe block per public service method
  [ ] Happy path is FIRST test in each describe
  [ ] Test names follow "should <outcome> when <condition>"
  [ ] Minimum coverage: happy path + not-found + auth + validation + edge cases
  [ ] Aggregation methods test zero and negative values
  [ ] FE components test all 4 states (loading/error/empty/data)
  [ ] Arrange-Act-Assert pattern used consistently
```

---

## Feature Build Order (Full-Stack Sequence)

Build features in this order. Each builds on the previous:

| # | Feature | BE | FE | Depends On |
|---|---------|----|----|------------|
| 1 | **Project Setup** | Express, Prisma, env config, error handling, logging, Redis | Next.js, Tailwind, api-client, query-client, Providers, query-keys | Nothing |
| 2 | **Auth** | signup/login/refresh/google, JWT, role middleware, refresh token hashing | LoginForm, SignupForm, AuthGuard, useAuth | Setup |
| 3 | **Destinations** | CRUD /destinations (admin), GET /destinations (public) | DestinationGrid, DestinationCard, useDestinations | Setup |
| 4 | **Trip Listing** | GET /trips (search by destinationId, filters, pagination) | TripGrid, TripCard, TripFilters, useTrips | Auth, Destinations |
| 5 | **Trip Detail** | GET /trips/:slug (detail + reviews + bookingMode) | TripDetail, Itinerary, BookingSidebar, useTripDetail | Trip Listing |
| 6 | **Trip Comparison** | — (FE-only, local state) | ComparisonTable, CompareBar | Trip Listing |
| 7 | **Trip CRUD + Upload** | POST/PUT /trips, POST /uploads/signature (Cloudinary) | CreateTripForm, EditTripForm, ImageUploader, useCreateTrip | Auth, Destinations |
| 8 | **Booking (Instant)** | POST /bookings, webhook, escrow, cron, atomic seat update | BookingForm, PriceBreakdown, Confirmation, useBooking | Trips, Auth |
| 9 | **Trip Requests** | POST /trip-requests, PATCH respond, cron expiry | TripRequestForm, TripRequestCard, StatusBadge, useTripRequests | Trips, Auth |
| 10 | **Booking (Request-Based)** | bookingMode check in createBooking, approved request validation | Conditional CTA (Book Now vs Request to Join) | Booking, Trip Requests |
| 11 | **Notifications** | CRUD /notifications, unread count, Socket.IO push | NotificationBell, NotificationList, useNotifications | Auth |
| 12 | **Reviews** | POST /reviews (completed bookings only) | ReviewForm, ReviewCard, StarRating, useReviews | Bookings |
| 13 | **Chat** | Socket.IO, anti-leakage filter | ChatWindow, MessageBubble, useChat | Auth |
| 14 | **Organizer Dashboard** | Stats API, payment history, pending requests queue | StatsCards, TripTable, RequestQueue, useOrganizerStats | Trips, Bookings, Requests |
| 15 | **Admin Panel** | Approval queue, dispute mgmt, destination CRUD | AdminDashboard, ApprovalQueue, useAdmin | All above |

---

## MANDATORY: Feature Documentation

Every feature MUST have a documentation file in `docs/engineering/fe/` that describes its flow, edge cases, and test coverage. This is **not optional** — treat it as a deliverable alongside code.

### Documentation File Location

```
docs/engineering/fe/<feature-name>.md
```

Examples:
- `docs/engineering/fe/revenue-and-bookings.md`
- `docs/engineering/fe/trip-requests.md`
- `docs/engineering/fe/auth-flow.md`

### Required Sections in Every Feature Doc

```markdown
# <Feature Name> — Feature Documentation

## Overview
One paragraph: what the feature does, who uses it, why it exists.

## 1. Data Flow
Describe the end-to-end flow with a diagram or step list:
  URL/Action → FE Hook → API Endpoint → Service → Repository → DB

## 2. API Endpoints
Table of all endpoints this feature uses:
| Method | Path | Auth | Description |
|--------|------|------|-------------|

## 3. Business Rules
- Bullet list of every business rule enforced in the service layer.
- Include formulas (e.g., revenue = CAPTURED payments − refunds).
- Include enum states and transitions (e.g., PENDING → CONFIRMED → COMPLETED).

## 4. Edge Cases
Table format:
| Scenario | Expected Behavior |
|----------|-------------------|

## 5. Error Handling
| Error | HTTP Status | When |
|-------|-------------|------|

## 6. Test Coverage
Reference test file paths and list what each `describe` block covers:
- ✅ Happy path
- ✅ Edge case X
- ✅ Error case Y

## 7. Seed Data (if applicable)
Table of relevant seed scenarios and credentials.
```

### Documentation Rules

```
Rules:
- Create the doc AFTER tests pass, not before (doc reflects reality, not wishes)
- Every business rule in the service layer MUST appear in the doc
- Every edge case tested MUST be listed in the Edge Cases table
- Include test credentials if the feature has seed data
- Keep the doc under 200 lines — concise, not verbose
- Update the doc when the feature changes (doc rot = tech debt)
- Link related docs if the feature depends on another (e.g., "See auth-flow.md")
```

### Documentation File Map

| Feature | Doc Location |
|---------|-------------|
| Revenue, Bookings, Refunds | `docs/engineering/fe/revenue-and-bookings.md` |
| Trip Requests (Accept/Reject) | `docs/engineering/fe/trip-requests.md` |
| Auth (Login/Signup/Refresh) | `docs/engineering/fe/auth-flow.md` |
| Trip CRUD + Upload | `docs/engineering/fe/trip-management.md` |
| Notifications | `docs/engineering/fe/notifications.md` |
| Chat | `docs/engineering/fe/chat.md` |
| Reviews | `docs/engineering/fe/reviews.md` |
| Organizer Dashboard | `docs/engineering/fe/organizer-dashboard.md` |

---

## MANDATORY: Code Comments Standards

Every method in services, repositories, and hooks MUST have a JSDoc comment. This is a **hard rule** — no exceptions.

### Service Layer Comments (`apps/api/src/services/`)

```typescript
/**
 * Short description of what the method does.
 *
 * Business rules:
 * - Rule 1 (e.g., "Only ACTIVE trips can toggle bookings")
 * - Rule 2 (e.g., "Revenue = CAPTURED payments − CAPTURED refunds")
 *
 * Edge cases:
 * - Edge case 1 (e.g., "Returns 0 if no payments exist")
 * - Edge case 2 (e.g., "Deleted trips excluded from calculation")
 *
 * @throws NotFoundError — when <entity> not found
 * @throws ForbiddenError — when user doesn't own the resource
 * @throws ValidationError — when business rule violated
 */
async methodName(param: Type): Promise<ReturnType> {
```

### Repository Layer Comments (`apps/api/src/repositories/`)

```typescript
/**
 * Short description of the query and its purpose.
 *
 * Filters: list key WHERE conditions (e.g., isDeleted: false, status: CAPTURED)
 * Used by: which service method calls this
 *
 * Edge cases:
 * - What happens with null/empty results
 * - Any aggregation nuances (e.g., _sum returns null if no rows)
 */
async methodName(param: Type): Promise<ReturnType> {
```

### Hook Comments (`apps/web/src/hooks/`)

```typescript
/**
 * Short description — what data it fetches or what action it performs.
 *
 * Query key: tripKeys.list(filters) — for cache identification
 * Invalidates: list which caches are invalidated on success (for mutations)
 * Error handling: describe onError behavior (toast, redirect, etc.)
 */
export function useHookName() {
```

### Controller Comments (`apps/api/src/controllers/`)

Controllers are thin — a single-line JSDoc is sufficient:

```typescript
/** POST /trips — Create a new trip (organizer only) */
createTrip = asyncHandler(async (req, res) => {
```

### Comment Rules

```
Rules:
- EVERY public method in service, repository, and hook files MUST have a JSDoc comment
- Private/helper methods: single-line comment above is sufficient
- Do NOT comment obvious code (e.g., `// return the result` above `return result`)
- DO comment business logic, formulas, and non-obvious decisions
- Include @throws tags for service methods that throw typed errors
- Include "Edge cases:" section for methods with tricky behavior
- Keep comments up-to-date — stale comments are worse than no comments
- Use "Why" comments for non-obvious decisions, not "What" comments for obvious code
```

---

## MANDATORY: Test Case Standards

Every feature MUST have comprehensive unit tests following these rules. Tests are a **first-class deliverable**, not an afterthought.

### Test File Structure

```typescript
// tests/unit/services/<domain>.service.test.ts

describe('<ServiceName>', () => {

  // ─── Test data & mocks (top of file) ────────────────
  // Define mock repos, mock data, and service instance

  beforeEach(() => {
    vi.clearAllMocks()
    // Re-instantiate service with fresh mocks
  })

  // ─── One describe per public method ─────────────────

  describe('methodName', () => {

    // 1. Happy path FIRST — always the first test
    it('should <expected behavior> when <valid input>', async () => {
      // Arrange → Act → Assert
    })

    // 2. Edge cases — boundary conditions, zero/null/empty
    it('should <edge behavior> when <edge condition>', async () => {
    })

    // 3. Error cases — one test per error type
    it('should throw <ErrorType> when <condition>', async () => {
      await expect(service.method(badInput)).rejects.toThrow('<error message>')
    })

    // 4. Authorization — wrong owner, wrong role
    it('should throw ForbiddenError when <unauthorized condition>', async () => {
    })
  })
})
```

### Test Naming Convention

```
Pattern: "should <expected outcome> when <condition>"

✅ Good:
  "should return stats with revenue from CAPTURED payments minus refunds"
  "should throw ForbiddenError when toggling another organizer's trip"
  "should return zero revenue when organizer has no payments"
  "should throw ValidationError for COMPLETED trip"

❌ Bad:
  "test getOrganizerStats"
  "works correctly"
  "error case"
  "should work"
```

### Minimum Test Coverage Per Method

```
Every public service method MUST have at minimum:

1. ✅ Happy path test (valid input → expected output)
2. ✅ Not-found test (entity doesn't exist → NotFoundError)
3. ✅ Authorization test (wrong owner → ForbiddenError)
4. ✅ Validation test (invalid state → ValidationError)
5. ✅ Edge case tests (zero values, empty arrays, boundary conditions)

For mutations (create/update/delete), also test:
6. ✅ Side effects verified (logger called, cache invalidated, related records updated)
7. ✅ Idempotency where applicable

For aggregation methods (stats, revenue), also test:
8. ✅ Zero/empty result
9. ✅ Negative values (e.g., refunds exceed payments)
10. ✅ Large dataset behavior
```

### Test Data Rules

```
Rules:
- Use factory functions for test data (tests/helpers/factories.ts)
- Override only the fields relevant to the test — use spread: { ...mockTrip, status: 'COMPLETED' }
- Use descriptive variable names: mockActiveTrip, mockCompletedTrip, not trip1, trip2
- Mock return values should match real Prisma shapes
- Never use real API keys, passwords, or PII in test data
- Use deterministic dates (new Date('2025-06-01')), not Date.now()
```

### Arrange-Act-Assert Pattern

```typescript
it('should return stats with revenue from CAPTURED payments minus refunds', async () => {
  // Arrange — set up mocks and input
  mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
  mockTripRepo.findByOrganizerId.mockResolvedValue([
    { ...mockTrip, status: 'ACTIVE', currentBookings: 5 },
  ])
  mockTripRepo.calculateOrganizerRevenue.mockResolvedValue(45000)
  mockTripRepo.countPendingRequests.mockResolvedValue(2)

  // Act — call the method under test
  const result = await service.getOrganizerStats('user-1')

  // Assert — verify outcomes
  expect(result.activeTrips).toBe(1)
  expect(result.revenue).toBe(45000)
  expect(result.pendingRequests).toBe(2)
  expect(mockTripRepo.calculateOrganizerRevenue).toHaveBeenCalledWith('org-1')
})
```

### Test Verification Checklist (run after writing tests)

```
[ ] Every public method has a describe block
[ ] Happy path is the FIRST test in each describe
[ ] Error cases test the exact error message (not just error type)
[ ] Mock assertions verify the method was called with correct args
[ ] No tests depend on execution order (each test is independent)
[ ] Tests run in < 5 seconds total (no real DB, no real HTTP)
[ ] No console.log in tests — use expect() assertions
[ ] Test file follows naming convention: <service>.service.test.ts
```

---

## Quick Reference: Full-Stack File Map

| Layer | "I need to..." | Location |
|-------|----------------|----------|
| **DB** | Add/change a table | `apps/api/prisma/schema.prisma` |
| **DB** | Run migration | `npx prisma migrate dev --name <name>` |
| **Shared** | Add a type both FE+BE use | `packages/shared/src/types/<domain>.types.ts` |
| **Shared** | Add a validator both FE+BE use | `packages/shared/src/validators/<domain>.schema.ts` |
| **BE** | Write a DB query | `apps/api/src/repositories/<domain>.repository.ts` |
| **BE** | Write business logic | `apps/api/src/services/<domain>.service.ts` |
| **BE** | Parse request + send response | `apps/api/src/controllers/<domain>.controller.ts` |
| **BE** | Wire route + middleware | `apps/api/src/routes/<domain>.routes.ts` |
| **BE** | Unit test | `apps/api/tests/unit/services/<domain>.service.test.ts` |
| **BE** | Integration test | `apps/api/tests/integration/routes/<domain>.routes.test.ts` |
| **BE** | Test data | `apps/api/tests/helpers/factories.ts` |
| **FE** | Fetch data from API | `apps/web/src/hooks/use-<domain>.ts` |
| **FE** | Build feature component | `apps/web/src/components/<feature>/<name>.tsx` |
| **FE** | Build skeleton | `apps/web/src/components/<feature>/<name>-skeleton.tsx` |
| **FE** | Add a page | `apps/web/src/app/(group)/<route>/page.tsx` |
| **FE** | Handle page error | `apps/web/src/app/(group)/<route>/error.tsx` |
| **FE** | Component test | `apps/web/src/components/<feature>/__tests__/<name>.test.tsx` |
| **FE** | Form with validation | React Hook Form + Zod from `@shared/validators/` |
