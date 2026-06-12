/**
 * Chart skeleton lives apart from the chart components so it can be used
 * as a `next/dynamic` loading fallback without statically pulling recharts
 * (+d3) into the admin route chunk.
 */
export function ChartSkeleton() {
  return <div className="skeleton h-[280px] w-full rounded-lg" />
}
