import { Spinner } from '@/components/shared/spinner'

export default function RootLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="lg" label="Loading..." />
    </div>
  )
}
