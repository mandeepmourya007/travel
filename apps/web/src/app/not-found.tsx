import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Page Not Found | ${APP_NAME}`,
  description: 'The page you are looking for does not exist or has been moved.',
}

export default function NotFound() {
  return (
    <AppShell>
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="card-static max-w-md w-full p-6 sm:p-12 text-center">
          <p className="text-5xl mb-3">🗺️</p>
          <p className="font-display text-6xl sm:text-7xl font-extrabold text-neutral-200 leading-none">
            404
          </p>
          <h1 className="mt-2 font-display text-lg font-bold text-neutral-900">
            Page not found
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/" className="btn-primary text-sm">
              Go Home
            </Link>
            <Link href="/trips" className="btn-secondary text-sm">
              Browse Trips
            </Link>
          </div>
          <p className="mt-8 text-xs text-neutral-400">{APP_NAME}</p>
        </div>
      </div>
    </AppShell>
  )
}
