'use client'

import Image from 'next/image'
import { MapPin, Calendar, Users, CheckCircle, Share2 } from 'lucide-react'
import { useToast } from '@/components/shared/toast'
import { StarRating } from '@/components/shared/star-rating'
import { formatDateRange, getTripDuration, getSeatsLeft, tripTypeLabel } from '@/lib/format'
import type { TripDetail } from '@shared/types/trip.types'

interface TripDetailHeaderProps {
  trip: TripDetail
}

export function TripDetailHeader({ trip }: TripDetailHeaderProps) {
  const { toast } = useToast()
  const seatsLeft = getSeatsLeft(trip.maxGroupSize, trip.currentBookings)

  return (
    <div>
      {/* Photo gallery */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 rounded-xl overflow-hidden">
        <div className="relative md:col-span-2 h-72 md:h-96 bg-neutral-200">
          {trip.photos[0] && (
            <Image
              src={trip.photos[0]}
              alt={trip.title}
              fill
              sizes="(max-width: 768px) 100vw, 66vw"
              className="object-cover"
              priority
            />
          )}
        </div>
        <div className="hidden md:grid grid-rows-2 gap-2">
          {trip.photos.slice(1, 3).map((photo, i) => (
            <div key={i} className="relative bg-neutral-200">
              <Image
                src={photo}
                alt={`${trip.title} ${i + 2}`}
                fill
                sizes="33vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Title section */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="badge-primary text-xs font-semibold">
            {tripTypeLabel(trip.tripType)}
          </span>
          <span
            className={
              trip.bookingMode === 'INSTANT'
                ? 'badge bg-success-50 text-success-500 text-xs font-semibold'
                : 'badge bg-warning-50 text-warning-500 text-xs font-semibold'
            }
          >
            {trip.bookingMode === 'INSTANT' ? 'Instant Book' : 'Request to Book'}
          </span>
          {seatsLeft > 0 && seatsLeft <= 5 && (
            <span className="badge bg-accent-50 text-accent-700 text-xs font-semibold">
              Only {seatsLeft} seats left!
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
          {trip.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-500">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-neutral-400" />
            {trip.destination.name}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-neutral-400" />
            {formatDateRange(trip.startDate, trip.endDate)} &middot;{' '}
            {getTripDuration(trip.startDate, trip.endDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-neutral-400" />
            {trip.currentBookings}/{trip.maxGroupSize} joined
          </span>
        </div>

        {/* Organizer row */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
              {trip.organizer.businessName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-neutral-700">
                  {trip.organizer.businessName}
                </span>
                {trip.organizer.verified && (
                  <CheckCircle className="h-4 w-4 text-primary-500" />
                )}
              </div>
              {trip.organizer.totalReviews > 0 && (
                <StarRating
                  rating={trip.organizer.rating}
                  size="sm"
                  showValue
                  count={trip.organizer.totalReviews}
                />
              )}
            </div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href)
              toast({ variant: 'success', title: 'Link copied to clipboard' })
            }}
            className="btn-ghost flex items-center gap-2 text-sm"
            aria-label="Share trip"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>

        {/* Description */}
        {trip.description && (
          <p className="mt-6 text-neutral-600 leading-relaxed whitespace-pre-line">
            {trip.description}
          </p>
        )}
      </div>
    </div>
  )
}
