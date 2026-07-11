import type { Logger } from 'pino'
import type { CreateVehicleDto, UpdateVehicleDto, SeatMapResponse, MultiVehicleSeatMapResponse, VehicleSeatItem, TravelerSeatAssignment, OrganizerVehicleListItem } from '@shared/types/vehicle.types'
import type { SeatCellTypeConst } from '@shared/constants/vehicle'
import { SEAT_STATUS, SEAT_CELL_TYPE } from '@shared/constants'
import { VehicleRepository } from '../repositories/vehicle.repository'
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../errors/app-error'
import { SEAT_HOLD_MINUTES, BOOKING_ERROR_CODE } from '../utils/constants'

/** Inferred type for a single vehicle row returned by findByTripId (with seats relation). */
type VehicleWithSeats = Awaited<ReturnType<VehicleRepository['findByTripId']>>[number]

/** Minimal trip repo interface consumed by VehicleService */
interface TripRepoLike {
  findById(id: string): Promise<(TripForVehicle & Record<string, unknown>) | null>
  update(id: string, data: Record<string, unknown>): Promise<unknown>
}

/** Minimal organizer profile repo interface */
interface OrganizerProfileRepoLike {
  findByUserId(userId: string): Promise<{ id: string } | null>
}

/**
 * Business logic for vehicle seat layout management.
 *
 * Responsibilities:
 * - Create / update / delete vehicle layouts (organizer)
 * - Generate seat records from layout grid
 * - Hold / confirm / release seats (booking lifecycle)
 * - Expire stale seat holds (cron)
 *
 * All DB access is delegated to VehicleRepository.
 */
export class VehicleService {
  constructor(
    private vehicleRepo: VehicleRepository,
    private tripRepo: TripRepoLike,
    private organizerProfileRepo: OrganizerProfileRepoLike,
    private logger: Logger,
  ) {}

  // ── Create Vehicle ─────────────────────────────────

  /**
   * Creates a vehicle with seat layout for a trip.
   *
   * Flow:
   * 1. Validate trip exists and user is organizer
   * 2. Create vehicle record (sortOrder based on existing count)
   * 3. Generate seat records from layout (SEAT cells only)
   * 4. Update trip: set seatSelectionEnabled=true, recalculate maxGroupSize
   *
   * @throws NotFoundError — trip doesn't exist
   * @throws ForbiddenError — user is not the trip organizer
   */
  async createVehicle(tripId: string, userId: string, dto: CreateVehicleDto) {
    await this.resolveOrganizerAndTrip(userId, tripId)

    const existing = await this.vehicleRepo.findByTripId(tripId)

    const { layoutConfig, layout } = dto
    const vehicle = await this.vehicleRepo.create({
      tripId,
      label: dto.label ?? `Vehicle ${existing.length + 1}`,
      vehicleType: dto.vehicleType,
      sortOrder: existing.length,
      rows: layoutConfig.rows,
      cols: layoutConfig.cols,
      aisleAfterCol: layoutConfig.aisleAfterCol,
      driverRow: layoutConfig.driverPos[0],
      driverCol: layoutConfig.driverPos[1],
      layout,
      photos: dto.photos ?? [],
    })

    // Generate seat records from layout
    const seats = this.generateSeatsFromLayout(vehicle.id, layout)
    await this.vehicleRepo.createSeats(vehicle.id, seats)

    // Recalculate total seats across all vehicles and sync trip
    await this.recalcTripSeats(tripId)

    this.logger.info(
      { tripId, vehicleId: vehicle.id, seatCount: seats.length },
      'Vehicle created with seat layout',
    )

    return vehicle
  }

  // ── Update Vehicle ─────────────────────────────────

