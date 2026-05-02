# My Bookings — Feature Documentation

## 1. Overview

**What:** Traveler-facing booking list with tab-based filtering, cancellation with refund calculation, and review prompts.
**Who:** Authenticated users with any role (primarily TRAVELER).
**Why:** Allows travelers to view, manage, and cancel their trip bookings from a single page.

## 2. Data Flow

```
/my-bookings (page)
  → MyBookingsList (component)
    → useMyBookings(filters)      → GET /api/v1/bookings/my         → BookingController.getMyBookings → BookingService.getMyBookings → BookingRepository.findByUserId → DB
    → useMyBookingSummary()        → GET /api/v1/bookings/my/summary → BookingController.getMyBookingSummary → BookingService.getMyBookingSummary → BookingRepository.getMyBookingSummary → DB
    → useCancelBooking()           → POST /api/v1/bookings/:id/cancel → BookingController.cancelBooking → BookingService.cancelBooking → BookingRepository.findById → DB
```

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/bookings/my` | Required | Paginated booking list with tab filter |
| GET | `/api/v1/bookings/my/summary` | Required | Tab count badges (all/upcoming/completed/cancelled) |
| POST | `/api/v1/bookings/:id/cancel` | Required | Cancel booking with refund calculation |

## 4. Business Rules

- **Tab mapping:** upcoming = CONFIRMED + PENDING_PAYMENT (future startDate), completed = COMPLETED, cancelled = CANCELLED + EXPIRED, all = no filter
- **Sort order:** upcoming tab sorts by `trip.startDate ASC`, all others by `createdAt DESC`
- **Pagination:** default limit 10, max 50 (PAGINATION_DEFAULTS.maxLimit)
- **Organizer verified mapping:** `verificationStatus === 'APPROVED'` → `verified: true`
- **hasReview mapping:** `review !== null` → `hasReview: true`
- **Cancel eligibility:** only CONFIRMED or PENDING_PAYMENT bookings with future trip startDate
- **Refund formula (FLEXIBLE):** ≥48h before trip → 100%, <48h → 50%
- **Refund formula (MODERATE):** ≥48h before trip → 50%, <48h → 0%
- **Refund formula (STRICT):** always 0%
- **Refund amount:** `Math.round((totalAmount × refundPercent) / 100)` — whole rupees
- **IDOR prevention:** userId always in WHERE clause; ForbiddenError if booking.userId !== authenticated user
- **Cancel reason:** minimum 5 characters required (FE validation)
- **REFUNDED status:** counted in `all` total but not mapped to any tab (upcoming/completed/cancelled) — intentional, since refunded bookings don't fit a user-facing tab
- **Dashboard link:** only visible to ORGANIZER role users
- **My Bookings link:** visible to all authenticated users

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Zero bookings | Empty state with "Browse Trips" CTA |
| Zero bookings in specific tab | Per-tab empty message (e.g. "No upcoming trips") |
| Cancel already-cancelled booking | ValidationError — wrong status |
| Cancel another user's booking | ForbiddenError (IDOR protection) |
| Booking not found | NotFoundError |
| Trip starts in <48h, FLEXIBLE policy | 50% refund |
| Trip starts in <48h, MODERATE policy | 0% refund |
| STRICT policy regardless of timing | 0% refund |
| Completed booking without review | "Leave Review" link shown |
| Completed booking with review | No review link |
| Multiple pages of bookings | Pagination controls with Previous/Next |
| Summary with no statuses | All counts return 0 |
| REFUNDED booking in summary | Counted in `all` but not in any specific tab |

## 6. Error Handling

| Error | HTTP Status | When |
|-------|-------------|------|
| NotFoundError | 404 | Booking ID doesn't exist or soft-deleted |
| ForbiddenError | 403 | User doesn't own the booking |
| ValidationError | 400 | Booking status not cancellable |
| API 500 | 500 | Server error — ErrorState with retry button |

## 7. Test Coverage

**Backend** — `apps/api/tests/unit/services/booking.service.test.ts` (21 tests)
- `getMyBookings`: happy path, empty result, pagination defaults, tab filtering, organizer verified mapping, hasReview mapping
- `getMyBookingSummary`: happy path, zero bookings, status grouping, multiple statuses
- `cancelBooking`: happy path (FLEXIBLE ≥48h), not found, forbidden (IDOR), already cancelled, STRICT 0% refund, MODERATE <48h, FLEXIBLE <48h 50%, PENDING_PAYMENT cancellable, refund rounding

**Frontend** — `apps/web/src/components/bookings/__tests__/my-bookings-list.test.tsx` (15 tests)
- Loading state (spinner visible)
- Error state (error message + retry button)
- Empty state (CTA to browse trips)
- Per-tab empty state (upcoming tab)
- Data state (card info renders correctly)
- Tab counts from summary endpoint
- Tab switching fetches filtered data
- Cancel button visibility (only confirmed upcoming)
- Cancel modal opens with booking details
- Cancel confirm success (toast fires)
- Cancel reason validation (min 5 chars, button disabled)
- Leave Review link for completed without review
- No review link when already reviewed
- Pagination controls (Previous/Next, page info)
- Status badge variants (Confirmed, Completed, Cancelled, Expired)
