import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { TripForm, TRIP_SUBMIT_INTENT } from '../trip-form'
import type { CreateTripDto } from '@shared/types/trip.types'

// Valid-per-schema defaults so clicking straight to Review + Submit opens the
// confirmation modal without needing to drive every tab's inputs.
const VALID_DEFAULTS: Partial<CreateTripDto> = {
  title: 'A Wonderful Trip to Goa',
  destinationId: 'dest-1',
  tripType: 'BEACH',
  bookingMode: 'INSTANT',
  description: 'A description that is definitely long enough to pass validation.',
  startDate: '2026-03-01T10:00',
  endDate: '2026-03-04T10:00',
  pricePerPerson: 5000,
  minGroupSize: 2,
  maxGroupSize: 20,
  cancellationPolicy: 'FLEXIBLE',
  inclusions: ['Transport'],
  exclusions: [],
  itinerary: [],
  photos: ['https://example.com/photo.jpg'],
  pickupPoints: [{ label: 'Delhi Airport', extraCharge: 0 }],
  dropPoints: [{ label: 'Delhi Airport', extraCharge: 0 }],
}

function renderForm(props: Partial<React.ComponentProps<typeof TripForm>> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn()
  renderWithQuery(
    <TripForm
      defaultValues={VALID_DEFAULTS}
      storageKey={`trip-form-test-${Math.random()}`}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return { onSubmit }
}

async function openConfirmModal(user: ReturnType<typeof userEvent.setup>) {
  // Tabs: basic -> dates -> itinerary -> transfers -> vehicle -> media -> review
  for (let i = 0; i < 6; i++) {
    await user.click(screen.getByRole('button', { name: /next/i }))
  }
  await user.click(screen.getByRole('button', { name: /create trip/i }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Create this trip?')).toBeInTheDocument()
  return dialog
}

describe('TripForm confirmation modal', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders only 2 footer buttons when allowPublish is false/omitted', async () => {
    const user = userEvent.setup()
    renderForm({ allowPublish: false })

    const dialog = await openConfirmModal(user)

    expect(within(dialog).getByRole('button', { name: /go back & review/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Create Trip' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /save as draft/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /publish now/i })).not.toBeInTheDocument()
  })

  it('clicking the 2-button-mode submit calls onSubmit with DRAFT intent', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ allowPublish: false })

    const dialog = await openConfirmModal(user)
    await user.click(within(dialog).getByRole('button', { name: 'Create Trip' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: VALID_DEFAULTS.title }),
      undefined,
      TRIP_SUBMIT_INTENT.DRAFT,
    )
  })

  it('renders 3 footer buttons (go back / save as draft / publish now) when allowPublish is true', async () => {
    const user = userEvent.setup()
    renderForm({ allowPublish: true })

    const dialog = await openConfirmModal(user)

    expect(within(dialog).getByRole('button', { name: /go back & review/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /save as draft/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /publish now/i })).toBeInTheDocument()
  })

  it('clicking "Save as draft" calls onSubmit with DRAFT intent', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ allowPublish: true })

    const dialog = await openConfirmModal(user)
    await user.click(within(dialog).getByRole('button', { name: /save as draft/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: VALID_DEFAULTS.title }),
      undefined,
      TRIP_SUBMIT_INTENT.DRAFT,
    )
  })

  it('clicking "Publish now" calls onSubmit with PUBLISH intent', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ allowPublish: true })

    const dialog = await openConfirmModal(user)
    await user.click(within(dialog).getByRole('button', { name: /publish now/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: VALID_DEFAULTS.title }),
      undefined,
      TRIP_SUBMIT_INTENT.PUBLISH,
    )
  })

  it('clicking "Go back & review" closes the modal without submitting', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ allowPublish: true })

    const dialog = await openConfirmModal(user)
    await user.click(within(dialog).getByRole('button', { name: /go back & review/i }))

    await waitFor(() => expect(screen.queryByText('Create this trip?')).not.toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('TripForm default values do not stick on clear', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clearing Min Group Size leaves the input empty instead of reverting to a hardcoded default', async () => {
    const user = userEvent.setup()
    // No `defaultValues` override here — we're exercising the component's own
    // internal DEFAULT_VALUES, which previously hardcoded minGroupSize to 2.
    renderWithQuery(
      <TripForm storageKey={`trip-form-test-${Math.random()}`} onSubmit={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /next/i })) // basic -> dates

    const input = screen.getByPlaceholderText('e.g. 5')
    await user.type(input, '5')
    expect(input).toHaveValue('5')

    await user.clear(input)
    expect(input).toHaveValue('')
  })
})
