-- NOTE: Prisma's diff engine flagged "organizer_profile_business_name_trgm_idx" and
-- "trips_title_trgm_idx" for DROP because they were created via raw SQL in
-- 20260704000001_add_trgm_indexes_for_review_search and aren't represented as
-- @@index(...) in schema.prisma. They are live, in-use GIN trigram indexes backing
-- admin review search — intentionally NOT dropped here. This migration is additive only.

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "bookingsPausedBy" "UserRole",
ADD COLUMN     "bookingsPausedReason" TEXT,
ADD COLUMN     "hiddenBy" "UserRole",
ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Trip_isDeleted_isHidden_status_startDate_idx" ON "Trip"("isDeleted", "isHidden", "status", "startDate");
