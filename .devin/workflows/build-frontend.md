---
description: How to build frontend components with BE API integration following best practices, custom hooks, error handling, and proper folder structure
---

# Frontend Development Workflow — Group Travel Aggregator

This workflow defines how to build frontend components that interface with backend APIs. Follow these steps **in order** for every feature. Think like a senior architect — plan first, type first, hook first, component last.

---

## Pre-Requisites

Before starting any frontend work, ensure:
1. You have read `docs/engineering/tech-stack.md` Section 3 (Frontend Spec) for architecture and patterns.
2. You have read `docs/engineering/tech-stack.md` Section 1 — **Design Patterns (GoF Classification)** — especially the "Frontend-Specific Patterns" table.
3. You have read `docs/engineering/fe/design-system.md` for color palette, tokens, and component styles.
4. You have read `docs/mvp/mvp-plan.md` for feature scope and wireframes.
5. The monorepo is set up with `apps/web/` (Next.js 14 + Tailwind) and `packages/shared/`.
6. `@tanstack/react-query` QueryClientProvider is mounted in the root layout.

---

## Folder Structure Reference

```
apps/web/src/
├── app/                      # Next.js App Router pages
│   ├── (auth)/               # Login, signup (separate layout)
│   ├── (main)/               # Public pages (trips, search)
│   │   ├── trips/
│   │   │   ├── page.tsx      # Trip listing + search
│   │   │   ├── [slug]/
│   │   │   │   └── page.tsx  # Trip detail
│   │   │   ├── loading.tsx   # Route-level loading skeleton
│   │   │   └── error.tsx     # Route-level error boundary
│   ├── (dashboard)/          # Traveler & organizer dashboards
│   └── layout.tsx            # Root layout (QueryProvider, ThemeProvider)
│
├── components/               # UI Components (feature-based)
│   ├── ui/                   # shadcn/ui primitives (Button, Card, Dialog, Input)
│   ├── layout/               # Header, Footer, Sidebar, MobileNav
│   ├── shared/               # Reusable across features
│   │   ├── error-boundary.tsx
│   │   ├── data-states.tsx   # LoadingState, EmptyState, ErrorState
│   │   ├── star-rating.tsx
│   │   ├── image-gallery.tsx
│   │   └── loading-skeleton.tsx
│   ├── trips/                # Trip-specific
│   │   ├── trip-card.tsx
│   │   ├── trip-card-skeleton.tsx
│   │   ├── trip-filters.tsx
│   │   ├── trip-grid.tsx
│   │   └── trip-comparison-table.tsx
│   ├── booking/              # Booking-specific
│   │   ├── booking-form.tsx
│   │   ├── price-breakdown.tsx
│   │   └── booking-confirmation.tsx
│   └── chat/                 # Chat-specific
│       ├── chat-window.tsx
│       ├── message-bubble.tsx
│       └── chat-sidebar.tsx
│
├── hooks/                    # Custom React hooks (data-fetching + logic)
│   ├── use-trips.ts          # GET /trips (search, filters)
│   ├── use-trip-detail.ts    # GET /trips/:slug
│   ├── use-booking.ts        # POST /bookings, GET /my-bookings
│   ├── use-reviews.ts        # GET /trips/:id/reviews, POST /reviews
│   ├── use-auth.ts           # Login, signup, logout, current user
│   ├── use-chat.ts           # Socket.IO + messages
│   ├── use-organizer.ts      # Organizer dashboard data
│   └── use-debounce.ts       # Utility: debounce input changes
│
├── lib/                      # Utility functions
│   ├── api-client.ts         # Axios/fetch wrapper (base URL, auth headers, error transform)
│   ├── query-client.ts       # TanStack Query client config
│   ├── format.ts             # Date, currency formatters
│   ├── constants.ts
│   └── utils.ts              # cn() and generic helpers
│
├── types/                    # Frontend-specific types
│   └── index.ts
│
└── styles/
    └── globals.css           # Tailwind base + design tokens
```

---

## Step 1: Understand the Feature

Before writing ANY code, answer these questions:

