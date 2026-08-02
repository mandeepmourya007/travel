'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useMemo, useEffect } from 'react'
import {
  Search,
  Menu,
  X,
  Bell,
  LayoutDashboard,
  LogOut,
  Coins,
  Shield,
  MapPin,
  Compass,
  BookOpen,
  ChevronDown,
  CreditCard,
  UserCircle,
  MessageSquare,
  Gift,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useProfile } from '@/hooks/use-profile'
import { useLogout } from '@/hooks/use-logout'
import { APP_NAME, isProduction } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { NavDropdownMenu, type NavDropdownLink } from '@/components/shared/nav-dropdown-menu'
import type { UserRole } from '@shared/types/user.types'
import { USER_ROLE } from '@shared/constants'

interface NavLinkBase {
  label: string
  icon?: typeof MapPin
  roles?: UserRole[]
  hideForRoles?: UserRole[]
  requiresAuth?: boolean
}

interface NavLink extends NavLinkBase {
  href: string
  variant?: 'primary'
  /** Shown only when the logged-in traveler's profile has isReseller=true */
  resellerOnly?: boolean
}

/**
 * A grouped nav entry rendered as a single dropdown trigger with sub-links.
 * Discriminated from `NavLink` structurally by the presence of `items` — kept
 * consistent with the same `items`-presence check used in `mobile-bottom-nav.tsx`.
 */
interface NavDropdown extends NavLinkBase {
  id: string
  items: NavDropdownLink[]
}

type NavEntry = NavLink | NavDropdown

function isDropdown(entry: NavEntry): entry is NavDropdown {
  return 'items' in entry
}

const NAV_LINKS: NavEntry[] = [
  { href: '/trips', label: 'Explore Trips', icon: MapPin, requiresAuth: false, hideForRoles: [USER_ROLE.ORGANIZER, USER_ROLE.ADMIN] },
  { href: '/destinations', label: 'Destinations', icon: Compass, requiresAuth: false, hideForRoles: [USER_ROLE.ORGANIZER, USER_ROLE.ADMIN] },
  {
    id: 'my-account',
    label: 'My Account',
    icon: BookOpen,
    hideForRoles: [USER_ROLE.ORGANIZER, USER_ROLE.ADMIN],
    items: [
      { href: '/my-bookings', label: 'My Bookings' },
      { href: '/my-reviews', label: 'My Reviews' },
      { href: '/messages', label: 'My Messages' },
    ],
  },
  { href: '/my-payments', label: 'Payments', icon: CreditCard, hideForRoles: [USER_ROLE.ORGANIZER, USER_ROLE.ADMIN] },
  { href: '/reseller', label: 'Reseller', icon: Gift, hideForRoles: [USER_ROLE.ORGANIZER, USER_ROLE.ADMIN], resellerOnly: true },
  // Travelers reach Messages via the "My Account" dropdown above; organizers/admin
  // (who have no bookings/reviews) keep this direct link.
  { href: '/messages', label: 'Messages', icon: MessageSquare, requiresAuth: true, hideForRoles: [USER_ROLE.TRAVELER] },
  { href: '/wallet', label: 'Wallet', icon: Coins },
  { href: '/profile', label: 'Profile', icon: UserCircle },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [USER_ROLE.ORGANIZER], variant: 'primary' },
  { href: '/admin', label: 'Admin', icon: Shield, roles: [USER_ROLE.ADMIN], variant: 'primary' },
]

