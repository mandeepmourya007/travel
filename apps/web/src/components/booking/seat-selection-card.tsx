'use client'

import { Armchair } from 'lucide-react'
import { SeatMapPicker } from '@/components/vehicle/seat-map-picker'

interface SeatSelectionCardProps {
  tripId: string
  numTravelers: number
  onSelectionChange: (seatIds: string[]) => void
}

export function SeatSelectionCard({ tripId, numTravelers, onSelectionChange }: SeatSelectionCardProps) {
  return (
    <div className="card-static p-4">
      <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5 mb-3">
        <Armchair className="h-4 w-4 text-primary-600" />
        Choose Your Seats
      </h3>
      <p className="text-xs text-neutral-500 mb-4">
        Select {numTravelers} seat{numTravelers > 1 ? 's' : ''} for your group
      </p>
      <SeatMapPicker
        tripId={tripId}
        maxSeats={numTravelers}
        onSelectionChange={onSelectionChange}
      />
    </div>
  )
}
