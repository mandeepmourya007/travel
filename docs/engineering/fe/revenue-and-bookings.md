# Revenue, Bookings & Trip Requests — Feature Documentation

## Overview

This document covers the revenue calculation logic, booking lifecycle, refund handling, and trip request (accept/reject) flow used across the organizer dashboard.

---

## 1. Revenue Calculation

### Formula

```
Net Revenue = SUM(CAPTURED PAYMENT transactions) − SUM(CAPTURED REFUND transactions)
```

### Implementation

| Layer | File | Method |
|-------|------|--------|
| Repository | `trip.repository.ts` | `calculateOrganizerRevenue(organizerId)` |
| Service | `trip.service.ts` | `getOrganizerStats(userId)` |
| API | `GET /api/v1/trips/organizer/stats` | Returns `{ activeTrips, totalBookings, revenue, pendingRequests }` |

### What counts as revenue

| Transaction Type | Status | Effect |
|-----------------|--------|--------|
| `PAYMENT` | `CAPTURED` | **+amount** (adds to revenue) |
| `REFUND` | `CAPTURED` | **−amount** (subtracts from revenue) |
| `PAYMENT` | `INITIATED` | Ignored (not yet captured) |
| `PAYMENT` | `FAILED` | Ignored (never captured) |
| `ESCROW_RELEASE` | any | Ignored (platform payout, not organizer revenue) |

### Edge cases handled

| Scenario | Expected Revenue |
|----------|-----------------|
| No payments at all | ₹0 |
| 3 bookings × ₹4,500 captured, no refunds | ₹13,500 |
| ₹13,500 captured − ₹4,500 refund | ₹9,000 |
| Full refund (payment = refund) | ₹0 |
| Refunds > payments (price adjustment edge case) | Negative value (displayed as-is) |
| Deleted trip bookings | Excluded (filtered by `isDeleted: false`) |
| INITIATED payment (pending Razorpay) | Not counted |

### Test coverage

See `tests/unit/services/trip.service.test.ts` → `describe('getOrganizerStats')`:
- ✅ Revenue from CAPTURED payments minus refunds
- ✅ Zero revenue (no payments)
- ✅ Negative revenue (refunds > payments)
- ✅ ForbiddenError if no organizer profile

---

## 2. Booking Lifecycle

### Statuses (`BookingStatus` enum)

```
PENDING → CONFIRMED → COMPLETED
                   ↘ CANCELLED
         → CANCELLED (direct cancellation before confirmation)
```

| Status | Description |
|--------|-------------|
| `PENDING` | Payment initiated but not yet captured |
| `CONFIRMED` | Payment captured, traveler is booked |
| `COMPLETED` | Trip finished, booking fulfilled |
| `CANCELLED` | Cancelled by traveler or organizer (refund may follow) |

### Booking modes

| Mode | Flow |
|------|------|
| `INSTANT` | Traveler books → payment captured → `CONFIRMED` immediately |
| `REQUEST_BASED` | Traveler submits `TripRequest` → organizer approves → booking created |

### `acceptingBookings` toggle

Organizers can close bookings on ACTIVE trips via `PATCH /trips/:id/toggle-bookings`. When `acceptingBookings: false`, new bookings and requests are blocked.

**Test coverage** — `describe('toggleBookings')`:
- ✅ Toggle true → false
- ✅ Toggle false → true
- ✅ NotFoundError for missing trip
- ✅ ForbiddenError for wrong owner
- ✅ ValidationError for non-ACTIVE trips (DRAFT, COMPLETED)

---

## 3. Refund Handling

### How refunds work

1. Organizer or system initiates a cancellation
2. A new `PaymentTransaction` is created with:
   - `type: 'REFUND'`
   - `status: 'CAPTURED'`
   - `amount`: the refund amount
   - `bookingId`: links back to the original booking
3. The booking status changes to `CANCELLED`
4. Revenue automatically decreases (aggregate query picks it up)

### Refund policies (`CancellationPolicy`)

| Policy | Refund Rules |
|--------|-------------|
| `FLEXIBLE` | Full refund up to 48h before trip |
| `MODERATE` | 50% refund up to 7 days before trip |
| `STRICT` | No refund after booking confirmation |

---

## 4. Trip Requests (Accept / Reject)

### Flow for `REQUEST_BASED` booking mode

```
Traveler submits TripRequest (status: PENDING)
  → Organizer reviews on dashboard
    → APPROVE: Creates Booking + PaymentTransaction, TripRequest → APPROVED
    → REJECT: TripRequest → REJECTED, no booking created
    → EXPIRED: Cron job marks old PENDING requests as EXPIRED
```

### `TripRequest` statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting organizer decision |
| `APPROVED` | Organizer accepted, booking created |
| `REJECTED` | Organizer declined |
| `EXPIRED` | Auto-expired by cron (configurable TTL) |

### Dashboard stat: Pending Requests

Counted via `TripRepository.countPendingRequests(organizerId)`:
- Filters: `status: 'PENDING'`, `isDeleted: false`, trip owned by organizer
- Displayed on the organizer dashboard `StatCard`

---

## 5. Edit History (Audit Trail)

### `TripEditHistory` table

Classified as an **audit table** (immutable, no soft-delete mixin). Every trip update creates an entry recording:

| Field | Purpose |
|-------|---------|
| `editedById` | User who made the change |
| `changedFields` | Array of field names that changed |
| `snapshot` | JSON snapshot of trip state before edit |
| `editNote` | Optional note from organizer |

### API: `GET /trips/:id/history`

Returns paginated edit history. Only the trip owner can view.

**Test coverage** — `describe('getTripEditHistory')`:
- ✅ Returns paginated history for own trip
- ✅ NotFoundError for missing trip
- ✅ ForbiddenError for non-owner

---

## 6. Seed Data Scenarios

The seed (`prisma/seed.ts`) creates 4 demo organizer trips:

| Trip | Mode | Status | Bookings | Revenue Scenario |
|------|------|--------|----------|-----------------|
| A | REQUEST_BASED | ACTIVE | 3 confirmed, 2 pending requests | Payments captured |
| B | INSTANT | ACTIVE | 3 confirmed | All auto-confirmed |
| C | INSTANT | COMPLETED | 6 completed, 2 cancelled | Payments + 2 refunds |
| D | REQUEST_BASED | COMPLETED | 3 completed, 2 rejected requests | Mixed payments |

### Test credentials

| Role | Email | Password |
|------|-------|----------|
| Organizer | `demo.organizer@test.com` | `Test@1234` |
| Traveler 1 | `traveler1@test.com` | `Test@1234` |
| Traveler 2-6 | `traveler{2-6}@test.com` | `Test@1234` |
