import { create } from 'zustand'

interface ConnectionState {
  isServerDown: boolean
  lastFailedAt: number | null
  markDown: () => void
  markUp: () => void
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  isServerDown: false,
  lastFailedAt: null,
  markDown: () => set({ isServerDown: true, lastFailedAt: Date.now() }),
  markUp: () => set({ isServerDown: false, lastFailedAt: null }),
}))