1. **What does the user see?** (Page, modal, section — check wireframes in MVP plan)
2. **What data does it need?** (Which API endpoints? Check `docs/engineering/tech-stack.md` Section 4)
3. **Is it a GET (read) or POST/PUT (write)?** (Determines `useQuery` vs `useMutation`)
4. **What are the loading/empty/error states?** (Check `docs/engineering/fe/design-system.md` Section 9)
5. **Does it need URL state?** (Filters, pagination → use `nuqs` for URL search params)
6. **Does it need client state?** (UI toggles, modal open/close → local state or Zustand)
7. **Is it a server component or client component?** (SSR for SEO pages, client for interactive)
8. **What shared types already exist?** (Check `packages/shared/src/types/`)

Write a brief plan as a comment at the top of your first file before proceeding.

---

## Step 2: Set Up the API Client (One-Time Setup)

If not already created, set up the API client. This is the **single point** where all HTTP requests go through.

**Location:** `apps/web/src/lib/api-client.ts`

```typescript
// lib/api-client.ts

import axios, { AxiosError, AxiosRequestConfig } from 'axios'

// --- Types ---

export interface ApiResponse<T> {
  success: true
  data: T
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiError {
  success: false
  error: {
    code: string       // Machine-readable: 'VALIDATION_ERROR', 'NOT_FOUND'
    message: string    // Human-readable: 'Trip is fully booked'
    details?: Array<{ path: string[]; message: string }>  // Validation errors
  }
}

// --- Axios Instance ---

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // Send httpOnly refresh cookie
})

// --- Request Interceptor: Attach access token ---

api.interceptors.request.use((config) => {
  const token = getAccessToken()  // From memory/context, NOT localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- Response Interceptor: Transform errors ---

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config

    // 401 → Try refreshing token ONCE
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const { data } = await api.post('/auth/refresh')
        setAccessToken(data.data.accessToken)
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`
        return api(originalRequest)
      } catch {
        // Refresh failed → force logout
        clearAuth()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      }
    }

    // Transform to a consistent error shape
    const apiError = error.response?.data?.error
    const message = apiError?.message || error.message || 'Something went wrong'
    const code = apiError?.code || 'NETWORK_ERROR'

    throw new AppApiError(message, code, error.response?.status, apiError?.details)
  },
)

// --- Custom Error Class ---

export class AppApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: Array<{ path: string[]; message: string }>,
  ) {
    super(message)
    this.name = 'AppApiError'
  }

  get isNotFound() { return this.status === 404 }
  get isValidation() { return this.code === 'VALIDATION_ERROR' }
  get isUnauthorized() { return this.status === 401 }
  get isNetworkError() { return this.code === 'NETWORK_ERROR' }
}

// --- Public API Methods ---

export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    api.get<ApiResponse<T>>(url, config).then(res => res.data),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.post<ApiResponse<T>>(url, data, config).then(res => res.data),

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.put<ApiResponse<T>>(url, data, config).then(res => res.data),

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.patch<ApiResponse<T>>(url, data, config).then(res => res.data),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    api.delete<ApiResponse<T>>(url, config).then(res => res.data),
}
```

**Rules:**
- All HTTP goes through `apiClient` — never raw `fetch()` or `axios()` in components.
- Response interceptor handles 401 refresh automatically.
- Errors are transformed into `AppApiError` with `.code`, `.status`, `.details`.
- `withCredentials: true` for httpOnly cookie (refresh token).

---

## Step 3: Set Up TanStack Query Client (One-Time Setup)

**Location:** `apps/web/src/lib/query-client.ts`

```typescript
// lib/query-client.ts

import { QueryClient } from '@tanstack/react-query'
import { AppApiError } from './api-client'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,          // 5 min — data considered fresh
        gcTime: 10 * 60 * 1000,             // 10 min — garbage collect unused cache
        retry: (failureCount, error) => {
          // Don't retry 4xx errors (client error, won't fix itself)
          if (error instanceof AppApiError && error.status && error.status < 500) {
            return false
          }
          return failureCount < 2  // Retry server errors max 2 times
        },
        refetchOnWindowFocus: false,        // Don't refetch on tab switch (annoying for UX)
      },
      mutations: {
        retry: false,                        // Never retry mutations (could duplicate actions)
      },
    },
  })
}
```

Mount in root layout:

```typescript
// app/layout.tsx (or a providers.tsx wrapper)

