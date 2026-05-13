import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripCategoryKeys } from '@/lib/query-keys'
import type {
  TripCategoryItem,
  AdminTripCategoryItem,
  TripTypeRequestItem,
  CreateTripCategoryDto,
  UpdateTripCategoryDto,
  CreateTripTypeRequestDto,
  ReviewTripTypeRequestDto,
} from '@shared/types/trip-category.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

// ─── Public ─────────────────────────────────────────────

export function useTripCategories() {
  return useQuery({
    queryKey: tripCategoryKeys.active(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: TripCategoryItem[] }>('/trip-categories')
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Admin: Category CRUD ───────────────────────────────

export function useAdminTripCategories() {
  return useQuery({
    queryKey: tripCategoryKeys.admin(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: AdminTripCategoryItem[] }>('/admin/trip-categories')
      return res.data.data
    },
  })
}

export function useCreateTripCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateTripCategoryDto) => {
      const res = await apiClient.post<{ success: true; data: TripCategoryItem }>('/admin/trip-categories', data)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripCategoryKeys.all })
    },
  })
}

export function useUpdateTripCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTripCategoryDto }) => {
      const res = await apiClient.put<{ success: true; data: TripCategoryItem }>(`/admin/trip-categories/${id}`, data)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripCategoryKeys.all })
    },
  })
}

export function useDeleteTripCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/trip-categories/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripCategoryKeys.all })
    },
  })
}

// ─── Admin: Request Review ──────────────────────────────

export function useAdminTripTypeRequests(filters?: { status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: tripCategoryKeys.requests(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.page != null) params.set('page', String(filters.page))
      if (filters?.limit != null) params.set('limit', String(filters.limit))
      const res = await apiClient.get<{
        success: true
        data: TripTypeRequestItem[]
        pagination: PaginationMeta
      }>(`/admin/trip-type-requests?${params}`)
      return res.data
    },
    placeholderData: keepPreviousData,
  })
}

export function useReviewTripTypeRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReviewTripTypeRequestDto }) => {
      const res = await apiClient.patch<{ success: true; data: TripTypeRequestItem }>(
        `/admin/trip-type-requests/${id}`,
        data,
      )
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripCategoryKeys.all })
    },
  })
}

// ─── Organizer: Submit/View Requests ────────────────────

export function useMyTripTypeRequests() {
  return useQuery({
    queryKey: tripCategoryKeys.myRequests(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: TripTypeRequestItem[] }>('/trip-type-requests/my')
      return res.data.data
    },
  })
}

export function useSubmitTripTypeRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateTripTypeRequestDto) => {
      const res = await apiClient.post<{ success: true; data: TripTypeRequestItem }>('/trip-type-requests', data)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripCategoryKeys.myRequests() })
    },
  })
}
