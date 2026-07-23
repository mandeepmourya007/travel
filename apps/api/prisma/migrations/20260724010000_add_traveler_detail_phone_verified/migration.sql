-- AlterTable
ALTER TABLE "TravelerDetail" ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterEnum
ALTER TYPE "VerificationCodeType" ADD VALUE 'BOOKING_CONTACT_OTP';
