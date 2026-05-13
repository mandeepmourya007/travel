/*
  Warnings:

  - Changed the type of `tripType` on the `Trip` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TripTypeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TRIP_TYPE_REQUEST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'TRIP_TYPE_REQUEST_REJECTED';

-- AlterTable — safe enum → text conversion (preserves existing data)
ALTER TABLE "Trip" ALTER COLUMN "tripType" TYPE TEXT USING "tripType"::TEXT;

-- DropEnum
DROP TYPE "TripType";

-- CreateTable
CREATE TABLE "TripCategory" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripTypeRequest" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "suggestedName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TripTypeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripTypeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripCategory_value_key" ON "TripCategory"("value");

-- CreateIndex
CREATE INDEX "TripCategory_isActive_sortOrder_idx" ON "TripCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "TripTypeRequest_status_idx" ON "TripTypeRequest"("status");

-- CreateIndex
CREATE INDEX "TripTypeRequest_organizerId_idx" ON "TripTypeRequest"("organizerId");

-- AddForeignKey
ALTER TABLE "TripTypeRequest" ADD CONSTRAINT "TripTypeRequest_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed initial trip categories from the old enum values
INSERT INTO "TripCategory" ("id", "value", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::TEXT, 'ADVENTURE', 'Adventure', 1, true, NOW(), NOW()),
  (gen_random_uuid()::TEXT, 'WEEKEND', 'Weekend', 2, true, NOW(), NOW()),
  (gen_random_uuid()::TEXT, 'TREKKING', 'Trekking', 3, true, NOW(), NOW()),
  (gen_random_uuid()::TEXT, 'BEACH', 'Beach', 4, true, NOW(), NOW()),
  (gen_random_uuid()::TEXT, 'CULTURAL', 'Cultural', 5, true, NOW(), NOW()),
  (gen_random_uuid()::TEXT, 'ROAD_TRIP', 'Road Trip', 6, true, NOW(), NOW());
