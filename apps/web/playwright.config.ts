import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for apps/web E2E smoke tests.
 *
 * Isolated from the Vitest unit/component suite on purpose:
 *  - testDir is 'e2e/', outside 'src/' (Vitest's `include` only ever matches
 *    'src/**\/*.test.{ts,tsx}', so it never sees these files).
 *  - Spec files use the '*.spec.ts' suffix, not '*.test.tsx', as a second
 *    layer of separation.
 *  - This file lives at the repo-relative apps/web root and is picked up
 *    only by `npx playwright test` / `npm run test:e2e`, never by `npm run test`.
 *
 * Pointing this at a real (non-local) domain — e.g. to verify a domain
 * change didn't break Google OAuth's "Authorized JavaScript origins":
 *
 *   PLAYWRIGHT_BASE_URL=https://new-domain.example.com npx playwright test
 *
 * When PLAYWRIGHT_BASE_URL is set, Playwright will NOT try to boot a local
 * dev server — it assumes the target is already deployed and reachable.
 * See e2e/google-auth.spec.ts for what this actually verifies.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const isRemoteTarget = Boolean(process.env.PLAYWRIGHT_BASE_URL)

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // 'html' is included in CI (alongside 'github'/'list') so the GitHub
  // Actions workflows (.github/workflows/smoke-test-staging.yml,
  // deploy-ec2.yml's smoke-test job) can upload playwright-report/ as a
  // workflow artifact when a run fails.
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Only manage a local dev server when no external base URL was given —
  // against a deployed/staging/prod domain we just hit it directly.
  webServer: isRemoteTarget
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
