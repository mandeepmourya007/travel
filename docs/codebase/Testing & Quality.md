---
title: Testing & Quality
created: 2026-07-10
type: reference
tags:
  - codebase/testing
  - quality
---

# Testing & Quality

## Backend (`apps/api`)

==Vitest== (`vitest.config.ts` — globals on, node env, v8 coverage over `src/**`, `setupFiles: tests/setup.ts`, `@shared/*` + `@` aliases) + **Supertest** for HTTP integration. Run: `npm run test` (`vitest run`) / `test:watch`.

**80 test files** under `apps/api/tests/`:

- `tests/integration/` — `auth.routes`, `chat-socket`, `document-review.repository`, `trending-score`, `health-ready.routes`
- `tests/unit/`
  - *middleware* — rate-limit (incl. `healthReadyRateLimit`), validate, error-handler
  - *providers* — `razorpay.gateway`, `cashfree.gateway`, `msg91-whatsapp-otp.provider`, `resend-email.provider`
  - *services* — all major services incl. payment, ==payment-cutover==, booking, chat, auth, admin, wallet, vehicle, notification, otp, `health.service`, `connectivity-check.service`
  - *repositories* — trip, trip-request, conversation, webhook-event
  - *validators* — admin-cashback, common, trip, auth schemas
  - *utils* — ==constants-sync==, documents, rate-limiter, paginate, email, trip-mapper, search, chat-filter, login-attempt-tracker, phone, perf-timer, cron-jobs
  - *config* — redis, `env` (`HEALTH_CHECK_TOKEN` min-length gate)

> [!tip] Deep readiness probe (`GET /api/v1/health/ready`) regression coverage
> All third-party connectivity/credential checks (Cloudinary, Razorpay/Cashfree, Resend, MSG91) are centralized in `ConnectivityCheckService` (`src/services/connectivity-check.service.ts`) — `HealthService` only orchestrates and times out the four `check*()` calls; the individual providers (`Msg91OtpProvider`, `Msg91WhatsappOtpProvider`, `ResendEmailProvider`, `UploadService`) no longer implement their own `verifyConnection()`. `health.service.test.ts` locks in `HealthService.safeCheck`'s per-check `Promise.race` timeout (fake timers — a hung `ConnectivityCheckService.check*()` call resolves to `down` within `HEALTH_CHECK_TIMEOUT_MS`, never hangs the test or the request). `connectivity-check.service.test.ts` asserts each check never leaks a distinctive sensitive value (raw MSG91 balance, SDK error text, Resend/Cloudinary account details) anywhere in the returned status/detail — only the fixed fallback strings do. `rate-limit.middleware.test.ts`'s `healthReadyRateLimit` block and `health-ready.routes.test.ts` together cover the 5 req/60s limit and the `requireHealthToken` 404 guard end-to-end — see the file-level comments in both for why the rate-limit *counting* is tested via direct middleware invocation (mock req/res, no HTTP) rather than a Supertest request loop: importing `health.routes.ts` was found to add a large, unexplained fixed latency to the first awaited call afterwards in a test file, so the Supertest-based wiring test batches its assertions into one concurrent-request `it()` to pay that cost once instead of per request. `env.test.ts` covers the `HEALTH_CHECK_TOKEN` `min(32)` Zod gate (rejects short/guessable tokens, accepts ≥32 chars, allows unset).

> [!tip] Notable Suites
> `constants-sync` guards drift between [[Shared Package]] constants and Prisma enums; `payment-cutover` covers the Razorpay→Cashfree gateway switch; `seed-refund-test.ts` seeds refund fixtures.

## Frontend (`apps/web`)

Vitest + **@testing-library/react** + **MSW** (API mocking). Tests co-located in `__tests__/` folders next to components. Run: `npm run test` / `test:coverage`. **@playwright/test** now backs a separate `e2e/` smoke suite — see "E2E (`apps/web`)" below.

## E2E (`apps/web`)

