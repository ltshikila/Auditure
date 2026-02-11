-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profilePictureKey" TEXT;