'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { makeQueryClient } from '@/lib/query-client'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  )
}
```

---

## Step 4: Check/Create Shared Types

Before writing any hook, check if the required types exist in `packages/shared/src/types/`.

**Location:** `packages/shared/src/types/`

```
Rules:
- One type file per domain: trip.types.ts, booking.types.ts, user.types.ts
- Export interfaces for data shapes, enums for fixed values
- DTOs for API request bodies (CreateBookingDto, TripFilters)
- Response types match what the API actually returns
- See `.windsurfrules` §1 for TypeScript strictness rules (no `any`, no `as unknown as`, etc.)
- Add JSDoc comments for non-obvious fields
```

**Check:** Do the types you need already exist?
- If yes → import from `@shared/types/...`
- If no → create them in `packages/shared/src/types/<domain>.types.ts`

**Pattern:**
```typescript
// packages/shared/src/types/api-response.types.ts

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  pagination?: PaginationMeta
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Array<{ path: string[]; message: string }>
  }
}
```

---

## Step 5: Write the Custom Hook (Data Layer)

This is the **bridge** between BE API and FE components. Each domain gets its own hook file.

**Location:** `apps/web/src/hooks/`

### 5a. Read Hook (GET requests → `useQuery`)

```typescript
// hooks/use-trips.ts

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { TripSummary, TripFilters } from '@shared/types/trip.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

// --- Query Keys: import from centralized lib/query-keys.ts ---
// See tech-stack.md Section 3 for full key factory definitions.
// All key factories (tripKeys, bookingKeys, tripRequestKeys, destinationKeys,
// notificationKeys) live in lib/query-keys.ts — single source of truth.

import { tripKeys } from '@/lib/query-keys'

// --- Hooks ---

/** Fetch paginated trip list with filters */
export function useTrips(filters: TripFilters) {
  return useQuery({
    queryKey: tripKeys.list(filters),
    queryFn: async () => {
      const response = await apiClient.get<TripSummary[]>('/trips', {
        params: filters,
      })
      return {
        trips: response.data,
        pagination: response.pagination as PaginationMeta,
      }
    },
    // Keep previous data while fetching new page (smooth UX)
    placeholderData: (previousData) => previousData,
  })
}

/** Fetch single trip detail by slug */
export function useTripDetail(slug: string) {
  return useQuery({
    queryKey: tripKeys.detail(slug),
    queryFn: () => apiClient.get<TripDetail>(`/trips/${slug}`).then(r => r.data),
    enabled: !!slug,  // Don't fetch if slug is empty
  })
}
```

**Rules for Read Hooks:**
- One hook per endpoint (or logical grouping).
- Always define `queryKey` using a factory function — makes cache invalidation reliable.
- Use `enabled` option to conditionally fetch (e.g., wait for slug, user ID).
- Use `placeholderData` for smooth pagination/filter transitions.
- Never put UI logic in hooks — return raw data, let components decide rendering.

### 5b. Write Hook (POST/PUT/DELETE → `useMutation`)

```typescript
// hooks/use-booking.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, AppApiError } from '@/lib/api-client'
import { tripKeys, bookingKeys } from '@/lib/query-keys'
import type { Booking, CreateBookingDto } from '@shared/types/booking.types'

/** Fetch current user's bookings */
export function useMyBookings() {
  return useQuery({
    queryKey: bookingKeys.myBookings(),
    queryFn: () => apiClient.get<Booking[]>('/my-bookings').then(r => r.data),
  })
}

/** Create a new booking (POST) */
export function useCreateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: CreateBookingDto) =>
      apiClient.post<Booking>('/bookings', dto).then(r => r.data),

    onSuccess: (newBooking) => {
      // 1. Invalidate cached trip detail (seat count changed)
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(newBooking.tripId) })
      // 2. Invalidate cached trip lists
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
      // 3. Invalidate my bookings
      queryClient.invalidateQueries({ queryKey: bookingKeys.myBookings() })
    },

    // Error is automatically typed as AppApiError (from api-client interceptor)
  })
}

/** Cancel a booking (PUT) */
export function useCancelBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (bookingId: string) =>
      apiClient.put<Booking>(`/bookings/${bookingId}/cancel`).then(r => r.data),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.myBookings() })
    },
  })
}
```

**Rules for Write Hooks:**
- `useMutation` for POST, PUT, PATCH, DELETE — **never `useQuery`** for writes.
- Always invalidate related queries in `onSuccess` to keep UI in sync.
- Never call `queryClient.setQueryData()` for mutations unless you're doing optimistic updates (Phase 2).
- Return the mutation object — component decides when to show toast, redirect, etc.

### 5c. Form Hook with Validation (React Hook Form + Zod)

```typescript
// hooks/use-create-trip-form.ts

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createTripSchema } from '@shared/validators/trip.schema'
import type { CreateTripDto } from '@shared/types/trip.types'