**Playwright** (`apps/web/playwright.config.ts`), scaffolded as a layer alongside — not a replacement for — the Vitest/Testing Library/MSW suite above. Isolated on purpose: `testDir: './e2e'` (outside `src/`, so Vitest's `include: ['src/**/*.test.{ts,tsx}']` never touches it) and spec files use `*.spec.ts`, never `*.test.tsx`. `apps/web/tsconfig.json` excludes `e2e/` and `playwright.config.ts` so `npm run type-check` (tsc) doesn't need Playwright's ambient types merged with `vitest/globals`.

Run: `npm run test:e2e` (`playwright test`) from `apps/web`. Base URL: `PLAYWRIGHT_BASE_URL` env var (defaults to `http://localhost:3000`, auto-booting `npm run dev` if that var is unset; when it *is* set, Playwright assumes the target is already deployed and skips managing a local server).

- `e2e/google-auth.spec.ts` — smoke test for a failure mode no mocked unit/component test can catch: after a domain change (staging → prod, a new custom domain), Google Cloud Console's OAuth client "Authorized JavaScript origins" list can fall out of sync, which silently breaks "Continue with Google" via GIS's origin check. This test navigates to `/login/email`, waits for the real Google Identity Services button to render inside `GoogleAuthSection`, and fails if it never appears or if a console/page error matches an origin-mismatch pattern. It does **not** attempt a real OAuth handshake (no credentials).
- **Skips visibly** (not silently) when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` isn't baked into the target build — `GoogleAuthSection` intentionally returns `null` in that case, so there's no button to check. The skip reason is attached as a Playwright annotation, visible in `--reporter=list`/`json`/HTML output.
- **To verify a just-changed domain hasn't broken Google auth** (the actual post-domain-change check this test exists for): `PLAYWRIGHT_BASE_URL=https://your-new-domain.example.com npx playwright test e2e/google-auth.spec.ts` from `apps/web`. A failure here means the new origin still needs to be added under the OAuth client's "Authorized JavaScript origins" in Google Cloud Console.
- `e2e/cloudinary-image.spec.ts` — navigates to `/trips`, polls for a real trip-card `<img>` whose resolved `src` points at `res.cloudinary.com`, and asserts it actually loaded (`naturalWidth > 0`), plus no console/page error matching an image-load-failure pattern for that host. Catches Next.js `images.remotePatterns`/`src/config/image-hosts.js` allow-list drift and `CLOUDINARY_CLOUD_NAME` mismatches after a domain/env change. **Skips visibly** when no Cloudinary-hosted image is found on the page (empty catalog, or every trip using the local placeholder fallback).
- `e2e/payment-checkout-scripts.spec.ts` — script-load/SDK-init only, **not** a full transaction test (no real booking/order — the booking flow is auth-gated). Independently loads `checkout.razorpay.com/v1/checkout.js` and `sdk.cashfree.com/js/v3/cashfree.js` the same way `src/lib/razorpay.ts`/`src/lib/cashfree.ts` do, and asserts `window.Razorpay`/`window.Cashfree` become defined with no CSP violation. Catches a CSP `script-src` change blocking either checkout host, and (for Cashfree) `NEXT_PUBLIC_CASHFREE_ENV` loading the wrong SDK mode. **Skips visibly, per gateway,** when a direct (non-browser) reachability probe to that script host fails — distinguishes "this runner has no internet access" from a real CSP/config regression.
- `e2e/api-connectivity.spec.ts` — the core "we moved domains and forgot a URI" check. From the browser, fetches the public trips API (`NEXT_PUBLIC_API_URL`) and asserts no CORS-policy console error; separately opens a Socket.IO connection to `NEXT_PUBLIC_SOCKET_URL` (via `socket.io-client`, spoofing the `Origin` header to the real page origin) and treats either a real `connect` or the expected unauthenticated `"Authentication token required"` rejection from `socket-auth.middleware.ts` as proof the handshake reached the server past CORS. Catches `CLIENT_URL`/`ALLOWED_ORIGINS` (`apps/api/src/config/cors.ts`) and `NEXT_PUBLIC_SOCKET_URL` drift after a domain change. **Skips visibly** (both the API and socket checks) when the API itself is unreachable in this environment — a bare connection failure is indistinguishable from a CORS block via the browser's generic `Failed to fetch`.
- **Runs automatically post-deploy in CI** — see [[Environment & Deployment#Post-deploy smoke test (GitHub Actions)]]: `.github/workflows/smoke-test-staging.yml` (push to `staging`, polls Render before running) and `deploy-ec2.yml`'s `smoke-test` job (runs after `deploy` succeeds, on push to `master`). Both set `PLAYWRIGHT_BASE_URL` to the target environment's URL and, on failure, upload the Playwright HTML report (`playwright-report/`, enabled for `CI` via the `html` reporter in `playwright.config.ts`) as a workflow artifact.

## Shared (`packages/shared`)

`src/utils/refund.test.ts` — refund matrix coverage → [[Product Domain#Refund Policy Matrix]].

## Quality Tooling

- **Type safety** — `npm run type-check` per workspace (strict TS → [[Monorepo & Tooling#TypeScript Base (tsconfig.base.json)]]).
- **Lint/format** — ESLint per app, Prettier at root.
- **Observability** — Sentry on API (instrument.ts, cron `withMonitor` check-ins) and web (`@sentry/nextjs`, tunnel `/monitoring`); Pino with AsyncLocalStorage request context.
- **QA flows** — manual scripts in `docs/qa-traveler-flows.md` and `docs/qa-organizer-flows.md`.

Related: [[API Backend]] · [[Web Frontend]] · [[Monorepo & Tooling]]
