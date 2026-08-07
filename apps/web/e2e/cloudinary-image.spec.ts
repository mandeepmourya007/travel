import { test, expect, type ConsoleMessage } from '@playwright/test'

/**
 * Smoke test for a failure mode NO unit/component test catches: every trip-card
 * test (src/components/trips/__tests__/) renders against jsdom/MSW with fixture
 * `photos` URLs and never asks a real browser to fetch a real image from a real
 * CDN origin — none of them would notice if the image simply failed to load.
 *
 * That matters because trip cover photos are served from Cloudinary
 * (res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/...) and rendered through
 * next/image (src/components/shared/blur-image.tsx), which only allows hosts
 * listed in `images.remotePatterns` (sourced from
 * src/config/image-hosts.js). Two independent things can silently drift
 * after a deploy/env change and both look the same in production — a broken
 * image icon where a trip photo should be:
 *
 *   1. `res.cloudinary.com` falls out of (or was never added to) the
 *      `remotePatterns` allow-list in next.config.js — Next.js's image
 *      optimizer then refuses to serve the image (400 from `/_next/image`).
 *   2. `CLOUDINARY_CLOUD_NAME` (baked into image URLs server-side) points at
 *      the wrong Cloudinary account/cloud for this environment — every image
 *      URL 404s against Cloudinary itself.
 *
 * curl/health checks and every mocked test still pass in both cases. This
 * test is the one that doesn't.
 *
 * --- Running this after a domain/env change ---
 *
 *   PLAYWRIGHT_BASE_URL=https://your-new-domain.example.com npx playwright test e2e/cloudinary-image.spec.ts
 *
 * A pass means at least one real trip cover photo round-tripped through
 * Cloudinary and the Next.js image optimizer. A failure means either the
 * remotePatterns allow-list or CLOUDINARY_CLOUD_NAME needs fixing for this
 * environment.
 *
 * --- Why this can skip ---
 * `/trips` renders whatever the seeded/live catalog returns. On a fresh or
 * near-empty environment (e.g. a brand-new preview env with no seeded trips,
 * or a catalog where every trip happens to fall back to the local
 * `/placeholder-trip.jpg` — see trip-card.tsx's `coverPhoto` fallback), there
 * may be no real Cloudinary-hosted `<img>` on the page at all. Rather than
 * pass trivially (false confidence) or hard-fail (a legitimately empty
 * catalog shouldn't break CI), this test detects that case and calls
 * `test.skip()` with a visible reason instead.
 */

const CLOUDINARY_HOST = 'res.cloudinary.com'
const CLOUDINARY_ERROR_PATTERN =
  /res\.cloudinary\.com.*(40\d|blocked|failed)|failed to load resource.*cloudinary|_next\/image.*40\d.*cloudinary/i

test.describe('Cloudinary image delivery smoke test', () => {
  test('trips listing: at least one real Cloudinary-hosted image loads successfully', async ({ page }) => {
    // A cold Next.js dev-mode compile of /trips plus its client-side data
    // fetch can exceed the default 30s test timeout on first run.
    test.slow()

    const consoleErrors: string[] = []
    const pageErrors: string[] = []

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    await page.goto('/trips')

    // TripsPageClient/TripGrid fetch and render trip cards client-side after
    // hydration — the initial SSR HTML has no Cloudinary <img>s yet (only the
    // nav logo, and a static "/trips/compare" nav link that would otherwise
    // false-positive a naive "any /trips/ link attached" wait). Poll for a
    // real Cloudinary <img> src directly instead. Generous timeout: a cold
    // Next.js dev-mode compile of this route on first request can itself
    // take 15-20s, on top of the client-side data fetch.
    const foundCloudinarySrc = await page
      .waitForFunction(
        (host) =>
          Array.from(document.querySelectorAll('img')).some(
            (el) => (el.currentSrc || el.src).includes(host),
          ),
        CLOUDINARY_HOST,
        { timeout: 40_000 },
      )
      .then(() => true)
      .catch(() => false)

    const images = page.locator('img')
    const imageCount = await images.count()
    let cloudinaryImage: ReturnType<typeof images.nth> | null = null

    if (foundCloudinarySrc) {
      for (let i = 0; i < imageCount; i++) {
        const candidate = images.nth(i)
        const src = await candidate.evaluate((el: HTMLImageElement) => el.currentSrc || el.src).catch(() => '')
        if (src.includes(CLOUDINARY_HOST)) {
          cloudinaryImage = candidate
          break
        }
      }
    }

    test.skip(
      cloudinaryImage === null,
      'No Cloudinary-hosted <img> found on /trips — the catalog on this environment may be empty ' +
        'or every trip is using the local placeholder image (trip-card.tsx `coverPhoto` fallback). ' +
        'Seed at least one trip with a real Cloudinary photo to enable this check.',
    )

    // Finding the <img> in the DOM only proves React rendered the tag — the
    // browser may not have finished fetching/decoding the image yet (more so
    // if it's using native lazy-loading and sits slightly below the fold).
    // Scroll it into view to give lazy-loading a chance to trigger, then poll
    // for actual completion instead of checking naturalWidth synchronously —
    // a same-instant check here previously produced false failures on real,
    // reachable Cloudinary images that just hadn't finished loading yet.
    await cloudinaryImage!.scrollIntoViewIfNeeded()

    const loaded = await cloudinaryImage!
      .evaluate(
        (el: HTMLImageElement) =>
          new Promise<boolean>((resolve) => {
            if (el.complete && el.naturalWidth > 0) {
              resolve(true)
              return
            }
            const done = () => resolve(el.complete && el.naturalWidth > 0)
            el.addEventListener('load', done, { once: true })
            el.addEventListener('error', done, { once: true })
            setTimeout(done, 10_000)
          }),
      )

    expect(
      loaded,
      'A Cloudinary-hosted <img> was found but never finished loading (naturalWidth is 0) even ' +
        'after scrolling it into view and waiting up to 10s for its load/error event. ' +
        'Check next.config.js `images.remotePatterns` / src/config/image-hosts.js for a missing ' +
        '"res.cloudinary.com" entry, and verify CLOUDINARY_CLOUD_NAME matches this environment\'s Cloudinary account.',
    ).toBe(true)

    const allMessages = [...consoleErrors, ...pageErrors]
    const cloudinaryFailures = allMessages.filter((text) => CLOUDINARY_ERROR_PATTERN.test(text))

    expect(
      cloudinaryFailures,
      `Console/page errors indicate a Cloudinary image failed to load on ${page.url()}:\n${cloudinaryFailures.join('\n')}\n\n` +
        'Check the Next.js image remotePatterns allow-list and CLOUDINARY_CLOUD_NAME for this environment.',
    ).toEqual([])
  })
})
