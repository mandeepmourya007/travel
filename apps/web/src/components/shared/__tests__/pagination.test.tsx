import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '../pagination'

// Mock next/link to render plain <a>
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

describe('Pagination', () => {
  describe('rendering', () => {
    it('should not render when totalPages is 1', () => {
      const { container } = render(
        <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
      )
      expect(container.innerHTML).toBe('')
    })

    it('should render all page numbers when totalPages <= 7', () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
      )
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument()
      }
    })

    it('should render ellipsis when totalPages > 7', () => {
      render(
        <Pagination currentPage={5} totalPages={20} onPageChange={vi.fn()} />,
      )

      // First and last pages always visible
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument()

      // Current page and neighbors visible
      expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '6' })).toBeInTheDocument()

      // Ellipsis present
      const ellipses = screen.getAllByText('...')
      expect(ellipses.length).toBeGreaterThanOrEqual(1)
    })

    it('should show total count when provided', () => {
      render(
        <Pagination currentPage={1} totalPages={3} total={42} onPageChange={vi.fn()} />,
      )
      expect(screen.getByText('42 total')).toBeInTheDocument()
    })
  })

  describe('button mode (onPageChange)', () => {
    it('should disable previous button on first page', () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
      )
      expect(screen.getByLabelText('Previous page')).toBeDisabled()
    })

    it('should disable next button on last page', () => {
      render(
        <Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />,
      )
      expect(screen.getByLabelText('Next page')).toBeDisabled()
    })

    it('should call onPageChange with correct page on next click', async () => {
      const onPageChange = vi.fn()
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />,
      )

      await userEvent.click(screen.getByLabelText('Next page'))
      expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('should call onPageChange with correct page on prev click', async () => {
      const onPageChange = vi.fn()
      render(
        <Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />,
      )

      await userEvent.click(screen.getByLabelText('Previous page'))
      expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('should call onPageChange when a page number is clicked', async () => {
      const onPageChange = vi.fn()
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />,
      )

      await userEvent.click(screen.getByRole('button', { name: '4' }))
      expect(onPageChange).toHaveBeenCalledWith(4)
    })
  })

  describe('link mode (buildHref)', () => {
    it('should render links instead of buttons', () => {
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          buildHref={(p) => `?page=${p}`}
        />,
      )

      const link3 = screen.getByRole('link', { name: '3' })
      expect(link3).toHaveAttribute('href', '?page=3')
    })

    it('should render prev/next as links', () => {
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          buildHref={(p) => `?page=${p}`}
        />,
      )

      expect(screen.getByLabelText('Previous page')).toHaveAttribute('href', '?page=1')
      expect(screen.getByLabelText('Next page')).toHaveAttribute('href', '?page=3')
    })
  })

  describe('page-size selector (opt-in limit/onLimitChange)', () => {
    it('should not render a limit select when limit/onLimitChange are not provided', () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
      )
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('should not render a limit select when only one of limit/onLimitChange is provided', () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} limit={25} />,
      )
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('should render a limit select with default options when both are provided', () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} limit={25} onLimitChange={vi.fn()} />,
      )
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '10 per page' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '25 per page' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '50 per page' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '100 per page' })).toBeInTheDocument()
    })

    it('should render custom limitOptions when provided', () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={vi.fn()}
          limit={5}
          limitOptions={[5, 15]}
          onLimitChange={vi.fn()}
        />,
      )
      expect(screen.getByRole('option', { name: '5 per page' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '15 per page' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: '10 per page' })).not.toBeInTheDocument()
    })

    it('should call onLimitChange with the new limit when changed', async () => {
      const onLimitChange = vi.fn()
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} limit={10} onLimitChange={onLimitChange} />,
      )
      await userEvent.selectOptions(screen.getByRole('combobox'), '50')
      expect(onLimitChange).toHaveBeenCalledWith(50)
    })

    it('should not render a limit select in link mode (buildHref) even if limit/onLimitChange are passed', () => {
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          buildHref={(p) => `?page=${p}`}
          limit={10}
          onLimitChange={vi.fn()}
        />,
      )
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })
  })

  describe('ellipsis logic', () => {
    it('should show left ellipsis when current is far from start', () => {
      render(
        <Pagination currentPage={15} totalPages={20} onPageChange={vi.fn()} />,
      )

      // Page 1 visible, page 2 not visible (replaced by ellipsis)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument()
      expect(screen.getAllByText('...').length).toBeGreaterThanOrEqual(1)
    })

    it('should show right ellipsis when current is far from end', () => {
      render(
        <Pagination currentPage={3} totalPages={20} onPageChange={vi.fn()} />,
      )

      expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '19' })).not.toBeInTheDocument()
      expect(screen.getAllByText('...').length).toBeGreaterThanOrEqual(1)
    })

    it('should show both ellipses when current is in the middle', () => {
      render(
        <Pagination currentPage={10} totalPages={20} onPageChange={vi.fn()} />,
      )

      expect(screen.getAllByText('...')).toHaveLength(2)
    })
  })
})
