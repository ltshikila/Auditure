-- AlterTable: Add rating fields to episodes
ALTER TABLE "episodes" ADD COLUMN "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "episodes" ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: EpisodeRating
CREATE TABLE "episode_ratings" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episode_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "episode_ratings_episodeId_userId_key" ON "episode_ratings"("episodeId", "userId");
CREATE INDEX "episode_ratings_episodeId_idx" ON "episode_ratings"("episodeId");
CREATE INDEX "episode_ratings_userId_idx" ON "episode_ratings"("userId");

-- AddForeignKey
ALTER TABLE "episode_ratings" ADD CONSTRAINT "episode_ratings_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episode_ratings" ADD CONSTRAINT "episode_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
