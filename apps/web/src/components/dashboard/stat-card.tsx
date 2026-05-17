import Link from 'next/link'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  href?: string
  compact?: boolean
}

export function StatCard({ label, value, icon, href, compact }: StatCardProps) {
  const content = compact ? (
    <div className="flex flex-col items-center text-center gap-1">
      <p className="text-xs text-neutral-500">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className="font-display text-2xl font-extrabold text-neutral-900">{value}</p>
        {icon && <div className="text-primary-400">{icon}</div>}
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-neutral-500">{label}</p>
        <p className="mt-1 font-display text-3xl font-extrabold text-neutral-900">{value}</p>
      </div>
      {icon && <div className="text-primary-400">{icon}</div>}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className={cn('card block', compact ? 'p-3' : 'p-6')}>
        {content}
      </Link>
    )
  }

  return <div className={cn('card-static', compact ? 'p-3' : 'p-6')}>{content}</div>
}

export function StatCardSkeleton() {
  return (
    <div className="card-static p-6">
      <div className="skeleton h-4 w-20 mb-3" />
      <div className="skeleton h-9 w-16" />
    </div>
  )
}
