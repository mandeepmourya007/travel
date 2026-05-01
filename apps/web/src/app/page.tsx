'use client'

import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'

export default function HomePage() {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore()

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="font-display text-xl font-bold text-primary-600">TravelApp</h1>
          <div className="flex items-center gap-3">
            {_hasHydrated && isAuthenticated ? (
              <>
                <span className="text-sm text-neutral-500">Hi, {user?.name.split(' ')[0]}</span>
                <Link
                  href="/dashboard"
                  className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-600 hover:shadow-lg"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-100"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-600 hover:shadow-lg"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="font-display text-5xl font-extrabold text-neutral-900">
          Group travel,{' '}
          <span className="text-primary-600">simplified</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-500">
          Discover curated group trips from verified organizers. Escrow-protected
          payments, real reviews, and hassle-free travel from Pune.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          {_hasHydrated && isAuthenticated ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-primary-500 px-8 py-3 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-primary-600 hover:shadow-lg"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-lg bg-primary-500 px-8 py-3 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-primary-600 hover:shadow-lg"
              >
                Start exploring
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-primary-200 bg-primary-50 px-8 py-3 text-base font-semibold text-primary-700 transition-all duration-200 hover:bg-primary-100"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { title: 'Verified Organizers', desc: 'Every organizer is verified. Real reviews from real travelers.' },
            { title: 'Escrow Payments', desc: 'Your money is safe. Released to organizer only after the trip.' },
            { title: 'Group Trips', desc: 'Trekking, beach getaways, road trips — all from Pune.' },
          ].map((feature) => (
            <div key={feature.title} className="rounded-xl bg-white border border-neutral-200 p-6 shadow-sm">
              <h3 className="font-display text-lg font-bold text-neutral-800">{feature.title}</h3>
              <p className="mt-2 text-sm text-neutral-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
