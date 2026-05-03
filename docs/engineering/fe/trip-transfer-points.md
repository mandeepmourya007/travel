# Trip Transfer Points

## 1. Overview
**What:** Replaces single `pickupLocation`/`pickupTime` fields with a normalized `TripTransferPoint` table supporting multiple pickup and drop points per trip, each with optional extra charge.

**Who:** Organizers manage transfer points during trip creation/edit. Travelers select a pickup and drop point when booking.

**Why:** Supports real-world scenarios where trips have multiple boarding/alighting locations with different surcharges.

## 2. Data Flow

### Organizer (Create/Edit Trip)
`TripForm → TransferPointsTab → useFieldArray → createTripSchema → POST /trips → TripService.createTrip → TripRepo.create(transferPoints: { create: [...] })`

### Traveler (Booking)
`BookingPage → TravelerForm (pickupPointId/dropPointId selects) → POST /bookings → BookingService.createBooking → Booking.pickupPointId/dropPointId`

### Traveler (View Trip)
`TripDetailPage → useTripDetail → GET /trips/slug/:slug → TripService.getTripBySlug → toDetail() splits transferPoints into pickupPoints/dropPoints`

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/trips` | Organizer | Creates trip with nested transfer points |
| PATCH | `/trips/:id` | Organizer | Replaces pickup/drop points (soft-delete old + create new) |
| GET | `/trips/slug/:slug` | Public | Returns `pickupPoints[]` and `dropPoints[]` |
| POST | `/trips/:id/publish` | Organizer | Validates ≥1 pickup + ≥1 drop before publishing |
| POST | `/bookings` | Traveler | Optional `pickupPointId` + `dropPointId` (required if trip has transfer points) |
| GET | `/bookings/my` | Traveler | Includes `pickupPoint` and `dropPoint` in response |

## 4. Business Rules
- At least 1 pickup point and 1 drop point required before publishing a trip
- `extraCharge` is in whole rupees (Int), `0` = included in base price
- Transfer points use soft-delete via Prisma Client Extensions (`TripTransferPoint` in `SOFT_DELETE_MODELS`)
- On update: manual `updateMany` sets `isDeleted=true` to bypass the extension's delete→soft-delete interception (needed for bulk ops inside tx)
- On update: old points of that type are soft-deleted, new ones created (atomic tx)
- Booking requires valid `pickupPointId` (type=PICKUP) and `dropPointId` (type=DROP)
- `sortOrder` preserves display order set by organizer

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Trip with 0 pickup points | Publish blocked with `ValidationError` |
| Trip with 0 drop points | Publish blocked with `ValidationError` |
| Update with only `pickupPoints` | Only pickup points replaced, drops untouched |
| Update with no transfer point arrays | Existing points preserved |
| Booking without pickupPointId | Zod validation error (cuid) |
| All pickup extraCharge = 0 | Shows "Included" in comparison table |

## 6. Error Handling

| Error | HTTP Status | When |
|-------|-------------|------|
| `ValidationError: At least one pickup point` | 400 | Publish with no pickups |
| `ValidationError: At least one drop point` | 400 | Publish with no drops |
| `Zod: Invalid pickup point` | 400 | Invalid cuid for pickupPointId |
| `Zod: Label must be at least 2 characters` | 400 | Short transfer point label |

## 7. Test Coverage

### Backend (`apps/api/tests/unit/services/trip.service.test.ts`)
- `createTrip`: nested transfer points create, slug generation
- `getTripBySlug`: splits transferPoints into pickupPoints/dropPoints
- `updateTrip`: replace pickup points in tx, no-touch when arrays absent
- `publishTrip`: validates ≥1 pickup, ≥1 drop

### Backend (`apps/api/tests/unit/services/booking.service.test.ts`)
- `createBooking (future)`: 5 `it.todo` tests for transfer point validation

### Frontend (`apps/web/src/components/booking/__tests__/booking-page.test.tsx`)
- Renders pickup/drop selectors when trip has transfer points
- Hides transfer points section when arrays are empty
