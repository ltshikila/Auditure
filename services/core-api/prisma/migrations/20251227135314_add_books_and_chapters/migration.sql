-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PDF', 'EPUB', 'URL');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED');

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "pageCount" INTEGER,
    "sourceType" "SourceType" NOT NULL,
    "originalFileName" TEXT,
    "fileStorageKey" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileMimeType" TEXT,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extractionError" TEXT,
    "extractedAt" TIMESTAMP(3),
    "fullTextKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "title" TEXT,
    "startPage" INTEGER,
    "endPage" INTEGER,
    "textLength" INTEGER,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "books_userId_idx" ON "books"("userId");

-- CreateIndex
CREATE INDEX "books_extractionStatus_idx" ON "books"("extractionStatus");

-- CreateIndex
CREATE INDEX "chapters_bookId_idx" ON "chapters"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_bookId_chapterNumber_key" ON "chapters"("bookId", "chapterNumber");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
