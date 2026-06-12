'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useToast } from '@/components/shared/toast'
import type { TripSummary } from '@shared/types/trip.types'

const STORAGE_KEY = 'compare-queue'
const MAX_ITEMS = 3

/**
 * Lightweight trip snapshot stored in the compare queue.
 * Keeps only the fields needed for the CompareBar UI — avoids
 * fetching full TripDetail until the user navigates to /trips/compare.
 */
export interface CompareItem {
  /** Trip UUID */
  id: string
  /** URL-safe slug used in /trips/:slug routes */
  slug: string
  /** Display title shown in the compare bar thumbnails */
  title: string
  /** Cover photo URL (first photo from trip.photos) */
  photo?: string
  /** Price per person in whole rupees (INR) */
  price: number
}

interface CompareQueueContextValue {
  items: CompareItem[]
  selectedIds: string[]
  isOpen: boolean
  toggle: (trip: TripSummary) => void
  remove: (id: string) => void
  clear: () => void
  close: () => void
}

const CompareQueueContext = createContext<CompareQueueContextValue | null>(null)

function readStorage(): CompareItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CompareItem[]) : []
  } catch {
    return []
  }
}

function writeStorage(items: CompareItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // storage full or unavailable — silently ignore
  }
}

/**
 * Provides shared compare-queue state to the entire app.
 *
 * Wrap once at the root (inside `<Providers>`) so that every page
 * (homepage trending trips, /trips listing, etc.) shares the same
 * compare selection. State is persisted to localStorage and synced
 * across tabs via the `storage` event.
 *
 * @example
 * ```tsx
 * // app/providers.tsx
 * <CompareQueueProvider>
 *   {children}
 *   <GlobalCompareBar />
 * </CompareQueueProvider>
 * ```
 */
export function CompareQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const { toast } = useToast()
  // Ref mirror so `toggle` can read current items without depending on them —
  // keeps its identity stable across renders (TripCard is memo'd on onCompare)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = readStorage()
    if (stored.length > 0) {
      setItems(stored)
    }
    setHydrated(true)
  }, [])

  // Sync state → localStorage on every change (skip initial empty write)
  useEffect(() => {
    if (hydrated) writeStorage(items)
  }, [items, hydrated])

  // Listen for storage changes from other tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setItems(readStorage())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Derive isOpen: bar is visible when items exist and user hasn't dismissed it
  const isOpen = items.length > 0 && !dismissed

  const toggle = useCallback((trip: TripSummary) => {
    // Adding past the limit must give feedback — a silent no-op reads as a dead click
    const current = itemsRef.current
    const exists = current.some((item) => item.id === trip.id)
    if (!exists && current.length >= MAX_ITEMS) {
      toast({
        variant: 'info',
        title: `You can compare up to ${MAX_ITEMS} trips`,
        description: 'Remove a trip from the compare bar to add this one.',
      })
      return
    }

    setItems((prev) => {
      if (prev.some((item) => item.id === trip.id)) {
        return prev.filter((item) => item.id !== trip.id)
      }
      if (prev.length >= MAX_ITEMS) return prev
      return [
        ...prev,
        {
          id: trip.id,
          slug: trip.slug,
          title: trip.title,
          photo: trip.photos[0],
          price: trip.pricePerPerson,
        },
      ]
    })
    // Re-open if user had dismissed but is now toggling
    setDismissed(false)
  }, [toast])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clear = useCallback(() => {
    setItems([])
  }, [])

  const selectedIds = useMemo(() => items.map((item) => item.id), [items])

  const close = useCallback(() => setDismissed(true), [])

  const value = useMemo<CompareQueueContextValue>(
    () => ({ items, selectedIds, isOpen, toggle, remove, clear, close }),
    [items, selectedIds, isOpen, toggle, remove, clear, close],
  )

  return (
    <CompareQueueContext.Provider value={value}>
      {children}
    </CompareQueueContext.Provider>
  )
}

/**
 * Access the shared compare-queue state.
 *
 * Must be called inside `<CompareQueueProvider>` — throws if not.
 *
 * @returns `{ items, selectedIds, isOpen, toggle, remove, clear, close }`
 *
 * @example
 * ```tsx
 * const { selectedIds, toggle } = useCompareQueue()
 * <TripCard onCompare={toggle} isSelected={selectedIds.includes(trip.id)} />
 * ```
 */
export function useCompareQueue(): CompareQueueContextValue {
  const ctx = useContext(CompareQueueContext)
  if (!ctx) {
    throw new Error('useCompareQueue must be used within <CompareQueueProvider>')
  }
  return ctx
}
