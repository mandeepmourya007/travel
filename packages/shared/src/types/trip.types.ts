export type TripType = 'ADVENTURE' | 'WEEKEND' | 'TREKKING' | 'BEACH' | 'CULTURAL' | 'ROAD_TRIP'
export type TripStatus = 'DRAFT' | 'ACTIVE' | 'FULL' | 'COMPLETED' | 'CANCELLED'
export type BookingMode = 'INSTANT' | 'REQUEST_BASED'
export type CancellationPolicy = 'FLEXIBLE' | 'MODERATE' | 'STRICT'

export interface TripSummary {
  id: string
  title: string
  slug: string
  destination: { id: string; name: string; slug: string }
  tripType: TripType
  bookingMode: BookingMode
  pricePerPerson: number
  earlyBirdPrice?: number | null
  startDate: string
  endDate: string
  maxGroupSize: number
  currentBookings: number
  organizer: {
    businessName: string
    rating: number
    totalReviews: number
    verified: boolean
  }
  photos: string[]
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
  tripType?: TripType
  bookingMode?: BookingMode
  minPrice?: number
  maxPrice?: number
  startDate?: string
  endDate?: string
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'date' | 'popularity'
  page?: number
  limit?: number
}

export interface CreateTripDto {
  title: string
  destinationId: string
  tripType: TripType
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

export type UpdateTripDto = Partial<CreateTripDto> & {
  acceptingBookings?: boolean
}

export interface OrganizerTripListItem {
  id: string
  title: string
  slug: string
  status: TripStatus
  acceptingBookings: boolean
  startDate: string
  endDate: string
  pricePerPerson: number
  currentBookings: number
  maxGroupSize: number
  bookingMode: BookingMode
  destination: { name: string }
  photos: string[]
  createdAt: string
  updatedAt: string
}

export interface TripEditHistoryItem {
  id: string
  editedBy: { id: string; name: string }
  changedFields: string[]
  editNote?: string | null
  createdAt: string
}

export interface OrganizerStats {
  activeTrips: number
  totalBookings: number
  revenue: number
  pendingRequests: number
}
