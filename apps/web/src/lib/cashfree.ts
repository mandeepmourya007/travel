/**
 * Loads Cashfree JS v3 SDK dynamically.
 * Returns a promise that resolves to the initialized Cashfree instance.
 *
 * Pattern: Adapter (wraps external SDK for internal use), mirrors razorpay.ts
 *
 * Cashfree checkout flow (redirect-based):
 *   cashfree.checkout({ paymentSessionId, redirectTarget: '_self' })
 * The user is redirected to Cashfree's hosted checkout page, then back to
 * the order's return_url (set on the backend during order creation).
 */

declare global {
  interface Window {
    Cashfree: (opts: { mode: 'sandbox' | 'production' }) => CashfreeInstance
  }
}

export interface CashfreeInstance {
  checkout(opts: CashfreeCheckoutOptions): void
}

export interface CashfreeCheckoutOptions {
  paymentSessionId: string
  /**
   * '_self'   — redirect current tab (production-safe default)
   * '_blank'  — open in new tab
   * '_modal'  — embedded modal (experimental)
   * '#id'     — drop into a DOM element (Drop.js)
   */
  redirectTarget?: '_self' | '_blank' | '_modal' | string
}

let loadPromise: Promise<typeof window.Cashfree> | null = null

function getCashfreeMode(): 'sandbox' | 'production' {
  const raw = process.env.NEXT_PUBLIC_CASHFREE_ENV
  return raw === 'production' ? 'production' : 'sandbox'
}

export function loadCashfreeScript(
  mode: 'sandbox' | 'production' = getCashfreeMode(),
): Promise<CashfreeInstance> {
  const doLoad = (): Promise<typeof window.Cashfree> => {
    if (loadPromise) return loadPromise

    loadPromise = new Promise((resolve, reject) => {
      if (window.Cashfree) {
        resolve(window.Cashfree)
        return
      }

      const existing = document.querySelector('script[src*="sdk.cashfree.com"]')
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Cashfree))
        existing.addEventListener('error', () => reject(new Error('Failed to load Cashfree SDK')))
        return
      }

      const script = document.createElement('script')
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
      script.async = true
      script.onload = () => resolve(window.Cashfree)
      script.onerror = () => {
        loadPromise = null
        reject(new Error('Failed to load Cashfree SDK'))
      }
      document.body.appendChild(script)
    })

    return loadPromise
  }

  return doLoad().then((CashfreeClass) => CashfreeClass({ mode }))
}
