import { test, expect, type ConsoleMessage } from '@playwright/test'
import { io } from 'socket.io-client'

/**
 * Smoke test for the exact "we moved domains and forgot a URI" failure class
 * this whole effort exists for. Every mocked component/hook test (MSW,
 * src/test/mocks/handlers.ts) intercepts requests before they ever leave the
 * process — none of them ever ask a real browser, on the real deployed
 * origin, to reach the real API or open a real Socket.IO connection.
 *
 * That matters because two env-driven, domain-bound settings can silently
 * drift out of sync after a domain change and both fail invisibly to
 * anything except a real browser:
 *
 *   1. `CLIENT_URL` / `ALLOWED_ORIGINS` (apps/api/src/config/cors.ts) not
 *      updated to include the new web origin — the API rejects the
 *      preflight/response with a missing `Access-Control-Allow-Origin`
 *      header, and the browser (not curl, not Postman) blocks the response.
 *   2. `NEXT_PUBLIC_SOCKET_URL` still pointing at the old domain/host after
 *      a cutover — Socket.IO's client never connects, chat/notifications/
 *      trending-live-updates silently stop working.
 *
 * curl/health checks and every mocked test still pass in both cases. This
 * test is the one that doesn't.
 *
 * The Socket.IO check below connects using the `socket.io-client` package
 * (already a dependency of this app — src/lib/socket.ts) directly from the
 * Playwright/Node process rather than injecting an unrelated CDN build into
 * the page: CORS/origin enforcement for the Socket.IO handshake happens
 * server-side purely off the `Origin` request header
 * (apps/api/src/config/cors.ts), so spoofing that header to the real page
 * origin exercises the exact same drift condition as a real browser tab
 * without the false-negative risk of loading a mismatched socket.io-client
 * build from a third-party CDN that isn't part of this app's actual bundle.
 *
 * This deliberately connects with NO auth token (this spec never signs in).
 * `apps/api/src/socket/middleware/socket-auth.middleware.ts` always rejects
 * that with a `connect_error` reading "Authentication token required" — but
 * getting THAT specific error is actually proof the transport-level
 * handshake (and CORS check ahead of it) succeeded; the connection reached
 * app-level auth logic instead of being dropped by the engine.io/CORS layer.
 * Any *other* connect_error (a network error, a CORS-policy rejection, a
 * timeout) means the handshake never got that far — that's the real
 * domain-drift failure this test exists to catch.
 *
 * --- Running this after a domain change ---
 *
 *   PLAYWRIGHT_BASE_URL=https://your-new-domain.example.com npx playwright test e2e/api-connectivity.spec.ts
 *
 * A failure on the API check means `CLIENT_URL`/`ALLOWED_ORIGINS` on the API
 * needs the new web origin added. A failure on the socket check means
 * `NEXT_PUBLIC_SOCKET_URL` (baked into this web build) still points at the
 * wrong host, or the API's CORS config also needs to allow the socket
 * namespace's Origin header.
 *
 * --- Why this can skip ---
 * Locally (and in some preview environments) the API process may not be
 * running at all — a connection-refused/timeout is indistinguishable from
 * "reachable but CORS-blocked" via the generic `TypeError: Failed to fetch`
 * that browsers surface for both. To avoid mis-reporting environment
 * unavailability as a CORS regression, this test first inspects console
 * output for an explicit CORS-policy message (a real regression) versus a
 * bare fetch failure with no such message (treated as "API not running
 * here" and skipped visibly). The Socket.IO check only runs once the API
 * check has confirmed the API is actually reachable in this environment.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api/v1'
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001'

const CORS_ERROR_PATTERN = /blocked by cors policy|access-control-allow-origin/i

/**
 * connect_error messages that prove the handshake reached the app's socket
 * auth middleware (i.e. transport/CORS succeeded) rather than being blocked
 * before it — see the header comment above. Anything else is a real failure.
 */
const AUTH_REJECTION_PATTERN = /authentication token required|invalid or expired token|authentication failed/i

