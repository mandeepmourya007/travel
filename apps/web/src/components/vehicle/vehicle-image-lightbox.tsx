'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Props ──────────────────────────────────────────

interface VehicleImageLightboxProps {
  open: boolean
  onClose: () => void
  photos: string[]
  initialIndex?: number
  vehicleName?: string
}

// ─── Component ──────────────────────────────────────

export function VehicleImageLightbox({
  open,
  onClose,
  photos,
  initialIndex = 0,
  vehicleName,
}: VehicleImageLightboxProps) {
  const [activeIdx, setActiveIdx] = useState(initialIndex)

  // Sync initialIndex when lightbox opens
  useEffect(() => {
    if (open) setActiveIdx(initialIndex)
  }, [open, initialIndex])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setActiveIdx((p) => (p > 0 ? p - 1 : photos.length - 1))
      if (e.key === 'ArrowRight') setActiveIdx((p) => (p < photos.length - 1 ? p + 1 : 0))
    },
    [onClose, photos.length],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  if (!open || photos.length === 0) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={vehicleName ? `${vehicleName} photos` : 'Vehicle photos'}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative flex w-full max-w-3xl flex-col items-center px-4">
        {/* Header */}
        <div className="mb-3 flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            {vehicleName && (
              <span className="text-sm font-semibold text-white/90">{vehicleName}</span>
            )}
            <span className="text-xs text-white/60">
              {activeIdx + 1} / {photos.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Image */}
        <div className="relative w-full overflow-hidden rounded-xl bg-neutral-900">
          <img
            src={photos[activeIdx]}
            alt={`Vehicle photo ${activeIdx + 1}`}
            className="mx-auto max-h-[70vh] w-full object-contain"
          />

          {/* Nav arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={() => setActiveIdx((p) => (p > 0 ? p - 1 : photos.length - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setActiveIdx((p) => (p < photos.length - 1 ? p + 1 : 0))}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
                aria-label="Next photo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Dot indicators */}
        {photos.length > 1 && (
          <div className="mt-3 flex gap-1.5">
            {photos.map((photoUrl, idx) => (
              <button
                key={photoUrl}
                onClick={() => setActiveIdx(idx)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  idx === activeIdx
                    ? 'w-6 bg-white'
                    : 'w-2 bg-white/40 hover:bg-white/60',
                )}
                aria-label={`Go to photo ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
