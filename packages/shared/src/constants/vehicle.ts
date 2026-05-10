// ─── Seat Cell Types (visual grid cells) ────────────
export const SEAT_CELL_TYPES = ['SEAT', 'DRIVER', 'EMPTY', 'BLOCKED'] as const
export type SeatCellTypeConst = (typeof SEAT_CELL_TYPES)[number]

export const SEAT_CELL_TYPE = {
  SEAT: 'SEAT',
  DRIVER: 'DRIVER',
  EMPTY: 'EMPTY',
  BLOCKED: 'BLOCKED',
} as const

// ─── Seat Status (booking lifecycle) ────────────────
export const SEAT_STATUSES = ['AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED'] as const
export type SeatStatusConst = (typeof SEAT_STATUSES)[number]

export const SEAT_STATUS = {
  AVAILABLE: 'AVAILABLE',
  HELD: 'HELD',
  BOOKED: 'BOOKED',
  BLOCKED: 'BLOCKED',
} as const

// ─── Vehicle Types (templates) ──────────────────────
export const VEHICLE_TYPES = [
  'sedan',
  'ertiga',
  'innova',
  'tempo',
  'minibus',
  'bus',
  'custom',
] as const
export type VehicleTypeConst = (typeof VEHICLE_TYPES)[number]

// ─── Vehicle Grid Constraints ───────────────────────
export const VEHICLE_GRID = {
  MIN_ROWS: 2,
  MAX_ROWS: 15,
  MIN_COLS: 1,
  MAX_COLS: 8,
} as const
