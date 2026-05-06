/*
  Warnings:

  - A unique constraint covering the columns `[type,tripId,travelerId]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('TRIP_CHAT', 'ADMIN_SUPPORT');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'CLOSED');

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_organizerProfileId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_tripId_fkey";

-- DropIndex
DROP INDEX "Conversation_travelerId_idx";

-- DropIndex
DROP INDEX "Conversation_tripId_travelerId_key";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "adminId" TEXT,
ADD COLUMN     "lastMessagePreview" TEXT,
ADD COLUMN     "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "type" "ConversationType" NOT NULL DEFAULT 'TRIP_CHAT',
ADD COLUMN     "unreadCountOrganizer" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unreadCountTraveler" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "tripId" DROP NOT NULL,
ALTER COLUMN "organizerProfileId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "originalContent" TEXT,
ADD COLUMN     "reactions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "replyToId" TEXT,
ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'TEXT';

-- CreateIndex
CREATE INDEX "Conversation_travelerId_type_idx" ON "Conversation"("travelerId", "type");

-- CreateIndex
CREATE INDEX "Conversation_adminId_idx" ON "Conversation"("adminId");

-- CreateIndex
CREATE INDEX "Conversation_type_status_idx" ON "Conversation"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_type_tripId_travelerId_key" ON "Conversation"("type", "tripId", "travelerId");

-- CreateIndex
CREATE INDEX "Message_isFlagged_idx" ON "Message"("isFlagged");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_type_idx" ON "PaymentTransaction"("status", "type");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "OrganizerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
