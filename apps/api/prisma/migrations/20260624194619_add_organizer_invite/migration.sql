-- CreateTable
CREATE TABLE "OrganizerInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerInvite_email_key" ON "OrganizerInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerInvite_token_key" ON "OrganizerInvite"("token");

-- CreateIndex
CREATE INDEX "OrganizerInvite_acceptedAt_idx" ON "OrganizerInvite"("acceptedAt");
