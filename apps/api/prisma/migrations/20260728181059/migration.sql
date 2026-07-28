-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';

-- DropIndex
DROP INDEX "organizer_profile_business_name_trgm_idx";

-- DropIndex
DROP INDEX "trips_title_trgm_idx";

-- CreateTable
CREATE TABLE "WhatsappBroadcast" (
    "id" TEXT NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetRole" TEXT,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappBroadcast_createdByAdminId_idx" ON "WhatsappBroadcast"("createdByAdminId");

-- CreateIndex
CREATE INDEX "WhatsappBroadcast_status_idx" ON "WhatsappBroadcast"("status");

-- CreateIndex
CREATE INDEX "WhatsappBroadcast_createdAt_idx" ON "WhatsappBroadcast"("createdAt");

-- AddForeignKey
ALTER TABLE "WhatsappBroadcast" ADD CONSTRAINT "WhatsappBroadcast_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
