import type { SeatCellTypeConst, SeatStatusConst, VehicleTypeConst } from '../constants/vehicle'

// ─── Layout Config ──────────────────────────────────

export interface LayoutConfig {
  rows: number
  cols: number
  aisleAfterCol: number | null
  /** [row, col] — driver position, India = [0, cols-1] */
  driverPos: [number, number]
}

// ─── DTOs — Create / Update Vehicle ─────────────────

export interface CreateVehicleDto {
  label?: string
  vehicleType: VehicleTypeConst
  layoutConfig: LayoutConfig
  layout: SeatCellTypeConst[][]
  photos?: string[]
}

export interface UpdateVehicleDto {
  label?: string
  vehicleType?: VehicleTypeConst
  layoutConfig?: LayoutConfig
  layout?: SeatCellTypeConst[][]
  photos?: string[]
}

// ─── API Response Types ─────────────────────────────

/** Vehicle summary returned inside trip detail or seat map */
export interface TripVehicleItem {
  id: string
  label: string
  vehicleType: string
  sortOrder: number
  layoutConfig: LayoutConfig
  layout: SeatCellTypeConst[][]
  photos: string[]
}

/** Single seat in the seat map */
export interface VehicleSeatItem {
  id: string
  row: number
  col: number
  seatLabel: string
  seatNumber: number
  status: SeatStatusConst
  /** Only populated for organizer view when seat is BOOKED */
  travelerName?: string
  /** Only populated for organizer view when seat is BOOKED */
  bookingRef?: string
}

/** Single vehicle seat map entry */
export interface SeatMapResponse {
  vehicle: TripVehicleItem
  seats: VehicleSeatItem[]
  summary: {
    total: number
    available: number
    booked: number
    held: number
    blocked: number
  }
}

/** Multi-vehicle seat map response (traveler API returns all vehicles) */
export interface MultiVehicleSeatMapResponse {
  vehicles: SeatMapResponse[]
}

/** List of vehicles for a trip (organizer multi-vehicle view) */
export interface OrganizerVehicleListItem {
  id: string
  label: string
  vehicleType: string
  sortOrder: number
  layoutConfig: LayoutConfig
  layout: SeatCellTypeConst[][]
  photos: string[]
  seatCount: number
}

/** Request body for holding seats during booking */
export interface SelectSeatsDto {
  seatIds: string[]
  bookingId: string
}

/** Traveler-seat assignment (used during confirm) */
export interface TravelerSeatAssignment {
  seatId: string
  travelerDetailId: string
}

// ─── Vehicle Templates ──────────────────────────────

export interface VehicleTemplate {
  vehicleType: VehicleTypeConst
  label: string
  rows: number
  cols: number
  aisleAfterCol: number | null
  layout: SeatCellTypeConst[][]
}
