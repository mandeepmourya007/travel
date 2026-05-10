# Vehicle Seat Layout — Feature Design

> **Status:** Design complete, ready for `/build-backend` + `/build-frontend`.
> **Prerequisite:** Existing Trip + Booking + TravelerDetail models.
> **Goal:** Let organizers define vehicle seat layouts per trip; let travelers pick specific seats during booking.

---

## 1. Problem Statement

Currently, booking uses `numTravelers` + `maxGroupSize` (count-based). This works for "how many seats" but doesn't support:
- Seat-specific booking (window vs aisle, front vs back)
- Visual seat selection UI (like bus booking apps)
- Per-seat pricing tiers (premium front seats vs regular)
- Multi-vehicle trips (bus + tempo for different legs)
- Driver / blocked / door gap representation

**Industry reference:** RedBus, AbhiBus, MakeMyTrip bus booking UIs.

---

## 2. Data Model

### 2.1 New Enums

```prisma
enum SeatCellType {
  SEAT       // Bookable passenger seat
  DRIVER     // Non-bookable, locked position
  EMPTY      // Gap / door / no seat
  BLOCKED    // Exists but unavailable (reserved, damaged, etc.)
}

enum SeatStatus {
  AVAILABLE    // Open for booking
  HELD         // Temporarily locked during payment (30min TTL, same as booking expiry)
  BOOKED       // Confirmed booking
  BLOCKED      // Admin/organizer blocked
}
```

### 2.2 New Tables

#### TripVehicle

One trip can have multiple vehicles (e.g., 2 buses for a large group). MVP: 1 vehicle per trip.

```prisma
model TripVehicle {
  id            String   @id @default(cuid())
  tripId        String
  trip          Trip     @relation(fields: [tripId], references: [id])
  label         String   @default("Main Vehicle") // "Bus 1", "Tempo", etc.
  vehicleType   String   // "sedan", "ertiga", "innova", "tempo", "minibus", "bus22", "bus23", "custom"
  sortOrder     Int      @default(0)

  // Layout config — defines the grid structure
  rows          Int                // Total data rows
  cols          Int                // Total data columns (excluding aisle)
  aisleAfterCol Int?               // null = no aisle, 0-indexed col after which aisle appears
  driverRow     Int      @default(0)  // Driver always row 0 for India
  driverCol     Int                   // Last col (extreme right for India)

  // 2D layout as JSON — SeatCellType[][] (e.g., [["SEAT","EMPTY","DRIVER"],["SEAT","SEAT","SEAT"]])
  layout        Json                // SeatCellType[][]

  // Mixin
  isActive      Boolean  @default(true)
  isDeleted     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  // Relations
  seats         VehicleSeat[]

  @@index([tripId])
  @@index([isDeleted])
}
```

#### VehicleSeat

One row per bookable seat. Created when organizer saves layout. Only `SEAT` cells get a `VehicleSeat` row.

```prisma
model VehicleSeat {
  id              String      @id @default(cuid())
  tripVehicleId   String
  tripVehicle     TripVehicle @relation(fields: [tripVehicleId], references: [id])

  row             Int         // 0-indexed grid row
  col             Int         // 0-indexed grid col
  seatLabel       String      // "1A", "2C" — human-readable
  seatNumber      Int         // Sequential: 1, 2, 3...
  status          SeatStatus  @default(AVAILABLE)

  // Optional: per-seat pricing tier (Phase 2)
  // priceTier     String?    // "standard", "premium", "window"
  // priceOverride Int?       // Override trip's pricePerPerson for this seat

  // Booking reference — set when seat is HELD or BOOKED
  bookingId       String?
  booking         Booking?    @relation(fields: [bookingId], references: [id])
  travelerDetailId String?    @unique
  travelerDetail  TravelerDetail? @relation(fields: [travelerDetailId], references: [id])

  // Hold expiry — for HELD status (same 30min window as booking)
  heldAt          DateTime?
  heldUntil       DateTime?
  heldByUserId    String?     // Who is holding this seat

  // Mixin
  isActive        Boolean  @default(true)
  isDeleted       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  @@unique([tripVehicleId, row, col])        // One seat per grid position
  @@unique([tripVehicleId, seatNumber])      // Unique seat numbers per vehicle
  @@index([tripVehicleId, status])           // Quick lookup: available seats
  @@index([bookingId])                       // Seats for a booking
  @@index([status, heldUntil])               // Cron: expire held seats
  @@index([isDeleted])
}
```

