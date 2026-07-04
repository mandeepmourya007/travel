import { z } from 'zod'
import { SORT_ORDERS, SORT_FIELD } from '../constants/sort'
import { idSchema } from './common.schema'
// PAYMENT_TYPES / PAYMENT_STATUSES live in constants/payment — imported here to feed z.enum
// ESCROW_RELEASE is stored in the DB and cannot be renamed without a data migration.
import { PAYMENT_TYPES, PAYMENT_STATUSES } from '../constants/payment'

// ─── Payment History Filters ──────────────────────────

const paymentTypeEnum = z.enum(PAYMENT_TYPES)
const paymentStatusEnum = z.enum(PAYMENT_STATUSES)

// Re-export so callers that previously imported these from this module still compile
export { PAYMENT_TYPES, PAYMENT_STATUSES } from '../constants/payment'

const dateRangeRefine = (data: { fromDate?: string; toDate?: string }) => {
  if (data.fromDate && data.toDate) {
    return new Date(data.fromDate) <= new Date(data.toDate)
  }
  return true
}
const dateRangeMessage = { message: 'fromDate must be before or equal to toDate', path: ['fromDate'] }

const basePaymentFilters = z.object({
  type: paymentTypeEnum.optional(),
  status: paymentStatusEnum.optional(),
  fromDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'fromDate must be a valid date string' }).optional(),
  toDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'toDate must be a valid date string' }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** Validates query params for GET /payments/my */
export const paymentHistoryFiltersSchema = basePaymentFilters.extend({
  tripId: idSchema.optional(),
}).refine(dateRangeRefine, dateRangeMessage)

/** Validates query params for GET /payments/admin — extends base with search fields */
export const adminPaymentFiltersSchema = basePaymentFilters.extend({
  userId: idSchema.optional(),
  tripId: idSchema.optional(),
  bookingRef: z.string().max(50).optional(),
}).refine(dateRangeRefine, dateRangeMessage)

/** Sort fields available on the organizer payment list. */
export const ORGANIZER_PAYMENT_SORT_FIELDS = [
  SORT_FIELD.AMOUNT,
  SORT_FIELD.CREATED_AT,
  SORT_FIELD.STATUS,
] as const

/** Validates query params for GET /payments/organizer — trip scope + sorting */
export const organizerPaymentFiltersSchema = basePaymentFilters.extend({
  tripId: idSchema.optional(),
  sortBy: z.enum(ORGANIZER_PAYMENT_SORT_FIELDS).optional(),
  sortOrder: z.enum(SORT_ORDERS).optional(),
}).refine(dateRangeRefine, dateRangeMessage)
