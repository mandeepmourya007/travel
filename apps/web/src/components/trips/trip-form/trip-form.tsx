'use client'

import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react'
import { createTripSchema } from '@shared/validators/trip.schema'
import { TabNavigation, TRIP_FORM_TABS } from './tab-navigation'
import { BasicInfoTab } from './basic-info-tab'
import { DatesPricingTab } from './dates-pricing-tab'
import { ItineraryTab } from './itinerary-tab'
import { MediaTab } from './media-tab'
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
  pickupLocation: '',
  pickupTime: '',
}

export function TripForm({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  submitError,
  submitLabel = 'Create Trip',
}: TripFormProps) {
  const [activeTab, setActiveTab] = useState<TripFormTabId>('basic')

  const methods = useForm<CreateTripDto>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues },
    mode: 'onTouched',
  })

  const { handleSubmit, formState: { errors } } = methods

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
    dates: !!(errors.startDate || errors.endDate || errors.pricePerPerson || errors.minGroupSize || errors.maxGroupSize),
    itinerary: !!(errors.itinerary || errors.inclusions || errors.exclusions),
    media: !!(errors.photos || errors.pickupLocation),
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} tabErrors={tabErrors} />

        <div className="mt-6 min-h-[400px]">
          {activeTab === 'basic' && <BasicInfoTab />}
          {activeTab === 'dates' && <DatesPricingTab />}
          {activeTab === 'itinerary' && <ItineraryTab />}
          {activeTab === 'media' && <MediaTab />}
          {activeTab === 'review' && <ReviewTab />}
        </div>

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
