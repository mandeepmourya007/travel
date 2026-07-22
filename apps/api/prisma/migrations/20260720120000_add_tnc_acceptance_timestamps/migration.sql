-- Explicit consent capture: traveler ToS/Privacy acceptance (User) and
-- organizer agreement acceptance (OrganizerProfile), both server-stamped at
-- the moment they happen.
ALTER TABLE "User" ADD COLUMN "tncAcceptedAt" TIMESTAMP(3);
ALTER TABLE "OrganizerProfile" ADD COLUMN "organizerTncAcceptedAt" TIMESTAMP(3);
