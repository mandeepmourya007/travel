import type { TripSummary } from './trip.types'
import type { PaginationMeta } from './api-response.types'

export interface Destination {
  id: string
  name: string
  slug: string
  state: string
  photoUrl?: string
  description?: string | null
  tripCount: number
  isPopular: boolean
}

export interface CreateDestinationDto {
  name: string
  slug?: string
  state: string
  photoUrl?: string
  description?: string
  isPopular?: boolean
}

export type UpdateDestinationDto = Partial<CreateDestinationDto>

export interface DestinationStats {
  avgPrice: number
  organizerCount: number
  upcomingCount: number
  minPrice: number
  maxPrice: number
}

export type DestinationTripSort = 'date' | 'price_asc' | 'price_desc'

export interface DestinationTripFilters {
  tripType?: string
  sort?: DestinationTripSort
  minPrice?: number
  maxPrice?: number
}

export interface DestinationDetailResponse {
  destination: Destination
  trips: TripSummary[]
  tripsPagination: PaginationMeta
  stats: DestinationStats
  relatedDestinations: Destination[]
}
