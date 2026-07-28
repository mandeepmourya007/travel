-- Migration: OrganizerPayoutAttempt — ledger-before-gateway-call row for
-- PayoutService.releaseOrganizerWalletPayout (admin-triggered organizer wallet-ledger
-- payout). Written INSIDE the distributed lock, BEFORE razorpayxClient.createPayout is
-- called, mirroring the PaymentTransaction ledger-before-gateway-call pattern already
-- used by releaseBalance/releaseRazorpayXPayout. See
-- docs/codebase/Payments & Webhooks.md "Organizer earnings via Wallet ledger".

-- CreateEnum
CREATE TYPE "OrganizerPayoutAttemptStatus" AS ENUM ('INITIATED', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "OrganizerPayoutAttempt" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestedAmount" INTEGER NOT NULL,
    "status" "OrganizerPayoutAttemptStatus" NOT NULL DEFAULT 'INITIATED',
    "gatewayTransferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerPayoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerPayoutAttempt_idempotencyKey_key" ON "OrganizerPayoutAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OrganizerPayoutAttempt_organizerId_idx" ON "OrganizerPayoutAttempt"("organizerId");

-- CreateIndex
CREATE INDEX "OrganizerPayoutAttempt_organizerId_status_createdAt_idx" ON "OrganizerPayoutAttempt"("organizerId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizerPayoutAttempt" ADD CONSTRAINT "OrganizerPayoutAttempt_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
