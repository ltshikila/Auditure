-- CreateEnum
CREATE TYPE "VoiceModel" AS ENUM ('CUSTOM', 'REALISTIC', 'ENERGETIC', 'CALM', 'SARCASTIC', 'ACADEMIC');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateTable
CREATE TABLE "podcasters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "voiceModel" "VoiceModel" NOT NULL,
    "gender" "Gender" NOT NULL,
    "accent" TEXT NOT NULL,
    "speakingSpeed" INTEGER NOT NULL DEFAULT 5,
    "vocalPitch" INTEGER NOT NULL DEFAULT 5,
    "vocabularyComplexity" INTEGER NOT NULL DEFAULT 5,
    "ageTone" INTEGER NOT NULL DEFAULT 5,
    "tone" INTEGER NOT NULL DEFAULT 5,
    "communicationStyle" INTEGER NOT NULL DEFAULT 5,
    "humorLevel" INTEGER NOT NULL DEFAULT 5,
    "conversationalDepth" INTEGER NOT NULL DEFAULT 5,
    "expertiseTags" TEXT[],
    "intellectualAngle" TEXT NOT NULL,
    "viewpointBehavior" INTEGER NOT NULL DEFAULT 5,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podcasters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "podcasters_userId_idx" ON "podcasters"("userId");

-- CreateIndex
CREATE INDEX "podcasters_isPublic_idx" ON "podcasters"("isPublic");

-- CreateIndex
CREATE INDEX "podcasters_playCount_idx" ON "podcasters"("playCount");

-- AddForeignKey
ALTER TABLE "podcasters" ADD CONSTRAINT "podcasters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
