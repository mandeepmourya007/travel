-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WALLET_CREDIT_EXPIRING';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "tripReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "expiryReminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_bookingStatus_tripReminderSentAt_idx" ON "Booking"("bookingStatus", "tripReminderSentAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_expiresAt_idx" ON "WalletTransaction"("expiresAt");