test.describe('API + Socket.IO connectivity smoke test', () => {
  test('public trips API is reachable from the browser with no CORS error', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/')

    const result = await page.evaluate(async (apiBaseUrl) => {
      try {
        const res = await fetch(`${apiBaseUrl}/trips?limit=1`, { credentials: 'include' })
        return { ok: true, status: res.status, threw: false }
      } catch (err) {
        return { ok: false, status: 0, threw: true, message: err instanceof Error ? err.message : String(err) }
      }
    }, API_BASE_URL)

    const corsErrors = consoleErrors.filter((text) => CORS_ERROR_PATTERN.test(text))

    test.skip(
      result.threw && corsErrors.length === 0,
      `Could not reach ${API_BASE_URL} at all (no CORS-policy message logged) — the API is likely ` +
        'not running in this environment rather than a CORS misconfiguration. Start the API ' +
        '(or point PLAYWRIGHT_BASE_URL/NEXT_PUBLIC_API_URL at a live deployment) to enable this check.',
    )

    expect(
      corsErrors,
      `Browser reported a CORS error reaching ${API_BASE_URL}:\n${corsErrors.join('\n')}\n\n` +
        'Check CLIENT_URL / ALLOWED_ORIGINS in apps/api/src/config/cors.ts for the current web origin.',
    ).toEqual([])

    expect(
      result.ok && result.status < 500,
      `Request to ${API_BASE_URL}/trips did not succeed (status ${result.status}). ` +
        'Expected a 2xx/4xx response reachable from the browser, not a network-level failure.',
    ).toBe(true)
  })

  test('Socket.IO connection opens against NEXT_PUBLIC_SOCKET_URL', async ({ page }) => {
    // Navigate first — probing fetch() from about:blank has an opaque origin
    // and fails regardless of whether the API is actually reachable.
    await page.goto('/')
    const pageOrigin = new URL(page.url()).origin

    // Reuse the same reachability signal as the API test: if the backend
    // isn't running here at all, skip rather than report a false socket failure.
    const apiProbe = await page.evaluate(async (apiBaseUrl) => {
      try {
        await fetch(`${apiBaseUrl}/trips?limit=1`, { credentials: 'include' })
        return true
      } catch {
        return false
      }
    }, API_BASE_URL)

    test.skip(
      !apiProbe,
      `The API at ${API_BASE_URL} is unreachable in this environment, so a Socket.IO connect_error here ` +
        'cannot be distinguished from "backend not running". Verify against an environment with a live API.',
    )

    const result = await new Promise<{ connected: boolean; error: string | null }>((resolve) => {
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 8000,
        // Spoof the Origin header to the real page origin so the server-side
        // CORS check (apps/api/src/config/cors.ts) evaluates exactly what a
        // real browser tab on this deployment would send.
        extraHeaders: { origin: pageOrigin },
      })

      const timer = setTimeout(() => {
        socket.close()
        resolve({ connected: false, error: 'timed out waiting for "connect" event (8s)' })
      }, 9000)

      socket.on('connect', () => {
        clearTimeout(timer)
        socket.close()
        resolve({ connected: true, error: null })
      })

      socket.on('connect_error', (err: Error) => {
        clearTimeout(timer)
        socket.close()
        resolve({ connected: false, error: err.message })
      })
    })

    // A real `connect` (no auth token supplied) would be surprising, but
    // treat it as success too — either way proves the handshake reached the
    // server. The expected outcome is an app-level auth rejection, which
    // still proves CORS/transport succeeded (see header comment).
    const handshakeReachedServer =
      result.connected || (result.error !== null && AUTH_REJECTION_PATTERN.test(result.error))

    expect(
      handshakeReachedServer,
      `Socket.IO handshake to ${SOCKET_URL} (spoofed Origin: ${pageOrigin}) never reached the server's ` +
        `auth layer: ${result.error}. Check NEXT_PUBLIC_SOCKET_URL (this web build) against the actual ` +
        'API host, and CLIENT_URL/ALLOWED_ORIGINS in apps/api/src/config/cors.ts for the current web origin.',
    ).toBe(true)
  })
})
