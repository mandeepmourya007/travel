'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, ChevronRight, Save, Loader2, AlertCircle } from 'lucide-react'
import { createTripSchema } from '@shared/validators/trip.schema'
import { TabNavigation, TRIP_FORM_TABS } from './tab-navigation'
import { BasicInfoTab } from './basic-info-tab'
import { DatesPricingTab } from './dates-pricing-tab'
import { ItineraryTab } from './itinerary-tab'
import { MediaTab } from './media-tab'
import { TransferPointsTab } from './transfer-points-tab'
import { ReviewTab } from './review-tab'
import { Alert } from '@/components/shared/alert'
import type { TripFormTabId } from './tab-navigation'
import type { CreateTripDto } from '@shared/types/trip.types'

interface TripFormProps {
  defaultValues?: Partial<CreateTripDto>
  onSubmit: (data: CreateTripDto) => void
  isSubmitting?: boolean
  submitError?: string | null
  submitLabel?: string
  storageKey?: string
}

const STORAGE_DEBOUNCE_MS = 500

function loadDraft(key: string): Partial<CreateTripDto> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveDraft(key: string, data: Partial<CreateTripDto>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch { /* quota exceeded — ignore */ }
}

export function clearTripDraft(key = 'trip-form-draft') {
  if (typeof window === 'undefined') return
  localStorage.removeItem(key)
}

const DEFAULT_VALUES: Partial<CreateTripDto> = {
  title: '',
  destinationId: '',
  tripType: undefined,
  bookingMode: 'INSTANT',
  description: '',
  startDate: '',
  endDate: '',
  pricePerPerson: undefined,
  minGroupSize: 2,
  maxGroupSize: 20,
  cancellationPolicy: 'FLEXIBLE',
  inclusions: [],
  exclusions: [],
  itinerary: [],
  photos: [],
  pickupPoints: [{ label: '', extraCharge: 0 }],
  dropPoints: [{ label: '', extraCharge: 0 }],
}

export function TripForm({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  submitError,
  submitLabel = 'Create Trip',
  storageKey = 'trip-form-draft',
}: TripFormProps) {
  const draft = loadDraft(storageKey)
  const [activeTab, setActiveTab] = useState<TripFormTabId>('basic')

  // Restore saved tab client-side only to avoid SSR hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem(`${storageKey}-tab`) as TripFormTabId | null
    if (saved) setActiveTab(saved)
  }, [storageKey])

  const methods = useForm<CreateTripDto>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { ...DEFAULT_VALUES, ...draft, ...defaultValues },
    mode: 'onTouched',
  })

  const { handleSubmit, formState: { errors }, watch } = methods
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // Debounced auto-save to localStorage
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    const sub = watch((values) => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        saveDraft(storageKey, values as Partial<CreateTripDto>)
        if (typeof window !== 'undefined') localStorage.setItem(`${storageKey}-tab`, activeTab)
      }, STORAGE_DEBOUNCE_MS)
    })
    return () => { sub.unsubscribe(); clearTimeout(timerRef.current) }
  }, [watch, storageKey, activeTab])

  const handleFormSubmit = useCallback(
    (data: CreateTripDto) => {
      clearTripDraft(storageKey)
      if (typeof window !== 'undefined') localStorage.removeItem(`${storageKey}-tab`)
      onSubmit(data)
    },
    [onSubmit, storageKey],
  )

  const tabIndex = TRIP_FORM_TABS.findIndex((t) => t.id === activeTab)
  const isFirstTab = tabIndex === 0
  const isLastTab = tabIndex === TRIP_FORM_TABS.length - 1

  const goNext = () => {
    if (!isLastTab) setActiveTab(TRIP_FORM_TABS[tabIndex + 1].id)
  }
  const goPrev = () => {
    if (!isFirstTab) setActiveTab(TRIP_FORM_TABS[tabIndex - 1].id)
  }

  const tabErrors: Partial<Record<TripFormTabId, boolean>> = {
    basic: !!(errors.title || errors.destinationId || errors.tripType || errors.description),
    dates: !!(errors.startDate || errors.endDate || errors.pricePerPerson || errors.minGroupSize || errors.maxGroupSize || errors.earlyBirdPrice || errors.earlyBirdDeadline || errors.bookingDeadline || errors.cancellationPolicy),
    itinerary: !!(errors.itinerary || errors.inclusions || errors.exclusions),
    transfers: !!(errors.pickupPoints || errors.dropPoints),
    media: !!(errors.photos || errors.itineraryDocUrl),
  }

  const errorTabNames = TRIP_FORM_TABS
    .filter((t) => tabErrors[t.id])
    .map((t) => t.label)

  const onInvalidSubmit = useCallback(() => {
    setSubmitAttempted(true)
    // Jump to first tab with errors
    const firstErrorTab = TRIP_FORM_TABS.find((t) => tabErrors[t.id])
    if (firstErrorTab) setActiveTab(firstErrorTab.id)
  }, [tabErrors])

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit, onInvalidSubmit)} noValidate>
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} tabErrors={tabErrors} />

        <div className="mt-6 min-h-[400px]">
          {activeTab === 'basic' && <BasicInfoTab />}
          {activeTab === 'dates' && <DatesPricingTab />}
          {activeTab === 'itinerary' && <ItineraryTab />}
          {activeTab === 'transfers' && <TransferPointsTab />}
          {activeTab === 'media' && <MediaTab />}
          {activeTab === 'review' && <ReviewTab />}
        </div>

        {submitAttempted && errorTabNames.length > 0 && (
          <div role="alert" aria-live="polite" className="mt-4 flex items-start gap-2 rounded-lg border border-error-500/30 bg-error-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error-500" />
            <div className="text-sm text-neutral-700">
              <p className="font-medium">Please fix errors in the following tabs:</p>
              <p className="mt-1">{errorTabNames.join(', ')}</p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="mt-4">
            <Alert variant="error">{submitError}</Alert>
          </div>
        )}

        {/* Navigation footer */}
        <div className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-6">
          <button
            type="button"
            onClick={goPrev}
            disabled={isFirstTab}
            className="btn-ghost flex items-center gap-1 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <div className="flex items-center gap-3">
            {isLastTab ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {submitLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="btn-primary flex items-center gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