### 2.3 Modified Existing Tables

```prisma
// Trip — add relation
model Trip {
  // ... existing fields ...
  vehicles    TripVehicle[]

  // NEW: flag to enable seat selection (false = count-based legacy mode)
  seatSelectionEnabled Boolean @default(false)
}

// Booking — add seat relation
model Booking {
  // ... existing fields ...
  seats       VehicleSeat[]       // Seats assigned to this booking
}

// TravelerDetail — add seat reference
model TravelerDetail {
  // ... existing fields ...
  assignedSeat  VehicleSeat?      // 1:1 — which seat this traveler sits in
}
```

### 2.4 Design Decisions

| Decision | Rationale |
|----------|-----------|
| `layout` as JSON on `TripVehicle` | Visual rendering needs the full grid (EMPTY, DRIVER, BLOCKED cells have no `VehicleSeat` row). JSON is read-heavy, never queried by sub-field. |
| `VehicleSeat` rows only for `SEAT` cells | Bookable seats need status tracking, FK to booking. Non-seat cells are display-only. |
| `seatSelectionEnabled` flag on Trip | Backward compatible — existing trips work as count-based. Organizers opt into seat selection. |
| `heldAt`/`heldUntil` on VehicleSeat | Same 30min TTL as `Booking.expiresAt`. Cron releases expired holds. |
| `travelerDetailId` unique FK | 1:1 mapping — each seat assigned to exactly one traveler. |
| Driver position in `TripVehicle` | Single source of truth. India = row 0, last col. Enforced in service layer. |

---

## 3. Race Condition Strategy

### Seat Hold (Atomic)

Same pattern as `Trip.currentBookings` — atomic SQL prevents double-booking:

```typescript
// VehicleSeatRepository.holdSeats()
const held = await tx.$executeRaw`
  UPDATE "VehicleSeat"
  SET "status" = 'HELD',
      "heldAt" = NOW(),
      "heldUntil" = NOW() + INTERVAL '30 minutes',
      "heldByUserId" = ${userId},
      "updatedAt" = NOW()
  WHERE "id" = ANY(${seatIds}::text[])
    AND "status" = 'AVAILABLE'
    AND "isDeleted" = false
`
if (held !== seatIds.length) {
  throw new ConflictError('One or more selected seats are no longer available')
}
```

### Seat Confirm (On Payment)

```typescript
// VehicleSeatRepository.confirmSeats()
await tx.$executeRaw`
  UPDATE "VehicleSeat"
  SET "status" = 'BOOKED',
      "bookingId" = ${bookingId},
      "heldAt" = NULL,
      "heldUntil" = NULL,
      "updatedAt" = NOW()
  WHERE "id" = ANY(${seatIds}::text[])
    AND "status" = 'HELD'
    AND "heldByUserId" = ${userId}
`
```

### Seat Release (On Cancel / Expiry)

```typescript
// VehicleSeatRepository.releaseSeats()
await tx.$executeRaw`
  UPDATE "VehicleSeat"
  SET "status" = 'AVAILABLE',
      "bookingId" = NULL,
      "travelerDetailId" = NULL,
      "heldAt" = NULL,
      "heldUntil" = NULL,
      "heldByUserId" = NULL,
      "updatedAt" = NOW()
  WHERE "bookingId" = ${bookingId}
    AND "isDeleted" = false
`
```

### Cron: Expire Held Seats

Add to `cron-jobs.ts` alongside booking expiry:

