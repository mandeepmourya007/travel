'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import tokens from '@shared/theme/tokens.json'
import { BOOKING_STATUS_COLORS } from '@/lib/admin-utils'
import type { BookingStatusCount } from '@shared/types/admin.types'

interface BookingsChartProps {
  data: BookingStatusCount[]
}

const GRID_COLOR = tokens.colors.neutral['200']
const TICK_COLOR = tokens.colors.neutral['500']

export function BookingsChart({ data }: BookingsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
        No booking data yet
      </div>
    )
  }

  const formatted = data.map((d) => ({
    ...d,
    label: d.status.replace('_', ' '),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="label" fontSize={11} tick={{ fill: TICK_COLOR }} />
        <YAxis fontSize={12} tick={{ fill: TICK_COLOR }} />
        <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${GRID_COLOR}` }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {formatted.map((entry, i) => (
            <Cell key={i} fill={BOOKING_STATUS_COLORS[entry.status] ?? TICK_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