export function useCreateTripForm() {
  return useForm<CreateTripDto>({
    resolver: zodResolver(createTripSchema),
    defaultValues: {
      title: '',
      destination: '',
      tripType: 'ADVENTURE',
      description: '',
      minGroupSize: 5,
      maxGroupSize: 20,
      cancellationPolicy: 'FLEXIBLE',
    },
  })
}

// Usage in component:
// const form = useCreateTripForm()
// const createTrip = useCreateTrip()  // mutation hook
// const onSubmit = form.handleSubmit((data) => createTrip.mutate(data))
```

### 5d. Utility Hooks

```typescript
// hooks/use-debounce.ts

import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

// Usage: const debouncedSearch = useDebounce(searchTerm, 400)
```

---

## Step 6: Build the Component

Now build the component that uses the hook. Components are **thin** — they render UI and delegate data/logic to hooks.

**Location:** `apps/web/src/components/<feature>/`

### Component Structure Rules

```
Every component file follows this structure:

1. 'use client' directive (only if it uses hooks, handlers, or browser APIs)
2. Imports (external → internal → types)
3. Props interface (explicit, above component)
4. Component function (named export, never default)
5. Internal structure: hooks → derived state → handlers → return JSX
```

### 6a. Read Component (Fetching + Displaying Data)

```typescript
// components/trips/trip-grid.tsx

'use client'

import { useTrips } from '@/hooks/use-trips'
import { TripCard } from './trip-card'
import { TripCardSkeleton } from './trip-card-skeleton'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import type { TripFilters } from '@shared/types/trip.types'

interface TripGridProps {
  filters: TripFilters
  onCompare?: (tripId: string) => void
  selectedTripIds?: string[]
}

