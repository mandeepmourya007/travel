import { z } from 'zod'
import { SEAT_CELL_TYPES, VEHICLE_TYPES, VEHICLE_GRID } from '../constants/vehicle'

// ─── Layout Config ──────────────────────────────────

export const layoutConfigSchema = z.object({
  rows: z.number().int().min(VEHICLE_GRID.MIN_ROWS).max(VEHICLE_GRID.MAX_ROWS),
  cols: z.number().int().min(VEHICLE_GRID.MIN_COLS).max(VEHICLE_GRID.MAX_COLS),
  aisleAfterCol: z.number().int().min(0).nullable(),
  driverPos: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
})

// ─── Create Vehicle ─────────────────────────────────

export const createVehicleSchema = z
  .object({
    label: z.string().trim().min(1).max(50).default('Main Vehicle'),
    vehicleType: z.enum(VEHICLE_TYPES),
    layoutConfig: layoutConfigSchema,
    layout: z.array(z.array(z.enum(SEAT_CELL_TYPES))).min(VEHICLE_GRID.MIN_ROWS),
  })
  .refine(
    (data) => {
      let driverCount = 0
      let seatCount = 0
      for (const row of data.layout) {
        for (const cell of row) {
          if (cell === 'DRIVER') driverCount++
          if (cell === 'SEAT') seatCount++
        }
      }
      return driverCount === 1 && seatCount >= 1
    },
    { message: 'Layout must have exactly 1 driver and at least 1 seat' },
  )
  .refine(
    (data) => data.layout.length === data.layoutConfig.rows,
    { message: 'Layout row count must match layoutConfig.rows' },
  )
  .refine(
    (data) => data.layout.every((row) => row.length === data.layoutConfig.cols),
    { message: 'Every layout row must have layoutConfig.cols columns' },
  )
  .refine(
    (data) => {
      const [dr, dc] = data.layoutConfig.driverPos
      return dr >= 0 && dr < data.layoutConfig.rows && dc >= 0 && dc < data.layoutConfig.cols
    },
    { message: 'Driver position must be within grid bounds' },
  )
  .refine(
    (data) => {
      const [dr, dc] = data.layoutConfig.driverPos
      return data.layout[dr]?.[dc] === 'DRIVER'
    },
    { message: 'Driver position in layoutConfig must match DRIVER cell in layout' },
  )

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>

// ─── Update Vehicle ─────────────────────────────────

export const updateVehicleSchema = z
  .object({
    label: z.string().trim().min(1).max(50).optional(),
    vehicleType: z.enum(VEHICLE_TYPES).optional(),
    layoutConfig: layoutConfigSchema.optional(),
    layout: z.array(z.array(z.enum(SEAT_CELL_TYPES))).min(VEHICLE_GRID.MIN_ROWS).optional(),
  })
  .refine(
    (data) => {
      if (!data.layout) return true
      let driverCount = 0
      let seatCount = 0
      for (const row of data.layout) {
        for (const cell of row) {
          if (cell === 'DRIVER') driverCount++
          if (cell === 'SEAT') seatCount++
        }
      }
      return driverCount === 1 && seatCount >= 1
    },
    { message: 'Layout must have exactly 1 driver and at least 1 seat' },
  )

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>

// ─── Select Seats ───────────────────────────────────

export const selectSeatsSchema = z.object({
  seatIds: z.array(z.string().min(1)).min(1).max(10),
  bookingId: z.string().min(1),
})

export type SelectSeatsInput = z.infer<typeof selectSeatsSchema>
