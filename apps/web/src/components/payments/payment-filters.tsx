import { PAYMENT_TYPES, PAYMENT_STATUSES } from '@shared/validators/payment.schema'
import { DateRangePicker } from '@/components/shared/date-range-picker'

/** Human-readable labels for payment type dropdown */
const TYPE_LABELS: Record<string, string> = {
  PAYMENT: 'Payment',
  REFUND: 'Refund',
  ESCROW_RELEASE: 'SafePay Release',
}

/** Human-readable labels for payment status dropdown */
const STATUS_LABELS: Record<string, string> = {
  INITIATED: 'Pending',
  AUTHORIZED: 'Authorized',
  CAPTURED: 'Captured',
  REFUNDED: 'Refunded',
  FAILED: 'Failed',
}

/** Props for the PaymentFilters component — all filter values sourced from shared Zod schema */
interface PaymentFiltersProps {
  activeType?: string
  activeStatus?: string
  fromDate?: string
  toDate?: string
  onTypeChange: (type: (typeof PAYMENT_TYPES)[number] | undefined) => void
  onStatusChange: (status: (typeof PAYMENT_STATUSES)[number] | undefined) => void
  onFromDateChange: (date: string | undefined) => void
  onToDateChange: (date: string | undefined) => void
}

export function PaymentFilters({
  activeType,
  activeStatus,
  fromDate,
  toDate,
  onTypeChange,
  onStatusChange,
  onFromDateChange,
  onToDateChange,
}: PaymentFiltersProps) {
  const hasActiveFilters = activeType || activeStatus || fromDate || toDate

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
      {/* Type dropdown — values from PAYMENT_TYPES (shared/validators) */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-type" className="text-xs font-medium text-neutral-500">
          Type
        </label>
        <select
          id="filter-type"
          value={activeType ?? ''}
          onChange={(e) =>
            onTypeChange((e.target.value || undefined) as (typeof PAYMENT_TYPES)[number] | undefined)
          }
          className="input w-auto py-2 text-sm"
        >
          <option value="">All Types</option>
          {PAYMENT_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Status dropdown — values from PAYMENT_STATUSES (shared/validators) */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-status" className="text-xs font-medium text-neutral-500">
          Status
        </label>
        <select
          id="filter-status"
          value={activeStatus ?? ''}
          onChange={(e) =>
            onStatusChange((e.target.value || undefined) as (typeof PAYMENT_STATUSES)[number] | undefined)
          }
          className="input w-auto py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-500">Date range</label>
        <DateRangePicker
          from={fromDate}
          to={toDate}
          onFromChange={onFromDateChange}
          onToChange={onToDateChange}
          placeholder="Select date range"
          className="w-auto py-2 text-sm"
        />
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            onTypeChange(undefined)
            onStatusChange(undefined)
            onFromDateChange(undefined)
            onToDateChange(undefined)
          }}
          className="self-end rounded-lg px-3 py-2 text-sm font-medium text-error-600 hover:bg-error-50 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
