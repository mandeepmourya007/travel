# DB Review — Apply Runbook & Scaling Plan

Generated from the DBA review (2026-06-27). Covers what changed, how to apply it,
and the deferred scale work.

---

## 1. What changed in this pass

| Area | Change | Migration / file |
|------|--------|------------------|
| Index hygiene | Dropped 14 standalone `isDeleted` indexes, redundant `User(email)`, prefix-redundant `Trip(isDeleted,status)` and `Review(tripId)` | `20260627000001_drop_redundant_indexes` |
| Money | `OrganizerProfile.commissionRate` `Float → Decimal(5,2)`; dropped unused `SeatCellType` enum | `20260627000002_commission_decimal_drop_seatcelltype` |
| Correctness | Partial unique: one `ADMIN_SUPPORT` conversation per traveler | `20260627000003_conversation_admin_support_unique` |
| IDs | All 26 models `@default(cuid()) → @default(uuid(7))` (Prisma 6.19) | **no SQL** — client-side default |
| Validators | `.cuid()` → shared `idSchema` (accepts legacy cuid **and** UUIDv7) | `packages/shared/src/validators/*` |
| Retention | New daily cron purges terminal `WebhookEvent` rows older than 90 days | `cron-jobs.ts` |

> **No data migration for the ID switch.** Existing `cuid` rows keep working; new
> rows get UUIDv7. Column type stays `TEXT`. Mixed ids coexist permanently.

---

## 2. How to apply (against your DB)

```bash
cd apps/api

# 1. Confirm the migration history is in sync (no drift expected)
npx prisma migrate status

# 2. Apply the 3 new migrations
npx prisma migrate deploy        # production
# or, in dev, to also re-sync the client:
# npx prisma migrate dev

# 3. Regenerate the client (already done locally, safe to repeat)
npx prisma generate
```

### Manual SQL (not expressible in Prisma) — run once

The `Wallet` non-negative balance CHECK was noted in the schema but is not in a
migration. Apply it when convenient:

```sql
ALTER TABLE "Wallet"
  ADD CONSTRAINT wallet_balance_non_negative CHECK (balance >= 0);
```

### Large-table note
`20260627000001` drops indexes inside a transaction (brief `ACCESS EXCLUSIVE`
lock — effectively instant, catalog-only). If any table is very large and you
want zero lock, run those `DROP INDEX` statements manually as
`DROP INDEX CONCURRENTLY` **outside** a transaction instead.

---

## 3. Deferred (agreed) — revisit later

- **`Wallet.balance` `Int → BigInt`.** `Int` caps a single value at ~₹21.4M (paise).
  Fine for beta; switch accumulating balances to `BigInt` before any wallet can
  approach that. Note the JS `bigint` serialization churn across API/FE when you do.
- **WalletTransaction NULL-unique.** Left as-is: the existing
  `@@unique([type, referenceModel, referenceId])` already de-dupes non-null refs
  (the real idempotency case). Enforcing on NULL refs would block legitimate
  repeated `ADMIN_CREDIT` rows.

---

## 4. Partitioning plan (not yet executed)

Three append-only tables will dominate row count at scale and should move to
**`RANGE` partitioning by `createdAt`** (monthly) before they reach the low
tens of millions of rows: **`WebhookEvent`**, **`Notification`**, **`Message`**.

Benefits: index size per partition stays small, old data is dropped by detaching
a partition (instant, no `DELETE` bloat), and `VACUUM`/backup costs drop.

### Approach (per table, done online)
Postgres can't convert a populated table to partitioned in place, so use the
rename + backfill pattern:

```sql
-- Example for WebhookEvent. Run in a maintenance window or with low write load.
BEGIN;

ALTER TABLE "WebhookEvent" RENAME TO "WebhookEvent_old";

CREATE TABLE "WebhookEvent" (LIKE "WebhookEvent_old" INCLUDING ALL)
  PARTITION BY RANGE ("createdAt");

-- Create partitions (automate monthly going forward, e.g. via pg_partman)
CREATE TABLE "WebhookEvent_2026_06" PARTITION OF "WebhookEvent"
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE "WebhookEvent_2026_07" PARTITION OF "WebhookEvent"
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- ... plus a DEFAULT partition as a safety net

INSERT INTO "WebhookEvent" SELECT * FROM "WebhookEvent_old";
DROP TABLE "WebhookEvent_old";

COMMIT;
```

### Caveats
- **The partition key must be part of every unique constraint / PK.** For these
  tables a unique like `WebhookEvent(source, externalEventId)` must become
  `(source, externalEventId, createdAt)` — plan the idempotency lookups around that.
- Prisma does not manage partitions; treat the partitioned table as raw SQL and
  keep the model in `schema.prisma` matching the parent table's columns.
- Recommended: **`pg_partman`** for automatic monthly partition creation +
  retention (it can detach+drop partitions past a retention window, replacing the
  row-by-row `DELETE` crons for these tables).

### Retention targets (suggested)
| Table | Keep | Then |
|-------|------|------|
| `WebhookEvent` | 90 days (terminal rows) | drop partition (cron already deletes today) |
| `Notification` | 6–12 months | drop partition |
| `Message` | indefinite (product data) | partition for performance, do **not** auto-drop |
