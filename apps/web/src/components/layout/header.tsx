'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
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
  CreditCard,
  UserCircle,
  MessageSquare,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/hooks/use-logout'
import { APP_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications/notification-bell'
import type { UserRole } from '@shared/types/user.types'

interface NavLink {
  href: string
  label: string
  icon?: typeof MapPin
  roles?: UserRole[]
  hideForRoles?: UserRole[]
  requiresAuth?: boolean
  variant?: 'primary'
}

const NAV_LINKS: NavLink[] = [
  { href: '/trips', label: 'Explore Trips', icon: MapPin, requiresAuth: false, hideForRoles: ['ORGANIZER', 'ADMIN'] },
  { href: '/destinations', label: 'Destinations', icon: Compass, requiresAuth: false, hideForRoles: ['ORGANIZER', 'ADMIN'] },
  { href: '/my-bookings', label: 'Bookings', icon: BookOpen, hideForRoles: ['ORGANIZER', 'ADMIN'] },
  { href: '/my-payments', label: 'Payments', icon: CreditCard, hideForRoles: ['ORGANIZER', 'ADMIN'] },
  { href: '/messages', label: 'Messages', icon: MessageSquare, requiresAuth: true },
  { href: '/wallet', label: 'Wallet', icon: Coins },
  { href: '/profile', label: 'Profile', icon: UserCircle },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ORGANIZER'], variant: 'primary' },
  { href: '/admin', label: 'Admin', icon: Shield, roles: ['ADMIN'], variant: 'primary' },
]

function isLinkVisible(link: NavLink, role: string | undefined, isAuthenticated: boolean): boolean {
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/trips?destination=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      closeMobileMenu()
    }
  }

  function isActive(href: string): boolean {
    if (href === '/trips') return pathname === '/trips'
    return pathname.startsWith(href)
  }

  const visibleLinks = useMemo(
    () => _hasHydrated
      ? NAV_LINKS.filter((link) => isLinkVisible(link, user?.role, isAuthenticated))
      : NAV_LINKS.filter((link) => link.href === '/trips'),
    [_hasHydrated, user?.role, isAuthenticated],
  )

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" prefetch={false} className="flex items-center gap-2">
          <span className="font-display text-xl font-bold text-primary-600">{APP_NAME}</span>
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
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all',
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
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
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
          {(isAuthenticated || loggingOut) ? (
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
                href="/login/email"
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
          ) : null}
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
          {(isAuthenticated || loggingOut) ? (
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
                href="/login/email"
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
