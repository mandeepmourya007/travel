'use client'

import { useState } from 'react'
import { ChevronDown, Phone, Users, Armchair } from 'lucide-react'
import type { TravelerDetailItem } from '@shared/types/booking.types'

/** Props for the expandable traveler details section on booking cards */
interface TravelerDetailsAccordionProps {
  travelers: TravelerDetailItem[]
}

/**
 * Expandable traveler details for a booking card.
 * - Empty array → renders nothing
 * - Single traveler → inline name
 * - Multiple travelers → collapsible accordion with table
 */
export function TravelerDetailsAccordion({ travelers }: TravelerDetailsAccordionProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (travelers.length === 0) return null

  // Single traveler — show inline
  if (travelers.length === 1) {
    const seat = travelers[0].assignedSeat
    return (
      <p className="text-sm text-neutral-600">
        Booked for: <span className="font-medium text-neutral-800">{travelers[0].name}</span>
        {seat && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-700">
            <Armchair className="h-3 w-3" /> Seat {seat.seatNumber} · {seat.vehicleName}
          </span>
        )}
      </p>
    )
  }

  // Multiple travelers — accordion
  return (
    <div className="mt-1">
      <button
        type="button"
        aria-label={`${travelers.length} travelers`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors"
      >
        <Users className="h-3.5 w-3.5" />
        {travelers.length} travelers
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="mt-2 max-h-[70vh] overflow-auto rounded-lg border border-neutral-200">
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Age</th>
                <th className="px-4 py-2">Gender</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2">Seat</th>
                <th className="px-4 py-2">Emergency Contact</th>
              </tr>
            </thead>
            <tbody>
              {travelers.map((td) => (
                <tr key={td.id} className="border-b border-neutral-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-neutral-800">
                    {td.name}
                    {td.isPrimary && (
                      <span className="ml-1.5 text-[10px] badge badge-primary">
                        Primary
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{td.age ?? '—'}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{td.gender ?? '—'}</td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {td.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {td.phone}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {td.assignedSeat ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                        <Armchair className="h-3 w-3" /> {td.assignedSeat.seatLabel} · {td.assignedSeat.vehicleName}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {td.emergencyContactName ? (
                      <span>
                        {td.emergencyContactName}
                        {td.emergencyContactPhone ? ` · ${td.emergencyContactPhone}` : ''}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="divide-y divide-neutral-100 md:hidden">
            {travelers.map((td) => (
              <div key={td.id} className="space-y-1 px-4 py-3">
                <p className="font-medium text-neutral-800">
                  {td.name}
                  {td.isPrimary && (
                    <span className="ml-1.5 text-[10px] badge badge-primary">
                      Primary
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-neutral-500">
                  <span>Age: {td.age ?? '—'}</span>
                  <span>{td.gender ?? '—'}</span>
                  {td.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {td.phone}
                    </span>
                  )}
                </div>
                {td.assignedSeat && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                    <Armchair className="h-3 w-3" /> Seat {td.assignedSeat.seatNumber} · {td.assignedSeat.vehicleName}
                  </span>
                )}
                {td.emergencyContactName && (
                  <p className="text-xs text-neutral-400">
                    Emergency: {td.emergencyContactName}
                    {td.emergencyContactPhone ? ` · ${td.emergencyContactPhone}` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
