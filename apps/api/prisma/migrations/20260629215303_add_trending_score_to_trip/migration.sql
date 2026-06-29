-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "trendingScore" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Booking_tripId_bookingStatus_createdAt_idx" ON "Booking"("tripId", "bookingStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Trip_isDeleted_status_trendingScore_idx" ON "Trip"("isDeleted", "status", "trendingScore");
