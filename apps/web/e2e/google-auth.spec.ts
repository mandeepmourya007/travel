import { test, expect, type ConsoleMessage } from '@playwright/test'

/**
 * Smoke test for a failure mode NO unit/component test catches: every existing
 * Google-auth test (see src/components/auth/__tests__/, src/hooks/__tests__/use-google-auth.test.ts)
 * mocks `<GoogleLogin>` / `@react-oauth/google` and the `/auth/google` response —
 * none of them load the real Google Identity Services (GIS) script against a
 * real browser origin.
 *
 * That matters because GIS validates the calling page's origin against the
 * OAuth client's "Authorized JavaScript origins" list in Google Cloud Console.
 * When the app's domain changes (staging -> prod cutover, a new custom domain,
 * even a scheme/port change) and nobody remembers to update that Console list,
 * "Continue with Google" silently breaks in production: GIS logs an
 * origin_mismatch-style console error and never renders its button/iframe.
 * curl/health checks and every mocked test still pass. This test is the one
 * that doesn't.
 *
 * --- Running this after a domain change ---
 * Point Playwright at the new domain and re-run:
 *
 *   PLAYWRIGHT_BASE_URL=https://your-new-domain.example.com npx playwright test e2e/google-auth.spec.ts
 *
 * A pass means GIS accepted the new origin. A failure (or the origin-mismatch
 * assertion below tripping) means Google Cloud Console's OAuth client still
 * needs the new origin added under "Authorized JavaScript origins".
 *
 * --- Why this can skip ---
 * GoogleAuthSection (src/components/auth/google-auth-section.tsx) returns
 * `null` whenever NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't baked into the build —
 * there is no button to check. Rather than pass trivially (false confidence)
 * or hard-fail (a legitimate env without Google auth configured shouldn't
 * break CI), the test below detects that case at runtime and calls
 * `test.skip()` with a visible reason instead.
 */

const GIS_ORIGIN_ERROR_PATTERN =
  /origin_mismatch|not a valid origin|idpiframe_initialization_failed|invalid_client|redirect_uri_mismatch/i

test.describe('Google OAuth origin smoke test', () => {
  test('login page: real GIS script loads and the Google button renders for the current origin', async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    await page.goto('/login/email')

    const wrapper = page.getByTestId('google-login-wrapper')

    // GoogleAuthSection renders `null` when NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't
    // configured on this target build — nothing to assert against. Skip
    // visibly instead of silently passing or failing.
    const wrapperAttached = await wrapper
      .waitFor({ state: 'attached', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    test.skip(
      !wrapperAttached,
      'NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured on this target — ' +
        'GoogleAuthSection intentionally renders null, so there is no Google ' +
        'button to verify. Configure the env var on this deployment to enable this check.',
    )

    // GIS renders the actual clickable "Continue with Google" button (SVG logo
    // + text) directly into the host page's DOM, inside our wrapper — the
    // accounts.google.com/gsi/button iframe alongside it is a 0x0 helper
    // frame used only for the credential/FedCM handshake, not the visible
    // button, so we assert on the real on-page button rather than iframe
    // content or the iframe's own (always-zero) box model.
    await expect(
      wrapper.getByRole('button', { name: /continue with google/i }),
      'Real "Continue with Google" button never rendered — ' +
        'this is the exact symptom of an origin not present in the OAuth client\'s ' +
        '"Authorized JavaScript origins" list in Google Cloud Console.',
    ).toBeVisible({ timeout: 15_000 })

    const allMessages = [...consoleErrors, ...pageErrors]
    const originMismatch = allMessages.filter((text) => GIS_ORIGIN_ERROR_PATTERN.test(text))

    expect(
      originMismatch,
      `GIS reported an origin-related error for ${page.url()}:\n${originMismatch.join('\n')}\n\n` +
        'Add this origin to the OAuth client\'s "Authorized JavaScript origins" in Google Cloud Console.',
    ).toEqual([])
  })
})