export function TripGrid({ filters, onCompare, selectedTripIds = [] }: TripGridProps) {
  // 1. Hooks
  const { data, isLoading, error, refetch } = useTrips(filters)

  // 2. Loading state — show skeleton grid
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <TripCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  // 3. Error state
  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />
  }

  // 4. Empty state
  if (!data?.trips.length) {
    return <EmptyState message="No trips found for your search" icon="🔍" />
  }

  // 5. Happy path
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.trips.map((trip) => (
        <ErrorBoundary key={trip.id} fallback={<TripCardError />}>
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

### 6b. Write Component (Form + Mutation)

```typescript
// components/booking/booking-form.tsx

'use client'

import { useCreateBooking } from '@/hooks/use-booking'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AppApiError } from '@/lib/api-client'
import type { TripDetail } from '@shared/types/trip.types'

interface BookingFormProps {
  trip: TripDetail
}

export function BookingForm({ trip }: BookingFormProps) {
  const router = useRouter()
  const createBooking = useCreateBooking()
  const [numTravelers, setNumTravelers] = useState(1)

  const totalAmount = trip.pricePerPerson * numTravelers
  const seatsAvailable = trip.maxGroupSize - trip.currentBookings

  async function handleBooking() {
    try {
      const booking = await createBooking.mutateAsync({
        tripId: trip.id,
        numTravelers,
      })
      // On success → redirect to Razorpay checkout or confirmation
      router.push(`/bookings/${booking.bookingRef}/payment`)
    } catch (error) {
      // Error is already AppApiError from api-client
      // TanStack Query exposes it via createBooking.error
      // No need to catch here unless you want to do something extra
    }
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
      <h3 className="text-lg font-display font-bold text-neutral-900 mb-4">
        Book This Trip
      </h3>

      {/* Price display */}
      <div className="flex justify-between items-baseline mb-4">
        <span className="text-neutral-600">Per person</span>
        <span className="text-2xl font-bold text-accent-500">
          ₹{trip.pricePerPerson.toLocaleString('en-IN')}
        </span>
      </div>

      {/* Traveler count */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Number of travelers
        </label>
        <select
          value={numTravelers}
          onChange={(e) => setNumTravelers(Number(e.target.value))}
          className="input"
        >
          {Array.from({ length: seatsAvailable }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
          ))}
        </select>
      </div>

      {/* Total */}
      <div className="flex justify-between items-baseline mb-6 pt-4 border-t border-neutral-200">
        <span className="font-semibold text-neutral-900">Total</span>
        <span className="text-xl font-bold text-neutral-900">
          ₹{totalAmount.toLocaleString('en-IN')}
        </span>
      </div>

      {/* Error display */}
      {createBooking.error && (
        <div className="mb-4 p-3 rounded-lg bg-error-50 text-error-500 text-sm font-medium">
          {createBooking.error instanceof AppApiError
            ? createBooking.error.message
            : 'Something went wrong. Please try again.'}
        </div>
      )}

      {/* Submit button */}
      <Button
        onClick={handleBooking}
        disabled={createBooking.isPending || seatsAvailable === 0}
        className="w-full btn-primary"
      >
        {createBooking.isPending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            Booking...
          </>
        ) : seatsAvailable === 0 ? (
          'Fully Booked'
        ) : (
          `Book Now — ₹${totalAmount.toLocaleString('en-IN')}`
        )}
      </Button>

      {/* Escrow trust badge */}
      <p className="text-xs text-neutral-500 text-center mt-3">
        🔒 Escrow protected — money released only after trip completion
      </p>
    </div>
  )
}
```

### 6c. Skeleton Component (Loading State)

```typescript
// components/trips/trip-card-skeleton.tsx

export function TripCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
      {/* Image placeholder */}
      <div className="skeleton h-48" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="flex gap-2 mt-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="flex justify-between items-center mt-3">
          <div className="skeleton h-5 w-20" />
          <div className="skeleton h-9 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
```

---

## Step 7: Wire Up in Page

Connect the component to a Next.js page.

**Location:** `apps/web/src/app/(main)/trips/page.tsx`

```typescript
// app/(main)/trips/page.tsx

import { Suspense } from 'react'
import { TripGrid } from '@/components/trips/trip-grid'
import { TripFilters } from '@/components/trips/trip-filters'
import { TripCardSkeleton } from '@/components/trips/trip-card-skeleton'
import type { Metadata } from 'next'

// SSR SEO metadata (runs on server)
export const metadata: Metadata = {
  title: 'Explore Group Trips from Pune | TripCompare',
  description: 'Compare and book group trips from Pune. Goa, Manali, Rishikesh and more. Escrow protected payments.',
}

// Page component (server component by default)
export default function TripsPage({
  searchParams,
}: {
  searchParams: Record<string, string>
}) {
  // Parse URL search params into typed filters
  const filters = {
    destination: searchParams.destination,
    tripType: searchParams.tripType,
    minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
    sort: searchParams.sort || 'date',
    page: Number(searchParams.page) || 1,
    limit: 20,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-bold text-neutral-900 mb-6">
        Explore Group Trips
      </h1>

      {/* Filters (client component) */}
      <TripFilters currentFilters={filters} />

      {/* Trip grid (client component with data fetching) */}
      <Suspense fallback={<TripGridSkeleton />}>
        <TripGrid filters={filters} />
      </Suspense>
    </div>
  )
}

function TripGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <TripCardSkeleton key={i} />
      ))}
    </div>
  )
}
```

---

## Step 8: Add Route-Level Error & Loading Files

Next.js App Router automatically uses `error.tsx` and `loading.tsx` files per route.

**Location:** Same folder as the `page.tsx`

```typescript
// app/(main)/trips/loading.tsx — Shows while page loads

export default function TripsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="skeleton h-8 w-64 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
            <div className="skeleton h-48" />
            <div className="p-4 space-y-3">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

```typescript
// app/(main)/trips/error.tsx — Shows on unhandled error

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
        We couldn't load the trips. This is probably temporary.
      </p>
      <button onClick={reset} className="btn-primary px-6 py-3 rounded-lg font-semibold">
        Try Again
      </button>
    </div>
  )
}
```

---

## Step 9: Handle Edge Cases

### Toast Notifications (for mutations)

```typescript
// Use a lightweight toast library like sonner or react-hot-toast

import { toast } from 'sonner'

// In component after mutation:
const createBooking = useCreateBooking()

async function handleBooking() {
  try {
    await createBooking.mutateAsync(dto)
    toast.success('Booking created! Redirecting to payment...')
    router.push('/payment')
  } catch (error) {
    if (error instanceof AppApiError) {
      toast.error(error.message)
    } else {
      toast.error('Something went wrong. Please try again.')
    }
  }
}
```

### Optimistic Updates (Phase 2 — use when confidence is high)

```typescript
// Example: "Add to comparison" is instant, revert on failure
const queryClient = useQueryClient()

