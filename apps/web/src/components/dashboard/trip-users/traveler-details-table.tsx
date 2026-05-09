'use client'

import { Phone } from 'lucide-react'

interface TravelerRow {
  id?: string
  name: string
  phone: string | null
  age: number | null
  gender: string | null
  isPrimary: boolean
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
}

interface TravelerDetailsTableProps {
  travelers: TravelerRow[]
}

export function TravelerDetailsTable({ travelers }: TravelerDetailsTableProps) {
  if (travelers.length === 0) return null

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2">Travelers</p>
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Age</th>
              <th className="px-4 py-2">Gender</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Emergency</th>
            </tr>
          </thead>
          <tbody>
            {travelers.map((td, idx) => (
              <tr key={td.id ?? idx} className="border-b border-neutral-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-neutral-800">
                  {td.name}
                  {td.isPrimary && (
                    <span className="ml-1.5 text-[10px] badge badge-primary">Primary</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{td.age ?? '—'}</td>
                <td className="px-4 py-2.5 text-neutral-600">{td.gender ?? '—'}</td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {td.phone ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {td.phone}
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
      </div>
    </div>
  )
}