```typescript
// Every 1 minute — release seats held past their TTL
await prisma.$executeRaw`
  UPDATE "VehicleSeat"
  SET "status" = 'AVAILABLE',
      "heldAt" = NULL, "heldUntil" = NULL, "heldByUserId" = NULL,
      "updatedAt" = NOW()
  WHERE "status" = 'HELD'
    AND "heldUntil" < NOW()
`
```

---

## 4. Business Flows

### 4.1 Organizer: Create Layout (Trip Create/Edit)

```
Organizer on /dashboard/trips/create (or edit):
  → Step: "Vehicle & Seats" tab in multi-step form
  → Select template (Sedan/Ertiga/Innova/Tempo/Bus/Custom)
  → Grid renders with predefined layout
  → Click cells to change type (Seat / No Seat / Blocked)
  → Adjust rows, columns, aisle position
  → Preview shows seat count, driver position
  → Save → TripVehicle + VehicleSeat rows created
  → Trip.seatSelectionEnabled = true
  → maxGroupSize auto-computed from SEAT cell count
```

**Validation rules:**
- Exactly 1 DRIVER cell per vehicle
- At least 1 SEAT cell
- `maxGroupSize` must equal total SEAT cells (auto-set, not manual)
- Grid dimensions: 2-15 rows, 1-8 cols

### 4.2 Traveler: Select Seats (Booking Flow)

```
Traveler on /trips/:slug/book:
  → IF trip.seatSelectionEnabled:
      Show seat map (visual grid) after traveler count selection
      → Seat states: Available (green), Booked (gray), Selected (teal), Held (yellow)
      → Click seat → assigns to next unassigned traveler
      → Click again → deselects
      → Must select exactly numTravelers seats
      → Seats map to TravelerDetail forms (Seat 5 → Traveler 1 form)
  → ELSE:
      Legacy flow — count-based, no seat selection
  → Click "Pay" → seats HELD atomically → Razorpay checkout
  → Payment success → seats BOOKED + Booking CONFIRMED
  → Payment fail / 30min expiry → seats released back to AVAILABLE
```

### 4.3 Cancel Booking → Release Seats

```
Traveler cancels booking:
  → BookingService.cancelBooking() (existing)
  → ADDITIONALLY: VehicleSeatRepository.releaseSeats(bookingId)
  → All seats for this booking → AVAILABLE
  → TravelerDetail seat assignments cleared
```

### 4.4 Organizer: View Seat Map (Bookings Dashboard)

```
Organizer on /dashboard/trips/:id/users:
  → "Seat Map" tab alongside Bookings/Requests tabs
  → Visual grid showing:
    - Booked seats (with traveler name + booking ref)
    - Available seats (green)
    - Held seats (yellow, with countdown)
    - Blocked seats (gray)
  → Click booked seat → slide-out with traveler details
```

---

## 5. API Endpoints

### 5.1 Organizer Routes (behind auth + organizer role)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/trips/:tripId/vehicle` | Create vehicle + layout for a trip |
| PUT | `/trips/:tripId/vehicle/:vehicleId` | Update layout (only if no BOOKED seats) |
| GET | `/trips/:tripId/vehicle` | Get vehicle(s) with layout for trip |
| DELETE | `/trips/:tripId/vehicle/:vehicleId` | Remove vehicle (only if no BOOKED seats) |

### 5.2 Traveler Routes (behind auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trips/:tripId/seats` | Get seat map with availability (for booking UI) |
| POST | `/bookings/:bookingId/seats` | Hold selected seats (during booking) |

### 5.3 Modified Existing Endpoints

| Endpoint | Change |
|----------|--------|
| `POST /trips` | Accept optional `vehicle` object in body |
| `PUT /trips/:id` | Accept optional `vehicle` updates |
| `POST /bookings` | Accept `seatIds: string[]` when `seatSelectionEnabled` |
| `POST /bookings/:id/cancel` | Release held/booked seats |
| `GET /bookings/my` | Include seat assignments in response |

---

