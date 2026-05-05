-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "organizerReply" TEXT,
ADD COLUMN     "organizerReplyAt" TIMESTAMP(3);
