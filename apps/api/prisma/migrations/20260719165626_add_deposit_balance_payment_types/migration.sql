-- Migration: Add DEPOSIT_RELEASE / BALANCE_RELEASE PaymentType enum values.
--
-- These back the Cashfree deposit/balance organizer-payout split (utils/payout.ts):
-- DEPOSIT_RELEASE is recorded at booking time (non-refundable share released immediately),
-- BALANCE_RELEASE is recorded by the balance-release cron once the refund cliff has passed.
-- ESCROW_RELEASE remains untouched — it is the separate, Razorpay-only SafePay path.
--
-- Split into its own migration (rather than combined with the index-creation migration
-- below) because PostgreSQL disallows referencing a brand-new enum value (e.g. in a
-- partial index's WHERE clause) within the same transaction that added it — the new
-- value must be committed first. Prisma applies each migration.sql in its own transaction,
-- so two migrations is the standard way to sequence this.

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'DEPOSIT_RELEASE';

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'BALANCE_RELEASE';
