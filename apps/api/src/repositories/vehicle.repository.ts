import type { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { SeatCellTypeConst } from '@shared/constants/vehicle'

interface CreateVehicleData {
  tripId: string
  label: string
  vehicleType: string
  sortOrder: number
  rows: number
  cols: number
  aisleAfterCol: number | null
  driverRow: number
  driverCol: number
  layout: SeatCellTypeConst[][]
  photos: string[]
}

interface SeatData {
  tripVehicleId: string
  row: number
  col: number
  seatLabel: string
  seatNumber: number
}

/**
 * Data access layer for TripVehicle and VehicleSeat tables.
 *
 * All Prisma queries are isolated here — services never write raw queries.
 * Atomic operations use $executeRaw for race-condition-safe seat mutations.
 */
export class VehicleRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /** Find all active vehicles for a trip, including their seats and relations */
  async findByTripId(tripId: string) {
    return this.prisma.tripVehicle.findMany({
      where: { tripId, isDeleted: false },
      include: {
        seats: {
          where: { isDeleted: false },
          include: {
            booking: { select: { bookingRef: true } },
            travelerDetail: { select: { name: true } },
          },
          orderBy: [{ row: 'asc' }, { col: 'asc' }],
        },
      },
      orderBy: { sortOrder: 'asc' },
    })
  }

  /** Find a single vehicle by ID */
  async findById(vehicleId: string) {
    return this.prisma.tripVehicle.findFirst({
      where: { id: vehicleId, isDeleted: false },
      include: {
        seats: {
          where: { isDeleted: false },
          orderBy: [{ row: 'asc' }, { col: 'asc' }],
        },
      },
    })
  }

  /** Create a new vehicle record */
  async create(data: CreateVehicleData) {
    return this.prisma.tripVehicle.create({
      data: {
        tripId: data.tripId,
        label: data.label,
        vehicleType: data.vehicleType,
        sortOrder: data.sortOrder,
        rows: data.rows,
        cols: data.cols,
        aisleAfterCol: data.aisleAfterCol,
        driverRow: data.driverRow,
        driverCol: data.driverCol,
        layout: data.layout as Prisma.InputJsonArray,
        photos: data.photos,
      },
    })
  }

  /** Update vehicle fields */
  async update(vehicleId: string, data: Partial<Omit<CreateVehicleData, 'tripId'>>) {
    const updateData: Prisma.TripVehicleUpdateInput = {}
    if (data.label !== undefined) updateData.label = data.label
    if (data.vehicleType !== undefined) updateData.vehicleType = data.vehicleType
    if (data.rows !== undefined) updateData.rows = data.rows
    if (data.cols !== undefined) updateData.cols = data.cols
    if (data.aisleAfterCol !== undefined) updateData.aisleAfterCol = data.aisleAfterCol
    if (data.driverRow !== undefined) updateData.driverRow = data.driverRow
    if (data.driverCol !== undefined) updateData.driverCol = data.driverCol
    if (data.layout !== undefined) updateData.layout = data.layout as Prisma.InputJsonArray
    if (data.photos !== undefined) updateData.photos = data.photos

    return this.prisma.tripVehicle.update({
      where: { id: vehicleId },
      data: updateData,
    })
  }

  /** Soft-delete a vehicle */
  async softDelete(vehicleId: string) {
    return this.prisma.tripVehicle.update({
      where: { id: vehicleId },
      data: { isDeleted: true, deletedAt: new Date() },
    })
  }

  /** Bulk-create seat records for a vehicle */
  async createSeats(vehicleId: string, seats: SeatData[]) {
    return this.prisma.vehicleSeat.createMany({
      data: seats.map((s) => ({
        tripVehicleId: vehicleId,
        row: s.row,
        col: s.col,
        seatLabel: s.seatLabel,
        seatNumber: s.seatNumber,
      })),
    })
  }

  /** Delete all seats for a vehicle (used before re-creating on layout update) */
  async deleteSeatsForVehicle(vehicleId: string) {
    return this.prisma.vehicleSeat.updateMany({
      where: { tripVehicleId: vehicleId, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    })
  }

  /** Find seats by IDs */
  async findSeatsByIds(seatIds: string[]) {
    return this.prisma.vehicleSeat.findMany({
      where: { id: { in: seatIds }, isDeleted: false },
    })
  }

  /** Find seats held/booked for a specific booking, ordered by seatNumber */
  async findSeatsByBookingId(bookingId: string) {
    return this.prisma.vehicleSeat.findMany({
      where: { bookingId, isDeleted: false },
      orderBy: { seatNumber: 'asc' },
    })
  }

  /** Find seats for a vehicle */
  async findSeatsByVehicleId(vehicleId: string) {
    return this.prisma.vehicleSeat.findMany({
      where: { tripVehicleId: vehicleId, isDeleted: false },
      include: {
        booking: { select: { bookingRef: true } },
        travelerDetail: { select: { name: true } },
      },
      orderBy: [{ row: 'asc' }, { col: 'asc' }],
    })
  }

  /** Count booked or held seats for a vehicle (non-available) */
  async countBookedSeats(vehicleId: string): Promise<number> {
    return this.prisma.vehicleSeat.count({
      where: {
        tripVehicleId: vehicleId,
        isDeleted: false,
        status: { in: ['BOOKED', 'HELD'] },
      },
    })
  }

  /**
   * Returns total non-deleted seat counts per vehicle for a trip in one query.
   * Use this instead of findByTripId() when only counts are needed (e.g.
   * getAllVehicles(), recalcTripSeats()) to avoid loading full seat rows with
   * booking/travelerDetail joins just to call .filter().length.
   *
   * Returns a Map<vehicleId, seatCount>.
   */
  async countSeatsByTripId(tripId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.vehicleSeat.groupBy({
      by: ['tripVehicleId'],
      where: {
        tripVehicle: { tripId, isDeleted: false },
        isDeleted: false,
      },
      _count: { id: true },
    })
    return new Map(rows.map((r) => [r.tripVehicleId, r._count.id]))
  }

  /**
   * Atomically hold seats — only updates seats that are currently AVAILABLE.
   * Returns the number of rows affected. If < seatIds.length, some seats were taken.
   */
  async holdSeats(
    seatIds: string[],
    userId: string,
    bookingId: string,
    holdMinutes: number,
  ): Promise<number> {
    const now = new Date()
    const heldUntil = new Date(now.getTime() + holdMinutes * 60 * 1000)
    const result = await this.prisma.vehicleSeat.updateMany({
      where: {
        id: { in: seatIds },
        status: 'AVAILABLE',
        isDeleted: false,
      },
      data: {
        status: 'HELD',
        bookingId,
        heldByUserId: userId,
        heldAt: now,
        heldUntil,
      },
    })
    return result.count
  }

  /**
   * Atomically confirm seats — transitions HELD → BOOKED for a booking.
   * Returns the number of rows affected.
   */
  async confirmSeats(bookingId: string, userId: string): Promise<number> {
    const result = await this.prisma.vehicleSeat.updateMany({
      where: {
        bookingId,
        heldByUserId: userId,
        status: 'HELD',
        isDeleted: false,
      },
      data: {
        status: 'BOOKED',
        heldAt: null,
        heldUntil: null,
      },
    })
    return result.count
  }

  /** Assign a traveler to a seat */
  async assignTravelerToSeat(seatId: string, travelerDetailId: string) {
    return this.prisma.vehicleSeat.update({
      where: { id: seatId },
      data: { travelerDetailId },
    })
  }

  /** Release all seats for a booking (HELD or BOOKED → AVAILABLE) */
  async releaseSeatsByBookingId(bookingId: string): Promise<number> {
    const result = await this.prisma.vehicleSeat.updateMany({
      where: {
        bookingId,
        isDeleted: false,
        status: { in: ['HELD', 'BOOKED'] },
      },
      data: {
        status: 'AVAILABLE',
        bookingId: null,
        heldByUserId: null,
        heldAt: null,
        heldUntil: null,
        travelerDetailId: null,
      },
    })
    return result.count
  }

  /**
   * Expire all seats whose hold window has passed.
   * HELD seats with heldUntil < now → AVAILABLE.
   * Returns number of expired seats.
   */
  async expireHeldSeats(): Promise<number> {
    const result = await this.prisma.vehicleSeat.updateMany({
      where: {
        status: 'HELD',
        heldUntil: { lt: new Date() },
        isDeleted: false,
      },
      data: {
        status: 'AVAILABLE',
        bookingId: null,
        heldByUserId: null,
        heldAt: null,
        heldUntil: null,
      },
    })
    return result.count
  }
}
