-- CreateIndex
CREATE INDEX "Trip_isDeleted_status_startDate_idx" ON "Trip"("isDeleted", "status", "startDate");

-- CreateIndex
CREATE INDEX "Trip_isDeleted_status_pricePerPerson_idx" ON "Trip"("isDeleted", "status", "pricePerPerson");

-- CreateIndex
CREATE INDEX "Trip_isDeleted_status_currentBookings_idx" ON "Trip"("isDeleted", "status", "currentBookings");
