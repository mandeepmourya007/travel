-- Migration: Add partial unique index on PaymentTransaction for PAYOUT_RELEASE rows —
-- mirrors the existing ESCROW_RELEASE / DEPOSIT_RELEASE / BALANCE_RELEASE unique indexes
-- (see 20260614000001_escrow_release_unique_index and
-- 20260719165627_add_deposit_balance_release_unique_index).
--
-- Purpose: prevent duplicate PAYOUT_RELEASE rows per booking even under concurrent
-- execution (multiple API instances). This is the hard DB backstop; PayoutService's
-- P2002 catch in releaseRazorpayXPayout is the code-level guard that keeps a duplicate
-- insert from also triggering a duplicate RazorpayX payout call.
--
-- PAYOUT_RELEASE is brand new as of the previous migration (no existing rows reference
-- it), so no dedupe step is needed before creating this index.

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_bookingId_payout_release_unique"
  ON "PaymentTransaction" ("bookingId")
  WHERE type = 'PAYOUT_RELEASE';
