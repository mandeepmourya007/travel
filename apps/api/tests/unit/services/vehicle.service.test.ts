/**
 * FEATURE BRIEF: Vehicle Seat Layout
 * ==================================
 * 1. What:      Organizers define vehicle seat layouts for trips; travelers pick specific seats during booking.
 * 2. Who:       Organizer (create/update/delete layout), Traveler (view seat map, hold seats), Admin (view).
 * 3. Why:       Enables seat-specific booking (window/aisle), visual seat selection like RedBus/AbhiBus.
 *
 * 4. API Endpoints:
 *    POST   /api/v1/trips/:tripId/vehicle       — Create vehicle with layout
 *    PUT    /api/v1/trips/:tripId/vehicle/:id    — Update layout
 *    GET    /api/v1/trips/:tripId/vehicle        — Get vehicle(s) for trip
 *    DELETE /api/v1/trips/:tripId/vehicle/:id    — Remove vehicle
 *    GET    /api/v1/trips/:tripId/seats          — Get seat map (traveler view)
 *    POST   /api/v1/trips/:tripId/seats/hold     — Hold seats for booking
 *
 * 5. DB Tables:  TripVehicle, VehicleSeat, Trip (seatSelectionEnabled), Booking, TravelerDetail
 * 6. Validations: Exactly 1 DRIVER, at least 1 SEAT, grid bounds, driver at driverPos, no booked seats for layout edit
 * 7. Error Cases: NotFound (trip/vehicle), Forbidden (not owner), Validation (bad layout), Conflict (seats taken)
 * 8. Side Effects: Trip.maxGroupSize auto-set from SEAT count, Trip.seatSelectionEnabled toggled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VehicleService } from '@/services/vehicle.service'
import type { SeatCellTypeConst } from '@shared/constants/vehicle'

// ── Mock data ────────────────────────────────────────

const MOCK_TRIP_ID = 'trip_1'
const MOCK_ORGANIZER_PROFILE_ID = 'org_profile_1'
const MOCK_USER_ID = 'user_1'
const MOCK_VEHICLE_ID = 'vehicle_1'
const MOCK_BOOKING_ID = 'booking_1'

function createMockLayout(): SeatCellTypeConst[][] {
  return [
    ['SEAT', 'EMPTY', 'DRIVER'],
    ['SEAT', 'SEAT', 'SEAT'],
    ['SEAT', 'SEAT', 'SEAT'],
  ]
}

function createMockVehicle(overrides?: Record<string, unknown>) {
  return {
    id: MOCK_VEHICLE_ID,
    tripId: MOCK_TRIP_ID,
    label: 'Main Vehicle',
    vehicleType: 'innova',
    sortOrder: 0,
    rows: 3,
    cols: 3,
    aisleAfterCol: 0,
    driverRow: 0,
    driverCol: 2,
    layout: createMockLayout(),
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    seats: [],
    ...overrides,
  }
}

function createMockTrip(overrides?: Record<string, unknown>) {
  return {
    id: MOCK_TRIP_ID,
    organizerId: MOCK_ORGANIZER_PROFILE_ID,
    status: 'ACTIVE',
    maxGroupSize: 20,
    currentBookings: 0,
    seatSelectionEnabled: false,
    isDeleted: false,
    ...overrides,
  }
}

function createMockSeat(overrides?: Record<string, unknown>) {
  return {
    id: 'seat_1',
    tripVehicleId: MOCK_VEHICLE_ID,
    row: 1,
    col: 0,
    seatLabel: '1A',
    seatNumber: 1,
    status: 'AVAILABLE',
    bookingId: null,
    travelerDetailId: null,
    heldAt: null,
    heldUntil: null,
    heldByUserId: null,
    isDeleted: false,
    ...overrides,
  }
}

// ── Mock repos ───────────────────────────────────────

function createMockVehicleRepo() {
  return {
    findByTripId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    createSeats: vi.fn(),
    deleteSeatsForVehicle: vi.fn(),
    findSeatsByVehicleId: vi.fn(),
    findSeatsByIds: vi.fn(),
    holdSeats: vi.fn(),
    confirmSeats: vi.fn(),
    releaseSeats: vi.fn(),
    releaseSeatsByBookingId: vi.fn(),
    countBookedSeats: vi.fn(),
    assignTravelerToSeat: vi.fn(),
    expireHeldSeats: vi.fn(),
  }
}

function createMockTripRepo() {
  return {
    findById: vi.fn(),
    update: vi.fn(),
  }
}

function createMockOrganizerProfileRepo() {
  return {
    findByUserId: vi.fn(),
  }
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
}

// ── Test Suite ───────────────────────────────────────

describe('VehicleService', () => {
  let service: VehicleService
  let mockVehicleRepo: ReturnType<typeof createMockVehicleRepo>
  let mockTripRepo: ReturnType<typeof createMockTripRepo>
  let mockOrgProfileRepo: ReturnType<typeof createMockOrganizerProfileRepo>

  beforeEach(() => {
    vi.clearAllMocks()
    mockVehicleRepo = createMockVehicleRepo()
    mockTripRepo = createMockTripRepo()
    mockOrgProfileRepo = createMockOrganizerProfileRepo()
    // Default: user resolves to organizer profile that owns the trip
    mockOrgProfileRepo.findByUserId.mockResolvedValue({ id: MOCK_ORGANIZER_PROFILE_ID })
    service = new VehicleService(mockVehicleRepo as any, mockTripRepo as any, mockOrgProfileRepo as any, mockLogger as any)
  })

  // ── createVehicle ──────────────────────────────────

  describe('createVehicle', () => {
    const dto = {
      label: 'Main Vehicle',
      vehicleType: 'innova' as const,
      layoutConfig: { rows: 3, cols: 3, aisleAfterCol: 0, driverPos: [0, 2] as [number, number] },
      layout: createMockLayout(),
    }

    it('should create vehicle with seats and enable seat selection on trip', async () => {
      const mockSeats = Array.from({ length: 7 }, (_, i) => ({ id: `seat_${i}`, isDeleted: false }))
      mockTripRepo.findById.mockResolvedValue(createMockTrip())
      mockVehicleRepo.findByTripId
        .mockResolvedValueOnce([])                                          // existing count
        .mockResolvedValueOnce([createMockVehicle({ seats: mockSeats })])   // recalcTripSeats
      mockVehicleRepo.create.mockResolvedValue(createMockVehicle())
      mockVehicleRepo.createSeats.mockResolvedValue([])
      mockTripRepo.update.mockResolvedValue({})

      const result = await service.createVehicle(MOCK_TRIP_ID, MOCK_USER_ID, dto)

      expect(result.id).toBe(MOCK_VEHICLE_ID)
      expect(mockVehicleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: MOCK_TRIP_ID,
          vehicleType: 'innova',
          rows: 3,
          cols: 3,
          driverCol: 2,
        }),
      )
      // Should create seats for each SEAT cell (7 SEAT cells in the mock layout)
      expect(mockVehicleRepo.createSeats).toHaveBeenCalled()
      const seatsArg = mockVehicleRepo.createSeats.mock.calls[0][1]
      expect(seatsArg).toHaveLength(7)
      // Should enable seat selection and set maxGroupSize
      expect(mockTripRepo.update).toHaveBeenCalledWith(
        MOCK_TRIP_ID,
        expect.objectContaining({
          seatSelectionEnabled: true,
          maxGroupSize: 7,
        }),
      )
    })

    it('should throw NotFoundError when trip does not exist', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(service.createVehicle(MOCK_TRIP_ID, MOCK_USER_ID, dto))
        .rejects.toThrow('Trip not found')
    })

    it('should throw ForbiddenError when user is not the trip organizer', async () => {
      mockOrgProfileRepo.findByUserId.mockResolvedValue({ id: 'different_org_profile' })
      mockTripRepo.findById.mockResolvedValue(createMockTrip())

      await expect(service.createVehicle(MOCK_TRIP_ID, MOCK_USER_ID, dto))
        .rejects.toThrow('You can only manage vehicles for your own trips')
    })

    it('should throw ForbiddenError when user has no organizer profile', async () => {
      mockOrgProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(service.createVehicle(MOCK_TRIP_ID, MOCK_USER_ID, dto))
        .rejects.toThrow('Organizer profile not found')
    })

    it('should set correct sortOrder when trip already has vehicles (multi-vehicle)', async () => {
      const mockSeats = Array.from({ length: 7 }, (_, i) => ({ id: `seat_${i}`, isDeleted: false }))
      mockTripRepo.findById.mockResolvedValue(createMockTrip())
      mockVehicleRepo.findByTripId
        .mockResolvedValueOnce([createMockVehicle()])                                       // existing count = 1
        .mockResolvedValueOnce([createMockVehicle(), createMockVehicle({ seats: mockSeats })]) // recalcTripSeats
      mockVehicleRepo.create.mockResolvedValue(createMockVehicle())
      mockVehicleRepo.createSeats.mockResolvedValue([])
      mockTripRepo.update.mockResolvedValue({})

      await service.createVehicle(MOCK_TRIP_ID, MOCK_USER_ID, dto)

      expect(mockVehicleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 1 }),
      )
    })

    it('should log vehicle creation', async () => {
      mockTripRepo.findById.mockResolvedValue(createMockTrip())
      mockVehicleRepo.findByTripId.mockResolvedValue([])
      mockVehicleRepo.create.mockResolvedValue(createMockVehicle())
      mockVehicleRepo.createSeats.mockResolvedValue([])
      mockTripRepo.update.mockResolvedValue({})

      await service.createVehicle(MOCK_TRIP_ID, MOCK_USER_ID, dto)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ tripId: MOCK_TRIP_ID, vehicleId: MOCK_VEHICLE_ID }),
        expect.stringContaining('Vehicle created'),
      )
    })
  })

  // ── updateVehicle ──────────────────────────────────

  describe('updateVehicle', () => {
    const updateDto = {
      label: 'Updated Vehicle',
      vehicleType: 'tempo' as const,
      layoutConfig: { rows: 3, cols: 3, aisleAfterCol: 0, driverPos: [0, 2] as [number, number] },
      layout: createMockLayout(),
    }

    it('should update vehicle layout when no seats are booked', async () => {
      const mockSeats = Array.from({ length: 7 }, (_, i) => ({ id: `seat_${i}`, isDeleted: false }))
      mockTripRepo.findById.mockResolvedValue(createMockTrip())
      mockVehicleRepo.findById.mockResolvedValue(createMockVehicle())
      mockVehicleRepo.countBookedSeats.mockResolvedValue(0)
      mockVehicleRepo.deleteSeatsForVehicle.mockResolvedValue({})
      mockVehicleRepo.update.mockResolvedValue(createMockVehicle({ label: 'Updated Vehicle' }))
      mockVehicleRepo.createSeats.mockResolvedValue([])
      mockVehicleRepo.findByTripId.mockResolvedValue([createMockVehicle({ seats: mockSeats })])
      mockTripRepo.update.mockResolvedValue({})

      const result = await service.updateVehicle(MOCK_TRIP_ID, MOCK_VEHICLE_ID, MOCK_USER_ID, updateDto)

      expect(result.label).toBe('Updated Vehicle')
      expect(mockVehicleRepo.deleteSeatsForVehicle).toHaveBeenCalledWith(MOCK_VEHICLE_ID)
      expect(mockVehicleRepo.createSeats).toHaveBeenCalled()
    })

    it('should throw NotFoundError when vehicle does not exist', async () => {
      mockTripRepo.findById.mockResolvedValue(createMockTrip())
      mockVehicleRepo.findById.mockResolvedValue(null)

      await expect(service.updateVehicle(MOCK_TRIP_ID, MOCK_VEHICLE_ID, MOCK_USER_ID, updateDto))
        .rejects.toThrow('Vehicle not found')
    })

    it('should throw ForbiddenError when user is not the trip organizer', async () => {
      mockOrgProfileRepo.findByUserId.mockResolvedValue({ id: 'different_org_profile' })
      mockTripRepo.findById.mockResolvedValue(createMockTrip())

      await expect(service.updateVehicle(MOCK_TRIP_ID, MOCK_VEHICLE_ID, MOCK_USER_ID, updateDto))
        .rejects.toThrow('You can only manage vehicles for your own trips')
    })

    it('should throw ValidationError when seats are booked', async () => {
      mockTripRepo.findById.mockResolvedValue(createMockTrip())
      mockVehicleRepo.findById.mockResolvedValue(createMockVehicle())
      mockVehicleRepo.countBookedSeats.mockResolvedValue(3)

      await expect(service.updateVehicle(MOCK_TRIP_ID, MOCK_VEHICLE_ID, MOCK_USER_ID, updateDto))
        .rejects.toThrow('Cannot modify layout while seats are booked')
    })

    it('should throw ValidationError when vehicle belongs to a different trip', async () => {
      mockTripRepo.findById.mockResolvedValue(createMockTrip())
      mockVehicleRepo.findById.mockResolvedValue(createMockVehicle({ tripId: 'other_trip' }))

      await expect(service.updateVehicle(MOCK_TRIP_ID, MOCK_VEHICLE_ID, MOCK_USER_ID, updateDto))
        .rejects.toThrow('Vehicle does not belong to this trip')
    })
  })

  // ── deleteVehicle ──────────────────────────────────

  describe('deleteVehicle', () => {
    it('should delete vehicle and disable seat selection on trip', async () => {
      mockTripRepo.findById.mockResolvedValue(createMockTrip({ seatSelectionEnabled: true }))
      mockVehicleRepo.findById.mockResolvedValue(createMockVehicle())
      mockVehicleRepo.countBookedSeats.mockResolvedValue(0)
      mockVehicleRepo.softDelete.mockResolvedValue({})
      mockVehicleRepo.findByTripId.mockResolvedValue([])   // no vehicles left after delete
      mockTripRepo.update.mockResolvedValue({})

      await service.deleteVehicle(MOCK_TRIP_ID, MOCK_VEHICLE_ID, MOCK_USER_ID)

      expect(mockVehicleRepo.softDelete).toHaveBeenCalledWith(MOCK_VEHICLE_ID)
      expect(mockTripRepo.update).toHaveBeenCalledWith(
        MOCK_TRIP_ID,
        expect.objectContaining({ seatSelectionEnabled: false }),
      )
    })

    it('should throw ValidationError when seats are booked', async () => {
      mockTripRepo.findById.mockResolvedValue(createMockTrip())
      mockVehicleRepo.findById.mockResolvedValue(createMockVehicle())
      mockVehicleRepo.countBookedSeats.mockResolvedValue(2)

      await expect(service.deleteVehicle(MOCK_TRIP_ID, MOCK_VEHICLE_ID, MOCK_USER_ID))
        .rejects.toThrow('Cannot delete vehicle while seats are booked')
    })

    it('should throw NotFoundError when vehicle does not exist', async () => {
      mockTripRepo.findById.mockResolvedValue(createMockTrip())
      mockVehicleRepo.findById.mockResolvedValue(null)

      await expect(service.deleteVehicle(MOCK_TRIP_ID, MOCK_VEHICLE_ID, MOCK_USER_ID))
        .rejects.toThrow('Vehicle not found')
    })
  })

  // ── getSeatMap ─────────────────────────────────────

  describe('getSeatMap', () => {
    it('should return seat map with summary for a trip', async () => {
      const seats = [
        createMockSeat({ id: 's1', status: 'AVAILABLE', seatNumber: 1 }),
        createMockSeat({ id: 's2', status: 'BOOKED', seatNumber: 2 }),
        createMockSeat({ id: 's3', status: 'HELD', seatNumber: 3 }),
        createMockSeat({ id: 's4', status: 'AVAILABLE', seatNumber: 4 }),
        createMockSeat({ id: 's5', status: 'BLOCKED', seatNumber: 5 }),
      ]
      const vehicle = createMockVehicle({ seats })
      mockVehicleRepo.findByTripId.mockResolvedValue([vehicle])

      const result = await service.getSeatMap(MOCK_TRIP_ID)

      expect(result.vehicles).toHaveLength(1)
      const first = result.vehicles[0]
      expect(first.vehicle.id).toBe(MOCK_VEHICLE_ID)
      expect(first.seats).toHaveLength(5)
      expect(first.summary.total).toBe(5)
      expect(first.summary.available).toBe(2)
      expect(first.summary.booked).toBe(1)
      expect(first.summary.held).toBe(1)
      expect(first.summary.blocked).toBe(1)
    })

    it('should throw NotFoundError when trip has no vehicle', async () => {
      mockVehicleRepo.findByTripId.mockResolvedValue([])

      await expect(service.getSeatMap(MOCK_TRIP_ID))
        .rejects.toThrow('No vehicle configured for this trip')
    })
  })

  // ── getOrganizerSeatMap ────────────────────────────

  describe('getOrganizerSeatMap', () => {
    it('should return seat map with traveler names for booked seats', async () => {
      const bookedSeat = createMockSeat({
        id: 's2',
        status: 'BOOKED',
        seatNumber: 2,
        booking: { bookingRef: 'TRP-2025-0001' },
        travelerDetail: { name: 'Priya Sharma' },
      })
      const vehicle = createMockVehicle({ seats: [createMockSeat(), bookedSeat] })
      mockTripRepo.findById.mockResolvedValue(createMockTrip())
      mockVehicleRepo.findByTripId.mockResolvedValue([vehicle])

      const result = await service.getOrganizerSeatMap(MOCK_TRIP_ID, MOCK_USER_ID)

      expect(result.vehicles).toHaveLength(1)
      const booked = result.vehicles[0].seats.find((s) => s.status === 'BOOKED')
      expect(booked?.travelerName).toBe('Priya Sharma')
      expect(booked?.bookingRef).toBe('TRP-2025-0001')
    })

    it('should throw ForbiddenError when user is not the trip organizer', async () => {
      mockOrgProfileRepo.findByUserId.mockResolvedValue({ id: 'different_org_profile' })
      mockTripRepo.findById.mockResolvedValue(createMockTrip())

      await expect(service.getOrganizerSeatMap(MOCK_TRIP_ID, MOCK_USER_ID))
        .rejects.toThrow('You can only manage vehicles for your own trips')
    })
  })

  // ── holdSeats ──────────────────────────────────────

  describe('holdSeats', () => {
    const seatIds = ['s1', 's2', 's3']

    it('should hold seats atomically for a user', async () => {
      mockVehicleRepo.holdSeats.mockResolvedValue(3)

      await service.holdSeats(seatIds, MOCK_USER_ID, MOCK_BOOKING_ID)

      expect(mockVehicleRepo.holdSeats).toHaveBeenCalledWith(
        seatIds,
        MOCK_USER_ID,
        MOCK_BOOKING_ID,
        expect.any(Number),
      )
    })

    it('should throw ConflictError when some seats are no longer available', async () => {
      mockVehicleRepo.holdSeats.mockResolvedValue(2) // Only 2 of 3 updated

      await expect(service.holdSeats(seatIds, MOCK_USER_ID, MOCK_BOOKING_ID))
        .rejects.toThrow('One or more selected seats are no longer available')
    })

    it('should throw ValidationError for empty seat array', async () => {
      await expect(service.holdSeats([], MOCK_USER_ID, MOCK_BOOKING_ID))
        .rejects.toThrow('No seats provided')
    })
  })

  // ── confirmSeats ───────────────────────────────────

  describe('confirmSeats', () => {
    it('should confirm held seats and assign travelers', async () => {
      const assignments = [
        { seatId: 's1', travelerDetailId: 'td1' },
        { seatId: 's2', travelerDetailId: 'td2' },
      ]
      mockVehicleRepo.confirmSeats.mockResolvedValue(2)
      mockVehicleRepo.assignTravelerToSeat.mockResolvedValue({})

      await service.confirmSeats(MOCK_BOOKING_ID, MOCK_USER_ID, assignments)

      expect(mockVehicleRepo.confirmSeats).toHaveBeenCalledWith(MOCK_BOOKING_ID, MOCK_USER_ID)
      expect(mockVehicleRepo.assignTravelerToSeat).toHaveBeenCalledTimes(2)
    })

    it('should throw ConflictError when no seats match for confirmation', async () => {
      mockVehicleRepo.confirmSeats.mockResolvedValue(0)

      await expect(service.confirmSeats(MOCK_BOOKING_ID, MOCK_USER_ID, []))
        .rejects.toThrow('No held seats found for this booking')
    })
  })

  // ── releaseSeats ───────────────────────────────────

  describe('releaseSeats', () => {
    it('should release all seats for a booking', async () => {
      mockVehicleRepo.releaseSeatsByBookingId.mockResolvedValue(3)

      await service.releaseSeats(MOCK_BOOKING_ID)

      expect(mockVehicleRepo.releaseSeatsByBookingId).toHaveBeenCalledWith(MOCK_BOOKING_ID)
    })

    it('should not throw when no seats to release (idempotent)', async () => {
      mockVehicleRepo.releaseSeatsByBookingId.mockResolvedValue(0)

      await expect(service.releaseSeats(MOCK_BOOKING_ID)).resolves.toBeUndefined()
    })

    it('should log when seats are released', async () => {
      mockVehicleRepo.releaseSeatsByBookingId.mockResolvedValue(2)

      await service.releaseSeats(MOCK_BOOKING_ID)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: MOCK_BOOKING_ID, releasedCount: 2 }),
        expect.stringContaining('Released seats'),
      )
    })
  })

  // ── expireHeldSeats ────────────────────────────────

  describe('expireHeldSeats', () => {
    it('should expire seats past their hold window', async () => {
      mockVehicleRepo.expireHeldSeats.mockResolvedValue(5)

      const count = await service.expireHeldSeats()

      expect(count).toBe(5)
      expect(mockVehicleRepo.expireHeldSeats).toHaveBeenCalled()
    })

    it('should return 0 when no seats to expire', async () => {
      mockVehicleRepo.expireHeldSeats.mockResolvedValue(0)

      const count = await service.expireHeldSeats()

      expect(count).toBe(0)
    })
  })

  // ── generateSeatLabel ──────────────────────────────

  describe('generateSeatLabel (private, tested via createVehicle)', () => {
    it('should generate sequential seat labels from layout', async () => {
      const trip = createMockTrip()
      mockTripRepo.findById.mockResolvedValue(trip)
      mockVehicleRepo.findByTripId.mockResolvedValue([])
      mockVehicleRepo.create.mockResolvedValue(createMockVehicle())
      mockVehicleRepo.createSeats.mockResolvedValue([])
      mockTripRepo.update.mockResolvedValue({})

      const layout: SeatCellTypeConst[][] = [
        ['SEAT', 'EMPTY', 'DRIVER'],
        ['SEAT', 'SEAT', 'SEAT'],
      ]

      await service.createVehicle(MOCK_TRIP_ID, MOCK_USER_ID, {
        label: 'Test',
        vehicleType: 'innova',
        layoutConfig: { rows: 2, cols: 3, aisleAfterCol: 0, driverPos: [0, 2] },
        layout,
      })

      const seatsArg = mockVehicleRepo.createSeats.mock.calls[0][1]
      // Row 0: 1 SEAT => seatNumber 1
      // Row 1: 3 SEAT => seatNumbers 2, 3, 4
      expect(seatsArg).toHaveLength(4)
      expect(seatsArg[0]).toMatchObject({ row: 0, col: 0, seatNumber: 1 })
      expect(seatsArg[1]).toMatchObject({ row: 1, col: 0, seatNumber: 2 })
      expect(seatsArg[2]).toMatchObject({ row: 1, col: 1, seatNumber: 3 })
      expect(seatsArg[3]).toMatchObject({ row: 1, col: 2, seatNumber: 4 })
    })
  })
})
