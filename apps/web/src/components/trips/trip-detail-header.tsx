'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Calendar, Users, CheckCircle, Share2, ChevronLeft, ChevronRight, Armchair } from 'lucide-react'
import { cn } from '@/lib/utils'
import Autoplay from 'embla-carousel-autoplay'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'
import { useToast } from '@/components/shared/toast'
import { StarRating } from '@/components/shared/star-rating'
import { formatDateRange, getTripDuration, getSeatsLeft } from '@/lib/format'
import type { TripDetail } from '@shared/types/trip.types'

interface TripDetailHeaderProps {
  trip: TripDetail
}

export function TripDetailHeader({ trip }: TripDetailHeaderProps) {
  const { toast } = useToast()
  const seatsLeft = getSeatsLeft(trip.maxGroupSize, trip.currentBookings)
  const photos = trip.photos?.length ? trip.photos : []
  const totalPhotos = photos.length

  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const autoplayPlugin = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true }),
  )

  const onSelect = useCallback(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
  }, [api])

  useEffect(() => {
    if (!api) return
    onSelect()
    api.on('select', onSelect)
    return () => { api.off('select', onSelect) }
  }, [api, onSelect])

  const scrollTo = useCallback(
    (index: number) => api?.scrollTo(index),
    [api],
  )

  return (
    <div>
      {/* Photo carousel */}
      <div className="rounded-xl overflow-hidden">
        {/* Main image — Embla carousel */}
        <div className={cn('relative h-72 md:h-96 bg-neutral-200 group overflow-hidden')}>
          <Carousel
            setApi={setApi}
            opts={{ loop: true }}
            plugins={totalPhotos > 1 ? [autoplayPlugin.current] : []}
            className="h-full"
          >
            <CarouselContent className="-ml-0 h-full">
              {photos.map((photo, i) => (
                <CarouselItem key={photo} className="pl-0 relative h-72 md:h-96">
                  <Image
                    src={photo}
                    alt={`${trip.title} ${i + 1}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 66vw"
                    quality={65}
                    className="object-cover"
                    priority={i === 0}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {/* Prev / Next buttons */}
          {totalPhotos > 1 && (
            <>
              <button
                type="button"
                onClick={() => api?.scrollPrev()}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/80 backdrop-blur-sm p-1.5 text-neutral-700 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => api?.scrollNext()}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/80 backdrop-blur-sm p-1.5 text-neutral-700 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Dot indicators */}
          {totalPhotos > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  className={cn(
                    'h-2 rounded-full transition-all duration-200',
                    i === current
                      ? 'w-5 bg-white'
                      : 'w-2 bg-white/60 hover:bg-white/80',
                  )}
                />
              ))}
            </div>
          )}

          {/* Photo counter badge */}
          {totalPhotos > 1 && (
            <span className="absolute top-3 right-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {current + 1} / {totalPhotos}
            </span>
          )}
        </div>

      </div>

      {/* Title section */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="badge-primary text-xs font-semibold">
            {trip.tripTypeLabel}
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
          {trip.seatSelectionEnabled && (
            <span className="badge bg-primary-50 text-primary-700 text-xs font-semibold inline-flex items-center gap-1">
              <Armchair className="h-3 w-3" />
              Seat Selection
            </span>
          )}
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
          <Link
            href={`/destinations/${trip.destination.slug}`}
            prefetch={false}
            className="flex items-center gap-1.5 hover:text-primary-600 transition-colors"
          >
            <MapPin className="h-4 w-4 text-neutral-400" />
            {trip.destination.name}
          </Link>
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
          <Link href={`/trips/organizers/${trip.organizer.slug}`} prefetch={false} className="flex items-center gap-3 group/org">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
              {trip.organizer.businessName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-neutral-700 group-hover/org:text-primary-600 transition-colors">
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
          </Link>
          <button
            type="button"
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