## 6. Shared Types (`packages/shared/src/types/vehicle.types.ts`)

```typescript
export type SeatCellType = 'SEAT' | 'DRIVER' | 'EMPTY' | 'BLOCKED'
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED'

export interface LayoutConfig {
  rows: number
  cols: number
  aisleAfterCol: number | null
  driverPos: [number, number]  // [row, col]
}

export interface TripVehicleDto {
  id?: string
  label: string
  vehicleType: string
  layoutConfig: LayoutConfig
  layout: SeatCellType[][]
}

export interface VehicleSeatItem {
  id: string
  row: number
  col: number
  seatLabel: string     // "1A"
  seatNumber: number    // 1
  status: SeatStatus
  travelerName?: string // Only for organizer view when BOOKED
  bookingRef?: string   // Only for organizer view when BOOKED
}

export interface SeatMapResponse {
  vehicle: {
    id: string
    label: string
    vehicleType: string
    layoutConfig: LayoutConfig
    layout: SeatCellType[][]
  }
  seats: VehicleSeatItem[]
  summary: {
    total: number
    available: number
    booked: number
    held: number
    blocked: number
  }
}

export interface SelectSeatsDto {
  seatIds: string[]  // VehicleSeat IDs to hold
}
```

---

## 7. Zod Validators (`packages/shared/src/validators/vehicle.schema.ts`)

```typescript
const seatCellTypeEnum = z.enum(['SEAT', 'DRIVER', 'EMPTY', 'BLOCKED'])

export const layoutConfigSchema = z.object({
  rows: z.number().int().min(2).max(15),
  cols: z.number().int().min(1).max(8),
  aisleAfterCol: z.number().int().min(0).nullable(),
  driverPos: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
})

export const createVehicleSchema = z.object({
  label: z.string().trim().min(1).max(50).default('Main Vehicle'),
  vehicleType: z.string().trim().min(1).max(30),
  layoutConfig: layoutConfigSchema,
  layout: z.array(z.array(seatCellTypeEnum)).min(2),
}).refine(
  (data) => {
    // Exactly 1 DRIVER cell
    let driverCount = 0
    let seatCount = 0
    data.layout.forEach(row => row.forEach(cell => {
      if (cell === 'DRIVER') driverCount++
      if (cell === 'SEAT') seatCount++
    }))
    return driverCount === 1 && seatCount >= 1
  },
  { message: 'Layout must have exactly 1 driver and at least 1 seat' }
)

export const selectSeatsSchema = z.object({
  seatIds: z.array(z.string().cuid()).min(1).max(10),
})
```

---

## 8. Backend Architecture

### 8.1 Files to Create

```
apps/api/src/
  repositories/vehicle.repository.ts        # TripVehicle + VehicleSeat queries
  services/vehicle.service.ts               # Layout CRUD, seat operations
  controllers/vehicle.controller.ts         # Thin controller
  routes/vehicle.routes.ts                  # Organizer + traveler routes

packages/shared/src/
  types/vehicle.types.ts
  validators/vehicle.schema.ts

tests/unit/services/vehicle.service.test.ts
```

### 8.2 Files to Modify

```
apps/api/prisma/schema.prisma        # New models + enums + relations
apps/api/src/config/dependencies.ts  # Wire VehicleRepo → Service → Controller
apps/api/src/server.ts               # Mount vehicle routes
apps/api/src/services/booking.service.ts  # Seat hold/confirm/release in booking flow
apps/api/src/utils/cron-jobs.ts      # Expire held seats
```

### 8.3 Service Methods

```typescript
class VehicleService {
  // Organizer
  createVehicleWithLayout(tripId: string, organizerId: string, dto: CreateVehicleDto): Promise<TripVehicle>
  updateLayout(tripId: string, vehicleId: string, organizerId: string, dto: UpdateVehicleDto): Promise<TripVehicle>
  deleteVehicle(tripId: string, vehicleId: string, organizerId: string): Promise<void>

  // Shared
  getSeatMap(tripId: string): Promise<SeatMapResponse>

  // Booking integration (called by BookingService)
  holdSeats(seatIds: string[], userId: string, bookingId: string): Promise<void>
  confirmSeats(bookingId: string, userId: string, travelerDetails: TravelerSeatAssignment[]): Promise<void>
  releaseSeats(bookingId: string): Promise<void>
}
```

