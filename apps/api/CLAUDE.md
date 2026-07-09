# Backend Conventions (`apps/api`)

Express 4 + TypeScript 5 + Prisma 6 + PostgreSQL, layered as **routes → controllers → services → repositories**. See [[API Backend]] and [[API Routes Reference]] in `docs/codebase/` for the full architecture and endpoint table — this file is the quick-reference for writing new code, not a duplicate of those notes.

## Handler anatomy

Every route follows this chain, wired in a `createXRoutes(controller, authMiddleware, requireRole)` factory (see `src/routes/booking.routes.ts` for the canonical example):

```typescript
router.post(
  '/',
  someRateLimit,                        // optional — src/middleware/rate-limit.middleware.ts
  authMiddleware,                       // src/middleware/auth.middleware.ts — verifies JWT, sets req.user
  requireRole('ORGANIZER', 'ADMIN'),    // optional — src/middleware/role.middleware.ts
  validate(createXSchema),              // src/middleware/validate.middleware.ts — Zod, throws ValidationError
  controller.createX,
)
```

Controllers are classes with `asyncHandler`-wrapped arrow methods (`src/utils/async-handler.ts`) that call **one service method** and shape the response — no business logic in controllers:

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

Business logic lives in `src/services/*.service.ts`; DB access lives in `src/repositories/*.repository.ts` (Prisma Client). Services never touch `req`/`res`; repositories never contain business rules.

## Error handling

Throw one of the `src/errors/app-error.ts` subclasses — never a bare `Error` or a hand-rolled `res.status(...).json(...)` for failures. `error-handler.middleware.ts` catches everything and shapes the response.

| Class                  | Status | Code                | Use for                                                                            |
| :-----------------------| :------:| :--------------------| :-----------------------------------------------------------------------------------|
| `ValidationError`      | 400    | `VALIDATION_ERROR`  | Bad input (normally thrown by `validate()` from Zod)                               |
| `AuthError`            | 401    | `UNAUTHORIZED`      | Missing/invalid JWT                                                                |
| `ForbiddenError`       | 403    | `FORBIDDEN`         | Authenticated but wrong role/ownership                                             |
| `NotFoundError`        | 404    | `NOT_FOUND`         | Entity not found / not in scope                                                    |
| `ConflictError`        | 409    | `CONFLICT`          | Duplicate, seat already held, already booked (use `subCode` to let clients branch) |
| `PaymentError`         | 502    | `PAYMENT_FAILED`    | Razorpay/Cashfree gateway failure — pass the underlying error as `cause`           |
| `TooManyRequestsError` | 429    | `TOO_MANY_REQUESTS` | OTP/resend cooldown, custom rate limiting (see `otp.service.ts`)                   |
| `GoneError`            | 410    | `GONE`              | Resource no longer valid, e.g. an already-used invite link (see `auth.service.ts`) |

Never leak Prisma internals, JWT secrets, or gateway credentials in an error message returned to the client.

## Auth & roles

- `authMiddleware` (from `createAuthMiddleware(authService)`) verifies the access JWT and sets `req.user = { userId, role, ... }`. It also enriches the AsyncLocalStorage request-context store so `getLogger()` includes `userId`/`role` — never re-derive these manually.
- `requireRole(...roles: UserRole[])` — role check against `packages/shared/src/constants/roles.ts` (`USER_ROLE`, `TRAVELER_ROLES`). Remember admins are included in `TRAVELER_ROLES` (see [[Product Domain]] — admin impersonation).
- Ownership checks (e.g. "this booking belongs to this user", "this trip belongs to this organizer") are **not** covered by `requireRole` — do them explicitly in the service layer against `req.user!.userId`, never trust an ID from the request body for the acting user.

## Validation

Every mutating route gets a Zod schema from `packages/shared/src/validators/` passed to `validate(schema, 'body' | 'query' | 'params')`. Add new schemas there — never inline `z.object({...})` in a route file. Path params (`:id`) usually validate against `cuidParamSchema` or a domain-specific `*IdParamSchema` from `@shared/validators/common.schema` — remember IDs are UUIDv7, so param schemas must accept both cuid and UUID (see root `CLAUDE.md` — never bare `z.string().uuid()`).

## No magic strings

Before adding any literal role/status/sort-field/query-key string, `grep -r` `packages/shared/src/constants/` first — see the root `CLAUDE.md` "Constants" rule. This applies doubly hard in `apps/api` since these values also drive Prisma enum-adjacent logic.

## Logging

Use `req.log` / the ALS-backed `getLogger()` (Pino) — never `console.log`. Structured fields (`userId`, `role`, `bookingId`, …) belong as object properties, not string-interpolated into the message.

## TypeScript & tests

- `npm run type-check` (from `apps/api/` or root `npm run type-check` via turbo) before committing.
- No `any` — use `unknown` with a type guard, or import the real Prisma/shared type.
- Tests live in `apps/api/tests/{unit,integration}/`, **not** colocated with source (unlike `apps/web`). Vitest. Unit tests mock services/repositories; integration tests hit a real Postgres (see `docs/codebase/Testing & Quality.md`).
- Payment-provider code goes behind the gateway interface in `src/providers/payment/` — never call Razorpay/Cashfree SDKs directly from a service.

## Socket.IO

Real-time handlers live in `src/socket/handlers/`, middleware in `src/socket/middleware/`. Same auth/role discipline as HTTP routes — never trust a socket payload's `userId`/`role`; use the value attached during socket auth.
