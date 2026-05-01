export type TripType = 'ADVENTURE' | 'WEEKEND' | 'TREKKING' | 'BEACH' | 'CULTURAL' | 'ROAD_TRIP'
export type TripStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
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

export interface TripDetail extends TripSummary {
  description: string
  minGroupSize: number
  cancellationPolicy: CancellationPolicy
  inclusions: string[]
  exclusions: string[]
  itinerary: ItineraryDay[]
  pickupLocation?: string
  pickupTime?: string
  status: TripStatus
}

export interface ItineraryDay {
  day: number
  title: string
  description: string
  activities: string[]
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
  pickupLocation?: string
  pickupTime?: string
}

export type UpdateTripDto = Partial<CreateTripDto>
