'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import tokens from '@shared/theme/tokens.json'
import type { TripTypeCount } from '@shared/types/admin.types'

interface TripTypeChartProps {
  data: TripTypeCount[]
}

const GRID_COLOR = tokens.colors.neutral['200']

const COLORS = [
  tokens.colors.primary['500'],
  tokens.colors.success['500'],
  tokens.colors.warning['500'],
  tokens.colors.error['500'],
  tokens.colors.info['500'],
  tokens.colors.highlight['500'],
  tokens.colors.accent['500'],
  tokens.colors.primary['300'],
]

export function TripTypeChart({ data }: TripTypeChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
        No trip data yet
      </div>
    )
  }

  const formatted = data.map((d) => ({
    ...d,
    label: d.type.replace('_', ' '),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={formatted}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={50}
          paddingAngle={2}
        >
          {formatted.map((_entry, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${GRID_COLOR}` }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
