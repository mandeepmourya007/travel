-- Enable pg_trgm extension for trigram-based similarity search.
-- Required for ILIKE '%term%' queries on Trip.title and OrganizerProfile.displayName
-- to use GIN indexes instead of sequential scans.
-- Safe to run multiple times (IF NOT EXISTS).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on Trip.title — backs admin review search by trip name.
-- Turns ILIKE '%term%' from a full-table scan into an index-range scan.
CREATE INDEX IF NOT EXISTS "trips_title_trgm_idx"
  ON "Trip" USING GIN (title gin_trgm_ops);

-- GIN index on OrganizerProfile.businessName — backs admin review search by organizer.
CREATE INDEX IF NOT EXISTS "organizer_profile_business_name_trgm_idx"
  ON "OrganizerProfile" USING GIN ("businessName" gin_trgm_ops);
