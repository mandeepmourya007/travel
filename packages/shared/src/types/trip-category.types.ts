export interface TripCategoryItem {
  id: string
  value: string
  label: string
  icon: string | null
  isActive: boolean
  sortOrder: number
}

export interface CreateTripCategoryDto {
  value: string
  label: string
  icon?: string
  sortOrder?: number
}

export interface UpdateTripCategoryDto {
  label?: string
  icon?: string | null
  isActive?: boolean
  sortOrder?: number
}

export interface AdminTripCategoryItem extends TripCategoryItem {
  tripCount: number
}

export type TripTypeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface TripTypeRequestItem {
  id: string
  suggestedName: string
  reason: string
  status: TripTypeRequestStatus
  adminNote: string | null
  reviewedAt: string | null
  createdAt: string
  organizer: { id: string; businessName: string }
}

export interface CreateTripTypeRequestDto {
  suggestedName: string
  reason: string
}

export interface ReviewTripTypeRequestDto {
  status: 'APPROVED' | 'REJECTED'
  adminNote?: string
}

export interface TripTypeRequestFilters {
  status?: TripTypeRequestStatus
  page?: number
  limit?: number
}
