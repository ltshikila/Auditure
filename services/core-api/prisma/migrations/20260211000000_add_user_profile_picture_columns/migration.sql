-- AlterTable: users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profilePictureKey" TEXT;

-- AlterTable: books
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "coverImageKey" TEXT;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "extractionWarnings" TEXT[] DEFAULT '{}';

-- AlterTable: podcasters
ALTER TABLE "podcasters" ADD COLUMN IF NOT EXISTS "profilePictureKey" TEXT;
ALTER TABLE "podcasters" ADD COLUMN IF NOT EXISTS "geminiVoiceName" TEXT;
ALTER TABLE "podcasters" ADD COLUMN IF NOT EXISTS "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "podcasters" ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: episodes
ALTER TABLE "episodes" ADD COLUMN IF NOT EXISTS "summary" TEXT;
