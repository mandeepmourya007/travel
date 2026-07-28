-- Migration: Organizer earnings via Wallet ledger (RazorpayX Payouts strategy) —
-- see docs/codebase/Payments & Webhooks.md "Organizer earnings via Wallet ledger".
--
-- Reuses the existing (traveler-only until now) Wallet/WalletTransaction ledger as the
-- organizer's earnings balance. Adds four WalletTransactionType values:
-- - ORGANIZER_EARNING            (credit) — organizer's entitlement, credited at payment capture.
-- - ORGANIZER_EARNING_REVERSAL   (debit)  — claw-back on refund/cancellation.
-- - ORGANIZER_PAYOUT             (debit)  — admin-triggered real payout release.
-- - ORGANIZER_PAYOUT_REVERSED    (credit) — rare bank-side reversal after a payout succeeded.
--
-- Modeled on 20260728010000_add_razorpayx_payouts_enums_and_columns — ADD VALUE IF NOT EXISTS
-- so this migration is safe to re-run.

-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'ORGANIZER_EARNING';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'ORGANIZER_EARNING_REVERSAL';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'ORGANIZER_PAYOUT';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'ORGANIZER_PAYOUT_REVERSED';