---

## 9. UI Wireframes

### 9.1 Organizer: Seat Layout Builder (Trip Create/Edit — "Vehicle" Tab)

```
┌─────────────────────────────────────────────────────────────────┐
│  CREATE TRIP — Step 3: Vehicle & Seats                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  VEHICLE TEMPLATE                                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │Sedan │ │Ertiga│ │Innova│ │Tempo │ │Bus   │ │Custom│        │
│  │ 🚗   │ │ 🚗   │ │ 🚗   │ │ 🚐   │ │ 🚌   │ │ 🔧   │        │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
│                                                                   │
│  GRID CONTROLS                                                   │
│  Rows: [−] 3 [+]   Left Cols: [−] 1 [+]   Right Cols: [−] 2 [+]│
│  Aisle: [−] Col 1 [+]                                           │
│                                                                   │
│  SEAT MAP BUILDER                          LEGEND                │
│  ┌─────────────────────────────────┐      ┌────────────────────┐ │
│  │                                  │      │ 💺 Seat (click to  │ │
│  │  ┌────┐  ╎  ┌────┐  ┌────┐     │      │    change type)    │ │
│  │  │ 1  │  ╎  │ ✕  │  │ 🛞 │     │      │ 🛞 Driver (locked) │ │
│  │  └────┘  ╎  └────┘  └────┘     │      │ ✕  No Seat (gap)   │ │
│  │                                  │      │ 🔒 Blocked         │ │
│  │  ┌────┐  ╎  ┌────┐  ┌────┐     │      └────────────────────┘ │
│  │  │ 2  │  ╎  │ 3  │  │ 4  │     │                              │
│  │  └────┘  ╎  └────┘  └────┘     │      SUMMARY                │
│  │                                  │      ┌────────────────────┐ │
│  │  ┌────┐  ╎  ┌────┐  ┌────┐     │      │ 5 bookable seats   │ │
│  │  │ 5  │  ╎  │ 6  │  │ 7  │     │      │ 1 driver           │ │
│  │  └────┘  ╎  └────┘  └────┘     │      │ 0 blocked          │ │
│  │                                  │      │ Grid: 3 × 3        │ │
│  └─────────────────────────────────┘      │ (aisle after col 1)│ │
│                                            └────────────────────┘ │
│  CLICK A SEAT TO CHANGE TYPE:                                    │
│  ┌──────────────────┐                                            │
│  │ 💺 Seat           │  ← Dropdown appears on click              │
│  │ ✕  No Seat        │                                            │
│  │ 🔒 Blocked        │                                            │
│  └──────────────────┘                                            │
│                                                                   │
│  ⚠ maxGroupSize will be auto-set to 7 (total bookable seats)    │
│                                                                   │
│  [← Back: Pricing]          [Next: Photos →]                    │
└─────────────────────────────────────────────────────────────────┘
```

**Key interactions:**
- Template buttons load predefined layouts
- Click any non-driver cell → dropdown to change type
- Driver cell shows 🛞, cursor: not-allowed, tooltip: "Driver (locked)"
- +/- buttons adjust grid dimensions (preserves existing cells)
- Summary auto-updates
- `maxGroupSize` synced to SEAT count

---

### 9.2 Traveler: Seat Picker (Booking Page — after traveler count)

