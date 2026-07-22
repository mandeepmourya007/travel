'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTripDetail } from '@/hooks/use-trip-detail'
import { useSublinkResolve, useRecordAttribution } from '@/hooks/use-reseller'
import { getResellerRefCookie, setResellerRefCookie } from '@/lib/reseller-cookie'
import { getEffectivePrice } from '@/lib/trip-utils'
import { useAuthStore } from '@/store/auth.store'
import { TripDetailHeader } from '@/components/trips/trip-detail-header'
import { TripItinerary } from '@/components/trips/trip-itinerary'
import { TripBookingCard } from '@/components/trips/trip-booking-card'
import { TripStickyBookBar } from '@/components/trips/trip-sticky-book-bar'
import { TripReviews } from '@/components/trips/trip-reviews'
import { TransferPointsTable } from '@/components/trips/transfer-points-table'
import { TripVehiclePreview } from '@/components/trips/trip-vehicle-preview'
import { TripOrganizerCard } from '@/components/trips/trip-organizer-card'
import { ChatWithOrganizerButton } from '@/components/chat'
import { ArrowLeft } from 'lucide-react'
import type { TripDetail } from '@shared/types/trip.types'

interface TripDetailClientProps {
  trip: TripDetail
  slug: string
}

export function TripDetailClient({
  trip: initialTrip,
  slug,
}: TripDetailClientProps) {
  const { data: trip, error, refetch } = useTripDetail(slug, initialTrip)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const recordAttribution = useRecordAttribution()
  const attributedTokenRef = useRef<string | null>(null)

  // Reseller sublink token resolution is entirely client-side (this component is
  // rendered inside a statically-generated/ISR page — see trips/[slug]/page.tsx —
  // so it cannot read `searchParams` server-side without breaking that page's static
  // rendering). Token resolution order (see plan §2): `?ref` in the URL wins;
  // otherwise fall back to the `reseller_ref` cookie written on a previous visit.
  const searchParams = useSearchParams()
  const urlToken = searchParams.get('ref') ?? undefined

  const [cookieToken, setCookieToken] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (urlToken) {
      setResellerRefCookie(urlToken)
    } else {
      setCookieToken(getResellerRefCookie())
    }
  }, [urlToken])

  const activeTokenCandidate = urlToken ?? cookieToken
  const tokenResolve = useSublinkResolve(activeTokenCandidate)

  const resolvedSublink = tokenResolve.data
  const activeToken = tokenResolve.data ? activeTokenCandidate : undefined

  // Fire attribution once per token, only when authenticated — this is what makes the
  // price survive on another device with no URL/cookie (SublinkAttribution upsert).
  useEffect(() => {
    if (!isAuthenticated || !activeToken) return
    if (attributedTokenRef.current === activeToken) return
    attributedTokenRef.current = activeToken
    recordAttribution.mutate(activeToken)
  }, [isAuthenticated, activeToken, recordAttribution])

  if (error || !trip) {
    const message =
      (error as Error)?.message ||
      'Could not load this trip. It may have been removed.'

    return (
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 flex justify-center">
        <div className="max-w-md w-full rounded-xl bg-error-50 border border-neutral-200 p-8 text-center">
          <p className="text-4xl mb-2">😕</p>
          <h2 className="text-base font-semibold text-neutral-800">
            Trip not found
          </h2>
          <p className="mt-1 text-sm text-neutral-500">{message}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/trips"
              prefetch={false}
              className="btn-secondary inline-flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              All Trips
            </Link>
            <button
              onClick={() => refetch()}
              className="btn-outline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Resolve DTO only carries the merged `effectivePrice` (no basePrice/markupAmount —
  // see ResolvedSublinkDto). Derive the per-person markup locally from the same
  // base-price logic the backend used (getEffectivePrice) purely for display.
  const markupAmount = resolvedSublink ? resolvedSublink.effectivePrice - getEffectivePrice(trip) : 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-36 md:pb-28 lg:pb-8 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-10">
          <TripDetailHeader trip={trip} />
          <TripItinerary itinerary={trip.itinerary} />
          {trip.seatSelectionEnabled && (
            <TripVehiclePreview
              tripId={trip.id}
              maxGroupSize={trip.maxGroupSize}
              currentBookings={trip.currentBookings}
            />
          )}
          <TransferPointsTable pickupPoints={trip.pickupPoints} dropPoints={trip.dropPoints} />
          <TripOrganizerCard organizer={trip.organizer} />
          <ChatWithOrganizerButton tripId={trip.id} />
          <TripReviews reviews={trip.reviews} />
        </div>

        {/* Sidebar — hidden on mobile, sticky sidebar on desktop */}
        <div className="hidden lg:block lg:col-span-1">
          <TripBookingCard trip={trip} markupAmount={markupAmount} />
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <TripStickyBookBar trip={trip} markupAmount={markupAmount} />
    </div>
  )
}
