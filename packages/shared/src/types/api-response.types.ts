export interface ApiResponse<T> {
  success: true
  data: T
  pagination?: PaginationMeta
}

export interface ApiError {
  success: false
  error: {
    code: string
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
