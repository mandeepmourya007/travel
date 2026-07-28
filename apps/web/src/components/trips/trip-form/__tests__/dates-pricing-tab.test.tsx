import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider, useFormContext } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { describe, it, expect } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { createTripSchema } from '@shared/validators/trip.schema'
import { DatesPricingTab } from '../dates-pricing-tab'
import type { CreateTripDto } from '@shared/types/trip.types'

// DatesPricingTab is an RHF-connected component (useFormContext) — it must be
// rendered inside a real FormProvider, matching the pattern used by trip-form.test.tsx
// for the parent TripForm. This harness exposes the live `pricePerPerson`/
// `earlyBirdPrice` field values via a sibling component so tests can assert on the
// GROSS value actually stored in the form, not just what's displayed in the preview.
function FieldSpy() {
  const { watch } = useFormContext<CreateTripDto>()
  const price = watch('pricePerPerson')
  const earlyBird = watch('earlyBirdPrice')
  return (
    <>
      <div data-testid="gross-price">{price ?? ''}</div>
      <div data-testid="gross-early-bird">{earlyBird ?? ''}</div>
    </>
  )
}

function Harness({
  commissionRate,
  defaultValues,
}: {
  commissionRate: number
  defaultValues?: Partial<CreateTripDto>
}) {
  const methods = useForm<CreateTripDto>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { cancellationPolicy: 'FLEXIBLE', ...defaultValues },
    mode: 'onTouched',
  })
  return (
    <FormProvider {...methods}>
      <DatesPricingTab commissionRate={commissionRate} />
      <FieldSpy />
    </FormProvider>
  )
}

function renderTab(props: Parameters<typeof Harness>[0]) {
  return renderWithQuery(<Harness {...props} />)
}

describe('DatesPricingTab — earning -> gross price conversion', () => {
  it('computes and displays the live "traveller pays" preview from a typed net earning', async () => {
    const user = userEvent.setup()
    renderTab({ commissionRate: 20 })

    await user.type(screen.getByPlaceholderText('e.g. 4050'), '4000')

    // gross = round(4000 / (1 - 0.2)) = 5000, fee = 1000
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /Traveller pays/.test(el.textContent ?? '')),
    ).toHaveTextContent('Traveller pays ₹5,000 (includes platform fee ₹1,000 at 20%)')
  })

  it('sets the RHF pricePerPerson field to the computed GROSS amount, not the raw typed net figure', async () => {
    const user = userEvent.setup()
    renderTab({ commissionRate: 20 })

    await user.type(screen.getByPlaceholderText('e.g. 4050'), '4000')

    expect(screen.getByTestId('gross-price')).toHaveTextContent('5000')
  })

  it('shows an inline validation message on the earning field when the computed gross falls below ₹100', async () => {
    const user = userEvent.setup()
    renderTab({ commissionRate: 10 })

    // gross = round(50 / 0.9) = 56, below the ₹100 minimum
    await user.type(screen.getByPlaceholderText('e.g. 4050'), '50')

    expect(
      screen.getByText('This would result in a traveller price below ₹100 minimum'),
    ).toBeInTheDocument()
    // No "Traveller pays" preview is shown while the value is invalid
    expect(screen.queryByText(/Traveller pays/)).not.toBeInTheDocument()
  })

  it('applies the same net -> gross conversion and below-minimum validation independently to the early-bird earning field', async () => {
    const user = userEvent.setup()
    renderTab({ commissionRate: 20 })

    // Regular earning stays untouched — should not affect the early-bird field
    await user.type(screen.getByPlaceholderText('Optional'), '4000')

    expect(screen.getByTestId('gross-early-bird')).toHaveTextContent('5000')
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /Traveller pays/.test(el.textContent ?? '')),
    ).toHaveTextContent('Traveller pays ₹5,000 (includes platform fee ₹1,000 at 20%)')
    // Regular earning/gross fields remain empty
    expect(screen.getByPlaceholderText('e.g. 4050')).toHaveValue('')
    expect(screen.getByTestId('gross-price')).toHaveTextContent('')
  })

  it('shows the below-minimum message on the early-bird field independently of the regular earning field', async () => {
    const user = userEvent.setup()
    renderTab({ commissionRate: 10 })

    await user.type(screen.getByPlaceholderText('e.g. 4050'), '4050') // valid, gross = 4500
    await user.type(screen.getByPlaceholderText('Optional'), '50') // gross = 56, invalid

    expect(screen.getByTestId('gross-price')).toHaveTextContent('4500')
    expect(
      screen.getByText('This would result in a traveller price below ₹100 minimum'),
    ).toBeInTheDocument()
  })
})

describe('DatesPricingTab — commissionRate fallback', () => {
  it('uses the FALLBACK_COMMISSION_RATE_PERCENT constant in the preview text when passed as the commission rate (e.g. organizer profile still loading)', async () => {
    const user = userEvent.setup()
    // Mirrors how trip-form.tsx resolves the rate when profile data isn't
    // available yet: FALLBACK_COMMISSION_RATE_PERCENT (10) is passed straight through.
    const { FALLBACK_COMMISSION_RATE_PERCENT } = await import('@/lib/constants')
    renderTab({ commissionRate: FALLBACK_COMMISSION_RATE_PERCENT })

    await user.type(screen.getByPlaceholderText('e.g. 4050'), '900')

    // gross = round(900 / (1 - 0.10)) = 1000, fee = 100, at 10%
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /Traveller pays/.test(el.textContent ?? '')),
    ).toHaveTextContent(`Traveller pays ₹1,000 (includes platform fee ₹100 at ${FALLBACK_COMMISSION_RATE_PERCENT}%)`)
  })
})

describe('DatesPricingTab — late-arriving commissionRate prop (organizer profile loads after render)', () => {
  it('recomputes the displayed earning from the existing gross price when commissionRate changes before the user types anything', () => {
    const { rerender } = renderTab({ commissionRate: 20, defaultValues: { pricePerPerson: 5000 } })

    // Initial: earning = computeNet(5000, 20) = round(5000 * 0.8) = 4000
    expect(screen.getByPlaceholderText('e.g. 4050')).toHaveValue('4000')

    // Organizer profile finishes loading with a different real commission rate —
    // the user hasn't touched the field, so it must re-derive from the SAME gross price.
    rerender(<Harness commissionRate={10} defaultValues={{ pricePerPerson: 5000 }} />)

    // computeNet(5000, 10) = round(5000 * 0.9) = 4500
    expect(screen.getByPlaceholderText('e.g. 4050')).toHaveValue('4500')
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /Traveller pays/.test(el.textContent ?? '')),
    ).toHaveTextContent('Traveller pays ₹5,000 (includes platform fee ₹500 at 10%)')
  })

  it('recomputes the stored gross price from the same typed net earning when commissionRate changes after the user has typed', async () => {
    const user = userEvent.setup()
    const { rerender } = renderTab({ commissionRate: 20 })

    await user.type(screen.getByPlaceholderText('e.g. 4050'), '4000')

    // gross = round(4000 / 0.8) = 5000
    expect(screen.getByTestId('gross-price')).toHaveTextContent('5000')

    // Late-arriving real commissionRate — the typed net figure (4000) must be
    // recomputed against the NEW rate, not left stale at the old rate's gross.
    rerender(<Harness commissionRate={10} />)

    // gross = round(4000 / 0.9) = 4444
    expect(screen.getByTestId('gross-price')).toHaveTextContent('4444')
    // The displayed earning input itself is untouched — still shows what the user typed
    expect(screen.getByPlaceholderText('e.g. 4050')).toHaveValue('4000')
  })
})
