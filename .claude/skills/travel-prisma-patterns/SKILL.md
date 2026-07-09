---
name: travel-prisma-patterns
description: >-
  Prisma/PostgreSQL repository patterns for the travel (Safarnama/TripCompare)
  backend. Use when adding or changing anything in apps/api/src/repositories/,
  writing new queries/filters/pagination, running multi-model writes, or
  touching entity IDs (UUIDv7).
paths:
  - apps/api/src/repositories/**
  - apps/api/prisma/**
---

# Travel Prisma Patterns

**Read this skill before** adding repository methods, new Prisma queries, transactions, or ID-handling code in `apps/api`.

**Source of truth:** `apps/api/prisma/schema.prisma`, `apps/api/src/repositories/*.repository.ts` (20 files — `booking.repository.ts` is the richest reference), `apps/api/src/lib/prisma.ts` (`ExtendedPrismaClient`/`TransactionClient` types), `packages/shared/src/validators/common.schema.ts` (`idSchema`).

There is **no DynamoDB, no single-table design, no GSIs, no partition keys, no TTL attribute, no table scans** in this codebase — it is relational Postgres via Prisma. Do not port those concepts. The relational equivalents are: foreign keys + `@@index`/`@@unique` for access patterns, `include`/`select` for joins, and cron jobs (not DynamoDB TTL) for time-based cleanup (see `docs/codebase/Background Jobs & Realtime.md`).

---

## 1. ID strategy — UUIDv7, not DynamoDB keys

Every model is `@id @default(uuid(7))`. There are no `pk`/`sk` composite keys — each table has its own primary key and normal Postgres foreign keys (`tripId`, `userId`, `bookingId`, …).

> [!warning] The one real gotcha
> `z.string().uuid()` in Zod only accepts UUID versions 1–5 and **rejects v7** — it will 400 every legitimate new ID. Never use it. Always import the shared `idSchema` (or a param schema built from it) from `packages/shared/src/validators/common.schema.ts`:
> ```typescript
> export const idSchema = z.string().regex(
>   /^(c[a-z0-9]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
>   'Invalid id',
> )
> ```
> It accepts **both** legacy cuid v1 rows (pre-migration) and current UUIDv7 rows. Reuse it via `cuidParamSchema`, `tripIdParamSchema`, `bookingIdParamSchema`, `organizerIdParamSchema`, `tripRequestParamSchema` — don't hand-roll a new `z.object({ id: z.string() })` per route.

There is no `entityType` discriminator field (that's a single-table-design concept) — Prisma models are already strongly typed per table, so no runtime type tag is needed.

---

## 2. Repository module shape

```
apps/api/src/repositories/
  <entity>.repository.ts   → one class per aggregate root, wraps Prisma Client
```

Standard shape (see `booking.repository.ts`, `trip.repository.ts`):

```typescript
export class BookingRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async findById(id: string) {
    return this.prisma.booking.findFirst({
      where: { id, isDeleted: false },   // soft-delete filter — see §5
      include: BOOKING_INCLUDE_LIST,
    })
  }

  // private helpers build dynamic WHERE/ORDER BY, kept out of the public API
  private buildWhere(...): Prisma.BookingWhereInput { ... }
}
```

Rules:
- Constructor takes `ExtendedPrismaClient` (or a `TransactionClient` for methods invoked inside someone else's transaction) — never instantiate `PrismaClient` inside a repository.
- Controllers/services never import `@prisma/client` query builders directly; only repositories call `this.prisma.<model>.*`.
- Reusable `include`/`select` shapes are module-level `const ... = { ... } as const` objects above the class (e.g. `BOOKING_INCLUDE_LIST`, `TRIP_SELECT_SUMMARY`, `TRIP_INCLUDE_SUMMARY`) — this keeps shapes consistent across methods and is the closest equivalent to oprag's key-builder functions, except these are query-shape builders, not key builders.
- Prefer `select` over `include` for list/summary endpoints to avoid pulling heavy `Json`/text columns (see `TRIP_SELECT_SUMMARY` comment in `trip.repository.ts`: "select instead of include so heavy JSON columns are never fetched for list views").

---

## 3. Common query patterns

### Paginated list with filters (offset/limit, not cursor)

```typescript
async findByUserId(userId: string, tab: string | undefined, pagination: { offset: number; limit: number }) {
  const where = this.buildUserWhere(userId, tab)
  const [data, total] = await Promise.all([
    this.prisma.booking.findMany({ where, skip: pagination.offset, take: pagination.limit, orderBy, include }),
    this.prisma.booking.count({ where }),
  ])
  return { data, total }
}
```
- Always run `findMany` + `count` in `Promise.all` — never sequentially.
- Filter types (`TripBookingFilters`, `TripFilters`, `DestinationTripFilters`) live in `packages/shared/src/types/*.types.ts`; sort/status enums that back them live in `packages/shared/src/constants/*` (see root `CLAUDE.md` "No Magic Strings" rule — a `sort=` or `status=` string used in more than one place must come from a shared constant, e.g. `BOOKING_STATUS`, `SORT_ORDER`).
- A `WHERE` clause is built by a private `buildWhere`/`buildUserWhere` method returning `Prisma.<Model>WhereInput` — keep this logic in the repository, not the service.

### Ownership-scoped queries (the relational equivalent of tenant isolation)

There's no `companyId` partition key here; ownership is enforced by **always including the owning FK in `WHERE`**:

```typescript
// IDOR prevention — userId is REQUIRED in the where clause, never optional
private buildUserWhere(userId: string, tab?: string): Prisma.BookingWhereInput {
  return { userId, isDeleted: false, ...tabFilter }
}
```
See the comment in `booking.repository.ts::findByUserId` ("WHERE: userId (REQUIRED — IDOR prevention)"). The same pattern applies to organizer-scoped trip queries (`trip.repository.ts` — `organizerId` in every organizer-dashboard query) and admin-only queries that intentionally omit the owner filter because the caller is ADMIN (checked at the route/service layer via `requireRole`, not in the repository).

### Aggregation (`groupBy`, `aggregate`)

```typescript
async getTripBookingSummary(tripId: string) {
  const [confirmedAgg, revenueGroups, pendingRequests] = await Promise.all([
    this.prisma.booking.aggregate({ _count: { id: true }, _sum: { numTravelers: true }, where: {...} }),
    this.prisma.paymentTransaction.groupBy({ by: ['type'], _sum: { amount: true }, where: {...} }),
    this.prisma.tripRequest.count({ where: {...} }),
  ])
  ...
}
```
Money aggregates always filter `status: PAYMENT_TX_STATUS.CAPTURED` — INITIATED/FAILED transactions must never count as revenue (see `getTripBookingSummary`'s "revenue nets out payments and refunds" comment).

### Raw SQL — only for what Prisma can't express

Used sparingly, for: `DATE_TRUNC` grouping (`getRevenueTrend`), `SELECT ... FOR UPDATE` row locks inside a transaction (`cancelAtomically`), and atomic counter increments/decrements (`atomicConfirmGate`, `revertConfirmGate`). Always via `$queryRaw`/`$executeRaw` **tagged templates** (parameterized) — never string-concatenate user input into raw SQL. The one place a non-parameterizable value is interpolated (`Prisma.raw(String(months - 1))` in `getRevenueTrend`) is explicitly commented as safe only because it's a hardcoded number from the service layer, never user input — follow that same discipline for any future `Prisma.raw()` use.

---

## 4. Transactions

Two patterns, both via `this.prisma.$transaction`:

1. **Multi-model atomic write** — e.g. `createWithPaymentTx` creates a `Booking` + its initial `PaymentTransaction` in one transaction so no request can crash between the two writes and leave an unresolvable order.
2. **Read-lock + conditional update** — e.g. `cancelAtomically` does `SELECT ... FOR UPDATE` then a conditional `UPDATE`, guaranteeing no double-cancel race; `atomicConfirmGate`/`revertConfirmGate` use a single guarded `UPDATE ... WHERE bookingStatus = 'PENDING_PAYMENT'` (optimistic-gate pattern) instead of a transaction when only one row needs a guarded transition.

A generic `withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>)` helper exists on both `BookingRepository` and `TripRepository` for services that need to coordinate writes across repositories inside one transaction — reuse it rather than opening ad hoc `$transaction` calls in the service layer.

---

## 5. Soft delete & audit conventions

Most models carry `isActive` / `isDeleted` / `deletedAt` + `createdAt` / `updatedAt`. **Every** repository read must filter `isDeleted: false` (or the model's soft-delete flag) unless the method is explicitly an admin/audit query that intentionally includes deleted rows — there is no automatic global filter (no Prisma middleware doing this), so it is a hand-checked convention. When adding a new repository method, check whether the model has a soft-delete flag and add it to `where`.

`WebhookEvent` is the one documented exception — it's an append-only audit trail with no soft-delete fields at all (see `docs/codebase/Database Schema.md`); don't add soft-delete filters to it.

Money fields are `Int` (paise/rupees), never `Float`/`Decimal` for amounts that must not have rounding drift (except `OrganizerProfile.commissionRate`, a `Decimal(5,2)` percentage). Never introduce a floating-point money field.

---

## 6. Common mistakes

1. **`z.string().uuid()` on any new param/body schema** — rejects UUIDv7. Always use `idSchema`/`*ParamSchema` from `common.schema.ts`.
2. **Missing `isDeleted: false` in a new repository query** — silently returns soft-deleted rows.
3. **Sequential `findMany` + `count`** instead of `Promise.all` — doubles latency for every paginated list.
4. **Owner filter left optional** — e.g. writing `userId?: string` into a `WHERE` builder for a booking/wallet/review query defeats IDOR protection; the owning FK must be a required parameter, not optional, on any traveler/organizer-scoped repository method.
5. **Calling Prisma directly from a controller or service** — breaks the routes → controllers → services → repositories layering documented in `apps/api/CLAUDE.md`; all Prisma Client calls belong in `src/repositories/*.repository.ts`.
6. **Hardcoding a status/sort-field string used in more than one file** — grep `packages/shared/src/constants/` first (e.g. `BOOKING_STATUS`, `PAYMENT_TX_TYPE`, `SORT_ORDER`, `WALLET_TX`) before adding a new literal; see root `CLAUDE.md` "No Magic Strings".
7. **Interpolating user input into `Prisma.raw()`** — only ever pass hardcoded, service-controlled values (see `getRevenueTrend`'s `months` parameter comment); all user-facing values must go through tagged-template parameters (`${value}`), never `Prisma.raw()`.
8. **Forgetting the partial-unique indexes that live only in raw SQL migrations** — e.g. one active booking per (user, trip), one REFUND per booking, admin-support conversation uniqueness. These aren't visible in `schema.prisma`'s declarative `@@unique` blocks; check `apps/api/prisma/migrations/` before assuming a constraint doesn't exist.

## Adding a new repository method (checklist)

1. Check `packages/shared/src/types/*.types.ts` for an existing filter/DTO type before inventing a new one.
2. Check `packages/shared/src/constants/*` for sort/status literals before hardcoding.
3. Build `WHERE` via a private `buildWhere`-style method returning `Prisma.<Model>WhereInput`; include the soft-delete flag and the owning FK if this is an owner-scoped read.
4. For list endpoints, use `select` with only the fields the mapper needs; for detail endpoints, `include` is fine.
5. For multi-model writes, use `$transaction` (or the repo's `withTransaction` helper) — never issue two independent `create`/`update` calls that must succeed together.
6. Any new ID-shaped param goes through `idSchema` — never bare `z.string()` or `z.string().uuid()`.
7. Run `npm run type-check` (root or `apps/api`) before considering the method done.
