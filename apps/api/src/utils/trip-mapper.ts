import { VERIFICATION_STATUS } from '@shared/constants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTripToSummary(trip: any) {
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
    earlyBirdPrice: trip.earlyBirdPrice,
    startDate: trip.startDate,
    endDate: trip.endDate,
    maxGroupSize: trip.maxGroupSize,
    currentBookings: trip.currentBookings,
    status: trip.status,
    acceptingBookings: trip.acceptingBookings,
    photos: trip.photos,
    seatSelectionEnabled: trip.seatSelectionEnabled ?? false,
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