```
┌─────────────────────────────────────────────────────────────────┐
│  BOOKING: Goa Beach Getaway                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Number of travelers: [1] [2] [●3] [+]                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  CHOOSE YOUR SEATS                                           │ │
│  │  Select 3 seats for your travelers                           │ │
│  │                                                               │ │
│  │  ┌──── FRONT ────┐                                           │ │
│  │  │                │                                           │ │
│  │  │  ┌────┐  ╎  ┌────┐  ┌────┐                               │ │
│  │  │  │ 1  │  ╎  │ ✕  │  │ 🛞 │   ← Driver                   │ │
│  │  │  └────┘  ╎  └────┘  └────┘                               │ │
│  │  │   🟢      ╎           ⬛                                   │ │
│  │  │                                                            │ │
│  │  │  ┌────┐  ╎  ┌────┐  ┌────┐                               │ │
│  │  │  │ T1 │  ╎  │ 3  │  │ 4  │                               │ │
│  │  │  └────┘  ╎  └────┘  └────┘                               │ │
│  │  │   🔵      ╎   🟢      🔴                                   │ │
│  │  │                                                            │ │
│  │  │  ┌────┐  ╎  ┌────┐  ┌────┐                               │ │
│  │  │  │ T2 │  ╎  │ T3 │  │ 7  │                               │ │
│  │  │  └────┘  ╎  └────┘  └────┘                               │ │
│  │  │   🔵      ╎   🔵      🟢                                   │ │
│  │  │                                                            │ │
│  │  └──── BACK ─────┘                                           │ │
│  │                                                               │ │
│  │  LEGEND:  🟢 Available  🔵 Your Selection  🔴 Booked  ⬛ N/A  │ │
│  │                                                               │ │
│  │  Selected: 3/3 ✓  Seats: 2, 5, 6                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  SEAT ASSIGNMENTS                                            │ │
│  │                                                               │ │
│  │  Seat 2 (Row 2, Left) → Traveler 1 (You)                    │ │
│  │    Name: [Pre-filled]  Phone: [Pre-filled]  Age: [__]       │ │
│  │                                                               │ │
│  │  Seat 5 (Row 3, Left) → Traveler 2                          │ │
│  │    Name: [__________]  Phone: [__________]  Age: [__]       │ │
│  │                                                               │ │
│  │  Seat 6 (Row 3, Middle) → Traveler 3                        │ │
│  │    Name: [__________]  Phone: [__________]  Age: [__]       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  PRICE BREAKDOWN                                                 │
│  3 × ₹4,500 = ₹13,500                                          │
│  Wallet applied: -₹725                                           │
│  ──────────────────                                              │
│  Pay: ₹12,775                                                    │
│                                                                   │
│  [Pay ₹12,775 with Razorpay]                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Key interactions:**
- Seat map appears after traveler count is selected
- Click available seat → assigns to next unassigned traveler (T1, T2...)
- Click selected seat → deselects
- Cannot click booked/blocked/driver seats
- "Selected: 2/3" counter with seat numbers
- Each traveler form shows assigned seat label
- Seats HELD atomically when "Pay" is clicked (30min TTL)
- Payment success → BOOKED; failure/expiry → released

---

### 9.3 Organizer: Seat Map View (Bookings Dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│  GOA BEACH GETAWAY — Seat Map                                    │
│  [Bookings] [Requests] [●Seat Map]                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Innova — 5/7 seats booked                                       │
│                                                                   │
│  ┌─────────────────────────────────┐   ┌────────────────────────┐│
│  │                                  │   │ SEAT DETAILS           ││
│  │  ┌────┐  ┌────┐  ┌────┐        │   │                        ││
│  │  │ P1 │  │ ✕  │  │ 🛞 │        │   │ Seat 1 (1A) — Booked  ││
│  │  │Priy│  │    │  │    │        │   │ ─────────────────────  ││
│  │  └────┘  └────┘  └────┘        │   │ Priya Sharma           ││
│  │   🟣             ⬛             │   │ +91 98765•••••         ││
│  │                                  │   │ Age: 26, Female        ││
│  │  ┌────┐  ┌────┐  ┌────┐        │   │ Booking: #TRP-2025-084 ││
│  │  │ R2 │  │ A3 │  │ S4 │        │   │ Paid: ₹4,500           ││
│  │  │Rahu│  │Amit│  │Sneh│        │   │                        ││
│  │  └────┘  └────┘  └────┘        │   │ [View Full Booking →]  ││
│  │   🟣      🟣      🟣            │   │                        ││
│  │                                  │   └────────────────────────┘│
│  │  ┌────┐  ┌────┐  ┌────┐        │                              │
│  │  │ V5 │  │ 6  │  │ 7  │        │   SUMMARY                   │
│  │  │Vika│  │    │  │    │        │   ┌────────────────────────┐ │
│  │  └────┘  └────┘  └────┘        │   │ Total: 7 seats         │ │
│  │   🟣      🟢      🟢            │   │ Booked: 5 (71%)        │ │
│  │                                  │   │ Available: 2           │ │
│  └─────────────────────────────────┘   │ Held: 0                │ │
│                                         │ Revenue: ₹22,500       │ │
│  🟣 Booked  🟢 Available  🟡 Held       └────────────────────────┘ │
│  ⬛ N/A     🔒 Blocked                                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Key interactions:**
- Click booked seat → side panel shows traveler details
- Booked seats show first 4 chars of traveler name
- Held seats show countdown timer
- Organizer can block/unblock available seats

---

### 9.4 Mobile Seat Picker (375px)

```
┌───────────────────────┐
│ CHOOSE YOUR SEATS     │
│ Select 2 more seats   │
│                       │
│ ┌────────────────────┐│
│ │  ← scroll →        ││
│ │                    ││
│ │ ┌──┐ ╎ ┌──┐ ┌──┐  ││
│ │ │ 1│ ╎ │✕ │ │🛞│  ││
│ │ └──┘ ╎ └──┘ └──┘  ││
│ │                    ││
│ │ ┌──┐ ╎ ┌──┐ ┌──┐  ││
│ │ │T1│ ╎ │ 3│ │ 4│  ││
│ │ └──┘ ╎ └──┘ └──┘  ││
│ │                    ││
│ │ ┌──┐ ╎ ┌──┐ ┌──┐  ││
│ │ │ 5│ ╎ │ 6│ │ 7│  ││
│ │ └──┘ ╎ └──┘ └──┘  ││
│ └────────────────────┘│
│                       │
│ Selected: 1/3         │
│ Seats: 2              │
│                       │
│ [Continue ↓]          │
└───────────────────────┘
```

- Grid horizontally scrollable if wider than viewport
- Cells slightly smaller on mobile (36px vs 44px desktop)
- Sticky bottom bar with selection status

---

## 10. Frontend Components

### 10.1 New Components

```
apps/web/src/components/vehicle/
  seat-layout-builder.tsx          # Organizer: grid builder with template + controls
  seat-layout-builder-controls.tsx # Row/col/aisle +/- controls
  seat-layout-builder-legend.tsx   # Color legend
  seat-layout-builder-summary.tsx  # Seat count summary
  seat-cell-dropdown.tsx           # Type picker dropdown (Seat/Empty/Blocked)
  seat-map-picker.tsx              # Traveler: seat selection grid
  seat-map-picker-legend.tsx       # Picker legend
  seat-map-viewer.tsx              # Organizer: read-only seat map with traveler info
  seat-map-detail-panel.tsx        # Slide-out panel for booked seat details
  seat-cell.tsx                    # Shared: single seat cell (all states)
  seat-grid.tsx                    # Shared: CSS grid with aisle rendering
  vehicle-template-selector.tsx    # Template button row (Sedan, Bus, etc.)
  seat-assignment-list.tsx         # Traveler form with seat labels