const addToComparison = useMutation({
  mutationFn: (tripId: string) => apiClient.post('/comparisons', { tripId }),

  onMutate: async (tripId) => {
    await queryClient.cancelQueries({ queryKey: ['comparisons'] })
    const previous = queryClient.getQueryData(['comparisons'])
    queryClient.setQueryData(['comparisons'], (old) => [...old, tripId])
    return { previous }
  },

  onError: (err, tripId, context) => {
    queryClient.setQueryData(['comparisons'], context?.previous)
    toast.error('Failed to add to comparison')
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['comparisons'] })
  },
})
```

---

## Step 10: Verify

### Checklist Before PR

```
[ ] Component renders all 4 states: loading, error, empty, data
[ ] Hook uses correct query key factory (for proper cache invalidation)
[ ] Mutations invalidate related queries in onSuccess
[ ] Error messages are user-friendly (not raw API errors)
[ ] All `.windsurfrules` satisfied (TypeScript, colors, skeletons, mobile-first, security, naming)
[ ] Loading state uses `.skeleton` class matching component shape (not animate-pulse)
[ ] Button shows loading spinner during mutation (isPending)
[ ] Error boundary wraps individual cards/sections (not whole page)
[ ] Mobile responsive (test at 375px width)
[ ] Accessibility: form labels, button aria, focus states
[ ] Page has layout.tsx with Header + Footer (or uses parent layout that provides them)
[ ] Navigation link added (header/sidebar/menu) so user can reach the new page from the UI
[ ] Verify navigation flow: login → navigate → page renders (manual or E2E test)
```

### Testing (Unit + Integration)

```typescript
// components/trips/__tests__/trip-grid.test.tsx

