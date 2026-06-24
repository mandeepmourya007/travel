-- AlterTable
ALTER TABLE "OrganizerInvite" ADD COLUMN     "sentBy" TEXT;

-- CreateIndex
CREATE INDEX "OrganizerInvite_sentBy_idx" ON "OrganizerInvite"("sentBy");

-- AddForeignKey
ALTER TABLE "OrganizerInvite" ADD CONSTRAINT "OrganizerInvite_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