function isLinkVisible(link: NavEntry, role: string | undefined, isAuthenticated: boolean): boolean {
  if (link.roles && (!role || !link.roles.includes(role as UserRole))) {
    return false
  }
  if (link.hideForRoles && role && link.hideForRoles.includes(role as UserRole)) {
    return false
  }
  if (link.requiresAuth !== false && !isAuthenticated) {
    return false
  }
  return true
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const _hasHydrated = useAuthStore((s) => s._hasHydrated)
  const { logout: handleLogout, loggingOut } = useLogout()
  const { data: profile } = useProfile()
  const isReseller = !!profile?.isReseller
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Populate search input on mount — Header remounts on cross-layout navigation
  // (AppShell is per-layout, not in root layout), so useState('') would otherwise
  // lose the query when navigating e.g. home → /trips?q=goa.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setSearchQuery(q)
  }, [])

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/trips?q=${encodeURIComponent(searchQuery.trim())}`)
      closeMobileMenu()
    }
  }

  function isActive(href: string): boolean {
    if (href === '/trips') return pathname === '/trips'
    return pathname.startsWith(href)
  }

  const visibleLinks = useMemo(
    () => _hasHydrated
      ? NAV_LINKS.filter((link) => isLinkVisible(link, user?.role, isAuthenticated) && (isDropdown(link) || !link.resellerOnly || isReseller))
      : NAV_LINKS.filter((link) => !isDropdown(link) && link.href === '/trips'),
    [_hasHydrated, user?.role, isAuthenticated, isReseller],
  )

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" prefetch={false} className="flex items-center gap-1.5 shrink-0">
          <Image
            src={isProduction ? '/logo-prod.svg' : '/logo.svg'}
            alt=""
            width={isProduction ? 195 : 28}
            height={isProduction ? 70 : 28}
            priority
            aria-hidden="true"
            className={isProduction ? 'h-9 w-auto sm:h-10 md:h-12 lg:h-14' : undefined}
          />
          {!isProduction && (
            <span className="font-display text-xl font-bold text-primary-600">{APP_NAME}</span>
          )}
        </Link>

        {/* Search bar — hidden on mobile, visible md+ */}
        <form
          onSubmit={handleSearch}
          className="hidden items-center mx-4 lg:mx-8 flex-1 max-w-xs lg:max-w-lg md:flex"
        >
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search destinations..."
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2 pl-10 pr-4 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>
        </form>

        {/* Desktop nav — hidden on mobile, visible md+ */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {visibleLinks.map((link) => {
            if (isDropdown(link)) {
              // No aria-current here — the trigger itself doesn't navigate anywhere
              // (unlike a real nav link), only its menu items do; those carry
              // aria-current in the mobile panel rendering below. The active
              // color state still reflects whether a child route is open.
              const active = link.items.some((item) => isActive(item.href))
              const Icon = link.icon

              return (
                <NavDropdownMenu
                  key={link.id}
                  items={link.items}
                  align="start"
                  trigger={
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                        active
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                      )}
                    >
                      {Icon && <Icon className="hidden xl:block h-4 w-4" />}
                      {link.label}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              )
            }

            const active = isActive(link.href)
            const Icon = link.icon

            if (link.variant === 'primary') {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all whitespace-nowrap',
                    active
                      ? 'bg-primary-600 text-white'
                      : 'bg-primary-500 text-white hover:bg-primary-600',
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {link.label}
                </Link>
              )
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                )}
              >
                {Icon && <Icon className="hidden xl:block h-4 w-4" />}
                {link.label}
              </Link>
            )
          })}

          {/* Auth-dependent actions */}
          {((_hasHydrated && isAuthenticated) || loggingOut) ? (
            <>
              <NotificationBell />
              <span className="ml-1 text-sm text-neutral-500">
                Hi, {user?.name.split(' ')[0]}
              </span>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 disabled:pointer-events-none"
                aria-label="Log out"
              >
                {loggingOut ? <span className="spinner spinner-sm" /> : <LogOut className="h-4 w-4" />}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login/phone"
                prefetch={false}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                prefetch={false}
                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
              >
                Get started
              </Link>
            </>
          )}
        </nav>

        {/* Mobile menu toggle — visible on mobile, hidden md+ */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 md:hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu panel */}
      {mobileMenuOpen && (
        <div className="border-t border-neutral-100 bg-white px-4 py-4 space-y-1 md:hidden">
          {/* Mobile search */}
          <form onSubmit={handleSearch} className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search destinations..."
                className="input pl-10 rounded-full"
              />
            </div>
          </form>

          {/* Mobile nav links */}
          {visibleLinks.map((link) => {
            if (isDropdown(link)) {
              const Icon = link.icon
              return (
                <div key={link.id} className="space-y-1">
                  <div className="flex items-center gap-3 px-4 pt-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {link.label}
                  </div>
                  {link.items.map((item) => {
                    const itemActive = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        onClick={closeMobileMenu}
                        aria-current={itemActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg py-2.5 pl-9 pr-4 text-sm font-medium transition-colors',
                          itemActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-neutral-700 hover:bg-neutral-100',
                        )}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )
            }

            const active = isActive(link.href)
            const Icon = link.icon

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                onClick={closeMobileMenu}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                  link.variant === 'primary'
                    ? active
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-primary-600 hover:bg-primary-50'
                    : active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-700 hover:bg-neutral-100',
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {link.label}
              </Link>
            )
          })}

          {/* Auth actions */}
          {((_hasHydrated && isAuthenticated) || loggingOut) ? (
            <>
              <Link
                href="/notifications"
                prefetch={false}
                onClick={closeMobileMenu}
                className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 border-t border-neutral-100 mt-2 pt-2"
              >
                <Bell className="h-4 w-4" />
                Notifications
              </Link>
              <div className="border-t border-neutral-100 mt-2 pt-2">
                <span className="block px-4 py-1 text-xs text-neutral-400">
                  Signed in as {user?.name.split(' ')[0]}
                </span>
                <button
                  onClick={() => { closeMobileMenu(); handleLogout() }}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-error-500 hover:bg-error-50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loggingOut ? <span className="spinner spinner-sm" /> : <LogOut className="h-4 w-4" />}
                  {loggingOut ? 'Logging out...' : 'Log out'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2 border-t border-neutral-100 mt-2 pt-3">
              <Link
                href="/login/phone"
                prefetch={false}
                onClick={closeMobileMenu}
                className="btn-secondary flex-1 text-center text-sm"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                prefetch={false}
                onClick={closeMobileMenu}
                className="btn-primary flex-1 text-center text-sm"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
