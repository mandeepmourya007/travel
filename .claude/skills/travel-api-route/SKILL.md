---
name: travel-api-route
description: >-
  End-to-end workflow for adding or changing an Express route in the travel
  (Safarnama/TripCompare) API — docs discovery, Zod schema in packages/shared,
  repository, service, controller, route registration, verify commands, and a
  downstream-sync reminder. Use when adding a backend route, changing
  request/response shape, or extending apps/api's REST surface.
paths:
  - apps/api/**
  - packages/shared/**
---

# Travel API Route

**Read this skill before** adding or changing a route in `apps/api/src/routes/`, a controller in `src/controllers/`, a service in `src/services/`, a repository in `src/repositories/`, or a Zod schema in `packages/shared/src/validators/`.

**Companion:** [travel-verify](../travel-verify/SKILL.md) (verification commands) · `apps/api/CLAUDE.md` (layering rules) · root `CLAUDE.md` (no-magic-strings + docs-sync rules)

**Source of truth:** `docs/codebase/API Routes Reference.md` (one file, full route table by domain — not split per-section like some repos) · `docs/codebase/API Backend.md` (architecture, middleware, services) · `apps/api/src/server.ts` (mount map) · `apps/api/src/config/dependencies.ts` (manual DI wiring)

---

## Pre-flight (before editing)

Copy and complete:

```
Pre-flight:
- [ ] Read docs/codebase/API Routes Reference.md — find the domain table (Auth/Trips/Bookings/etc.) for this endpoint
- [ ] Read docs/codebase/API Backend.md if touching middleware, services layer, or constants
- [ ] Open the existing routes file in apps/api/src/routes/ if extending a domain (e.g. booking.routes.ts)
- [ ] Decide auth: none / authMiddleware only / authMiddleware + requireRole(...roles)
- [ ] If the wire shape changes (new field, new enum, new status) → new/changed Zod schema in packages/shared/src/validators/
- [ ] Grep packages/shared/src/constants/ for any string literal you're about to hardcode (root CLAUDE.md "no magic strings" rule)
```

---

## Workflow

### 1. Route discovery

1. Scan `docs/codebase/API Routes Reference.md` for the method + path — it's organized by domain heading (`## Auth`, `## Bookings`, etc.) with a guard column (`—` / `auth` / `ROLE`). There is no separate per-section file — this one note *is* the whole route table.
2. Cross-check `apps/api/src/server.ts` — confirm the mount prefix (`app.use('/api/v1/<domain>', <domain>Routes)`) exists or is missing.
3. Open the routes file for that domain in `apps/api/src/routes/` (e.g. `booking.routes.ts`) — it's a `createXRoutes(controller, authMiddleware, requireRole)` factory function, not a bare `Router()` export.
4. Read `docs/codebase/API Backend.md` for the relevant service's responsibility summary and any related constants in `src/utils/constants.ts`.

### 2. Wire contract (`packages/shared/`)

Travel has **no separate `api-contract` package** — the shared wire contract lives directly in:

| Change | Where |
| --- | --- |
| New enum / status value / sort field | `packages/shared/src/constants/<domain>.ts` — export the `const` object, its derived type, and (if used in a Zod `.enum()`) the tuple array (see root `CLAUDE.md` DRY pattern) |
| Request/response DTO shape | `packages/shared/src/types/<domain>.types.ts` |
| Request validation schema | `packages/shared/src/validators/<domain>.schema.ts` — a `z.object({...})` per body/query/params shape, exported by name (e.g. `createBookingSchema`, `myBookingFiltersSchema`) |
| Shared ID/param schemas | `packages/shared/src/validators/common.schema.ts` — `cuidParamSchema`, `tripIdParamSchema`, `bookingIdParamSchema`, `paginationSchema`, etc. Reuse these; only add a new one if no existing param schema fits |

All of the above are re-exported from `packages/shared/src/index.ts` (`export * from './types' / './constants' / './validators'`). After changing anything here:

```bash
cd packages/shared && npm run type-check
cd apps/api && npm run type-check      # apps/api imports @shared/* extensively
cd apps/web && npm run type-check      # apps/web imports @travel/shared directly too — don't skip this
```

**Never** use `z.string().uuid()` for ID params — IDs are UUIDv7 and Zod's `.uuid()` rejects v7. Use `idSchema` / `cuidParamSchema` / a domain `*IdParamSchema` from `common.schema.ts`, which accept both cuid and UUID.

### 3. Repository (`apps/api/src/repositories/`)

Skip if the service only orchestrates existing repository calls.

When adding data access:

1. One file per aggregate, Prisma Client only — controllers and services never import `@prisma/client` operations directly; only repositories do.
2. Method names read like intent (`findActiveByOrganizer`, `markCancelled`), not raw Prisma verbs.
3. Schema change (new column/model/enum)? Update `schema.prisma`, run `npm run db:migrate` (dev), then update `docs/codebase/Database Schema.md` per the root docs-sync rule.
4. If the query needs to guard against a known drift class (e.g. a shared constant mirroring a Prisma enum), check `tests/unit/utils/constants-sync.test.ts` — extend it if you added a new mirrored enum.

### 4. Service (`apps/api/src/services/`)

Business logic and ownership checks live here — never in the controller.

```typescript
export class XService {
  constructor(private xRepo: XRepository, /* other repos/services */) {}

  async createX(userId: string, dto: CreateXDto) {
    // ownership / role-adjacent checks that requireRole() can't express
    // (e.g. "this trip belongs to this organizer") go here, against userId — never trust an id from dto for the acting user
    const result = await this.xRepo.create({ ...dto, ownerId: userId })
    return result
  }
}
```

- Throw `src/errors/app-error.ts` subclasses (`ValidationError` 400, `AuthError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `PaymentError` 502) — never a bare `Error` or manual `res.status()`.
- Services never touch `req`/`res`.
- Payment-provider calls go through `src/providers/payment/` gateway interfaces — never call Razorpay/Cashfree SDKs directly from a service (see root `CLAUDE.md` Cashfree section if this is a payment-flow change).
- Register the new service instance in `src/config/dependencies.ts` alongside its repository, following the existing wiring order (repo → service → controller → routes).

