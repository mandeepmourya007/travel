import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { Modal } from '../modal'

function ModalHarness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open Modal</button>
      <button>Outside Button</button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          onClose()
        }}
        title="Test Modal"
      >
        <p>Modal body</p>
        <button>Action One</button>
        <button>Action Two</button>
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<ModalHarness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('moves focus inside the dialog when opened', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)

    await user.click(screen.getByText('Open Modal'))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // First focusable element in the panel is the Close button in the header
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('traps Tab focus inside the dialog (wraps from last to first)', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByText('Open Modal'))

    const closeBtn = screen.getByLabelText('Close')
    const actionTwo = screen.getByText('Action Two')

    // Walk to the last focusable element
    actionTwo.focus()
    await user.tab()
    // Wrapped around to the first focusable element (Close)
    expect(document.activeElement).toBe(closeBtn)
  })

  it('traps Shift+Tab focus (wraps from first to last)', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByText('Open Modal'))

    const closeBtn = screen.getByLabelText('Close')
    const actionTwo = screen.getByText('Action Two')

    closeBtn.focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(actionTwo)
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ModalHarness onClose={onClose} />)
    await user.click(screen.getByText('Open Modal'))

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('restores focus to the trigger element after closing', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)

    const trigger = screen.getByText('Open Modal')
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(document.activeElement).toBe(trigger)
  })

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ModalHarness onClose={onClose} />)
    await user.click(screen.getByText('Open Modal'))

    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.querySelector('[aria-hidden="true"]')!
    fireEvent.click(backdrop)

    expect(onClose).toHaveBeenCalled()
  })
})
