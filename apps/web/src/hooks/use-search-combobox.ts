import { useEffect, useRef, useState } from 'react'
import { useDebounce } from './use-debounce'

export interface SearchComboboxOptionLike {
  id: string
}

export interface SearchComboboxPageInfo {
  page: number
  totalPages: number
}

export interface UseAccumulatedSearchResultsReturn<T> {
  options: T[]
  hasMore: boolean
  isLoadingMore: boolean
}

export interface UseSearchComboboxReturn {
  query: string
  debouncedQuery: string
  /** Highest page fetched so far (starts at 1). */
  page: number
  setPage: (page: number) => void
  handleQueryChange: (q: string) => void
  /** Advance to the next page — wire to <SearchCombobox onLoadMore>. */
  loadMore: () => void
  /**
   * Accumulates fetched pages into a single flat list, tracking `hasMore`
   * and `isLoadingMore` — the single shared implementation used by every
   * search-combobox wrapper (trip/reseller/organizer) so accumulation logic
   * isn't duplicated per wrapper.
   *
   * Resets the accumulated list whenever `debouncedQuery` changes, and
   * appends (rather than replaces) when `page` advances beyond the last
   * page already appended — this avoids double-appending page 1 when
   * React Query refetches on mount/remount.
   */
  accumulate: <T extends SearchComboboxOptionLike>(
    items: T[] | undefined,
    pageInfo: SearchComboboxPageInfo | undefined,
    isFetching: boolean,
  ) => UseAccumulatedSearchResultsReturn<T>
}

/**
 * Generic state manager for any search-with-infinite-scroll combobox.
 *
 * Responsibilities:
 *  - Holds raw query + debounced query (for API calls)
 *  - Holds `page` (highest page fetched so far), resets to 1 on every new search term
 *  - Provides `accumulate()`, the single shared "concat pages, track hasMore"
 *    implementation for every combobox wrapper
 *
 * Pair with any data hook and pass results into <SearchCombobox />.
 */
export function useSearchCombobox(debounceMs = 300): UseSearchComboboxReturn {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const debouncedQuery = useDebounce(query, debounceMs)

  const accumulatedRef = useRef<unknown[]>([])
  const lastAppendedPageRef = useRef(0)
  const lastQueryRef = useRef(debouncedQuery)

  function handleQueryChange(q: string) {
    setQuery(q)
    setPage(1)
  }

  function loadMore() {
    setPage((p) => p + 1)
  }

  // Reset accumulation whenever the debounced search term changes.
  useEffect(() => {
    if (lastQueryRef.current !== debouncedQuery) {
      lastQueryRef.current = debouncedQuery
      accumulatedRef.current = []
      lastAppendedPageRef.current = 0
    }
  }, [debouncedQuery])

  function accumulate<T extends SearchComboboxOptionLike>(
    items: T[] | undefined,
    pageInfo: SearchComboboxPageInfo | undefined,
    isFetching: boolean,
  ): UseAccumulatedSearchResultsReturn<T> {
    if (items && pageInfo && pageInfo.page > lastAppendedPageRef.current) {
      accumulatedRef.current =
        pageInfo.page === 1 ? items : [...accumulatedRef.current, ...items]
      lastAppendedPageRef.current = pageInfo.page
    }

    const hasMore = pageInfo ? pageInfo.page < pageInfo.totalPages : false
    const isLoadingMore = isFetching && page > 1

    return {
      options: accumulatedRef.current as T[],
      hasMore,
      isLoadingMore,
    }
  }

  return { query, debouncedQuery, page, setPage, handleQueryChange, loadMore, accumulate }
}
