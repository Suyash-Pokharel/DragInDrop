-- AlterTable
ALTER TABLE "PlatformPost" ADD COLUMN "publishId" TEXT;

-- CreateIndex
CREATE INDEX "PlatformPost_publishId_idx" ON "PlatformPost"("publishId");
