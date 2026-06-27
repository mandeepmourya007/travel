export function FetchingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center pt-16 bg-white/60 rounded-xl">
      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-md text-sm font-medium text-neutral-600">
        <span className="spinner h-4 w-4" />
        Loading…
      </div>
    </div>
  )
}
