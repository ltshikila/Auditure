-- AlterTable
ALTER TABLE "books" ADD COLUMN "genres" TEXT[] DEFAULT ARRAY[]::TEXT[];
