-- AlterTable: Add download tracking fields to subscriptions
ALTER TABLE "subscriptions" ADD COLUMN "downloadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions" ADD COLUMN "downloadPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable: EpisodeDownload
CREATE TABLE "episode_downloads" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episode_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "episode_downloads_userId_idx" ON "episode_downloads"("userId");
CREATE INDEX "episode_downloads_episodeId_idx" ON "episode_downloads"("episodeId");
CREATE INDEX "episode_downloads_userId_downloadedAt_idx" ON "episode_downloads"("userId", "downloadedAt");

-- AddForeignKey
ALTER TABLE "episode_downloads" ADD CONSTRAINT "episode_downloads_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episode_downloads" ADD CONSTRAINT "episode_downloads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
