'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationBaseProps {
  currentPage: number
  totalPages: number
  total?: number
}

interface PaginationWithCallback extends PaginationBaseProps {
  onPageChange: (page: number) => void
  buildHref?: never
}

interface PaginationWithLinks extends PaginationBaseProps {
  buildHref: (page: number) => string
  onPageChange?: never
}

type PaginationProps = PaginationWithCallback | PaginationWithLinks

/**
 * Generates the page numbers to display with ellipsis.
 * Pattern: [1] [...] [current-1] [current] [current+1] [...] [totalPages]
 * Always shows first page, last page, and a window around the current page.
 */
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = []

  // Always show first page
  pages.push(1)

  // Calculate window around current page
  const windowStart = Math.max(2, current - 1)
  const windowEnd = Math.min(total - 1, current + 1)

  // Left ellipsis
  if (windowStart > 2) {
    pages.push('ellipsis')
  }

  // Window pages
  for (let i = windowStart; i <= windowEnd; i++) {
    pages.push(i)
  }

  // Right ellipsis
  if (windowEnd < total - 1) {
    pages.push('ellipsis')
  }

  // Always show last page
  pages.push(total)

  return pages
}

const navBtnClass = (enabled: boolean) =>
  cn(
    'h-9 w-9 rounded-lg flex items-center justify-center transition-colors',
    enabled
      ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
      : 'bg-neutral-50 text-neutral-300 pointer-events-none',
  )

const pageBtnClass = (isActive: boolean) =>
  cn(
    'h-9 min-w-[36px] rounded-lg flex items-center justify-center text-sm transition-colors',
    isActive
      ? 'bg-primary-500 text-white font-semibold'
      : 'bg-neutral-100 text-neutral-600 font-medium hover:bg-neutral-200',
  )

export function Pagination({ currentPage, totalPages, total, onPageChange, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null

  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages
  const pages = getPageNumbers(currentPage, totalPages)

  const renderPageItem = (page: number | 'ellipsis', index: number) => {
    if (page === 'ellipsis') {
      return (
        <span key={`ellipsis-${index}`} className="flex h-9 w-6 items-center justify-center text-sm text-neutral-400">
          ...
        </span>
      )
    }

    if (buildHref) {
      return (
        <Link key={page} href={buildHref(page)} className={pageBtnClass(page === currentPage)}>
          {page}
        </Link>
      )
    }

    return (
      <button key={page} type="button" onClick={() => onPageChange?.(page)} className={pageBtnClass(page === currentPage)}>
        {page}
      </button>
    )
  }

  const prevContent = <ChevronLeft className="h-4 w-4" />
  const nextContent = <ChevronRight className="h-4 w-4" />

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      {total != null && (
        <p className="text-sm text-neutral-500">{total} total</p>
      )}

      <div className="flex items-center gap-1.5">
        {buildHref ? (
          hasPrev ? (
            <Link href={buildHref(currentPage - 1)} aria-label="Previous page" className={navBtnClass(true)}>
              {prevContent}
            </Link>
          ) : (
            <span aria-disabled aria-label="Previous page" className={navBtnClass(false)}>
              {prevContent}
            </span>
          )
        ) : (
          <button
            type="button"
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={!hasPrev}
            aria-label="Previous page"
            className={navBtnClass(hasPrev)}
          >
            {prevContent}
          </button>
        )}

        {pages.map(renderPageItem)}

        {buildHref ? (
          hasNext ? (
            <Link href={buildHref(currentPage + 1)} aria-label="Next page" className={navBtnClass(true)}>
              {nextContent}
            </Link>
          ) : (
            <span aria-disabled aria-label="Next page" className={navBtnClass(false)}>
              {nextContent}
            </span>
          )
        ) : (
          <button
            type="button"
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={!hasNext}
            aria-label="Next page"
            className={navBtnClass(hasNext)}
          >
            {nextContent}
          </button>
        )}
      </div>
    </div>
  )
}
