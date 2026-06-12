import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import type { TravelerDetailItem } from '@shared/types/booking.types'
import { TravelerDetailsAccordion } from '../traveler-details-accordion'

const twoTravelers: TravelerDetailItem[] = [
  { id: 'td-1', name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE', isPrimary: true, emergencyContactName: 'Bob', emergencyContactPhone: '8888888888' },
  { id: 'td-2', name: 'Charlie', phone: '7777777777', age: 30, gender: 'MALE', isPrimary: false, emergencyContactName: null, emergencyContactPhone: null },
]

const oneTraveler: TravelerDetailItem[] = [
  { id: 'td-1', name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE', isPrimary: true, emergencyContactName: null, emergencyContactPhone: null },
]

describe('TravelerDetailsAccordion', () => {
  it('should be collapsed by default showing traveler count', () => {
    renderWithQuery(<TravelerDetailsAccordion travelers={twoTravelers} />)

    expect(screen.getByText(/2 travelers/i)).toBeInTheDocument()
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('should expand and show traveler details when clicked', async () => {
    const user = userEvent.setup()
    renderWithQuery(<TravelerDetailsAccordion travelers={twoTravelers} />)

    await user.click(screen.getByRole('button', { name: /travelers/i }))

    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Charlie').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/primary/i).length).toBeGreaterThanOrEqual(1)
  })

  it('should show phone, age, gender for each traveler', async () => {
    const user = userEvent.setup()
    renderWithQuery(<TravelerDetailsAccordion travelers={twoTravelers} />)

    await user.click(screen.getByRole('button', { name: /travelers/i }))

    expect(screen.getAllByText('9999999999').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('25').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/female/i).length).toBeGreaterThanOrEqual(1)
  })

  it('should show emergency contact when provided', async () => {
    const user = userEvent.setup()
    renderWithQuery(<TravelerDetailsAccordion travelers={twoTravelers} />)

    await user.click(screen.getByRole('button', { name: /travelers/i }))

    expect(screen.getAllByText(/Bob/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/8888888888/).length).toBeGreaterThanOrEqual(1)
  })

  it('should show dash when emergency contact is not provided', async () => {
    const user = userEvent.setup()
    renderWithQuery(<TravelerDetailsAccordion travelers={twoTravelers} />)

    await user.click(screen.getByRole('button', { name: /travelers/i }))

    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('should show inline name for single traveler without expand', () => {
    renderWithQuery(<TravelerDetailsAccordion travelers={oneTraveler} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /travelers/i })).not.toBeInTheDocument()
  })

  it('should render nothing when travelers array is empty', () => {
    const { container } = renderWithQuery(<TravelerDetailsAccordion travelers={[]} />)

    // The wrapper's always-mounted (empty) toast live-region is the only child —
    // the accordion itself contributes no content
    expect(container.textContent).toBe('')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should collapse when clicked a second time', async () => {
    const user = userEvent.setup()
    renderWithQuery(<TravelerDetailsAccordion travelers={twoTravelers} />)

    const toggle = screen.getByRole('button', { name: /travelers/i })

    await user.click(toggle)
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1)

    await user.click(toggle)
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })
})
