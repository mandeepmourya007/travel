import { useState } from 'react'
import { useDebounce } from './use-debounce'

export interface UseSearchComboboxReturn {
  query: string
  debouncedQuery: string
  page: number
  setPage: (page: number) => void
  handleQueryChange: (q: string) => void
}

/**
 * Generic state manager for any search-with-pagination combobox.
 *
 * Responsibilities:
 *  - Holds raw query + debounced query (for API calls)
 *  - Holds page, resets to 1 on every new search term
 *
 * Pair with any data hook and pass results into <SearchCombobox />.
 */
export function useSearchCombobox(debounceMs = 300): UseSearchComboboxReturn {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const debouncedQuery = useDebounce(query, debounceMs)

  function handleQueryChange(q: string) {
    setQuery(q)
    setPage(1)
  }

  return { query, debouncedQuery, page, setPage, handleQueryChange }
}
