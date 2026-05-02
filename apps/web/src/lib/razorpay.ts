/**
 * Loads Razorpay checkout.js script dynamically.
 * Returns a promise that resolves to the Razorpay constructor.
 *
 * Pattern: Adapter (wraps external SDK for internal use)
 */

declare global {
  interface Window {
    Razorpay: RazorpayConstructor
  }
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance
}

export interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description?: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  theme?: { color: string }
  handler: (response: RazorpayResponse) => void
  modal?: {
    ondismiss?: () => void
    escape?: boolean
    confirm_close?: boolean
  }
}

export interface RazorpayResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayInstance {
  open: () => void
  close: () => void
  on: (event: string, callback: () => void) => void
}

let loadPromise: Promise<RazorpayConstructor> | null = null

export function loadRazorpayScript(): Promise<RazorpayConstructor> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay)
      return
    }

    // Prevent duplicate script tags (React StrictMode double-mount)
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay))
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay SDK')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(window.Razorpay)
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load Razorpay SDK'))
    }
    document.body.appendChild(script)
  })

  return loadPromise
}
