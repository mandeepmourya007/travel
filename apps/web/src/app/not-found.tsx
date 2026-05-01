import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="card-static max-w-md w-full p-12 text-center">
        <p className="text-5xl mb-3">🗺️</p>
        <p className="font-display text-7xl font-extrabold text-neutral-200 leading-none">
          404
        </p>
        <h1 className="mt-2 font-display text-lg font-bold text-neutral-900">
          Page not found
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/" className="btn-primary text-sm">
            Go Home
          </Link>
          <Link href="/trips" className="btn-secondary text-sm">
            Browse Trips
          </Link>
        </div>
      </div>
    </div>
  )
}
