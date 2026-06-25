'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Map,
  MessageSquare,
  Landmark,
  UserCircle,
  MapPin,
  BookOpen,
  Coins,
  Compass,
  LogIn,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useProfile } from '@/hooks/use-profile'

interface NavItem {
  id: string
  label: string
  href: string
  icon: typeof Map
}

const ORGANIZER_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { id: 'trips', label: 'My Trips', href: '/dashboard/trips', icon: Map },
  { id: 'messages', label: 'Messages', href: '/messages', icon: MessageSquare },
  { id: 'bank', label: 'Bank', href: '/dashboard/settings/bank', icon: Landmark },
  { id: 'profile', label: 'Profile', href: '/profile', icon: UserCircle },
]

const TRAVELER_NAV: NavItem[] = [
  { id: 'explore', label: 'Explore', href: '/trips', icon: MapPin },
  { id: 'bookings', label: 'Bookings', href: '/my-bookings', icon: BookOpen },
  { id: 'messages', label: 'Messages', href: '/messages', icon: MessageSquare },
  { id: 'wallet', label: 'Wallet', href: '/wallet', icon: Coins },
  { id: 'profile', label: 'Profile', href: '/profile', icon: UserCircle },
]

const GUEST_NAV: NavItem[] = [
  { id: 'explore', label: 'Explore', href: '/trips', icon: MapPin },
  { id: 'destinations', label: 'Destinations', href: '/destinations', icon: Compass },
  { id: 'signin', label: 'Sign In', href: '/login/email', icon: LogIn },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const _hasHydrated = useAuthStore((s) => s._hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const { data: profile } = useProfile()

  // Admin pages have their own bottom nav
  if (pathname.startsWith('/admin')) return null

  const role = user?.role
  const isOrganizer = role === 'ORGANIZER'

  // Organizer-specific: check approval + bank status for badge
  const orgProfile = profile?.organizerProfile
  const bankLinked = orgProfile?.bankAccountLinked ?? true

  let navItems: NavItem[]
  if (!_hasHydrated || !isAuthenticated) {
    navItems = GUEST_NAV
  } else if (isOrganizer) {
    navItems = ORGANIZER_NAV
  } else {
    navItems = TRAVELER_NAV
  }

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/trips') return pathname === '/trips'
    return pathname.startsWith(href)
  }

  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-neutral-200 bg-white py-2 md:hidden">
      {navItems.map((item) => {
        const active = isActive(item.href)
        const Icon = item.icon
        const showBadge = isOrganizer && item.id === 'bank' && !bankLinked

        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1.5 text-xs leading-tight',
              active ? 'text-primary-600' : 'text-neutral-400',
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate max-w-full">{item.label}</span>
            {showBadge && (
              <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-warning-500" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
