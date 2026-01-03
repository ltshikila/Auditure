-- CreateEnum
CREATE TYPE "EpisodeStatus" AS ENUM ('PENDING', 'SCRIPT_GENERATING', 'SCRIPT_GENERATED', 'AUDIO_GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EpisodeType" AS ENUM ('MONOLOGUE', 'DUO', 'GROUP');

-- CreateEnum
CREATE TYPE "EpisodeTheme" AS ENUM ('LECTURE', 'DISCUSSION', 'DEBATE');

-- CreateEnum
CREATE TYPE "ContentCoverage" AS ENUM ('ENTIRE_BOOK', 'MULTIPLE_CHAPTERS', 'SINGLE_CHAPTER');

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podcasterId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contentCoverage" "ContentCoverage" NOT NULL,
    "chapters" INTEGER[],
    "episodeType" "EpisodeType" NOT NULL,
    "episodeTheme" "EpisodeTheme" NOT NULL,
    "targetLengthMin" INTEGER NOT NULL,
    "targetLengthMax" INTEGER NOT NULL,
    "scriptContent" TEXT,
    "audioFileKey" TEXT,
    "generationStatus" "EpisodeStatus" NOT NULL DEFAULT 'PENDING',
    "scriptGeneratedAt" TIMESTAMP(3),
    "audioGeneratedAt" TIMESTAMP(3),
    "generationError" TEXT,
    "duration" INTEGER,
    "audioFormat" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "episodes_userId_idx" ON "episodes"("userId");

-- CreateIndex
CREATE INDEX "episodes_podcasterId_idx" ON "episodes"("podcasterId");

-- CreateIndex
CREATE INDEX "episodes_bookId_idx" ON "episodes"("bookId");

-- CreateIndex
CREATE INDEX "episodes_isPublic_idx" ON "episodes"("isPublic");

-- CreateIndex
CREATE INDEX "episodes_generationStatus_idx" ON "episodes"("generationStatus");

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_podcasterId_fkey" FOREIGN KEY ("podcasterId") REFERENCES "podcasters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
