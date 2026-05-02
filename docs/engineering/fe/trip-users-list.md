# Trip Participants Dashboard

## 1. Overview

**What:** Organizer-facing dashboard to view and manage all bookings and trip requests for a specific trip.
**Who:** Organizers (role: `ORGANIZER`).
**Why:** Organizers need Swiggy/Zomato-style real-time visibility into who has booked, who is requesting to join, and capacity status — with inline approve/reject actions.

## 2. Data Flow

```
/dashboard/trips/[id]/users
  → useTripSummary(tripId)        → GET /trips/:tripId/summary     → TripService.getTripBookingSummary → BookingRepo.getTripBookingSummary
  → useTripBookings(tripId, f)    → GET /trips/:tripId/bookings    → TripService.getTripBookings       → BookingRepo.findByTripId
  → useTripRequests(tripId, f)    → GET /trips/:tripId/requests    → TripService.getTripRequests       → TripRequestRepo.findByTripId
  → useRespondToRequest()         → PATCH /trips/:tripId/requests/:requestId → TripService.respondToTripRequest → TripRequestRepo.updateStatus
```

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/:tripId/bookings` | ORGANIZER | Paginated bookings with user + traveler details |
| GET | `/trips/:tripId/requests` | ORGANIZER | Paginated trip requests with user details |
| GET | `/trips/:tripId/summary` | ORGANIZER | Aggregated stats (confirmed, travelers, revenue, pending, seats) |
| PATCH | `/trips/:tripId/requests/:requestId` | ORGANIZER | Approve or reject a pending request |

## 4. Business Rules

- Only the trip owner (organizer) can access these endpoints
- Bookings support filters: `bookingStatus`, `search` (user name), `sort` (newest/oldest/amount), `page`, `limit`
- Requests support filters: `status`, `search` (user name), `page`, `limit`
- Only `PENDING` requests can be approved/rejected
- On approve: `approvalExpiresAt` set to now + 48 hours
- On reject: `rejectionReason` is required (enforced by UI)
- Capacity check on approve: `request.numTravelers <= trip.maxGroupSize - trip.currentBookings`
- `seatsLeft = max(0, maxGroupSize - currentBookings)`
- Revenue = sum of CAPTURED PAYMENT transactions for the trip's bookings
- Limit capped at 50 per page

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Trip not found | 404 NotFoundError |
| User not trip owner | 403 ForbiddenError |
| No bookings/requests | Empty state with message |
| Approve with insufficient seats | 400 ValidationError with seat count |
| Respond to non-PENDING request | 400 ValidationError |
| Request belongs to different trip | 404 NotFoundError |
| Page limit > 50 | Capped to 50 |
| Zero confirmed bookings | Summary returns all zeros |

## 6. Error Handling

| Error | HTTP Status | When |
|-------|-------------|------|
| NotFoundError | 404 | Trip or request doesn't exist |
| ForbiddenError | 403 | User doesn't own the trip |
| ValidationError | 400 | Non-PENDING request, insufficient seats |
| AuthError | 401 | Missing/invalid JWT |

## 7. Test Coverage

**Test file:** `apps/api/tests/unit/services/trip-users.service.test.ts` — 24 tests

| Describe | Cases |
|----------|-------|
| `getTripBookings` | Happy path, not-found, forbidden, empty, status filter, search filter, pagination cap |
| `getTripRequests` | Happy path, not-found, forbidden, empty, status filter, search filter |
| `getTripBookingSummary` | Happy path, not-found, forbidden, zero stats |
| `respondToTripRequest` | Approve happy, reject happy, trip not found, request not found, forbidden, non-pending, insufficient seats |

**Frontend components:**
- `trip-stats-bar.tsx` — Stats bar with 4 metric cards + skeleton
- `participant-card.tsx` — Booking card + request card (with inline approve/reject) + skeleton
- `participant-drawer.tsx` — Slide-out detail panel with traveler table
- `request-action-modal.tsx` — Approve/reject confirmation with seat validation
- `participant-filters.tsx` — Debounced search + status dropdown