### 5. Controller (`apps/api/src/controllers/`)

Thin, one service call per method, wrapped in `asyncHandler`:

```typescript
export class XController {
  constructor(private xService: XService) {}

  /** POST /x — one-line description of what this route does */
  createX = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.xService.createX(req.user!.userId, req.body as CreateXDto)
    res.status(201).json({ success: true, data: result })
  })
}
```

No business logic, no direct repository calls, no manual try/catch (that's what `asyncHandler` + `error-handler.middleware.ts` are for).

### 6. Register route (`apps/api/src/routes/<domain>.routes.ts` + `server.ts`)

Add to the `createXRoutes` factory, ordering **static paths before `:param` paths** (see `booking.routes.ts` — `/my`, `/my/summary` before `/:id/cancel`):

```typescript
router.post(
  '/',
  someRateLimit,                          // optional — src/middleware/rate-limit.middleware.ts
  authMiddleware,                         // omit for public routes
  requireRole('ORGANIZER', 'ADMIN'),      // optional
  validate(createXSchema),                // body — or validate(schema, 'query'|'params')
  controller.createX,
)
```

- If this is a brand-new domain (not extending an existing routes file), also: import + instantiate repo/service/controller/routes in `src/config/dependencies.ts`, then `app.use('/api/v1/<domain>', xRoutes)` in `src/server.ts` — mount **after** the JSON body parser unless it's a webhook needing raw bytes (webhooks mount before `express.json()` — never move them below it).
- Reuse an existing rate limiter from `src/middleware/rate-limit.middleware.ts` (`general`, `auth`, `otp`, `webhook`, `booking`, `admin`) rather than inventing a new bucket unless the endpoint genuinely needs its own limit.

### 7. Verify

From [travel-verify](../travel-verify/SKILL.md):

```bash
# Route/controller/service only (no shared schema change):
cd apps/api && npm run type-check
cd apps/api && npx vitest run tests/unit/services/<name>.service.test.ts tests/unit/repositories/<name>.repository.test.ts

# packages/shared validator/constant/type touched:
cd packages/shared && npm run type-check
cd apps/api && npm run type-check
cd apps/web && npm run type-check      # apps/web imports @travel/shared directly

# Before commit (full route work):
cd apps/api && npm run type-check && npm run test
```

Add a test in `tests/unit/services/` for the new business logic, and in `tests/unit/validators/` if you added a nontrivial Zod refinement. Extend `tests/integration/auth.routes.test.ts`-style coverage only if the route is auth/session-critical.

---

## Surface changed? Downstream sync (remind, don't block)

When method, path, auth mode, or request/response shape changes, **note it for follow-up** — per the root `CLAUDE.md` docs-sync rule, update in the same task where possible:

| Surface change | Update | Notes |
| --- | --- | --- |
| Any route add/remove/rename, guard change, rate-limit change | `docs/codebase/API Routes Reference.md` | Do this yourself, or hand off to the `travel-api-docs-engineer` subagent if it's already running in parallel |
| Service/repository/middleware/backend constant change | `docs/codebase/API Backend.md` | Edit only the affected rows/sections |
| `schema.prisma` change | `docs/codebase/Database Schema.md` | Include new migration name |
| Shared constant/type/validator change | `docs/codebase/Shared Package.md` | Also remove the item from "Known Inconsistencies" if this resolves one |
| `apps/web` consumes the changed enum/type directly | Re-run `cd apps/web && npm run type-check` | No separate doc note needed — this is a compile-time check, not a docs update |
| Payment/webhook/escrow flow change | `docs/codebase/Payments & Webhooks.md` | — |

Prompt template for the user or parent agent:

```
Backend route changed: [METHOD /path].
Run travel-api-docs-engineer to sync docs/codebase/API Routes Reference.md,
and travel-qa-engineer if new business logic needs test coverage.
```

Do **not** silently skip the docs update for a user-facing endpoint — it's a same-task requirement, not optional polish.

---

## Decision tree

```
New endpoint?
├─ Data persisted? → repository (Prisma) → service → controller → routes.ts → server.ts mount
├─ Wire shape changed (new field/enum/status)? → packages/shared (constants/types/validators) → re-typecheck apps/api + apps/web
├─ Protected? → authMiddleware [+ requireRole(...)] ; ownership checks in the service against req.user!.userId
├─ Payment-related? → src/providers/payment/ gateway interface only, never the SDK directly
└─ New rate-limit bucket needed? → src/middleware/rate-limit.middleware.ts, else reuse an existing one

Changing an existing endpoint?
├─ Read docs/codebase/API Routes Reference.md row for this path
├─ Grep the routes file + server.ts mount + dependencies.ts wiring
└─ Same verify + downstream-sync rules as above
```

---

## Common mistakes

1. **`z.string().uuid()` on an ID param** — rejects UUIDv7. Use `idSchema`/`cuidParamSchema` from `packages/shared/src/validators/common.schema.ts`.
2. **Business logic in the controller** — controllers call exactly one service method and shape the response; move branching/ownership checks to the service.
3. **Trusting `req.body.userId` for the acting user** — always use `req.user!.userId` from the verified JWT.
4. **Static routes registered after `:param` routes** — Express matches top-down; `/my/summary` must be declared before `/:id`.
5. **Forgetting the `apps/web` typecheck** after a `packages/shared` enum/type change — `apps/web` imports `@travel/shared` in dozens of pages/components and will silently drift until you run its typecheck.
6. **Calling Razorpay/Cashfree SDKs directly from a service** instead of through `src/providers/payment/` — breaks the gateway-swap abstraction (see `payment-cutover.test.ts`).
7. **Moving a webhook route below `express.json()`** — breaks HMAC signature verification, which needs the raw body.
8. **Skipping the `docs/codebase/API Routes Reference.md` update** when the route surface changes — this is a same-task requirement per root `CLAUDE.md`, not a follow-up nice-to-have.

---

## Pre-ship checklist

- [ ] `docs/codebase/API Routes Reference.md` row read/updated for this endpoint
- [ ] Route registered in the domain's `createXRoutes` factory with correct static-before-`:param` ordering
- [ ] Auth: `authMiddleware` [+ `requireRole`] matches the guard column in the docs table; ownership checks done in the service
- [ ] Zod schema added/updated in `packages/shared/src/validators/`, no bare `z.object({...})` inline in the route file
- [ ] No new magic strings — checked `packages/shared/src/constants/` first
- [ ] `packages/shared` / `apps/api` / `apps/web` typechecks all pass if the shared contract changed
- [ ] `cd apps/api && npm run type-check && npm run test` passes
- [ ] Docs/QA follow-up noted if the surface changed (`travel-api-docs-engineer`, `travel-qa-engineer`)
