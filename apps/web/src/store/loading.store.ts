import { create } from 'zustand'

interface LoadingState {
  isLoading: boolean
  message: string | undefined
  /** When true, only an explicit hide(true) or show(msg)+hide can dismiss the loader.
   *  Prevents the apiClient interceptor from accidentally clearing auth transition overlays. */
  _pinned: boolean
  show: (message?: string) => void
  hide: (force?: boolean) => void
}

export const useLoadingStore = create<LoadingState>()((set, get) => ({
  isLoading: false,
  message: undefined,
  _pinned: false,
  show: (message?: string) => {
    if (get()._pinned && !message) return
    set({ isLoading: true, message, _pinned: !!message })
  },
  hide: (force?: boolean) => {
    if (!force && get()._pinned) return
    set({ isLoading: false, message: undefined, _pinned: false })
  },
}))
