-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENT_REUPLOAD_REQUIRED';

-- AlterEnum
ALTER TYPE "VerificationStatus" ADD VALUE 'REVISION_REQUIRED';

-- CreateTable
CREATE TABLE "DocumentReview" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "status" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "currentUrl" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentReviewComment" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "docType" TEXT,
    "comment" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentReview_organizerId_idx" ON "DocumentReview"("organizerId");

-- CreateIndex
CREATE INDEX "DocumentReview_status_idx" ON "DocumentReview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReview_organizerId_docType_key" ON "DocumentReview"("organizerId", "docType");

-- CreateIndex
CREATE INDEX "DocumentReviewComment_organizerId_createdAt_idx" ON "DocumentReviewComment"("organizerId", "createdAt");

-- AddForeignKey
ALTER TABLE "DocumentReview" ADD CONSTRAINT "DocumentReview_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReviewComment" ADD CONSTRAINT "DocumentReviewComment_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: create DocumentReview rows for existing organizers with documents
-- APPROVED organizers get APPROVED doc reviews; others get PENDING
INSERT INTO "DocumentReview" ("id", "organizerId", "docType", "status", "currentUrl", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  op."id",
  dt."docType",
  CASE WHEN op."verificationStatus" = 'APPROVED' THEN 'APPROVED'::"DocumentReviewStatus" ELSE 'PENDING'::"DocumentReviewStatus" END,
  op."documents" ->> dt."docType",
  NOW(),
  NOW()
FROM "OrganizerProfile" op
CROSS JOIN (VALUES ('aadhaarFront'), ('aadhaarBack'), ('panCard')) AS dt("docType")
WHERE op."documents" IS NOT NULL
  AND op."documents" ->> dt."docType" IS NOT NULL
  AND op."documents" ->> dt."docType" != '';
