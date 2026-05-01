'use client'

import Link from 'next/link'
import { ArrowLeft, Construction } from 'lucide-react'

export default function BookingPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 text-center">
      <Construction className="mx-auto h-16 w-16 text-primary-400" />
      <h1 className="mt-6 font-display text-2xl font-bold text-neutral-800">
        Booking Coming Soon
      </h1>
      <p className="mt-3 text-neutral-500 max-w-md mx-auto">
        We&apos;re building a secure booking experience with escrow payments.
        This feature will be available shortly.
      </p>
      <div className="mt-8 flex items-center justify-center gap-4">
        <Link
          href={`/trips/${slug}`}
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Trip
        </Link>
        <Link href="/trips" className="btn-primary text-sm">
          Browse Trips
        </Link>
      </div>
    </div>
  )
}
