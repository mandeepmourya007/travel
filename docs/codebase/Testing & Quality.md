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

**56 test files** under `apps/api/tests/`:

- `tests/integration/` — `auth.routes`, `chat-socket`, `document-review.repository`, `trending-score`
- `tests/unit/`
  - *middleware* — rate-limit, validate, error-handler
  - *providers* — `razorpay.gateway`, `cashfree.gateway`
  - *services* — all major services incl. payment, ==payment-cutover==, booking, chat, auth, admin, wallet, vehicle, notification, otp
  - *repositories* — trip, trip-request, conversation, webhook-event
  - *validators* — admin-cashback, common, trip, auth schemas
  - *utils* — ==constants-sync==, documents, rate-limiter, paginate, email, trip-mapper, search, chat-filter, login-attempt-tracker, phone, perf-timer, cron-jobs
  - *config* — redis

> [!tip] Notable Suites
> `constants-sync` guards drift between [[Shared Package]] constants and Prisma enums; `payment-cutover` covers the Razorpay→Cashfree gateway switch; `seed-refund-test.ts` seeds refund fixtures.

## Frontend (`apps/web`)

Vitest + **@testing-library/react** + **MSW** (API mocking) + **@playwright/test** (e2e dep). Tests co-located in `__tests__/` folders next to components. Run: `npm run test` / `test:coverage`.

## Shared (`packages/shared`)

`src/utils/refund.test.ts` — refund matrix coverage → [[Product Domain#Refund Policy Matrix]].

## Quality Tooling

- **Type safety** — `npm run type-check` per workspace (strict TS → [[Monorepo & Tooling#TypeScript Base (tsconfig.base.json)]]).
- **Lint/format** — ESLint per app, Prettier at root.
- **Observability** — Sentry on API (instrument.ts, cron `withMonitor` check-ins) and web (`@sentry/nextjs`, tunnel `/monitoring`); Pino with AsyncLocalStorage request context.
- **QA flows** — manual scripts in `docs/qa-traveler-flows.md` and `docs/qa-organizer-flows.md`.

Related: [[API Backend]] · [[Web Frontend]] · [[Monorepo & Tooling]]
