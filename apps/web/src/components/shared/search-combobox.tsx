'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchComboboxOption {
  id: string
  label: string
  /** Secondary descriptor shown to the right of the label (e.g. destination name). Never PII (e.g. email). */
  meta?: string
}

export interface SearchComboboxProps {
  /** Currently selected option id */
  value: string | undefined
  onChange: (id: string | undefined) => void
  /** Full accumulated list of options fetched so far */
  options: SearchComboboxOption[]
  /** Controlled search input value */
  query: string
  onQueryChange: (q: string) => void
  isLoading?: boolean
  /** Whether another page of results is available to fetch */
  hasMore?: boolean
  /** Called when the results list is scrolled near the bottom and more results can be loaded */
  onLoadMore?: () => void
  /** True while a subsequent page (not the first) is being fetched — shows a bottom-of-list spinner */
  isLoadingMore?: boolean
  /** Text shown on the trigger when nothing is selected */
  placeholder?: string
  /** Placeholder inside the search input */
  searchPlaceholder?: string
  /**
   * Label for the "clear selection" row at the top of the list.
   * Pass undefined/null to hide the row entirely.
   * @default "All"
   */
  allOptionLabel?: string | null
  className?: string
}

/**
 * Generic search-with-infinite-scroll combobox.
 *
 * Manages only UI state (open/close, selectedLabel persistence, scroll-to-load-more).
 * All data concerns (fetching, debouncing, page accumulation) live in the
 * parent — wire via useSearchCombobox() + any data hook.
 *
 * Usage:
 *   const state = useSearchCombobox()
 *   const { data, isFetching } = useMyTripsSearch(state.debouncedQuery, state.page)
 *   <SearchCombobox {...state} options={...} value={...} onChange={...} />
 */
export function SearchCombobox({
  value,
  onChange,
  options,
  query,
  onQueryChange,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  allOptionLabel = 'All',
  className,
}: SearchComboboxProps) {
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Persist the selected option's label so the trigger doesn't blank out
  // when the user browses to a different page (selected item leaves the list).
  useEffect(() => {
    if (!value) { setSelectedLabel(undefined); return }
    const found = options.find((o) => o.id === value)
    if (found) setSelectedLabel(found.label)
  }, [value, options])

  // Close on outside click — also clears search so the next open starts fresh
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onQueryChange('')
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, onQueryChange])

  // Auto-focus the search input when the dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  function handleTriggerClick() {
    setOpen((prev) => !prev)
  }

  function handleSelect(id: string | undefined) {
    onChange(id)
    onQueryChange('') // clear search so the next open starts fresh
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onQueryChange(e.target.value)
  }

  const displayLabel = value ? (selectedLabel ?? placeholder) : placeholder
  const showAllOption = allOptionLabel != null

  function handleResultsScroll(e: React.UIEvent<HTMLUListElement>) {
    if (!hasMore || isLoadingMore || !onLoadMore) return
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      onLoadMore()
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={handleTriggerClick}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-300',
          value ? 'text-neutral-800' : 'text-neutral-500',
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-neutral-400" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-neutral-200 bg-white shadow-lg">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
            />
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />}
          </div>

          {/* Results */}
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1" onScroll={handleResultsScroll}>
            {showAllOption && (
              <li
                role="option"
                aria-selected={!value}
                onClick={() => handleSelect(undefined)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-neutral-50',
                  !value && 'bg-primary-50 text-primary-700',
                )}
              >
                <Check className={cn('h-4 w-4 shrink-0', !value ? 'opacity-100 text-primary-600' : 'opacity-0')} />
                {allOptionLabel}
              </li>
            )}

            {!isLoading && options.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-neutral-400">No results found.</li>
            )}

            {options.map((option) => (
              <li
                key={option.id}
                role="option"
                aria-selected={value === option.id}
                onClick={() => handleSelect(option.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50',
                  value === option.id && 'bg-primary-50',
                )}
              >
                <Check
                  className={cn('h-4 w-4 shrink-0', value === option.id ? 'opacity-100 text-primary-600' : 'opacity-0')}
                />
                <span className="flex-1 truncate">{option.label}</span>
                {option.meta && <span className="shrink-0 text-xs text-neutral-400">{option.meta}</span>}
              </li>
            ))}

            {isLoadingMore && (
              <li className="flex justify-center py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
