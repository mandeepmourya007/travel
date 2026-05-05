import Link from 'next/link'

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  href?: string
}

export function StatCard({ label, value, icon, href }: StatCardProps) {
  const content = (
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
      <Link href={href} className="card block p-6">
        {content}
      </Link>
    )
  }

  return <div className="card-static p-6">{content}</div>
}

export function StatCardSkeleton() {
  return (
    <div className="card-static p-6">
      <div className="skeleton h-4 w-20 mb-3" />
      <div className="skeleton h-9 w-16" />
    </div>
  )
}
