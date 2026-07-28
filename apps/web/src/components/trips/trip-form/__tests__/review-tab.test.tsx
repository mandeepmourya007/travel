import { screen } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import { describe, it, expect } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { ReviewTab } from '../review-tab'
import type { CreateTripDto } from '@shared/types/trip.types'

function Harness({
  commissionRate,
  defaultValues,
}: {
  commissionRate: number
  defaultValues: Partial<CreateTripDto>
}) {
  const methods = useForm<CreateTripDto>({ defaultValues })
  return (
    <FormProvider {...methods}>
      <ReviewTab commissionRate={commissionRate} />
    </FormProvider>
  )
}

function renderReview(props: Parameters<typeof Harness>[0]) {
  return renderWithQuery(<Harness {...props} />)
}

const BASE_DEFAULTS: Partial<CreateTripDto> = {
  title: 'Goa Beach Getaway',
  minGroupSize: 5,
  maxGroupSize: 20,
  cancellationPolicy: 'FLEXIBLE',
}

describe('ReviewTab — earning / traveller-pays price rows', () => {
  it('renders both "Your earning" and "Traveller pays" for the regular price row', () => {
    // commissionRate 20%, gross 5000 -> organizer earning = round(5000 * 0.8) = 4000
    renderReview({
      commissionRate: 20,
      defaultValues: { ...BASE_DEFAULTS, pricePerPerson: 5000 },
    })

    expect(
      screen.getByText('Your earning: ₹4,000 · Traveller pays: ₹5,000'),
    ).toBeInTheDocument()
  })

  it('renders both "Your earning" and "Traveller pays" for the early-bird price row', () => {
    renderReview({
      commissionRate: 20,
      defaultValues: {
        ...BASE_DEFAULTS,
        pricePerPerson: 5000,
        earlyBirdPrice: 4000,
        earlyBirdDeadline: '2026-01-01T00:00:00.000Z',
      },
    })

    // early bird gross 4000 -> earning = round(4000 * 0.8) = 3200
    expect(
      screen.getByText('Your earning: ₹3,200 · Traveller pays: ₹4,000'),
    ).toBeInTheDocument()
  })

  it('does not render the early-bird row when no early-bird price/deadline is set', () => {
    renderReview({
      commissionRate: 20,
      defaultValues: { ...BASE_DEFAULTS, pricePerPerson: 5000 },
    })

    expect(screen.queryByText('Early bird price')).not.toBeInTheDocument()
  })

  it('shows a "—" placeholder for the regular price row when pricePerPerson is not yet set', () => {
    renderReview({
      commissionRate: 20,
      defaultValues: { ...BASE_DEFAULTS },
    })

    expect(screen.getByText('Price / person')).toBeInTheDocument()
    expect(screen.queryByText(/Your earning:/)).not.toBeInTheDocument()
  })
})