```

### 10.2 New Hooks

```
apps/web/src/hooks/
  use-seat-map.ts                  # GET /trips/:tripId/seats
  use-create-vehicle.ts            # POST /trips/:tripId/vehicle
  use-update-vehicle.ts            # PUT /trips/:tripId/vehicle/:id
  use-hold-seats.ts                # POST /bookings/:bookingId/seats
```

### 10.3 Query Keys

```typescript
// lib/query-keys.ts
export const vehicleKeys = {
  all: ['vehicle'] as const,
  seatMap: (tripId: string) => [...vehicleKeys.all, 'seat-map', tripId] as const,
  vehicle: (tripId: string) => [...vehicleKeys.all, 'vehicle', tripId] as const,
}
```

---

## 11. Integration with Existing Booking Flow

### Current Flow (count-based):
```
Select numTravelers → Fill details → Pay → Confirm
```

### New Flow (seat-based, when seatSelectionEnabled):
```
Select numTravelers → Pick seats on map → Fill details (with seat labels) → Pay → Confirm
                                          ↑
                              Seats HELD on "Pay" click
                              Released on fail/expiry
```

### BookingService Changes:

```typescript
// BookingService.createBooking() — modified
async createBooking(dto: CreateBookingDto) {
  return this.prisma.$transaction(async (tx) => {
    // ... existing validation (trip, seats, deadline, etc.) ...

    // NEW: If seat selection enabled, validate + hold seats
    if (trip.seatSelectionEnabled && dto.seatIds?.length) {
      if (dto.seatIds.length !== dto.numTravelers) {
        throw new ValidationError('Must select exactly one seat per traveler')
      }
      await this.vehicleService.holdSeats(dto.seatIds, userId, booking.id)
    }

    // ... existing: create Razorpay order, return booking ...
  })
}

