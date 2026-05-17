'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Map,
  MessageSquare,
  Star,
  UserCircle,
  Landmark,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProfile } from '@/hooks/use-profile'

interface NavItem {
  id: string
  label: string
  href: string
  icon: typeof LayoutDashboard
  disabled?: boolean
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { id: 'trips', label: 'My Trips', href: '/dashboard/trips', icon: Map },
  { id: 'messages', label: 'Messages', href: '/messages', icon: MessageSquare },
  { id: 'reviews', label: 'Reviews', href: '/dashboard/reviews', icon: Star },
  { id: 'bank', label: 'Bank Account', href: '/dashboard/settings/bank', icon: Landmark },
  { id: 'profile', label: 'Profile', href: '/profile', icon: UserCircle },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { data: profile } = useProfile()
  const orgProfile = profile?.organizerProfile
  const isApproved = orgProfile?.verificationStatus === 'APPROVED'

  const bankLinked = orgProfile?.bankAccountLinked ?? true

  const resolvedItems = NAV_ITEMS.map((item) => {
    if (item.id === 'reviews') {
      const href = orgProfile?.slug
        ? `/trips/organizers/${orgProfile.slug}`
        : item.href
      return { ...item, href, disabled: !isApproved }
    }
    if (item.id === 'bank' && !bankLinked) {
      return { ...item, badge: 'Action Needed' as const }
    }
    return item
  })

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-neutral-200 md:bg-white">
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {resolvedItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.id}
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
              {item.badge && (
                <span className="ml-auto h-2 w-2 rounded-full bg-warning-500" title={item.badge} />
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
  )
}
