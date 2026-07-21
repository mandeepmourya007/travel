export type TripType = string
export type TripStatus = 'DRAFT' | 'ACTIVE' | 'FULL' | 'COMPLETED' | 'CANCELLED'
export type BookingMode = 'INSTANT' | 'REQUEST_BASED'
export type CancellationPolicy = 'FLEXIBLE' | 'MODERATE' | 'STRICT'

export interface TripSummary {
  id: string
  title: string
  slug: string
  destination: { id: string; name: string; slug: string }
  tripType: string
  tripTypeLabel: string
  bookingMode: BookingMode
  pricePerPerson: number
  earlyBirdPrice?: number | null
  startDate: string
  endDate: string
  maxGroupSize: number
  currentBookings: number
  organizer: {
    id: string
    slug: string
    businessName: string
    rating: number
    totalReviews: number
    verified: boolean
  }
  photos: string[]
  seatSelectionEnabled?: boolean
  isTrending?: boolean
  acceptingBookings: boolean
  bookingsPausedReason?: string | null
}

export interface TripDetailReview {
  id: string
  overallRating: number
  comment?: string | null
  photos: string[]
  editedAt?: string | null
  organizerReply?: string | null
  organizerReplyAt?: string | null
  createdAt: string
  user: { id: string; name: string; avatarUrl?: string | null }
}

export interface TripDetail extends Omit<TripSummary, 'organizer'> {
  description: string
  minGroupSize: number
  cancellationPolicy: CancellationPolicy
  inclusions: string[]
  exclusions: string[]
  itinerary: ItineraryDay[]
  pickupPoints: TransferPoint[]
  dropPoints: TransferPoint[]
  status: TripStatus
  acceptingBookings: boolean
  /** Public reason shown to travelers when bookings are paused. Null when bookings are open. */
  bookingsPausedReason?: string | null
  /** True when the trip has been hidden from public search and detail pages. */
  isHidden: boolean
  bookingDeadline?: string | null
  earlyBirdDeadline?: string | null
  organizer: TripSummary['organizer'] & {
    id: string
    totalTrips?: number
    memberSince?: string
  }
  reviews: TripDetailReview[]
}

export interface ItineraryActivity {
  time?: string
  title: string
  description?: string
}

export interface ItineraryDay {
  day: number
  date?: string
  title: string
  subtitle?: string
  description: string
  activities: ItineraryActivity[]
  includes?: string[]
  excludes?: string[]
}

export interface TransferPoint {
  id: string
  type: 'PICKUP' | 'DROP'
  label: string
  address?: string | null
  time?: string | null
  extraCharge: number
  sortOrder: number
}

export interface CreateTransferPointDto {
  label: string
  address?: string
  time?: string
  extraCharge?: number
}

export interface TripFilters {
  destinationId?: string
  destination?: string
  /** Free-text search: OR-matches title, description, destination name (ILIKE) */
  q?: string
  tripType?: string
  bookingMode?: BookingMode
  minPrice?: number
  maxPrice?: number
  startDate?: string
  endDate?: string
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'date' | 'popularity' | 'newest' | 'trending'
  page?: number
  limit?: number
}

export interface CreateTripDto {
  title: string
  destinationId: string
  tripType: string
  bookingMode: BookingMode
  description: string
  startDate: string
  endDate: string
  pricePerPerson: number
  earlyBirdPrice?: number
  earlyBirdDeadline?: string
  minGroupSize: number
  maxGroupSize: number
  cancellationPolicy: CancellationPolicy
  inclusions: string[]
  exclusions: string[]
  itinerary: ItineraryDay[]
  photos: string[]
  pickupPoints: CreateTransferPointDto[]
  dropPoints: CreateTransferPointDto[]
  itineraryDocUrl?: string
  bookingDeadline?: string
}

export type UpdateTripDto = Partial<CreateTripDto>

/** DTO for stop/resume bookings on a trip (organizer or admin). */
export interface ToggleBookingsDto {
  paused: boolean
  reason?: string
}

/** DTO for hide/unhide a trip (organizer or admin). */
export interface SetVisibilityDto {
  hidden: boolean
  reason?: string
}

export interface OrganizerTripListItem {
  id: string
  title: string
  slug: string
  status: TripStatus
  acceptingBookings: boolean
  /** Public reason shown to travelers when bookings are paused. */
  bookingsPausedReason?: string | null
  /**
   * Role that applied the booking pause. Non-null only when paused.
   * If 'ADMIN', the organizer cannot resume — only an admin can.
   */
  bookingsPausedBy?: string | null
  /** True when trip is hidden from public search and detail pages. */
  isHidden: boolean
  /**
   * Role that applied the hide. Non-null only when hidden.
   * If 'ADMIN', the organizer cannot unhide — only an admin can.
   */
  hiddenBy?: string | null
  /** Internal reason stored when the trip was hidden. Not shown to travelers. */
  hiddenReason?: string | null
  startDate: string
  endDate: string
  pricePerPerson: number
  /** Seat count: sum of numTravelers across CONFIRMED bookings (denormalized Trip column). */
  currentBookings: number
  /** Booking record count from live Booking table (CONFIRMED+COMPLETED rows, not seat count). */
  confirmedGroupCount: number
  /** Trip requests still in organizer queue (PENDING or APPROVED). REQUEST_BASED trips only. */
  pendingRequestCount: number
  /** PENDING_PAYMENT bookings: payments in-flight (30-min TTL). INSTANT trips only. */
  pendingPaymentCount: number
  maxGroupSize: number
  bookingMode: BookingMode
  destination: { name: string }
  reviewCount: number
  photos: string[]
  createdAt: string
  updatedAt: string
}

export interface TripFieldChange {
  field: string
  previousValue: unknown
}

export interface TripEditHistoryItem {
  id: string
  editedBy: { id: string; name: string }
  changes: TripFieldChange[]
  editNote?: string | null
  createdAt: string
}

export interface OrganizerStats {
  activeTrips: number
  totalBookings: number
  revenue: number
  pendingRequests: number
}
