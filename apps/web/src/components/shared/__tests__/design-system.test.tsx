import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Alert } from '../alert'
import { Avatar } from '../avatar'
import { Modal } from '../modal'
import { Tabs } from '../tabs'
import { Tooltip } from '../tooltip'
import { ProgressBar } from '../progress-bar'
import { Spinner } from '../spinner'

describe('Alert', () => {
  it('renders title and children', () => {
    render(<Alert variant="success" title="Done!">All good.</Alert>)
    expect(screen.getByText('Done!')).toBeInTheDocument()
    expect(screen.getByText('All good.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it.each(['success', 'warning', 'error', 'info'] as const)('applies %s variant class', (variant) => {
    render(<Alert variant={variant}>msg</Alert>)
    expect(screen.getByRole('alert').className).toContain(variant)
  })
})

describe('Avatar', () => {
  it('renders initials from full name', () => {
    render(<Avatar name="John Doe" />)
    expect(screen.getByLabelText('John Doe')).toHaveTextContent('JD')
  })

  it('renders single initial for one-word name', () => {
    render(<Avatar name="Alice" />)
    expect(screen.getByLabelText('Alice')).toHaveTextContent('A')
  })

  it('applies size and color classes', () => {
    const { container } = render(<Avatar name="Test User" size="lg" color="accent" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('h-14')
    expect(el.className).toContain('accent')
  })
})

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()} title="Test">
        Content
      </Modal>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders title and children when open', () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="My Modal">
        <p>Body</p>
      </Modal>,
    )
    expect(screen.getByText('My Modal')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal open={true} onClose={onClose} title="Close Me">
        Content
      </Modal>,
    )

    await user.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape key', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal open={true} onClose={onClose} title="Escape">
        Content
      </Modal>,
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders footer when provided', () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="With Footer" footer={<button>Save</button>}>
        Content
      </Modal>,
    )
    expect(screen.getByText('Save')).toBeInTheDocument()
  })
})

describe('Tabs', () => {
  const items = [
    { label: 'Tab A', value: 'a' },
    { label: 'Tab B', value: 'b' },
    { label: 'Tab C', value: 'c' },
  ]

  it('renders all tab labels', () => {
    render(<Tabs items={items} value="a" onChange={vi.fn()} />)
    expect(screen.getByText('Tab A')).toBeInTheDocument()
    expect(screen.getByText('Tab B')).toBeInTheDocument()
    expect(screen.getByText('Tab C')).toBeInTheDocument()
  })

  it('marks active tab with aria-selected', () => {
    render(<Tabs items={items} value="b" onChange={vi.fn()} />)
    expect(screen.getByText('Tab B')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Tab A')).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange with tab value on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Tabs items={items} value="a" onChange={onChange} />)

    await user.click(screen.getByText('Tab C'))
    expect(onChange).toHaveBeenCalledWith('c')
  })
})

describe('Tooltip', () => {
  it('renders children and tooltip text', () => {
    render(
      <Tooltip label="Help text">
        <button>Hover me</button>
      </Tooltip>,
    )
    expect(screen.getByText('Hover me')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help text')
  })
})

describe('ProgressBar', () => {
  it('renders with correct aria attributes', () => {
    render(<ProgressBar value={60} max={100} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '60')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('clamps value to 0-100% range', () => {
    const { container } = render(<ProgressBar value={150} max={100} />)
    const inner = container.querySelector('[role="progressbar"] > div') as HTMLElement
    expect(inner.style.width).toBe('100%')
  })

  it('handles zero value', () => {
    const { container } = render(<ProgressBar value={0} />)
    const inner = container.querySelector('[role="progressbar"] > div') as HTMLElement
    expect(inner.style.width).toBe('0%')
  })
})

describe('Spinner', () => {
  it('renders with default aria-label', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading')
  })

  it('renders with custom label text and aria-label', () => {
    render(<Spinner label="Fetching trips..." />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Fetching trips...')
    expect(screen.getByText('Fetching trips...')).toBeInTheDocument()
  })

  it('does not render label text when label is omitted', () => {
    const { container } = render(<Spinner />)
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(0)
  })
})
