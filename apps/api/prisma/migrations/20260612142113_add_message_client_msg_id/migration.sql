-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "clientMsgId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_senderId_clientMsgId_key" ON "Message"("conversationId", "senderId", "clientMsgId");

