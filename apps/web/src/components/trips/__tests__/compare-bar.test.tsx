import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CompareBar } from '../compare-bar'

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

// Mock formatCurrency to return predictable strings
vi.mock('@/lib/format', () => ({
  formatCurrency: (amount: number) => `₹${amount.toLocaleString('en-IN')}`,
}))

const baseItems = [
  { id: '1', slug: 'goa-beach', title: 'Goa Beach Trip', photo: '/goa.jpg', price: 15000 },
  { id: '2', slug: 'manali-trek', title: 'Manali Trek', photo: '/manali.jpg', price: 22000 },
]

describe('CompareBar', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(
      <CompareBar items={[]} onRemove={vi.fn()} onClose={vi.fn()} isOpen={true} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders selected trip names', () => {
    render(
      <CompareBar items={baseItems} onRemove={vi.fn()} onClose={vi.fn()} isOpen={true} />,
    )
    expect(screen.getByText('Goa Beach Trip')).toBeInTheDocument()
    expect(screen.getByText('Manali Trek')).toBeInTheDocument()
  })

  it('shows empty slots for remaining capacity', () => {
    render(
      <CompareBar items={[baseItems[0]]} onRemove={vi.fn()} onClose={vi.fn()} isOpen={true} />,
    )
    // 1 item selected, max 3 → 2 empty slots
    const emptySlots = screen.getAllByText('Add Trip')
    expect(emptySlots).toHaveLength(2)
  })

  it('calls onRemove when X button is clicked', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()

    render(
      <CompareBar items={baseItems} onRemove={onRemove} onClose={vi.fn()} isOpen={true} />,
    )

    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    await user.click(removeButtons[0])
    expect(onRemove).toHaveBeenCalledWith('1')
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <CompareBar items={baseItems} onRemove={vi.fn()} onClose={onClose} isOpen={true} />,
    )

    await user.click(screen.getByRole('button', { name: /close compare bar/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows "Select N more" when less than 2 items', () => {
    render(
      <CompareBar items={[baseItems[0]]} onRemove={vi.fn()} onClose={vi.fn()} isOpen={true} />,
    )
    expect(screen.getByText('Select 1 more')).toBeInTheDocument()
  })

  it('shows Compare Now link when 2+ items selected', () => {
    render(
      <CompareBar items={baseItems} onRemove={vi.fn()} onClose={vi.fn()} isOpen={true} />,
    )
    const link = screen.getByRole('link', { name: /compare now/i })
    expect(link).toHaveAttribute('href', '/trips/compare?trips=goa-beach,manali-trek')
  })

  it('includes all 3 slugs in compare link', () => {
    const threeItems = [
      ...baseItems,
      { id: '3', slug: 'rishikesh-raft', title: 'Rishikesh Rafting', price: 8000 },
    ]
    render(
      <CompareBar items={threeItems} onRemove={vi.fn()} onClose={vi.fn()} isOpen={true} />,
    )
    const link = screen.getByRole('link', { name: /compare now/i })
    expect(link).toHaveAttribute(
      'href',
      '/trips/compare?trips=goa-beach,manali-trek,rishikesh-raft',
    )
  })
})
