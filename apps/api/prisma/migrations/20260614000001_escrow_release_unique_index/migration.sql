-- Migration: Add partial unique index on PaymentTransaction for ESCROW_RELEASE rows
--
-- Purpose: Prevent duplicate ESCROW_RELEASE rows per booking even under concurrent
-- cron executions (multiple API instances). This is the hard DB backstop; the
-- Redis distributed lock in cron-jobs.ts is the first line of defence, and the
-- P2002 catch in trip-lifecycle.service.ts ensures we never double-call Razorpay.
--
-- Prisma cannot express partial unique indexes declaratively, so this migration
-- is written as raw SQL. The index is documented via a comment in schema.prisma.
--
-- Step 1: Dedupe — keep the earliest ESCROW_RELEASE per bookingId and delete the
-- rest. This lets the index be created even if duplicates already exist in prod.
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      "bookingId",
      ROW_NUMBER() OVER (PARTITION BY "bookingId" ORDER BY "createdAt" ASC) AS rn
    FROM "PaymentTransaction"
    WHERE type = 'ESCROW_RELEASE'
  ),
  to_delete AS (
    SELECT id FROM ranked WHERE rn > 1
  )
  DELETE FROM "PaymentTransaction"
  WHERE id IN (SELECT id FROM to_delete);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    RAISE WARNING 'escrow_release_unique_index migration: deleted % duplicate ESCROW_RELEASE row(s) — investigate how these were created', deleted_count;
  END IF;
END $$;

-- Step 2: Create the partial unique index.
-- CONCURRENTLY avoids a full table lock; cannot be run inside a transaction block,
-- but Prisma migrations run outside a transaction by default.
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_bookingId_escrow_release_unique"
  ON "PaymentTransaction" ("bookingId")
  WHERE type = 'ESCROW_RELEASE';
