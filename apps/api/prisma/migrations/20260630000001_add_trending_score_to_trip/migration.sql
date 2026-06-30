-- Add trendingScore column to Trip for the booking-velocity scoring pipeline.
-- Nullable so existing rows default to NULL (treated as 0 in sort: nulls last).
ALTER TABLE "Trip" ADD COLUMN "trendingScore" INTEGER;