  /**
   * Updates vehicle layout.
   *
   * Precondition: No booked/held seats — layout changes would invalidate bookings.
   *
   * @throws NotFoundError — trip or vehicle not found
   * @throws ForbiddenError — user is not the trip organizer
   * @throws ValidationError — seats are booked, or vehicle doesn't belong to trip
   */
  async updateVehicle(tripId: string, vehicleId: string, userId: string, dto: UpdateVehicleDto) {
    await this.resolveOrganizerAndTrip(userId, tripId)

    const vehicle = await this.vehicleRepo.findById(vehicleId)
    if (!vehicle) throw new NotFoundError('Vehicle not found')
    if (vehicle.tripId !== tripId) throw new ValidationError('Vehicle does not belong to this trip')

    // Check for booked seats before allowing layout change
    if (dto.layout) {
      const bookedCount = await this.vehicleRepo.countBookedSeats(vehicleId)
      if (bookedCount > 0) throw new ValidationError('Cannot modify layout while seats are booked')

      // Delete old seats and create new ones
      await this.vehicleRepo.deleteSeatsForVehicle(vehicleId)
      const seats = this.generateSeatsFromLayout(vehicleId, dto.layout)
      await this.vehicleRepo.createSeats(vehicleId, seats)

      // Recalculate total seats across all vehicles
      await this.recalcTripSeats(tripId)
    }

    const updateData: Partial<{
      label: string
      vehicleType: string
      photos: string[]
      rows: number
      cols: number
      aisleAfterCol: number | null
      driverRow: number
      driverCol: number
      layout: SeatCellTypeConst[][]
    }> = {}
    if (dto.label !== undefined) updateData.label = dto.label
    if (dto.vehicleType !== undefined) updateData.vehicleType = dto.vehicleType
    if (dto.photos !== undefined) updateData.photos = dto.photos
    if (dto.layoutConfig) {
      updateData.rows = dto.layoutConfig.rows
      updateData.cols = dto.layoutConfig.cols
      updateData.aisleAfterCol = dto.layoutConfig.aisleAfterCol
      updateData.driverRow = dto.layoutConfig.driverPos[0]
      updateData.driverCol = dto.layoutConfig.driverPos[1]
    }
    if (dto.layout) updateData.layout = dto.layout

    const updated = await this.vehicleRepo.update(vehicleId, updateData)

    this.logger.info({ tripId, vehicleId }, 'Vehicle updated')
    return updated
  }

  // ── Delete Vehicle ─────────────────────────────────

  /**
   * Soft-deletes a vehicle and disables seat selection on the trip.
   *
   * @throws NotFoundError — trip or vehicle not found
   * @throws ForbiddenError — user is not the trip organizer
   * @throws ValidationError — seats are booked
   */
  async deleteVehicle(tripId: string, vehicleId: string, userId: string) {
    await this.resolveOrganizerAndTrip(userId, tripId)

    const vehicle = await this.vehicleRepo.findById(vehicleId)
    if (!vehicle) throw new NotFoundError('Vehicle not found')
    if (vehicle.tripId !== tripId) throw new ValidationError('Vehicle does not belong to this trip')

    const bookedCount = await this.vehicleRepo.countBookedSeats(vehicleId)
    if (bookedCount > 0) throw new ValidationError('Cannot delete vehicle while seats are booked')

    await this.vehicleRepo.softDelete(vehicleId)

    // Recalculate — may disable seat selection if no vehicles left
    await this.recalcTripSeats(tripId)

    this.logger.info({ tripId, vehicleId }, 'Vehicle deleted')
  }

  // ── Get Seat Map (Traveler) ────────────────────────

  /**
   * Returns the seat map for a trip — used by travelers to view/select seats.
   *
   * Strips private info (traveler names, booking refs) from the response.
   *
   * @throws NotFoundError — no vehicle configured for the trip
   */
  async getSeatMap(tripId: string): Promise<MultiVehicleSeatMapResponse> {
    const vehicles = await this.vehicleRepo.findByTripId(tripId)
    if (vehicles.length === 0) throw new NotFoundError('Vehicle for this trip')
    return { vehicles: vehicles.map((v) => this.mapVehicleToSeatMapResponse(v)) }
  }

  // ── Get Seat Map (Organizer) ───────────────────────

  /**
   * Returns the full seat map including traveler names and booking refs.
   * Returns empty vehicles array when no vehicle is configured (organizer needs empty state).
   *
   * @throws NotFoundError — trip not found
   * @throws ForbiddenError — user is not the trip organizer
   */
  async getOrganizerSeatMap(tripId: string, userId: string): Promise<MultiVehicleSeatMapResponse> {
    await this.resolveOrganizerAndTrip(userId, tripId)

    const vehicles = await this.vehicleRepo.findByTripId(tripId)
    if (vehicles.length === 0) return { vehicles: [] }
    return { vehicles: vehicles.map((v) => this.mapVehicleToSeatMapResponse(v, { includePrivate: true })) }
  }

  // ── Get All Vehicles (Organizer) ──────────────────