import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TripGrid } from '../trip-grid'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('*/api/v1/trips', () => {
    return HttpResponse.json({
      success: true,
      data: [{ id: '1', title: 'Goa Trip', destination: 'Goa', slug: 'goa-trip' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('TripGrid', () => {
  it('renders trips after loading', async () => {
    renderWithQuery(<TripGrid filters={{}} />)

    // Initially shows skeletons
    expect(screen.getAllByTestId('trip-card-skeleton')).toHaveLength(6)

    // After fetch, shows trip card
    await waitFor(() => {
      expect(screen.getByText('Goa Trip')).toBeInTheDocument()
    })
  })

  it('shows error state on API failure', async () => {
    server.use(
      http.get('*/api/v1/trips', () => {
        return HttpResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
          { status: 500 },
        )
      }),
    )

    renderWithQuery(<TripGrid filters={{}} />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no trips found', async () => {
    server.use(
      http.get('*/api/v1/trips', () => {
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        })
      }),
    )

    renderWithQuery(<TripGrid filters={{}} />)

    await waitFor(() => {
      expect(screen.getByText(/no trips found/i)).toBeInTheDocument()
    })
  })
})
```

---

## Module Build Order (Follow This Sequence)

Build frontend modules in this order — each builds on the previous:

| Order | Module | Hook(s) | Key Components |
|-------|--------|---------|----------------|
| 1 | **Project Setup** | — | Layout, Providers, api-client, query-client |
| 2 | **Auth** | `useAuth`, `useLogin`, `useSignup` | LoginForm, SignupForm, AuthGuard |
| 3 | **Trip Listing** | `useTrips` | TripGrid, TripCard, TripFilters, TripCardSkeleton |
| 4 | **Trip Detail** | `useTripDetail` | TripDetail, TripItinerary, TripReviews, BookingSidebar |
| 5 | **Trip Comparison** | `useComparison` (local state) | ComparisonTable, CompareBar |
| 6 | **Booking** | `useCreateBooking`, `useMyBookings` | BookingForm, PriceBreakdown, BookingConfirmation |
| 7 | **Reviews** | `useReviews`, `useCreateReview` | ReviewCard, ReviewForm, StarRating |
| 8 | **Chat** | `useChat` (Socket.IO) | ChatWindow, MessageBubble, ChatSidebar |
| 9 | **Organizer Dashboard** | `useOrganizerTrips`, `useOrganizerStats` | StatsCards, TripTable, BookingTable |
| 10 | **Admin Panel** | `useAdminStats`, `useOrganizerApprovals` | AdminDashboard, ApprovalQueue |

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Page | `page.tsx` | `app/(main)/trips/page.tsx` |
| Layout | `layout.tsx` | `app/(main)/layout.tsx` |
| Loading | `loading.tsx` | `app/(main)/trips/loading.tsx` |
| Error | `error.tsx` | `app/(main)/trips/error.tsx` |
| Component | `kebab-case.tsx` | `trip-card.tsx`, `booking-form.tsx` |
| Skeleton | `<component>-skeleton.tsx` | `trip-card-skeleton.tsx` |
| Hook | `use-<name>.ts` | `use-trips.ts`, `use-booking.ts` |
| Lib/Util | `kebab-case.ts` | `api-client.ts`, `format.ts` |
| Types (shared) | `<domain>.types.ts` | `trip.types.ts`, `booking.types.ts` |
| Test | `<source>.test.tsx` | `trip-grid.test.tsx` |

---

## MANDATORY: Code Comments for Hooks & Components

### Hook Comments — Every hook MUST have JSDoc

```typescript
/**
 * Fetches paginated organizer stats (activeTrips, totalBookings, revenue, pendingRequests).
 *
 * Query key: organizerKeys.stats() — staleTime 30s to avoid excessive refetches
 * Error handling: caller should render ErrorState on error
 */
export function useOrganizerStats() {
```

```typescript
/**
 * Creates a new trip and invalidates related caches on success.
 *
 * Invalidates: organizerKeys.myTrips(), organizerKeys.stats()
 * Error handling: shows error toast via onError callback
 * Success: shows success toast via onSuccess callback
 */
export function useCreateTrip() {
```

### Component Comments — Props interface + purpose

```typescript
/**
 * Renders a single trip card in the organizer's trip list.
 * Shows status badge, booking count, price, and action menu (publish/delete/toggle).
 * Uses design system badge-* classes for status colors.
 */
interface TripListCardProps {
  trip: OrganizerTripListItem
  onPublish?: (id: string) => void
  onDelete?: (id: string) => void
  onToggleBookings?: (id: string) => void
}

export function TripListCard({ trip, onPublish, onDelete, onToggleBookings }: TripListCardProps) {
```

### Comment Rules for Frontend

```
Rules:
- EVERY custom hook: JSDoc with query key, invalidation targets, and error handling
- EVERY component with props: JSDoc above the Props interface describing the component's purpose
- Presentational components (no props / no hooks): single-line comment is sufficient
- Utility functions in lib/: JSDoc with @param and @returns
- DO NOT comment JSX structure (e.g., "// render the header" above <header>)
- DO comment non-obvious UI decisions (e.g., "// placeholderData keeps previous results during filter change")
- DO comment accessibility choices (e.g., "// aria-live for screen reader announcements")
```

---

## MANDATORY: Frontend Test Standards

### Component Test Structure (React Testing Library + MSW)

```typescript
// components/<feature>/__tests__/<component>.test.tsx

describe('<ComponentName>', () => {
  // 1. Happy path — renders data correctly
  it('should render trip cards when data loads', async () => {
    renderWithProviders(<TripGrid filters={{}} />)
    await waitFor(() => expect(screen.getByText('Goa Beach Trip')).toBeInTheDocument())
  })

  // 2. Loading state — shows skeleton
  it('should show skeletons while loading', () => {
    renderWithProviders(<TripGrid filters={{}} />)
    expect(document.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0)
  })

  // 3. Error state — shows error message + retry
  it('should show error state with retry button on API failure', async () => {
    server.use(http.get('*/api/v1/trips', () => HttpResponse.json(errorResponse, { status: 500 })))
    renderWithProviders(<TripGrid filters={{}} />)
    await waitFor(() => expect(screen.getByText(/failed/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  // 4. Empty state — shows empty message
  it('should show empty state when no results', async () => {
    server.use(http.get('*/api/v1/trips', () => HttpResponse.json(emptyResponse)))
    renderWithProviders(<TripGrid filters={{}} />)
    await waitFor(() => expect(screen.getByText(/no trips/i)).toBeInTheDocument())
  })
})
```

### Minimum FE Test Coverage Per Component

```
Every data-driven component MUST test all 4 states:
1. ✅ Loading state (skeleton visible)
2. ✅ Error state (error message + retry button visible)
3. ✅ Empty state (empty message visible)
4. ✅ Data state (actual content renders)

For mutation components (forms), also test:
5. ✅ Submit success (toast shown, redirect, cache invalidated)
6. ✅ Submit error (error message displayed)
7. ✅ Validation error (form-level errors shown before submit)
8. ✅ Button disabled during isPending
```

### Test Naming Convention

```
✅ "should render trip cards when data loads"
✅ "should show error toast when booking fails"
✅ "should disable submit button while mutation is pending"
✅ "should show skeletons while loading"

❌ "renders correctly"
❌ "works"
❌ "test form"
```

### Frontend Test Data Rules

```
- Use MSW (Mock Service Worker) for API mocking — never mock apiClient directly
- Define mock responses as constants at the top of the test file
- Use renderWithProviders helper that wraps QueryClientProvider
- Set retry: false in test QueryClient to avoid flaky tests
- Clean up: server.resetHandlers() in afterEach, server.close() in afterAll
```

---

## Common Mistakes to AVOID

| Mistake | Correct Approach |
|---------|-----------------|
| `fetch()` or `axios()` directly in component | Use `apiClient` through a custom hook |
| `useEffect` + `useState` for data fetching | Use TanStack Query (`useQuery` / `useMutation`) |
| Inline string query keys `['trips']` everywhere | Use query key factory (`tripKeys.list(filters)`) |
| Catching errors in component and swallowing them | Let TanStack Query expose `.error`, render `<ErrorState>` |
| Generic spinner for all loading states | Shape-matching skeleton per component |
| `any` type on API response | Type it through shared types |
| Business logic in component | Move to hook or util function |
| `useEffect` to sync form state | Use React Hook Form + Zod |
| Hardcoded API URLs | Use env variable `NEXT_PUBLIC_API_URL` |
| Retrying mutations | Mutations should never auto-retry (could duplicate) |
| Default export for components | Named exports only — easier refactoring |
| `console.log` for debugging | Use React Query Devtools + Error boundaries |
| Forgetting `enabled: false` on conditional queries | Causes unnecessary fetches and errors |
| Not invalidating cache after mutation | Stale UI — always invalidate related queries |

---

## Quick Reference: Where Does This Code Go?

| "I need to..." | File Location |
|----------------|---------------|
| Call a GET API endpoint | `hooks/use-<domain>.ts` → `useQuery` |
| Call a POST/PUT/DELETE API | `hooks/use-<domain>.ts` → `useMutation` |
| Configure HTTP headers, auth, base URL | `lib/api-client.ts` |
| Share types between FE and BE | `packages/shared/src/types/<domain>.types.ts` |
| Add a new page | `app/(group)/<route>/page.tsx` |
| Handle page-level errors | `app/(group)/<route>/error.tsx` |
| Show loading skeleton for a page | `app/(group)/<route>/loading.tsx` |
| Build a trip-specific component | `components/trips/<name>.tsx` |
| Build a reusable UI component | `components/shared/<name>.tsx` |
| Add a shadcn/ui primitive | `components/ui/<name>.tsx` (via CLI) |
| Validate a form | Zod schema in `packages/shared/src/validators/` + React Hook Form |
| Format a date or currency | `lib/format.ts` |
| Debounce an input | `hooks/use-debounce.ts` |
| Manage global client state (not server) | Zustand store in `lib/stores/<name>.ts` |
| Add SEO meta tags | `generateMetadata()` in the page's `page.tsx` |
| Define cache keys for a domain | `lib/query-keys.ts` — Factory Method pattern |

---

## FE Design Patterns Quick Reference

> Full documentation: `docs/engineering/tech-stack.md` Section 1 — Design Patterns (GoF Classification)

| Pattern | FE Usage | Example |
|---------|----------|---------|
| **Factory Method** | Query key factories | `tripKeys.list(filters)` → consistent cache keys |
| **Observer** | `onSuccess` in mutation hooks | Booking creation → invalidates trip + booking caches |
| **Command** | Mutation hooks = encapsulated actions | `useCreateBooking()` has execute, onSuccess, onError |
| **Template Method** | 4-state rendering | `if (isLoading)` → `if (error)` → `if (!data)` → render |
| **Adapter** | `apiClient` wraps Axios | Token injection, error transform, refresh logic |
| **Provider** | React Context + QueryClientProvider | Auth, theme, query client available to entire tree |
| **Compound Component** | React Hook Form + Zod | Form ↔ field ↔ error message coupling |
| **Custom Hook** | All data fetching in hooks | `useTrips()`, `useBooking()` — reusable, testable |
