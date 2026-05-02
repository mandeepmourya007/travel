'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Map,
  MessageSquare,
  Star,
  Wallet,
  UserCircle,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: typeof LayoutDashboard
  disabled?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Trips', href: '/dashboard/trips', icon: Map },
  { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare, disabled: true },
  { label: 'Reviews', href: '/dashboard/reviews', icon: Star, disabled: true },
  { label: 'Payments', href: '/dashboard/payments', icon: Wallet, disabled: true },
  { label: 'Profile', href: '/dashboard/profile', icon: UserCircle, disabled: true },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-neutral-200 md:bg-white">
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.disabled ? '#' : item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800',
                  item.disabled && 'pointer-events-none opacity-40',
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
                {item.disabled && (
                  <span className="badge badge-warning ml-auto text-[10px]">Soon</span>
                )}
              </Link>
            )
          })}

          <div className="mt-4 border-t border-neutral-100 pt-4">
            <Link
              href="/dashboard/trips/create"
              className="btn-primary flex w-full items-center justify-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              New Trip
            </Link>
          </div>
        </nav>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-neutral-200 bg-white py-2 md:hidden">
        {NAV_ITEMS.filter((item) => !item.disabled).map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-3 text-xs',
                isActive ? 'text-primary-600' : 'text-neutral-400',
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
        <Link
          href="/dashboard/trips/create"
          className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-3 text-xs text-primary-600"
        >
          <Plus className="h-5 w-5" />
          Create
        </Link>
      </nav>
    </>
  )
}