  /**
   * Returns all vehicles for a trip as a lightweight list.
   * Used by the trip form to populate the multi-vehicle editor on edit.
   *
   * Seat counts are fetched via a single groupBy instead of loading full seat
   * rows with booking/travelerDetail joins just to call .filter().length.
   */
  async getAllVehicles(tripId: string, userId: string): Promise<OrganizerVehicleListItem[]> {
    await this.resolveOrganizerAndTrip(userId, tripId)

    const [vehicles, seatCounts] = await Promise.all([
      this.vehicleRepo.findByTripId(tripId),
      this.vehicleRepo.countSeatsByTripId(tripId),
    ])

    return vehicles.map((v) => ({
      id: v.id,
      label: v.label,
      vehicleType: v.vehicleType,
      sortOrder: v.sortOrder,
      layoutConfig: {
        rows: v.rows,
        cols: v.cols,
        aisleAfterCol: v.aisleAfterCol,
        driverPos: [v.driverRow, v.driverCol] as [number, number],
      },
      layout: v.layout as SeatCellTypeConst[][],
      photos: v.photos ?? [],
      seatCount: seatCounts.get(v.id) ?? 0,
    }))
  }

  // ── Get Booking Seats ─────────────────────────────

  /**
   * Returns seats held/booked for a booking, ordered by seatNumber.
   * Used by BookingService during confirmation to auto-assign travelers.
   */
  async getBookingSeats(bookingId: string) {
    return this.vehicleRepo.findSeatsByBookingId(bookingId)
  }

  // ── Check Seat Availability ───────────────────────

  /**
   * Optimistic pre-check: returns true if ALL requested seats are AVAILABLE.
   * Non-atomic — used before creating Razorpay order to fail fast.
   */
  async checkSeatsAvailable(seatIds: string[]): Promise<boolean> {
    const seats = await this.vehicleRepo.findSeatsByIds(seatIds)
    if (seats.length !== seatIds.length) return false
    return seats.every((s: { status: string }) => s.status === 'AVAILABLE')
  }

  // ── Hold Seats ─────────────────────────────────────

  /**
   * Atomically holds seats for a user during booking.
   *
   * @throws ValidationError — empty seat array
   * @throws ConflictError — one or more seats no longer available
   */
  async holdSeats(seatIds: string[], userId: string, bookingId: string) {
    if (seatIds.length === 0) throw new ValidationError('No seats provided')

    const updatedCount = await this.vehicleRepo.holdSeats(seatIds, userId, bookingId, SEAT_HOLD_MINUTES)
    if (updatedCount < seatIds.length) {
      // Rollback any that were partially held
      await this.vehicleRepo.releaseSeatsByBookingId(bookingId)
      throw new ConflictError('One or more selected seats are no longer available', BOOKING_ERROR_CODE.SEAT_CONFLICT)
    }

    this.logger.info({ seatIds, userId, bookingId }, 'Seats held')
  }

  // ── Confirm Seats ──────────────────────────────────

  /**
   * Transitions held seats to BOOKED and assigns travelers.
   *
   * @throws ConflictError — no held seats found
   */
  async confirmSeats(bookingId: string, userId: string, assignments: TravelerSeatAssignment[]) {
    const confirmedCount = await this.vehicleRepo.confirmSeats(bookingId, userId)
    if (confirmedCount === 0) throw new ConflictError('No held seats found for this booking', 'HOLD_EXPIRED')

    await this.vehicleRepo.batchAssignTravelers(assignments)

    this.logger.info({ bookingId, confirmedCount }, 'Seats confirmed')
  }

  // ── Release Seats ──────────────────────────────────

  /**
   * Releases all seats for a booking (cancel/expire).
   * Idempotent — safe to call even if no seats are held.
   */
  async releaseSeats(bookingId: string) {
    const releasedCount = await this.vehicleRepo.releaseSeatsByBookingId(bookingId)
    if (releasedCount > 0) {
      this.logger.info({ bookingId, releasedCount }, 'Released seats for booking')
    }
  }

  // ── Expire Held Seats (Cron) ───────────────────────

  /**
   * Expires all seats whose hold window has passed.
   * Called by the cron job every minute.
   */
  async expireHeldSeats(): Promise<number> {
    const count = await this.vehicleRepo.expireHeldSeats()
    if (count > 0) {
      this.logger.info({ expiredCount: count }, 'Expired held seats')
    }
    return count
  }

  // ── Private Helpers ────────────────────────────────