// BookingService.confirmBooking() — modified
async confirmBooking(bookingId: string) {
  return this.prisma.$transaction(async (tx) => {
    // ... existing: atomic seat increment + status change ...

    // NEW: Confirm held seats → BOOKED
    if (booking.trip.seatSelectionEnabled) {
      await this.vehicleService.confirmSeats(bookingId, userId, travelerAssignments)
    }
  })
}

// BookingService.cancelBooking() — modified
async cancelBooking(bookingId: string) {
  // ... existing: cancel + refund logic ...

  // NEW: Release all seats for this booking
  if (booking.trip.seatSelectionEnabled) {
    await this.vehicleService.releaseSeats(bookingId)
  }
}
```

---

## 12. Implementation Order

| Phase | Scope | Effort |
|-------|-------|--------|
| **Phase 1** | DB migration + shared types + validators | 1 day |
| **Phase 2** | VehicleRepository + VehicleService + tests (TDD) | 2 days |
| **Phase 3** | VehicleController + routes + DI wiring | 0.5 day |
| **Phase 4** | Modify BookingService for seat hold/confirm/release + tests | 1 day |
| **Phase 5** | Cron: expire held seats | 0.5 day |
| **Phase 6** | FE: Seat layout builder (organizer trip form) | 2 days |
| **Phase 7** | FE: Seat picker (booking page) | 2 days |
| **Phase 8** | FE: Seat map viewer (organizer dashboard) | 1 day |
| **Phase 9** | Integration tests + edge cases | 1 day |

**Total: ~11 days**

---

## 13. Edge Cases & Rules

| Case | Handling |
|------|----------|
| Organizer edits layout after bookings exist | Block layout changes if any seats are BOOKED or HELD. Allow only if all seats AVAILABLE. |
| Traveler selects seat that gets booked by another user | Atomic SQL — `holdSeats` fails with ConflictError. FE refetches seat map and shows updated availability. |
| Payment fails after seats held | Seats released on booking cancel/expiry. Cron also cleans up stale holds. |
| Organizer deletes vehicle | Only allowed if no BOOKED seats. HELD seats are force-released. |
| Trip with `seatSelectionEnabled = false` | Legacy count-based flow. No seat map UI. No VehicleSeat rows. |
| numTravelers changes after seat selection | Clear seat selection, user must re-pick. |
| Multi-vehicle trip (Phase 2) | Traveler picks vehicle first, then seats within that vehicle. |
| Premium seat pricing (Phase 2) | `priceTier` + `priceOverride` on VehicleSeat. Price breakdown shows per-seat pricing. |

---

*Last updated: 2026-05-11*
