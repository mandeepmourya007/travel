'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Users,
  Package,
  CreditCard,
  Gift,
  MessageSquare,
  Tags,
  Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  href: string
  icon: typeof BarChart3
}

const ADMIN_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', href: '/admin', icon: BarChart3 },
  { id: 'organizers', label: 'Organizers', href: '/admin/organizers', icon: Users },
  { id: 'bookings', label: 'Bookings', href: '/admin/bookings', icon: Package },
  { id: 'payments', label: 'Payments', href: '/admin/payments', icon: CreditCard },
  { id: 'trip-types', label: 'Trip Types', href: '/admin/trip-types', icon: Tags },
  { id: 'cashback', label: 'Cashback', href: '/admin/cashback', icon: Gift },
  { id: 'chat', label: 'Chat', href: '/admin/chat', icon: MessageSquare },
  { id: 'invites', label: 'Invites', href: '/admin/invites', icon: Mail },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-neutral-200 md:bg-white">
        <div className="px-4 pt-5 pb-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Admin Panel
          </h2>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4 pt-2">
          {ADMIN_NAV.map((item) => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={false}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800',
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile bottom nav — scrollable for 7+ items */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center overflow-x-auto border-t border-neutral-200 bg-white py-2 md:hidden">
        {ADMIN_NAV.map((item) => {
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={false}
              className={cn(
                'flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1.5 text-[10px] leading-tight',
                isActive ? 'text-primary-600' : 'text-neutral-400',
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              <span className="truncate max-w-full">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
