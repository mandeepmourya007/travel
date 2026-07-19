-- ResellerMainLink is now unique per (tripId, resellerId): an organizer can
-- only have one main link (invite) per reseller per trip. Re-inviting the
-- same reseller for the same trip is a no-op at the service layer
-- (ResellerService.generateMainLink), not a new row.
CREATE UNIQUE INDEX "ResellerMainLink_tripId_resellerId_key" ON "ResellerMainLink"("tripId", "resellerId");
