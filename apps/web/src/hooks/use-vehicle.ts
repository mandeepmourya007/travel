'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, type AppApiError } from '@/lib/api-client'
import { STALE_TIME_DEFAULT, STALE_TIME_REALTIME, REFETCH_INTERVAL_REALTIME } from '@/lib/constants'
import { vehicleKeys, tripKeys } from '@/lib/query-keys'
import type { MultiVehicleSeatMapResponse, CreateVehicleDto, UpdateVehicleDto, OrganizerVehicleListItem } from '@shared/types/vehicle.types'
import type { ApiResponse } from '@shared/types/api-response.types'

// ── Queries ─────────────────────────────────────────

/** Fetch seat map for traveler view (public) — returns all vehicles */
export function useSeatMap(tripId: string) {
  return useQuery<MultiVehicleSeatMapResponse, AppApiError>({
    queryKey: vehicleKeys.seatMap(tripId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MultiVehicleSeatMapResponse>>(
        `/trips/${tripId}/seats`,
      )
      return data.data
    },
    enabled: !!tripId,
    staleTime: STALE_TIME_REALTIME,
    refetchInterval: REFETCH_INTERVAL_REALTIME,
  })
}

/** Fetch seat map for organizer view (includes traveler names) — returns all vehicles */
export function useOrganizerSeatMap(tripId: string) {
  return useQuery<MultiVehicleSeatMapResponse, AppApiError>({
    queryKey: vehicleKeys.organizerSeatMap(tripId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MultiVehicleSeatMapResponse>>(
        `/trips/${tripId}/vehicle`,
      )
      return data.data
    },
    enabled: !!tripId,
    staleTime: STALE_TIME_DEFAULT,
  })
}

/** Fetch all vehicles for a trip (organizer, multi-vehicle) */
export function useOrganizerVehicles(tripId: string) {
  return useQuery<OrganizerVehicleListItem[], AppApiError>({
    queryKey: vehicleKeys.vehicleList(tripId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<OrganizerVehicleListItem[]>>(
        `/trips/${tripId}/vehicles`,
      )
      return data.data
    },
    enabled: !!tripId,
    staleTime: STALE_TIME_DEFAULT,
  })
}

// ── Mutations ───────────────────────────────────────

/** Create vehicle with seat layout */
export function useCreateVehicle(tripId: string) {
  const queryClient = useQueryClient()

  return useMutation<unknown, AppApiError, CreateVehicleDto>({
    mutationFn: async (dto) => {
      const { data } = await apiClient.post(`/trips/${tripId}/vehicle`, dto)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
    },
  })
}

/** Update vehicle layout */
export function useUpdateVehicle(tripId: string, vehicleId: string) {
  const queryClient = useQueryClient()

  return useMutation<unknown, AppApiError, UpdateVehicleDto>({
    mutationFn: async (dto) => {
      const { data } = await apiClient.put(`/trips/${tripId}/vehicle/${vehicleId}`, dto)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
    },
  })
}

/** Delete vehicle */
export function useDeleteVehicle(tripId: string) {
  const queryClient = useQueryClient()

  return useMutation<unknown, AppApiError, string>({
    mutationFn: async (vehicleId) => {
      const { data } = await apiClient.delete(`/trips/${tripId}/vehicle/${vehicleId}`)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
    },
  })
}

/** Hold seats during booking */
export function useHoldSeats(tripId: string) {
  const queryClient = useQueryClient()

  return useMutation<unknown, AppApiError, { seatIds: string[]; bookingId: string }>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post(`/trips/${tripId}/seats/hold`, payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.seatMap(tripId) })
    },
  })
}