  /**
   * Generates seat records from a 2D layout grid.
   * Only SEAT cells become bookable seats. Seats are numbered sequentially (row-major).
   */
  private generateSeatsFromLayout(vehicleId: string, layout: SeatCellTypeConst[][]) {
    const seats: Array<{
      tripVehicleId: string
      row: number
      col: number
      seatLabel: string
      seatNumber: number
    }> = []

    let seatNum = 0
    for (let r = 0; r < layout.length; r++) {
      for (let c = 0; c < layout[r].length; c++) {
        if (layout[r][c] === SEAT_CELL_TYPE.SEAT) {
          seatNum++
          seats.push({
            tripVehicleId: vehicleId,
            row: r,
            col: c,
            seatLabel: `${r + 1}${String.fromCharCode(65 + c)}`, // "1A", "1B", "2A", etc.
            seatNumber: seatNum,
          })
        }
      }
    }

    return seats
  }

  /**
   * Resolves userId → organizerProfile and validates trip ownership.
   * @throws ForbiddenError — organizer profile not found or not trip owner
   * @throws NotFoundError — trip not found
   */
  private async resolveOrganizerAndTrip(userId: string, tripId: string) {
    const [profile, trip] = await Promise.all([
      this.organizerProfileRepo.findByUserId(userId),
      this.tripRepo.findById(tripId),
    ])
    if (!profile) throw new ForbiddenError('Organizer profile not found')
    if (!trip) throw new NotFoundError('Trip not found')
    if (trip.organizerId !== profile.id) throw new ForbiddenError('You can only manage vehicles for your own trips')

    return { trip, organizerId: profile.id }
  }

  /**
   * Shared vehicle → SeatMapResponse mapper used by both getSeatMap and getOrganizerSeatMap.
   *
   * @param includePrivate - when true, includes travelerName + bookingRef (organizer view only).
   *   Keeping this as a flag rather than two separate methods avoids duplicating the
   *   layoutConfig / vehicle block (15 lines) and the summary calculation.
   */
  private mapVehicleToSeatMapResponse(vehicle: VehicleWithSeats, options: { includePrivate?: boolean } = {}): SeatMapResponse {
    const { includePrivate = false } = options
    const seats: VehicleSeatItem[] = vehicle.seats.map((s) => ({
      id: s.id,
      row: s.row,
      col: s.col,
      seatLabel: s.seatLabel,
      seatNumber: s.seatNumber,
      status: s.status as VehicleSeatItem['status'],
      ...(includePrivate && {
        travelerName: s.travelerDetail?.name,
        bookingRef: s.booking?.bookingRef,
      }),
    }))

    return {
      vehicle: {
        id: vehicle.id,
        label: vehicle.label,
        vehicleType: vehicle.vehicleType,
        sortOrder: vehicle.sortOrder,
        layoutConfig: {
          rows: vehicle.rows,
          cols: vehicle.cols,
          aisleAfterCol: vehicle.aisleAfterCol,
          driverPos: [vehicle.driverRow, vehicle.driverCol],
        },
        layout: vehicle.layout as SeatCellTypeConst[][],
        photos: vehicle.photos ?? [],
      },
      seats,
      summary: this.buildSummary(seats),
    }
  }

  /**
   * Recalculates total bookable seats across all vehicles for a trip
   * and syncs trip.maxGroupSize + trip.seatSelectionEnabled.
   *
   * Uses a DB groupBy count instead of loading full seat rows with joins.
   */
  private async recalcTripSeats(tripId: string) {
    const seatCounts = await this.vehicleRepo.countSeatsByTripId(tripId)
    const vehicleCount = seatCounts.size
    let totalSeats = 0
    for (const count of seatCounts.values()) {
      totalSeats += count
    }
    await this.tripRepo.update(tripId, {
      seatSelectionEnabled: vehicleCount > 0,
      maxGroupSize: totalSeats,
    })
  }

  /** Builds seat count summary from seat list */
  private buildSummary(seats: VehicleSeatItem[]) {
    let available = 0, booked = 0, held = 0, blocked = 0
    for (const s of seats) {
      switch (s.status) {
        case SEAT_STATUS.AVAILABLE: available++; break
        case SEAT_STATUS.BOOKED: booked++; break
        case SEAT_STATUS.HELD: held++; break
        case SEAT_STATUS.BLOCKED: blocked++; break
      }
    }
    return { total: seats.length, available, booked, held, blocked }
  }
}

// ── Internal type for trip query result ──────────────
interface TripForVehicle {
  id: string
  organizerId: string
  status: string
  maxGroupSize: number
  currentBookings: number
  seatSelectionEnabled: boolean
  isDeleted: boolean
}
