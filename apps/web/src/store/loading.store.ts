import { create } from 'zustand'

interface LoadingState {
  isLoading: boolean
  message: string | undefined
  show: (message?: string) => void
  hide: () => void
}

export const useLoadingStore = create<LoadingState>()((set) => ({
  isLoading: false,
  message: undefined,
  show: (message?: string) => set({ isLoading: true, message }),
  hide: () => set({ isLoading: false, message: undefined }),
}))
