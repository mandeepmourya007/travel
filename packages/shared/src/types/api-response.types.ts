export interface ApiResponse<T> {
  success: true
  data: T
  pagination?: PaginationMeta
}

export interface ApiError {
  success: false
  error: {
    code: string
    /** Discriminator within the same `code` (e.g. SEAT_CONFLICT vs ALREADY_BOOKED under CONFLICT) */
    subCode?: string
    message: string
    details?: unknown[]
  }
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}
