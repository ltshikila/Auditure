-- Add new values to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_LIKE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOK_READY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOK_FAILED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WELCOME';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MILESTONE';

-- CreateTable
CREATE TABLE IF NOT EXISTS "episode_likes" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episode_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "episode_likes_episodeId_userId_key" ON "episode_likes"("episodeId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "episode_likes_userId_idx" ON "episode_likes"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "episode_likes_episodeId_idx" ON "episode_likes"("episodeId");

-- AddForeignKey
ALTER TABLE "episode_likes" ADD CONSTRAINT "episode_likes_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_likes" ADD CONSTRAINT "episode_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
