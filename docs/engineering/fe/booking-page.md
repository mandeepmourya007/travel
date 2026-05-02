# Booking Page

## 1. Overview

**What:** Full booking page with traveler form, Razorpay payment checkout, and success/failure handling.
**Who:** Authenticated travelers booking INSTANT-mode trips.
**Why:** Core revenue flow — converts trip interest into confirmed, paid bookings with escrow protection.

## 2. Data Flow

```
URL /trips/:slug/book
  → useTripDetail(slug) → GET /trips/slug/:slug → TripDetail
  → TravelerForm (React Hook Form + Zod)
  → useCreateBooking → POST /bookings → CreateBookingResponse (razorpayOrderId, keyId)
  → loadRazorpayScript() → Razorpay.open()
  → handler callback → useVerifyPayment → POST /bookings/:id/verify-payment → VerifyPaymentResponse
  → BookingSuccess screen
```

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/slug/:slug` | Public | Fetch trip details for form |
| POST | `/bookings` | Traveler | Create booking + Razorpay order |
| POST | `/bookings/:id/verify-payment` | Traveler | Verify HMAC signature, confirm booking |

## 4. Business Rules

- All prices stored and displayed in **whole rupees** (backend converts to paise for Razorpay)
- `numTravelers` capped at `min(seatsLeft, 10)`
- Booking blocked when: trip fully booked, deadline passed, or `acceptingBookings === false`
- `razorpayKeyId` validated before opening checkout — empty key shows error toast
- `isProcessing` flag prevents double-submit across the multi-step async flow (create → Razorpay → verify)
- Ownership check: only booking owner can verify payment (backend `ForbiddenError`)
- Idempotent: re-verifying a CONFIRMED booking returns success without side effects
- HMAC-SHA256 signature verification on backend before capture
- `razorpayPaymentId` persisted to `PaymentTransaction` before `confirmBooking()`
- Early bird pricing applied when `earlyBirdDeadline > now`
- Booking expiry: 30 minutes (set by backend)

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Trip fully booked | Shows "Fully Booked" message with back link |
| Booking deadline passed | Shows "Deadline Passed" message |
| Razorpay modal dismissed | Warning toast, form re-enabled, can retry |
| Payment verification fails | Error toast from `useVerifyPayment` hook |
| Booking creation fails (400) | Error toast from `useCreateBooking` hook |
| Empty `razorpayKeyId` | Error toast, processing stopped |
| Network error on trip fetch | Error state with "Try Again" button |
| User refreshes after payment | Backend idempotent — re-creating booking returns same order |

## 6. Error Handling

| Error | HTTP Status | When |
|-------|-------------|------|
| Trip not found | 404 | Invalid slug |
| Not enough seats | 400 | `currentBookings + numTravelers > maxGroupSize` |
| Booking deadline passed | 400 | `bookingDeadline < now` |
| Payment config missing | 400 | `RAZORPAY_KEY_ID` not set |
| Invalid signature | 401 | HMAC verification fails |
| Not booking owner | 403 | Different user tries to verify |
| Organizer no Razorpay | 400 | Organizer missing `razorpayAccountId` |

## 7. Test Coverage

**File:** `src/components/booking/__tests__/booking-page.test.tsx` (13 tests)

| Describe | Covers |
|----------|--------|
| Loading State | Skeleton visible during trip fetch |
| Error State | Error message + "Try Again" button on 500 |
| Trip Validation | Fully booked message, deadline passed message |
| Form — Data State | Fields render, name pre-filled from auth, price updates with traveler count |
| Form — Validation | Error messages on empty required fields, button enabled by default |
| Form — Submit Success | POST /bookings called, Razorpay opens with correct key, success screen after verify |
| Form — Submit Error | Error toast on booking creation failure, form stays visible on Razorpay dismiss |
