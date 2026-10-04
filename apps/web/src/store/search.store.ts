import { create } from 'zustand'

/**
 * Shared free-text search query, shown in both the header search bar and the
 * /trips filter panel. Not persisted. Lives in a store (not local state) because
 * Header remounts on cross-layout navigation; the trips filter panel syncs it
 * from the URL `q` on mount and on external URL changes.
 */
interface SearchState {
  query: string
  setQuery: (q: string) => void
  reset: () => void
}

export const useSearchStore = create<SearchState>()((set) => ({
  query: '',
  setQuery: (q) => set({ query: q }),
  reset: () => set({ query: '' }),
}))
