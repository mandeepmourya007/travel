'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import tokens from '@shared/theme/tokens.json'
import type { RevenueTrendPoint } from '@shared/types/admin.types'

const CHART_COLOR = tokens.colors.primary['600']
const GRID_COLOR = tokens.colors.neutral['200']
const TICK_COLOR = tokens.colors.neutral['500']

interface RevenueChartProps {
  data: RevenueTrendPoint[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
        No revenue data yet
      </div>
    )
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    display: `₹${d.revenue.toLocaleString('en-IN')}`,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="label" fontSize={12} tick={{ fill: TICK_COLOR }} />
        <YAxis
          fontSize={12}
          tick={{ fill: TICK_COLOR }}
          tickFormatter={(v: number) => {
            if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(0)}Cr`
            if (v >= 100_000) return `₹${(v / 100_000).toFixed(0)}L`
            if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`
            return `₹${v}`
          }}
        />
        <Tooltip
          formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
          contentStyle={{ borderRadius: 8, border: `1px solid ${GRID_COLOR}` }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke={CHART_COLOR}
          strokeWidth={2}
          dot={{ r: 4, fill: CHART_COLOR }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function RevenueChartSkeleton() {
  return <div className="skeleton h-[280px] w-full rounded-lg" />
}
