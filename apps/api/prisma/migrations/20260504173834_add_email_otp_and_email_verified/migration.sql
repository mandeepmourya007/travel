-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('REFUND', 'CASHBACK', 'BOOKING_DEDUCTION', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'PROMOTIONAL_CREDIT', 'EXPIRY');

-- AlterEnum
ALTER TYPE "VerificationCodeType" ADD VALUE 'EMAIL_OTP';

-- DropForeignKey
ALTER TABLE "TravelerDetail" DROP CONSTRAINT "TravelerDetail_bookingId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "walletAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TravelerDetail" ADD COLUMN     "tripRequestId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "referenceModel" TEXT,
    "referenceId" TEXT,
    "description" TEXT NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_isDeleted_idx" ON "Wallet"("isDeleted");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_referenceModel_referenceId_idx" ON "WalletTransaction"("referenceModel", "referenceId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_type_referenceModel_referenceId_key" ON "WalletTransaction"("type", "referenceModel", "referenceId");

-- CreateIndex
CREATE INDEX "TravelerDetail_tripRequestId_idx" ON "TravelerDetail"("tripRequestId");

-- AddForeignKey
ALTER TABLE "TravelerDetail" ADD CONSTRAINT "TravelerDetail_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelerDetail" ADD CONSTRAINT "TravelerDetail_tripRequestId_fkey" FOREIGN KEY ("tripRequestId") REFERENCES "TripRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
