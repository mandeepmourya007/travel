import type { TripFilters } from '@shared/types/trip.types'

export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (filters: TripFilters) => [...tripKeys.lists(), filters] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (slug: string) => [...tripKeys.details(), slug] as const,
}

export const bookingKeys = {
  all: ['bookings'] as const,
  myBookings: () => [...bookingKeys.all, 'my'] as const,
  detail: (id: string) => [...bookingKeys.all, 'detail', id] as const,
}

export const tripRequestKeys = {
  all: ['tripRequests'] as const,
  forTrip: (tripId: string) => [...tripRequestKeys.all, 'trip', tripId] as const,
  myRequests: () => [...tripRequestKeys.all, 'my'] as const,
}

export const destinationKeys = {
  all: ['destinations'] as const,
  list: () => [...destinationKeys.all, 'list'] as const,
}

export const reviewKeys = {
  all: ['reviews'] as const,
  forTrip: (tripId: string) => [...reviewKeys.all, 'trip', tripId] as const,
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread'] as const,
}
