'use client'

import { MapPin } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { TransferPoint } from '@shared/types/trip.types'

interface TransferPointsTableProps {
  pickupPoints: TransferPoint[]
  dropPoints: TransferPoint[]
}

function PointsColumn({ title, iconColor, points, emptyLabel }: {
  title: string
  iconColor: string
  points: TransferPoint[]
  emptyLabel: string
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <MapPin className={`h-4 w-4 ${iconColor}`} />
        <h4 className="text-sm font-semibold text-neutral-700">{title}</h4>
      </div>
      {points.length === 0 ? (
        <p className="text-sm text-neutral-400">{emptyLabel}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left">
                <th className="px-3 py-2 font-medium text-neutral-600">Location</th>
                <th className="px-3 py-2 font-medium text-neutral-600">Time</th>
                <th className="px-3 py-2 text-right font-medium text-neutral-600">Extra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {points.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 text-neutral-800">{p.label}</td>
                  <td className="px-3 py-2 text-neutral-500">{p.time ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {p.extraCharge > 0 ? (
                      <span className="text-accent-600">+{formatCurrency(p.extraCharge)}</span>
                    ) : (
                      <span className="text-success-500">Included</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Side-by-side comparison table of pickup and drop points for the trip detail page */
export function TransferPointsTable({ pickupPoints, dropPoints }: TransferPointsTableProps) {
  if (pickupPoints.length === 0 && dropPoints.length === 0) return null

  return (
    <section className="mt-8">
      <h3 className="mb-4 text-lg font-semibold text-neutral-800">Pickup & Drop Points</h3>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PointsColumn title="Pickup Points" iconColor="text-primary-500" points={pickupPoints} emptyLabel="No pickup points specified" />
        <PointsColumn title="Drop Points" iconColor="text-neutral-400" points={dropPoints} emptyLabel="No drop points specified" />
      </div>
    </section>
  )
}
