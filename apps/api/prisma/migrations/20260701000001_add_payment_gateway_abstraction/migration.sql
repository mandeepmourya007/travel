-- Migration: Add payment gateway abstraction (expand phase)
-- Adds provider-neutral columns alongside the legacy razorpay* columns.
-- The contract migration (dropping razorpay* columns) is deferred until after
-- one full deploy cycle with the new columns live.

-- ── Expand: Add new columns to PaymentTransaction ────────────────────────
ALTER TABLE "PaymentTransaction"
  ADD COLUMN IF NOT EXISTS "provider"          TEXT NOT NULL DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS "gatewayOrderId"    TEXT,
  ADD COLUMN IF NOT EXISTS "gatewayPaymentId"  TEXT,
  ADD COLUMN IF NOT EXISTS "gatewayRefundId"   TEXT,
  ADD COLUMN IF NOT EXISTS "gatewayTransferId" TEXT;

-- ── Expand: Add cashfreeVendorId to OrganizerProfile ─────────────────────
ALTER TABLE "OrganizerProfile"
  ADD COLUMN IF NOT EXISTS "cashfreeVendorId" TEXT;

-- ── New indexes for provider-neutral lookup ───────────────────────────────
CREATE INDEX IF NOT EXISTS "PaymentTransaction_provider_idx"
  ON "PaymentTransaction"("provider");

CREATE INDEX IF NOT EXISTS "PaymentTransaction_gatewayOrderId_idx"
  ON "PaymentTransaction"("gatewayOrderId");

CREATE INDEX IF NOT EXISTS "PaymentTransaction_gatewayPaymentId_idx"
  ON "PaymentTransaction"("gatewayPaymentId");

-- ── Backfill: copy existing Razorpay data into generic columns ────────────
-- All existing rows were created by Razorpay so provider='razorpay' (default covers them).
-- Copy IDs into the gateway* columns so code can switch reads to gateway* immediately.
UPDATE "PaymentTransaction" SET
  "provider"          = 'razorpay',
  "gatewayOrderId"    = "razorpayOrderId",
  "gatewayPaymentId"  = "razorpayPaymentId",
  "gatewayRefundId"   = "razorpayRefundId",
  "gatewayTransferId" = "razorpayTransferId"
WHERE "provider" = 'razorpay';
