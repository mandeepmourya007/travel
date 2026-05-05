'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageLightboxProps {
  images: string[]
  initialIndex?: number
  onClose: () => void
}

export function ImageLightbox({ images, initialIndex = 0, onClose }: ImageLightboxProps) {
  const [current, setCurrent] = useState(initialIndex)
  const hasMultiple = images.length > 1

  const goPrev = useCallback(() => {
    setCurrent((i) => (i > 0 ? i - 1 : images.length - 1))
  }, [images.length])

  const goNext = useCallback(() => {
    setCurrent((i) => (i < images.length - 1 ? i + 1 : 0))
  }, [images.length])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose, goPrev, goNext])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
        aria-label="Close preview"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      {hasMultiple && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white">
          {current + 1} / {images.length}
        </span>
      )}

      {/* Prev */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 md:left-6"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Image */}
      <div
        className="relative h-[80vh] w-[90vw] max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={images[current]}
          alt={`Photo ${current + 1} of ${images.length}`}
          fill
          sizes="90vw"
          className="object-contain"
          priority
        />
      </div>

      {/* Next */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext() }}
          className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 md:right-6"
          aria-label="Next image"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}

/**
 * Hook to manage lightbox state. Returns the state, opener, closer, and component props.
 */
export function useLightbox() {
  const [state, setState] = useState<{ images: string[]; index: number } | null>(null)

  const open = useCallback((images: string[], index = 0) => {
    setState({ images, index })
  }, [])

  const close = useCallback(() => setState(null), [])

  return { isOpen: !!state, open, close, lightboxProps: state ? { images: state.images, initialIndex: state.index, onClose: close } : null }
}
