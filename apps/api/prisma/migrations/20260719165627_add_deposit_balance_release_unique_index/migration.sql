-- Migration: Add partial unique indexes on PaymentTransaction for DEPOSIT_RELEASE and
-- BALANCE_RELEASE rows — one index per type, mirrors the existing ESCROW_RELEASE unique
-- index (see 20260614000001_escrow_release_unique_index).
--
-- Purpose: prevent duplicate DEPOSIT_RELEASE / BALANCE_RELEASE rows per booking even
-- under concurrent execution (multiple API instances, or a duplicate cron run). This is
-- the hard DB backstop; payout.service.ts's P2002 catch is the code-level guard that
-- keeps a duplicate insert from also triggering a duplicate gateway call.
--
-- Both enum values are brand new as of the previous migration (no existing rows
-- reference them), so no dedupe step is needed before creating these indexes, unlike
-- the ESCROW_RELEASE migration which had to clean up pre-existing duplicates first.

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_bookingId_deposit_release_unique"
  ON "PaymentTransaction" ("bookingId")
  WHERE type = 'DEPOSIT_RELEASE';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_bookingId_balance_release_unique"
  ON "PaymentTransaction" ("bookingId")
  WHERE type = 'BALANCE_RELEASE';
