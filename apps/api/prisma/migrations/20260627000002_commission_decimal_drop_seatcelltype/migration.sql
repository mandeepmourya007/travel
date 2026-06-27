-- Migration: commissionRate Float -> Decimal(5,2); drop unused SeatCellType enum
--
-- 1. Store commissionRate as an exact NUMERIC instead of double precision.
--    A commission percentage is config money math; Decimal removes float drift
--    in storage/comparisons. (double precision -> numeric is an allowed
--    assignment cast, no USING clause needed.)
--
-- ⚠️  PRODUCTION DEPLOY NOTE:
--    ALTER COLUMN … SET DATA TYPE takes an ACCESS EXCLUSIVE lock on
--    "OrganizerProfile". DOUBLE PRECISION → NUMERIC(5,2) requires a full table
--    rewrite in Postgres (different on-disk format). On a small table (<10k rows)
--    the lock is effectively instant, but schedule this migration during off-peak
--    hours as a precaution.
--
--    Pre-deploy check — run this first and confirm 0 rows before applying:
--    SELECT id, "commissionRate"
--    FROM "OrganizerProfile"
--    WHERE "commissionRate" IS NOT NULL
--      AND "commissionRate" != ROUND("commissionRate"::numeric, 2);
--    Any rows returned have >2 decimal places and will be rounded — review them
--    manually before proceeding.
ALTER TABLE "OrganizerProfile"
  ALTER COLUMN "commissionRate" SET DATA TYPE DECIMAL(5, 2);

-- 2. SeatCellType was defined but never referenced by any column. Drop it.
DROP TYPE IF EXISTS "SeatCellType";
