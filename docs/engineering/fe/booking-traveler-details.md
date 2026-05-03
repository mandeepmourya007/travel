# Booking Traveler Details — Expand on Card

## 1. Overview

- **What**: Expandable accordion on traveler booking cards showing individual traveler details (name, phone, age, gender, emergency contact). Emergency contact columns added to organizer's participant drawer.
- **Who**: Travelers (My Bookings page) + Organizers (Trip Participants dashboard)
- **Why**: Visibility into co-traveler details for multi-person bookings

## 2. Data Flow

### Traveler View
```
/my-bookings → MyBookingsList → useMyBookings hook → GET /bookings/my
  → BookingController.getMyBookings → BookingService.getMyBookings
  → BookingRepository.findByUserId (MY_BOOKING_INCLUDE w/ travelerDetails)
  → MyBookingCard → TravelerDetailsAccordion
```

### Organizer View
```
/dashboard/trips/:id/users → ParticipantCard → ParticipantDrawer
  → useTripBookings hook → GET /trips/:tripId/bookings
  → BookingRepository.findByTripId (BOOKING_INCLUDE_LIST w/ travelerDetails + emergency)
```

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/bookings/my` | TRAVELER | Returns paginated bookings with `travelerDetails[]` per item |
| GET | `/trips/:tripId/bookings` | ORGANIZER | Returns bookings with traveler details including emergency contacts |

## 4. Business Rules

- `TravelerDetailsAccordion` renders nothing when `travelers.length === 0`
- Single traveler (`travelers.length === 1`) → inline text: "Booked for: {name}"
- Multiple travelers (`travelers.length > 1`) → expandable accordion with table
- Accordion collapsed by default, toggles on click
- Primary traveler marked with "Primary" badge
- Emergency contact shown as "Name · Phone" or dash if null
- Organizer view always shows emergency contact column in traveler table
- Soft-deleted traveler details excluded via `where: { isDeleted: false }`

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty `travelerDetails` array | Component returns `null` |
| Single traveler | Inline name, no accordion button |
| Null phone/age/gender | Dash (`—`) displayed |
| Null emergency contact | Dash (`—`) in table cell |
| Emergency name present, phone null | Shows name only (no "·" separator) |

## 6. Error Handling

No new error states — traveler details come from existing `GET /bookings/my` and `GET /trips/:tripId/bookings` endpoints. Errors are handled by parent components.

## 7. Test Coverage

### Backend — `apps/api/tests/unit/services/booking.service.test.ts`

`describe('getMyBookings')` additions:
- `should include travelerDetails array in response`
- `should include emergency contact fields in travelerDetails`
- `should return empty travelerDetails array when booking has none`

### Frontend — `apps/web/src/components/bookings/__tests__/traveler-details-accordion.test.tsx`

`describe('TravelerDetailsAccordion')`:
- Collapsed by default showing count
- Expand on click shows names + primary badge
- Phone, age, gender visible when expanded
- Emergency contact rendered when provided
- Dash for null emergency contact
- Single traveler inline name
- Empty array renders nothing
- Collapse on second click

### Frontend Integration — `apps/web/src/components/bookings/__tests__/my-bookings-list.test.tsx`

Added to `describe('MyBookingsList')`:
- Accordion button visible when `numTravelers > 1`
- Inline traveler name when `numTravelers === 1`
