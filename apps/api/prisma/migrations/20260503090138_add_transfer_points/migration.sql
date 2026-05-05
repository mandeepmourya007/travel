/*
  Warnings:

  - You are about to drop the column `pickupLocation` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `pickupTime` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `event` on the `WebhookEvent` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `WebhookEvent` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[source,externalEventId]` on the table `WebhookEvent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `eventType` to the `WebhookEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `externalEventId` to the `WebhookEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `WebhookEvent` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransferPointType" AS ENUM ('PICKUP', 'DROP');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'AUTHORIZED';

-- DropIndex
DROP INDEX "WebhookEvent_eventId_idx";

-- DropIndex
DROP INDEX "WebhookEvent_eventId_key";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "dropPointId" TEXT,
ADD COLUMN     "pickupPointId" TEXT;

-- AlterTable
ALTER TABLE "OrganizerProfile" ADD COLUMN     "razorpayAccountId" TEXT;

-- AlterTable
ALTER TABLE "TravelerDetail" ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT;

-- AlterTable
ALTER TABLE "Trip" DROP COLUMN "pickupLocation",
DROP COLUMN "pickupTime",
ADD COLUMN     "acceptingBookings" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "exclusions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "itineraryDocUrl" TEXT;

-- AlterTable
ALTER TABLE "WebhookEvent" DROP COLUMN "event",
DROP COLUMN "eventId",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "eventType" TEXT NOT NULL,
ADD COLUMN     "externalEventId" TEXT NOT NULL,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "headers" JSONB,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'live',
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "referenceModel" TEXT,
ADD COLUMN     "response" JSONB,
ADD COLUMN     "source" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

-- CreateTable
CREATE TABLE "TripTransferPoint" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "type" "TransferPointType" NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT,
    "time" TEXT,
    "extraCharge" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TripTransferPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripEditHistory" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedFields" TEXT[],
    "editNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripEditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripTransferPoint_tripId_type_idx" ON "TripTransferPoint"("tripId", "type");

-- CreateIndex
CREATE INDEX "TripTransferPoint_isDeleted_idx" ON "TripTransferPoint"("isDeleted");

-- CreateIndex
CREATE INDEX "TripEditHistory_tripId_createdAt_idx" ON "TripEditHistory"("tripId", "createdAt");

-- CreateIndex
CREATE INDEX "TripEditHistory_editedById_idx" ON "TripEditHistory"("editedById");

-- CreateIndex
CREATE INDEX "WebhookEvent_source_eventType_idx" ON "WebhookEvent"("source", "eventType");

-- CreateIndex
CREATE INDEX "WebhookEvent_referenceModel_referenceId_idx" ON "WebhookEvent"("referenceModel", "referenceId");

-- CreateIndex
CREATE INDEX "WebhookEvent_externalId_idx" ON "WebhookEvent"("externalId");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_mode_idx" ON "WebhookEvent"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_source_externalEventId_key" ON "WebhookEvent"("source", "externalEventId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "TripTransferPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dropPointId_fkey" FOREIGN KEY ("dropPointId") REFERENCES "TripTransferPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripTransferPoint" ADD CONSTRAINT "TripTransferPoint_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripEditHistory" ADD CONSTRAINT "TripEditHistory_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripEditHistory" ADD CONSTRAINT "TripEditHistory_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
