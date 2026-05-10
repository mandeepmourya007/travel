'use client'

export default function DestinationDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 flex justify-center">
      <div className="max-w-md w-full rounded-xl bg-error-50 border border-error-200 p-8 text-center">
        <p className="text-4xl mb-2">😕</p>
        <h2 className="text-base font-semibold text-neutral-800">
          Destination not found
        </h2>
        <p className="mt-1 text-sm text-neutral-500">{error.message}</p>
        <button
          onClick={reset}
          className="btn-outline mt-4"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
