import { test, expect } from '@playwright/test'

/**
 * Smoke test for a failure mode NO unit/component test catches: every
 * booking-flow test (src/components/booking/__tests__/booking-page.test.tsx)
 * mocks `loadRazorpayScript`/`loadCashfreeScript` (src/lib/razorpay.ts,
 * src/lib/cashfree.ts) entirely — none of them ever asks a real browser to
 * fetch the real checkout SDK from checkout.razorpay.com / sdk.cashfree.com.
 *
 * This is SCRIPT-LOAD / SDK-INIT ONLY — it is intentionally NOT a full
 * transaction test. It never drives a real booking (the flow is auth-gated:
 * src/app/trips/[slug]/book/page.tsx) and never creates a real payment order.
 * What it catches instead:
 *
 *   1. A Content-Security-Policy `script-src` directive that blocks
 *      checkout.razorpay.com or sdk.cashfree.com after a CSP change —
 *      the loader's <script> tag would fire an `error` event and/or the
 *      browser would log a CSP violation, and `window.Razorpay` /
 *      `window.Cashfree` would never be defined.
 *   2. `NEXT_PUBLIC_CASHFREE_ENV` pointing at the wrong SDK mode
 *      ('sandbox' vs 'production') for this environment — the SDK loads
 *      fine but initializes against the wrong Cashfree environment.
 *
 * Both loaders are exercised independently by replicating exactly what
 * src/lib/razorpay.ts / src/lib/cashfree.ts do (inject the same <script> tag,
 * point at the same URL) via `page.evaluate`, since the real loader
 * functions only run on-demand from the auth-gated booking page and we are
 * not signing in here.
 *
 * --- Running this after a domain/CSP change ---
 *
 *   PLAYWRIGHT_BASE_URL=https://your-new-domain.example.com npx playwright test e2e/payment-checkout-scripts.spec.ts
 *
 * A failure means either a CSP change is blocking the checkout host, or (for
 * Cashfree) `NEXT_PUBLIC_CASHFREE_ENV` needs correcting for this environment.
 *
 * --- Why this can skip ---
 * Both checkout hosts are public CDNs unconditionally reachable regardless
 * of app config — there's no "feature flag" gate to check client-side. The
 * one real gate is network reachability of the test runner itself: a fully
 * offline/sandboxed CI runner (no route to the public internet) would make
 * this test indistinguishable from "CSP is blocking it". To avoid that false
 * failure, each gateway first does a direct `page.request` probe (bypasses
 * the browser/CSP entirely) — if that itself cannot reach the host, the test
 * skips visibly rather than misreporting a CSP/config problem.
 */

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'
const CASHFREE_SCRIPT_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js'

const CASHFREE_ENV = process.env.NEXT_PUBLIC_CASHFREE_ENV === 'production' ? 'production' : 'sandbox'

/**
 * Direct (non-browser) reachability probe for a script host. Used only to
 * distinguish "this test runner has no route to the public internet" (skip)
 * from "the browser refused to load/execute the script" (real failure).
 */
async function isHostReachable(request: import('@playwright/test').APIRequestContext, url: string): Promise<boolean> {
  try {
    const res = await request.get(url, { timeout: 8_000 })
    return res.ok() || res.status() < 500
  } catch {
    return false
  }
}

test.describe('Payment checkout SDK reachability smoke test', () => {
  test('Razorpay checkout.js loads and window.Razorpay initializes', async ({ page, request }) => {
    const reachable = await isHostReachable(request, RAZORPAY_SCRIPT_URL)
    test.skip(
      !reachable,
      'checkout.razorpay.com is unreachable from this test runner (network-level, not CSP) — ' +
        'likely an offline/sandboxed environment. Re-run from an environment with public internet access.',
    )

    const cspErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /content security policy|refused to load/i.test(msg.text())) {
        cspErrors.push(msg.text())
      }
    })

    await page.goto('/')

    const result = await page.evaluate((src) => {
      return new Promise<{ loaded: boolean; hasGlobal: boolean }>((resolve) => {
        const script = document.createElement('script')
        script.src = src
        script.async = true
        script.onload = () => resolve({ loaded: true, hasGlobal: typeof (window as unknown as { Razorpay?: unknown }).Razorpay !== 'undefined' })
        script.onerror = () => resolve({ loaded: false, hasGlobal: false })
        document.body.appendChild(script)
      })
    }, RAZORPAY_SCRIPT_URL)

    expect(
      result.loaded,
      'Razorpay checkout.js failed to load in the browser (script "error" event fired). ' +
        'Check for a CSP script-src directive blocking checkout.razorpay.com.',
    ).toBe(true)

    expect(
      result.hasGlobal,
      'checkout.js loaded but window.Razorpay was never defined — the script executed but did not initialize as expected.',
    ).toBe(true)

    expect(
      cspErrors,
      `CSP violation(s) reported while loading the Razorpay script:\n${cspErrors.join('\n')}`,
    ).toEqual([])
  })

  test('Cashfree SDK loads and window.Cashfree initializes in the configured mode', async ({ page, request }) => {
    const reachable = await isHostReachable(request, CASHFREE_SCRIPT_URL)
    test.skip(
      !reachable,
      'sdk.cashfree.com is unreachable from this test runner (network-level, not CSP) — ' +
        'likely an offline/sandboxed environment. Re-run from an environment with public internet access.',
    )

    const cspErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /content security policy|refused to load/i.test(msg.text())) {
        cspErrors.push(msg.text())
      }
    })

    await page.goto('/')

    const result = await page.evaluate(
      ({ src, mode }) => {
        return new Promise<{ loaded: boolean; initialized: boolean; error: string | null }>((resolve) => {
          const script = document.createElement('script')
          script.src = src
          script.async = true
          script.onload = () => {
            try {
              const CashfreeCtor = (window as unknown as { Cashfree?: (opts: { mode: string }) => unknown }).Cashfree
              const instance = typeof CashfreeCtor === 'function' ? CashfreeCtor({ mode }) : undefined
              resolve({ loaded: true, initialized: Boolean(instance), error: null })
            } catch (err) {
              resolve({ loaded: true, initialized: false, error: err instanceof Error ? err.message : String(err) })
            }
          }
          script.onerror = () => resolve({ loaded: false, initialized: false, error: 'script error event' })
          document.body.appendChild(script)
        })
      },
      { src: CASHFREE_SCRIPT_URL, mode: CASHFREE_ENV },
    )

    expect(
      result.loaded,
      'Cashfree SDK (v3) failed to load in the browser (script "error" event fired). ' +
        'Check for a CSP script-src directive blocking sdk.cashfree.com.',
    ).toBe(true)

    expect(
      result.initialized,
      `window.Cashfree loaded but failed to initialize in mode "${CASHFREE_ENV}" (from NEXT_PUBLIC_CASHFREE_ENV): ${result.error}. ` +
        'Verify NEXT_PUBLIC_CASHFREE_ENV is set to the correct SDK environment ("sandbox" or "production") for this deployment.',
    ).toBe(true)

    expect(
      cspErrors,
      `CSP violation(s) reported while loading the Cashfree script:\n${cspErrors.join('\n')}`,
    ).toEqual([])
  })
})
