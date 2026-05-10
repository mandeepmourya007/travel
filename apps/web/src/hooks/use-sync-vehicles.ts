'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { vehicleKeys, tripKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { CreateVehicleDto, OrganizerVehicleListItem } from '@shared/types/vehicle.types'

/**
 * Plain async function for creating vehicles on a newly created trip.
 * Safe to call from mutation onSuccess callbacks (not a hook).
 */
export async function createVehiclesForTrip(
  tripId: string,
  vehicleData: CreateVehicleDto[],
): Promise<void> {
  await Promise.all(
    vehicleData.map((v) => apiClient.post(`/trips/${tripId}/vehicle`, v)),
  )
}

/**
 * Compares old vehicle data with new form data to detect meaningful changes.
 * Returns true if the user actually modified the vehicle configuration.
 */
function hasVehicleDataChanged(
  existing: OrganizerVehicleListItem[],
  incoming: CreateVehicleDto[],
): boolean {
  if (existing.length !== incoming.length) return true

  for (let i = 0; i < existing.length; i++) {
    const old = existing[i]
    const nw = incoming[i]
    if (old.label !== nw.label) return true
    if (old.vehicleType !== nw.vehicleType) return true
    if (JSON.stringify(old.layout) !== JSON.stringify(nw.layout)) return true
    if (JSON.stringify(old.layoutConfig) !== JSON.stringify(nw.layoutConfig)) return true
  }

  return false
}

interface SyncVehiclesOptions {
  tripId: string
  existingVehicles?: OrganizerVehicleListItem[] | null
}

/**
 * Hook that encapsulates all vehicle CRUD operations during trip create/edit.
 *
 * - On **create**: simply POSTs new vehicles.
 * - On **edit**: compares existing vs incoming data and only deletes/recreates
 *   if changes are detected. Stops on first delete failure (e.g. booked seats).
 *
 * Returns a `syncVehicles` callback to call inside onSuccess of trip mutation.
 */
export function useSyncVehicles({ tripId, existingVehicles }: SyncVehiclesOptions) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const syncVehicles = useCallback(
    async (newVehicleData: CreateVehicleDto[] | undefined) => {
      const oldVehicles = existingVehicles ?? []
      const oldIds = oldVehicles.map((v) => v.id)

      try {
        if (newVehicleData && newVehicleData.length > 0) {
          if (oldIds.length === 0) {
            // Create-only: no existing vehicles to delete
            await Promise.all(
              newVehicleData.map((v) => apiClient.post(`/trips/${tripId}/vehicle`, v)),
            )
          } else if (hasVehicleDataChanged(oldVehicles, newVehicleData)) {
            // Edit: data changed — delete old, create new (sequential delete guards booked seats)
            for (const vid of oldIds) {
              await apiClient.delete(`/trips/${tripId}/vehicle/${vid}`)
            }
            await Promise.all(
              newVehicleData.map((v) => apiClient.post(`/trips/${tripId}/vehicle`, v)),
            )
          }
          // else: data unchanged — skip entirely
        } else if (oldIds.length > 0) {
          // User disabled vehicles — delete sequentially
          for (const vid of oldIds) {
            await apiClient.delete(`/trips/${tripId}/vehicle/${vid}`)
          }
        }

        queryClient.invalidateQueries({ queryKey: vehicleKeys.all })
        queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) })
      } catch {
        toast({
          variant: 'error',
          title: 'Trip saved but vehicle update failed. Configure it from the Seats tab.',
        })
      }
    },
    [tripId, existingVehicles, queryClient, toast],
  )

  return { syncVehicles }
}
