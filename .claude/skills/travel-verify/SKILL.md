---
name: travel-verify
description: >-
  Use this skill whenever you need to answer: "I just changed X in the travel
  monorepo — what do I need to run to verify it's correct?" A change-type →
  verification-command decision table for apps/api, apps/web, and
  packages/shared. Use before committing any code change in this repo.
paths:
  - apps/api/**
  - apps/web/**
  - packages/shared/**
---

# Travel Verify

Decision table for the `travel` monorepo (npm workspaces + Turborepo). Commands below match the real `package.json` scripts (root, `apps/api`, `apps/web`, `packages/shared`) and each package's `vitest.config.ts` — not generic advice.

**Workspaces:** `apps/api` (Express 4 + Prisma 6 + Vitest + Supertest), `apps/web` (Next.js 15 + React 19 + Vitest + Testing Library + MSW), `packages/shared` (Zod constants/types/validators, no build step, consumed by both apps as `@travel/shared`).

---

## Section 1: Change type → verification map

| Change type | Typecheck | Unit / component tests | Integration / manual |
| --- | --- | --- | --- |
| API route/controller | `cd apps/api && npm run type-check` | `cd apps/api && npx vitest run tests/unit/**/<domain>*` (or full `npm run test`) | Relevant `tests/integration/*.test.ts` if the route touches DB/socket flows (e.g. `auth.routes.test.ts`); otherwise `curl` the route locally |
| Service change (`src/services/*.service.ts`) | `cd apps/api && npm run type-check` | `cd apps/api && npx vitest run tests/unit/services/<name>.service.test.ts` | If it touches payments/escrow, also run `tests/unit/services/payment-cutover.test.ts` (Razorpay↔Cashfree cutover coverage) |
| Repository change (`src/repositories/*.repository.ts`) | `cd apps/api && npm run type-check` | Colocated unit test in `tests/unit/repositories/` if present | If it's one of `trip`, `trip-request`, `conversation`, `webhook-event`, `document-review` — also check `tests/integration/` for a real-Postgres test on that repo |
| New/changed Zod validator (`packages/shared/src/validators/`) | `cd packages/shared && npm run type-check` then `cd apps/api && npm run type-check` and `cd apps/web && npm run type-check` (both consume `@travel/shared`) | `cd apps/api && npx vitest run tests/unit/validators/<name>.schema.test.ts` if it exists | — |
| New/changed shared constant or type (`packages/shared/src/constants\|types/`) | Same 3-package typecheck fan-out as above | `cd apps/api && npx vitest run tests/unit/utils/constants-sync.test.ts` — this test guards drift between shared constants and Prisma enums; run it whenever a constant that mirrors a Prisma enum changes | — |
| Prisma schema (`schema.prisma`, migration) | `cd apps/api && npm run type-check` (regenerates client via `prisma generate` if you ran `db:migrate`/`build`) | Affected `tests/unit/repositories/*` + `tests/integration/*` | `npm run db:migrate` locally against dev Postgres before committing the migration; see [[Database Schema]] |
| Middleware (`src/middleware/*.middleware.ts`) | `cd apps/api && npm run type-check` | `cd apps/api && npx vitest run tests/unit/middleware/<name>.middleware.test.ts` | — |
| Payment provider (`src/providers/payment/*.gateway.ts`) | `cd apps/api && npm run type-check` | `cd apps/api && npx vitest run tests/unit/providers/<razorpay\|cashfree>.gateway.test.ts` | Sandbox call per the relevant `cashfree-skills`/Razorpay flow — see root `CLAUDE.md` Cashfree section before declaring done |
| Socket.IO handler (`src/socket/handlers/*.ts`) | `cd apps/api && npm run type-check` | `cd apps/api && npx vitest run tests/integration/chat-socket.integration.test.ts` (only existing socket coverage — see Section 4) | Manual: connect two clients, verify presence/typing/read-receipt events |
| Cron job (`src/utils/cron-jobs.ts`, trip-lifecycle sweep) | `cd apps/api && npm run type-check` | `cd apps/api && npx vitest run tests/unit/utils/cron-jobs.test.ts` if present | Trigger the job function directly in `tsx --tsconfig tsconfig.json src/repl.ts` (via `npm run shell` in apps/api) against a seeded dev DB |
| Next.js page/layout (`apps/web/src/app/**`) | `cd apps/web && npm run type-check` | Colocated `__tests__/` next to the page if logic-bearing; otherwise visual check | `npm run dev` (or `docker:up`) and browse the route; see `debug-runtime` skill for client-side bugs |
| React component (`apps/web/src/components/**`) | `cd apps/web && npm run type-check` | `cd apps/web && npx vitest run src/components/<domain>/__tests__/<name>.test.tsx` | — |
| Hook / store (`apps/web/src/hooks\|store/**`) | `cd apps/web && npm run type-check` | `cd apps/web && npx vitest run src/hooks/__tests__/<name>.test.ts` or `src/store/__tests__/<name>.test.ts` | — |
| `apps/web` query keys / api-client (`src/lib/query-keys.ts`, `src/lib/api-client.ts`) | `cd apps/web && npm run type-check` | `cd apps/web && npx vitest run src/lib/__tests__/<name>.test.ts` | MSW mocks live in `src/test/mocks/`; update them if the endpoint shape changed |
| ESLint config / lint-only fix | `npm run lint` (root turbo, or scoped to the touched workspace) | — | — |
| Turbo/tsconfig/workspace scripts | `npm run type-check` at root (turbo fan-out) | `npm run test` at root | — |

### CI-equivalent (what should pass before opening a PR)

| Package | Commands |
| --- | --- |
| `apps/api` | `npm run type-check && npm run test` (`vitest run`, includes `tests/unit/**` + `tests/integration/**`) |
| `apps/web` | `npm run type-check && npm run lint && npm run test` |
| `packages/shared` | `npm run type-check && npm run test` (`vitest run`, covers `src/utils/refund.test.ts`) |
| Root (all workspaces) | `npm run type-check && npm run test` (Turborepo fans these out to all 3 packages) |

---

## Section 2: Always run before committing

Match the packages you touched — this repo has three packages, not the oprag five-plus-Terraform set.

```bash
# apps/api change:
cd apps/api && npm run type-check && npm run test

# apps/web change:
cd apps/web && npm run type-check && npm run lint && npm run test

# packages/shared change (constants/types/validators/utils):
cd packages/shared && npm run type-check
cd packages/shared && npx vitest run          # no package.json "test" script — invoke vitest directly
# THEN re-typecheck both consumers:
cd apps/api && npm run type-check
cd apps/web && npm run type-check

# Full-stack feature (typical):
cd apps/api && npm run type-check && npm run test
cd apps/web && npm run type-check && npm run lint && npm run test

# Or, from repo root, to fan out across all workspaces at once:
npm run type-check
npm run test
```

---

## Section 3: Test file conventions in travel

- **`apps/api`:** tests live in `apps/api/tests/{unit,integration}/`, **not** colocated with source. Vitest (`vitest.config.ts`: `environment: 'node'`, `include: ['tests/**/*.test.ts']`, `setupFiles: ['tests/setup.ts']`). Unit tests mock services/repositories; integration tests hit a real Postgres (`tests/integration/auth.routes.test.ts`, `chat-socket.integration.test.ts`, `document-review.repository.test.ts`, `trending-score.integration.test.ts`). HTTP-level tests use **Supertest** against the Express app.
- **`apps/web`:** tests are **colocated** in `__tests__/` folders next to the source file they cover (e.g. `src/components/bookings/__tests__/`, `src/hooks/__tests__/`, `src/store/__tests__/`). Vitest (`environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']`) + `@testing-library/react` + **MSW** for API mocking (handlers in `src/test/mocks/`, factories in `src/test/factories/`). `@playwright/test` is a dependency but no e2e suite exists yet — don't assume Playwright specs exist.
- **`packages/shared`:** no dedicated test folder convention yet — the one example (`src/utils/refund.test.ts`) is colocated next to its source file, Vitest syntax, but there is **no `vitest.config.ts` and no `test` script** in `packages/shared/package.json`. Run it with `npx vitest run` from that package directly (works because `vitest` is hoisted from `apps/api`/`apps/web` devDependencies at the workspace root).
- **Mocking pattern (`apps/api`):** constructor-inject fakes for services/repositories (this repo uses manual DI via `src/config/dependencies.ts`, not a DI container) — no `jest.mock()`/`vi.mock()` module-hoisting tricks needed for most service tests; use `vi.mock()` only for external SDKs (Razorpay, Cashfree, Cloudinary, Firebase Admin).
- **Auth/role tests:** mirror the pattern in `tests/integration/auth.routes.test.ts` for JWT/refresh-rotation coverage and `tests/unit/middleware/` for `requireRole`/`validate` gate tests.

