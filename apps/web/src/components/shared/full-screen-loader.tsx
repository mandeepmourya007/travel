'use client'

import { useLoadingStore } from '@/store/loading.store'

export function FullScreenLoader() {
  const { isLoading, message } = useLoadingStore()

  if (!isLoading) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm animate-fade-in"
      role="status"
      aria-live="assertive"
      aria-label={message || 'Loading'}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="spinner spinner-lg" />
        {message && (
          <p className="text-sm font-medium text-white">{message}</p>
        )}
      </div>
    </div>
  )
}
