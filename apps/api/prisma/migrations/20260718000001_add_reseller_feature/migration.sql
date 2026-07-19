-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isReseller" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "markupAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sublinkId" TEXT;

-- CreateTable
CREATE TABLE "ResellerMainLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "resellerEmail" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ResellerMainLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerSublink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "mainLinkId" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "markupAmount" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ResellerSublink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SublinkAttribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sublinkId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SublinkAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResellerMainLink_token_key" ON "ResellerMainLink"("token");

-- CreateIndex
CREATE INDEX "ResellerMainLink_organizerId_idx" ON "ResellerMainLink"("organizerId");

-- CreateIndex
CREATE INDEX "ResellerMainLink_tripId_idx" ON "ResellerMainLink"("tripId");

-- CreateIndex
CREATE INDEX "ResellerMainLink_resellerId_idx" ON "ResellerMainLink"("resellerId");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerSublink_token_key" ON "ResellerSublink"("token");

-- CreateIndex
CREATE INDEX "ResellerSublink_mainLinkId_idx" ON "ResellerSublink"("mainLinkId");

-- CreateIndex
CREATE INDEX "ResellerSublink_resellerId_idx" ON "ResellerSublink"("resellerId");

-- CreateIndex
CREATE INDEX "ResellerSublink_tripId_idx" ON "ResellerSublink"("tripId");

-- CreateIndex
CREATE INDEX "SublinkAttribution_sublinkId_idx" ON "SublinkAttribution"("sublinkId");

-- CreateIndex
CREATE UNIQUE INDEX "SublinkAttribution_userId_tripId_key" ON "SublinkAttribution"("userId", "tripId");

-- CreateIndex
CREATE INDEX "Booking_sublinkId_idx" ON "Booking"("sublinkId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sublinkId_fkey" FOREIGN KEY ("sublinkId") REFERENCES "ResellerSublink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerMainLink" ADD CONSTRAINT "ResellerMainLink_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerMainLink" ADD CONSTRAINT "ResellerMainLink_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerMainLink" ADD CONSTRAINT "ResellerMainLink_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerSublink" ADD CONSTRAINT "ResellerSublink_mainLinkId_fkey" FOREIGN KEY ("mainLinkId") REFERENCES "ResellerMainLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerSublink" ADD CONSTRAINT "ResellerSublink_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerSublink" ADD CONSTRAINT "ResellerSublink_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SublinkAttribution" ADD CONSTRAINT "SublinkAttribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SublinkAttribution" ADD CONSTRAINT "SublinkAttribution_sublinkId_fkey" FOREIGN KEY ("sublinkId") REFERENCES "ResellerSublink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

