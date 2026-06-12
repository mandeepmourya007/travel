import { cn } from '@/lib/utils'

interface StatItemProps {
  label: string
  value: string | number
  colorClass?: string
}

function StatItem({ label, value, colorClass = 'text-neutral-900' }: StatItemProps) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
      <div className={cn('font-display text-2xl font-extrabold', colorClass)}>
        {typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : value}
      </div>
      <div className="mt-1 text-sm text-neutral-500">{label}</div>
    </div>
  )
}

export function StatItemSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
      <div className="skeleton h-8 w-24" />
      <div className="skeleton mt-2 h-4 w-16" />
    </div>
  )
}

interface PaymentSummaryCardsSkeletonProps {
  /** Breakpoint at which the grid expands to 4 columns — `lg` mirrors the admin cards, `md` the rest. */
  cols?: 'md' | 'lg'
}

export function PaymentSummaryCardsSkeleton({ cols = 'md' }: PaymentSummaryCardsSkeletonProps) {
  return (
    <div className={cn(
      'grid grid-cols-1 gap-4 sm:grid-cols-2',
      cols === 'lg' ? 'lg:grid-cols-4' : 'md:grid-cols-4',
    )}>
      {[1, 2, 3, 4].map((i) => <StatItemSkeleton key={i} />)}
    </div>
  )
}

// ─── Traveler Summary ────────────────────────────────

interface TravelerSummaryProps {
  totalPaid: number
  totalRefunded: number
  pendingRefunds: number
  transactionCount: number
}

export function TravelerPaymentSummaryCards(props: TravelerSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
      <StatItem label="Total Paid" value={props.totalPaid} colorClass="text-primary-600" />
      <StatItem label="Total Refunded" value={props.totalRefunded} colorClass="text-success-600" />
      <StatItem label="Pending Refunds" value={props.pendingRefunds} colorClass="text-warning-600" />
      <StatItem label="Transactions" value={String(props.transactionCount)} />
    </div>
  )
}

// ─── Organizer Trip Summary ──────────────────────────

interface TripSummaryProps {
  totalRevenue: number
  totalRefunded: number
  netRevenue: number
  platformCommission: number
  organizerEarnings: number
  transactionCount: number
  refundCount: number
}

export function TripPaymentSummaryCards(props: TripSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
      <StatItem label="Revenue" value={props.totalRevenue} colorClass="text-primary-600" />
      <StatItem label="Refunds" value={props.totalRefunded} colorClass="text-accent-600" />
      <StatItem label="Your Earnings" value={props.organizerEarnings} colorClass="text-success-600" />
      <StatItem label="Platform Fee" value={props.platformCommission} colorClass="text-neutral-500" />
    </div>
  )
}

// ─── Admin Summary ───────────────────────────────────

interface AdminSummaryProps {
  totalRevenue: number
  totalRefunded: number
  netRevenue: number
  totalCommission: number
  transactionCount: number
  failedCount: number
}

export function AdminPaymentSummaryCards(props: AdminSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatItem label="Total Revenue" value={props.totalRevenue} colorClass="text-primary-600" />
      <StatItem label="Total Refunded" value={props.totalRefunded} colorClass="text-accent-600" />
      <StatItem label="Net Revenue" value={props.netRevenue} colorClass="text-success-600" />
      <StatItem label="Failed" value={String(props.failedCount)} colorClass="text-error-600" />
    </div>
  )
}
