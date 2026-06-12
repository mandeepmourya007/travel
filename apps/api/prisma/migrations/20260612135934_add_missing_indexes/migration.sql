-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Trip_isDeleted_status_tripType_idx" ON "Trip"("isDeleted", "status", "tripType");

-- CreateIndex
CREATE INDEX "Trip_status_endDate_idx" ON "Trip"("status", "endDate");