---

## Section 4: What's not tested yet (real gaps found by inspection)

- `apps/api/src/socket/handlers/presence.handler.ts` and `socket-auth.middleware.ts` have no dedicated test file — only `chat.handler.ts` behavior is covered indirectly via `tests/integration/chat-socket.integration.test.ts`.
- `apps/api/tests/unit/` has no `controllers/` subfolder — controllers are thin (`asyncHandler` + one service call) and are exercised indirectly through `tests/integration/auth.routes.test.ts`, not via dedicated controller unit tests for other domains (booking, trip, payment, etc.).

---

## Section 5: When to write a test vs skip

**Write a test when:**

- New Zod validator with branching/refinement logic (`packages/shared/src/validators/`).
- New service method with business rules (refund math, seat-hold expiry, escrow release, commission calculation) — mirror `tests/unit/services/payment-cutover.test.ts` or `packages/shared/src/utils/refund.test.ts` for the pattern.
- Any auth, role, or ownership-check branch (mirror `tests/integration/auth.routes.test.ts` and `tests/unit/middleware/`).
- New repository method with nontrivial Prisma query logic (filters, joins, pagination) — add to `tests/unit/repositories/` or, if it needs a real DB, `tests/integration/`.
- New React hook or store slice with derived state or side effects (`apps/web/src/hooks/__tests__/`, `src/store/__tests__/`).

**Skip when:**

- Thin controller method that only calls one service method and shapes the response.
- Simple pass-through route registration with no branching.
- Pure UI/layout/spacing changes with no logic — use a manual browser check or the `debug-runtime` skill instead.

**After adding tests:** run the scoped file first (`npx vitest run <path>`), then the full package `npm run test` before committing.
