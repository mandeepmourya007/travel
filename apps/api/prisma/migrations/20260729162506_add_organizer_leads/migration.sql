-- CreateEnum
CREATE TYPE "OrganizerLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'REJECTED');

-- CreateTable
CREATE TABLE "OrganizerLead" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "businessName" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "status" "OrganizerLeadStatus" NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerLead_email_key" ON "OrganizerLead"("email");

-- CreateIndex
CREATE INDEX "OrganizerLead_status_createdAt_idx" ON "OrganizerLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizerLead_createdAt_idx" ON "OrganizerLead"("createdAt");
