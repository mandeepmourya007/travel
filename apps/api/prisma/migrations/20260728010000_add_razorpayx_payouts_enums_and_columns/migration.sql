-- Migration: RazorpayX Payouts support — dormant, switchable alternative to Razorpay
-- Route (see docs/codebase/Payments & Webhooks.md, PAYOUT_STRATEGY env var).
--
-- Adds:
-- - PaymentType.PAYOUT_RELEASE — the razorpayx_payouts-strategy analogue of ESCROW_RELEASE.
-- - PaymentStatus.PROCESSING / REVERSED — RazorpayX Payouts lifecycle statuses only;
--   INITIATED/CAPTURED/FAILED are reused for the rest of that lifecycle.
-- - OrganizerProfile.razorpayxContactId / razorpayxFundAccountId — Contact/FundAccount
--   IDs created alongside (not instead of) the existing razorpayAccountId Route linked
--   account, when PAYOUT_STRATEGY=razorpayx_payouts.
--
-- Split into its own migration (rather than combined with the index-creation migration
-- below) because PostgreSQL disallows referencing a brand-new enum value (e.g. in a
-- partial index's WHERE clause) within the same transaction that added it — mirrors
-- 20260719165626_add_deposit_balance_payment_types / ...627_add_deposit_balance_release_unique_index.

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'PAYOUT_RELEASE';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REVERSED';

-- AlterTable
ALTER TABLE "OrganizerProfile" ADD COLUMN IF NOT EXISTS "razorpayxContactId" TEXT;
ALTER TABLE "OrganizerProfile" ADD COLUMN IF NOT EXISTS "razorpayxFundAccountId" TEXT;
