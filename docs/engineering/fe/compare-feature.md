# Trip Comparison Feature — Architecture & Implementation

The compare feature lets travelers select up to 3 trips from any listing page and view them side-by-side in a Smartprix-style comparison table.

---

## 1. User Flow

```
TripCard "Compare" button → CompareBar (floating bottom bar) → /trips/compare page
```

1. **Select:** User clicks the "Compare" button on any `TripCard` (homepage trending, /trips listing).
2. **Queue:** A floating `CompareBar` appears at the bottom showing selected trip thumbnails (max 3).
3. **Compare:** Once ≥2 trips are selected, "Compare Now" CTA links to `/trips/compare?trips=slug1,slug2`.
4. **View:** The comparison page fetches full `TripDetail` for each slug and renders a side-by-side table.
5. **Remove:** Users can remove trips from comparison on either the bar or the table.
6. **Dismiss:** The bar can be closed (dismissed) without clearing the queue.

---

## 2. Architecture

### State Management — React Context + localStorage

```
CompareQueueProvider (providers.tsx)
├── useCompareQueue() — shared hook for all consumers
├── localStorage persistence — survives page refresh
└── StorageEvent listener — syncs across browser tabs
```

**Why Context over standalone hook:**
Each `useCompareQueue()` call would create independent state if it were a plain hook.
The Context provider ensures a single source of truth shared across all pages.

**Why localStorage over URL params:**
The compare queue persists across page navigations (home → /trips → /trips/compare).
URL params would be lost when navigating between pages.

### Component Tree

```
<Providers>
  <CompareQueueProvider>
    {children}                          ← all pages
    <GlobalCompareBar />                ← floating bar (rendered once, globally)
  </CompareQueueProvider>
</Providers>
```

### Data Flow

```
TripCard                    CompareBar                  Compare Page
  │                            │                            │
  │ onCompare(trip) ──────────►│                            │
  │   toggle() writes to       │ reads items from context   │
  │   context + localStorage   │ shows thumbnails + CTA     │
  │                            │                            │
  │                            │ "Compare Now" link ───────►│
  │                            │                            │ useCompareTrips(slugs)
  │                            │                            │   → parallel API calls
  │                            │                            │   → TripComparisonTable
```

---

## 3. File Map

| File | Purpose |
|------|---------|
| `hooks/use-compare-queue.tsx` | Context provider, `useCompareQueue()` hook, `CompareItem` type, localStorage sync |
| `hooks/use-compare-trips.ts` | `useCompareTrips(slugs)` — parallel `useQueries` to fetch `TripDetail[]` |
| `components/trips/trip-card.tsx` | Card with compare toggle button (pulse-zoom + pop animations) |
| `components/trips/compare-bar.tsx` | Floating bottom bar — thumbnails, empty slots, "Compare Now" CTA |
| `components/trips/global-compare-bar.tsx` | Connects `CompareBar` to context (rendered once in Providers) |
| `components/trips/trip-comparison-table.tsx` | Side-by-side comparison table with winner highlights |
| `app/trips/compare/page.tsx` | Compare route — 4-state rendering (empty/loading/error/table) |
| `app/trips/compare/loading.tsx` | Route-level skeleton |
| `app/trips/compare/error.tsx` | Route-level error boundary |
| `app/globals.css` | `animate-pulse-zoom` and `animate-pop` keyframe animations |

---

## 4. Key Design Decisions

### CompareItem — Lightweight Snapshot

```typescript
interface CompareItem {
  id: string        // Trip UUID
  slug: string      // URL slug for /trips/:slug
  title: string     // Display name in bar
  photo?: string    // Cover photo for thumbnail
  price: number     // Price per person (INR, whole rupees)
}
```

We store only 5 fields per trip in the queue (not the full `TripSummary`).
Full `TripDetail` is only fetched when the user actually navigates to the compare page.

### Derived State — `isOpen`

```typescript
const isOpen = items.length > 0 && !dismissed
```

`isOpen` is derived, not stored as separate state. This avoids bugs where `isOpen` and `items`
could get out of sync (e.g., clearing items but `isOpen` remaining `true`).

### Animation Strategy

Animations are defined in `globals.css` (not `tailwind.config.ts`) because:
- Tailwind JIT may not pick up keyframes defined in config when running inside Docker volume mounts.
- Direct CSS classes (`.animate-pulse-zoom`, `.animate-pop`) are more reliable.

The `hasInteracted` ref prevents the pulse-zoom animation from replaying when a user
deselects a trip (which would cause the button to re-enter the "unselected" branch).

### Hydration Safety

localStorage is read in a `useEffect` (not in `useState` initializer) to prevent
SSR/hydration mismatches. A `hydrated` flag gates localStorage writes to avoid
overwriting stored data with the initial empty array.

---

## 5. Comparison Table — Row Categories

| Row | Data Source | Winner Highlight |
|-----|-------------|-----------------|
| Rating | `trip.organizer.rating` | Highest rating → `success-50` bg |
| Price | `trip.pricePerPerson` | Lowest price → `success-50` bg |
| Destination | `trip.destination.name` + `trip.tripType` | — |
| Dates | `trip.startDate` / `trip.endDate` | — |
| Group Size | `trip.maxGroupSize`, seats left | — |
| Booking Mode | `INSTANT` / `REQUEST_BASED` | — |
| Inclusions | `trip.inclusions[]` | — |
| Cancellation | `FLEXIBLE` / `MODERATE` / `STRICT` | `FLEXIBLE` → `success-50` bg |
| CTA | "Book Now" / "Request to Join" / "Fully Booked" | — |

---

## 6. Test Coverage

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `compare-bar.test.tsx` | 8 | Render, remove, close, empty slots, compare link generation |
| `trip-comparison-table.test.tsx` | 11 | All row types, CTA links, remove callback, 3-trip render |
| `use-compare-trips.test.tsx` | 4 | Parallel fetch, error handling, empty input |
| `compare/page.test.tsx` | 7 | Empty state, loading, error, full data, insight badges, slug limit |

All tests use `makeTripDetail()` / `makeTripSummary()` factories from `test/factories/trip.factory.ts`.

---

## 7. Future Improvements

- **useCompareQueue hook tests** — unit tests for toggle/remove/clear/close/localStorage/MAX_ITEMS cap
- **TripCard component tests** — animation class presence, hasInteracted ref behavior
- **Share comparison** — copy shareable URL with selected trip slugs
- **"Save comparison"** — persist to user account (requires auth)
- **Mobile comparison** — stacked card view for `< md` breakpoints (currently table on all sizes)
