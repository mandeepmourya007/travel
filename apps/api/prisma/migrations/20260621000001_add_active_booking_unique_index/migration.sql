-- Migration: Add partial unique index on Booking(userId, tripId) for active rows
--
-- Purpose: DB-level backstop preventing duplicate active bookings for the same
-- user+trip. This is the hard constraint; the Redis distributed lock in
-- BookingService.createBooking() is the first line of defence.
--
-- "Active" = PENDING_PAYMENT or CONFIRMED and not soft-deleted.
-- CANCELLED / EXPIRED / COMPLETED rows are explicitly excluded so a user can
-- rebook after cancellation or expiry.
--
-- Prisma cannot express partial unique indexes declaratively, so this migration
-- is written as raw SQL. The index is documented via a comment in schema.prisma.
--
-- Step 1: Dedupe — keep the earliest active row per (userId, tripId) and expire
-- any extras so the index can be created even if duplicates already exist.
DO $$
DECLARE
  deduped_count INTEGER;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      "userId",
      "tripId",
      ROW_NUMBER() OVER (
        PARTITION BY "userId", "tripId"
        ORDER BY "createdAt" ASC
      ) AS rn
    FROM "Booking"
    WHERE "bookingStatus" IN ('PENDING_PAYMENT', 'CONFIRMED')
      AND "isDeleted" = false
  ),
  to_expire AS (
    SELECT id FROM ranked WHERE rn > 1
  )
  UPDATE "Booking"
  SET "bookingStatus" = 'EXPIRED', "updatedAt" = NOW()
  WHERE id IN (SELECT id FROM to_expire);

  GET DIAGNOSTICS deduped_count = ROW_COUNT;

  IF deduped_count > 0 THEN
    RAISE WARNING 'active_booking_unique_index migration: expired % duplicate active booking row(s) — investigate concurrent booking creation', deduped_count;
  END IF;
END $$;

-- Step 2: Create the partial unique index.
-- Note: CONCURRENTLY is intentionally omitted. Prisma migrations run inside a
-- transaction by default, and PostgreSQL does not permit CREATE INDEX CONCURRENTLY
-- inside a transaction. The trade-off is a brief exclusive lock on the Booking table
-- while the index is built. For large production tables, run this step manually
-- outside a transaction (after extracting it from the migration file).
--
-- IMPORTANT — keep in sync: if a new "active" booking status is added, update BOTH:
--   1. This WHERE clause
--   2. The under-lock re-check inside BookingService.createBooking() in booking.service.ts
-- The distributed lock and the DB index must agree on what constitutes an "active" booking.
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_active_user_trip_unique"
  ON "Booking" ("userId", "tripId")
  WHERE "bookingStatus" IN ('PENDING_PAYMENT', 'CONFIRMED') AND "isDeleted" = false;
