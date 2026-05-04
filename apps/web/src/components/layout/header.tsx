'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search, Menu, X, User, LogOut, Wallet, Shield } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/hooks/use-logout'
import { APP_NAME } from '@/lib/constants'

export function Header() {
  const router = useRouter()
  const { isAuthenticated, user, _hasHydrated } = useAuthStore()
  const { logout: handleLogout, loggingOut } = useLogout('/login')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/trips?destination=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-xl font-bold text-primary-600">{APP_NAME}</span>
        </Link>

        {/* Search bar — desktop */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex items-center mx-8 flex-1 max-w-lg"
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

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2">
          <Link
            href="/trips"
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            Explore Trips
          </Link>
          {_hasHydrated && isAuthenticated ? (
            <>
              {user?.role !== 'ORGANIZER' && (
                <>
                  <Link
                    href="/my-bookings"
                    className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    My Bookings
                  </Link>
                  <Link
                    href="/my-payments"
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Wallet className="h-4 w-4" />
                    My Payments
                  </Link>
                </>
              )}
              <Link
                href="/profile"
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                Profile
              </Link>
              <span className="text-sm text-neutral-500">Hi, {user?.name.split(' ')[0]}</span>
              {user?.role === 'ORGANIZER' && (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
                >
                  <User className="h-4 w-4" />
                  Dashboard
                </Link>
              )}
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin/payments"
                  className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              )}
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
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-600"
              >
                Get started
              </Link>
            </>
          )}
        </nav>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden rounded-lg p-2 text-neutral-600 hover:bg-neutral-100"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-100 bg-white px-4 py-4 space-y-3">
          <form onSubmit={handleSearch}>
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
          <Link
            href="/trips"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Explore Trips
          </Link>
          {_hasHydrated && isAuthenticated ? (
            <>
              {user?.role !== 'ORGANIZER' && (
                <>
                  <Link
                    href="/my-bookings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    My Bookings
                  </Link>
                  <Link
                    href="/my-payments"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <Wallet className="h-4 w-4" />
                    My Payments
                  </Link>
                </>
              )}
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Profile
              </Link>
              {user?.role === 'ORGANIZER' && (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50"
                >
                  Dashboard
                </Link>
              )}
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin/payments"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50"
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              )}
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout() }}
                disabled={loggingOut}
                className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-error-600 hover:bg-error-50 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loggingOut ? <span className="spinner spinner-sm" /> : <LogOut className="h-4 w-4" />}
                {loggingOut ? 'Logging out...' : 'Log out'}
              </button>
            </>
          ) : (
            <div className="flex gap-2 pt-2">
              <Link href="/login" className="btn-secondary flex-1 text-center text-sm">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary flex-1 text-center text-sm">
                Get started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
