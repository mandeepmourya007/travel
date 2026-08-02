'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Map,
  MessageSquare,
  UserCircle,
  MapPin,
  BookOpen,
  Coins,
  Compass,
  LogIn,
  Wallet,
  Gift,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useProfile } from '@/hooks/use-profile'
import { NavDropdownMenu, type NavDropdownLink } from '@/components/shared/nav-dropdown-menu'

interface NavItem {
  id: string
  label: string
  href: string
  icon: typeof Map
}

/**
 * A grouped bottom-nav slot rendered as a single dropdown trigger with sub-links.
 * Discriminated from `NavItem` structurally by the presence of `items` — kept
 * consistent with the same `items`-presence check used in `header.tsx`.
 */
interface NavDropdownItem {
  id: string
  label: string
  icon: typeof Map
  items: NavDropdownLink[]
}

type BottomNavEntry = NavItem | NavDropdownItem

function isDropdownItem(entry: BottomNavEntry): entry is NavDropdownItem {
  return 'items' in entry
}

const ORGANIZER_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { id: 'trips', label: 'My Trips', href: '/dashboard/trips', icon: Map },
  { id: 'payments', label: 'Payments', href: '/dashboard/payments', icon: Wallet },
  { id: 'messages', label: 'Messages', href: '/messages', icon: MessageSquare },
  { id: 'profile', label: 'Profile', href: '/profile', icon: UserCircle },
]

const TRAVELER_NAV: BottomNavEntry[] = [
  { id: 'explore', label: 'Explore', href: '/trips', icon: MapPin },
  {
    id: 'account',
    label: 'My Account',
    icon: BookOpen,
    items: [
      { href: '/my-bookings', label: 'My Bookings' },
      { href: '/my-reviews', label: 'My Reviews' },
      { href: '/messages', label: 'My Messages' },
    ],
  },
  { id: 'wallet', label: 'Wallet', href: '/wallet', icon: Coins },
  { id: 'profile', label: 'Profile', href: '/profile', icon: UserCircle },
]

const GUEST_NAV: NavItem[] = [
  { id: 'explore', label: 'Explore', href: '/trips', icon: MapPin },
  { id: 'destinations', label: 'Destinations', href: '/destinations', icon: Compass },
  { id: 'signin', label: 'Sign In', href: '/login/phone', icon: LogIn },
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
  const isReseller = !!profile?.isReseller

  let navItems: BottomNavEntry[]
  if (!_hasHydrated || !isAuthenticated) {
    navItems = GUEST_NAV
  } else if (isOrganizer) {
    navItems = ORGANIZER_NAV
  } else if (isReseller) {
    navItems = [...TRAVELER_NAV, { id: 'reseller', label: 'Reseller', href: '/reseller', icon: Gift }]
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
        if (isDropdownItem(item)) {
          // No aria-current here — the trigger itself doesn't navigate anywhere
          // (unlike a real bottom-nav tab), only its menu items do. The active
          // color state still reflects whether a child route is open.
          const active = item.items.some((sub) => isActive(sub.href))
          const Icon = item.icon

          return (
            <NavDropdownMenu
              key={item.id}
              items={item.items}
              side="top"
              align="center"
              trigger={
                <button
                  type="button"
                  className={cn(
                    'relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1.5 text-xs leading-tight',
                    active ? 'text-primary-600' : 'text-neutral-400',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate max-w-full">{item.label}</span>
                </button>
              }
            />
          )
        }

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
