import { VERIFICATION_STATUS } from '@shared/constants'
import { TRENDING_SCORE_THRESHOLD } from './constants'

/**
 * Structural contract for mapTripToSummary.
 *
 * Defined as an explicit interface rather than Prisma.TripGetPayload because:
 * - The mapper is called with results from both `select` (TRIP_SELECT_SUMMARY)
 *   and `include` (TRIP_INCLUDE_SUMMARY) queries — no single Prisma payload covers both.
 * - `_tripTypeLabel` is an ad-hoc field injected by raw SQL joins; it is not in the schema.
 *
 * Keep in sync with TRIP_SELECT_SUMMARY in trip.repository.ts.
 */
export interface TripForSummary {
  id: string
  title: string
  slug: string
  tripType: string | null
  bookingMode: string
  pricePerPerson: number
  earlyBirdPrice: number | null
  earlyBirdDeadline: Date | null
  startDate: Date
  endDate: Date
  maxGroupSize: number
  currentBookings: number
  status: string
  acceptingBookings: boolean
  photos: string[]
  seatSelectionEnabled?: boolean | null
  trendingScore?: number | null
  _tripTypeLabel?: string
  destination?: { id: string; name: string; slug: string } | null
  organizer?: {
    id: string
    slug: string
    businessName: string
    rating: number
    totalReviews: number
    verificationStatus: string
  } | null
  _count?: { reviews: number; bookings?: number }
}

export function mapTripToSummary(trip: TripForSummary) {
  return {
    id: trip.id,
    title: trip.title,
    slug: trip.slug,
    destination: trip.destination
      ? { id: trip.destination.id, name: trip.destination.name, slug: trip.destination.slug }
      : undefined,
    tripType: trip.tripType,
    tripTypeLabel: trip._tripTypeLabel ?? trip.tripType?.replace(/_/g, ' ') ?? '',
    bookingMode: trip.bookingMode,
    pricePerPerson: trip.pricePerPerson,
    earlyBirdPrice: (trip.earlyBirdPrice && trip.earlyBirdDeadline && new Date(trip.earlyBirdDeadline) > new Date())
      ? trip.earlyBirdPrice
      : null,
    startDate: trip.startDate,
    endDate: trip.endDate,
    maxGroupSize: trip.maxGroupSize,
    currentBookings: trip.currentBookings,
    pendingBookingsCount: trip._count?.bookings ?? 0,
    status: trip.status,
    acceptingBookings: trip.acceptingBookings,
    photos: trip.photos,
    seatSelectionEnabled: trip.seatSelectionEnabled ?? false,
    isTrending: (trip.trendingScore ?? 0) >= TRENDING_SCORE_THRESHOLD,
    reviewCount: trip._count?.reviews ?? 0,
    organizer: trip.organizer
      ? {
          id: trip.organizer.id,
          slug: trip.organizer.slug,
          businessName: trip.organizer.businessName,
          rating: trip.organizer.rating,
          totalReviews: trip.organizer.totalReviews,
          verified: trip.organizer.verificationStatus === VERIFICATION_STATUS.APPROVED,
        }
      : undefined,
  }
}
