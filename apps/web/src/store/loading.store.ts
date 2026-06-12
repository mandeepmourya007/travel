import { create } from 'zustand'

interface LoadingState {
  isLoading: boolean
  message: string | undefined
  /** When true, only an explicit hide(true) or show(msg)+hide can dismiss the loader.
   *  Prevents the apiClient interceptor from accidentally clearing auth transition overlays. */
  _pinned: boolean
  /** Incremented on every show() — lets delayed force-hides (e.g. the session-expiry
   *  safety timeout) verify they are not clearing a NEWER overlay than the one they set. */
  epoch: number
  show: (message?: string) => void
  hide: (force?: boolean) => void
}

export const useLoadingStore = create<LoadingState>()((set, get) => ({
  isLoading: false,
  message: undefined,
  _pinned: false,
  epoch: 0,
  show: (message?: string) => {
    if (get()._pinned && !message) return
    set((s) => ({ isLoading: true, message, _pinned: !!message, epoch: s.epoch + 1 }))
  },
  hide: (force?: boolean) => {
    if (!force && get()._pinned) return
    set({ isLoading: false, message: undefined, _pinned: false })
  },
}))
