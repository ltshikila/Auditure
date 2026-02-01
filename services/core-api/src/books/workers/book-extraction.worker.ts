import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { TextExtractionService } from '../services/text-extraction.service';
import { CoverExtractionService } from '../services/cover-extraction.service';
import { StorageService } from '../../common/storage.service';
import { DatabaseService } from '../../database/database.service';
import { BookExtractionJob } from '../../rabbitmq/interfaces/jobs.interface';

@Injectable()
export class BookExtractionWorker implements OnModuleInit {
    private readonly logger = new Logger(BookExtractionWorker.name);

    constructor(
        private rabbitMQService: RabbitMQService,
        private textExtractionService: TextExtractionService,
        private coverExtractionService: CoverExtractionService,
        private storageService: StorageService,
        private databaseService: DatabaseService,
    ) {}

    async onModuleInit() {
        await this.rabbitMQService.consumeBookExtractionQueue(this.handleExtractionJob.bind(this));
        this.logger.log('Book extraction worker started');
    }

    private async handleExtractionJob(job: BookExtractionJob): Promise<void> {
        this.logger.log(`Processing extraction job for book ${job.bookId}`);

        try {
            // 1. Update status to PROCESSING
            await this.databaseService.book.update({
                where: { id: job.bookId },
                data: { extractionStatus: 'PROCESSING' },
            });

            // 2. Download file from storage
            const fileBuffer = await this.storageService.downloadFile(job.fileStorageKey);

            // 3. Extract content based on source type
            let extracted;
            if (job.sourceType === 'PDF') {
                extracted = await this.textExtractionService.extractFromPdf(fileBuffer);
            } else if (job.sourceType === 'EPUB') {
                extracted = await this.textExtractionService.extractFromEpub(fileBuffer);
            } else {
                throw new Error(`Unsupported source type: ${String(job.sourceType)}`);
            }

            // 3.5. Get current book from database to access original title (from filename)
            // This is needed because PDF metadata often lacks title/author
            const currentBook = await this.databaseService.book.findUnique({
                where: { id: job.bookId },
            });

            // Determine best title for cover search - prefer PDF metadata, then database title
            let coverSearchTitle = extracted.metadata.title;
            if (!coverSearchTitle && currentBook?.title) {
                coverSearchTitle = this.cleanupTitle(currentBook.title);
                this.logger.log(`Using database title for cover search: "${coverSearchTitle}"`);
            }

            // 4. Extract cover image (hybrid: Google Books API + file extraction)
            const storageKey = `${job.userId}/${job.bookId}`;
            const coverResult = await this.coverExtractionService.extractCover(
                fileBuffer,
                job.sourceType,
                {
                    title: coverSearchTitle,
                    author: extracted.metadata.author,
                },
                async (imageBuffer, key) => {
                    await this.storageService.uploadFile(imageBuffer, key, 'image/jpeg');
                    return key;
                },
                storageKey,
            );

            if (coverResult.coverImageUrl) {
                this.logger.log(
                    `Cover extracted for book ${job.bookId} (source: ${coverResult.source})`,
                );
            }

            // 5. Store full text in storage
            const fullTextKey = `${job.userId}/${job.bookId}/fulltext.txt`;
            await this.storageService.uploadFile(
                Buffer.from(extracted.fullText),
                fullTextKey,
                'text/plain',
            );

            // 5. Delete existing chapters (for retry scenarios) and create new ones
            await this.databaseService.chapter.deleteMany({
                where: { bookId: job.bookId },
            });
            this.logger.log(`Deleted existing chapters for book ${job.bookId}`);

            // Deduplicate chapters by chapterNumber (extraction might produce duplicates)
            const uniqueChapters = new Map<number, (typeof extracted.chapters)[0]>();
            for (const chapter of extracted.chapters) {
                if (!uniqueChapters.has(chapter.chapterNumber)) {
                    uniqueChapters.set(chapter.chapterNumber, chapter);
                }
            }
            this.logger.log(
                `Creating ${uniqueChapters.size} unique chapters (from ${extracted.chapters.length} detected)`,
            );

            // Track extraction quality
            let emptyChapters = 0;
            let minimalChapters = 0;
            const MIN_CHAPTER_CHARS = 500; // Chapters with less than this are considered minimal

            for (const chapter of uniqueChapters.values()) {
                await this.databaseService.chapter.create({
                    data: {
                        bookId: job.bookId,
                        chapterNumber: chapter.chapterNumber,
                        title: chapter.title,
                        startPage: chapter.startPage,
                        endPage: chapter.endPage,
                        extractedText: chapter.text,
                        textLength: chapter.text.length,
                    },
                });

                // Track chapter quality
                if (!chapter.text || chapter.text.length === 0) {
                    emptyChapters++;
                } else if (chapter.text.length < MIN_CHAPTER_CHARS) {
                    minimalChapters++;
                }
            }

            // Determine extraction status based on quality
            // PARTIALLY_COMPLETED if:
            // - Any chapters are empty
            // - More than 30% of chapters are minimal
            // - Extraction method was OCR (inherently less reliable)
            const totalChapters = uniqueChapters.size;
            const isPartial =
                emptyChapters > 0 ||
                (totalChapters > 0 && minimalChapters / totalChapters > 0.3) ||
                extracted.extractionMethod === 'ocr';

            const extractionStatus = isPartial ? 'PARTIALLY_COMPLETED' : 'COMPLETED';

            if (isPartial) {
                this.logger.warn(
                    `Book ${job.bookId} partially extracted: ` +
                        `${emptyChapters} empty chapters, ${minimalChapters} minimal chapters, ` +
                        `method: ${extracted.extractionMethod || 'text'}`,
                );
            }

            // 6. Determine best title/author for database update
            // (currentBook was already fetched earlier for cover search)
            let bestTitle = extracted.metadata.title;
            if (!bestTitle && currentBook?.title) {
                // URL-decode and clean up existing title (often from filename)
                bestTitle = this.cleanupTitle(currentBook.title);
            }

            // Determine best author - prefer PDF metadata, then try to extract from content
            let bestAuthor = extracted.metadata.author;
            if (!bestAuthor && extracted.fullText) {
                bestAuthor = this.extractAuthorFromContent(extracted.fullText);
            }

            // 8. Update book record
            await this.databaseService.book.update({
                where: { id: job.bookId },
                data: {
                    extractionStatus,
                    extractedAt: new Date(),
                    fullTextKey,
                    pageCount: extracted.metadata.pageCount,
                    // Cover image
                    coverImageUrl: coverResult.coverImageUrl,
                    coverImageKey: coverResult.coverImageKey,
                    // Store extraction warnings for user notification
                    extractionWarnings: extracted.extractionWarnings || [],
                    // Update metadata - always update title/author if we have better versions
                    ...(bestTitle && bestTitle !== currentBook?.title && { title: bestTitle }),
                    ...(bestAuthor && !currentBook?.author && { author: bestAuthor }),
                    ...(extracted.metadata.language && { language: extracted.metadata.language }),
                },
            });

            // Log warnings if present
            if (extracted.extractionWarnings && extracted.extractionWarnings.length > 0) {
                this.logger.warn(
                    `Book ${job.bookId} extraction warnings: ${extracted.extractionWarnings.join(' | ')}`,
                );
            }

            this.logger.log(
                `Successfully extracted book ${job.bookId} (status: ${extractionStatus})`,
            );

            // 7. Queue any pending episodes for this book
            const pendingEpisodes = await this.databaseService.episode.findMany({
                where: {
                    bookId: job.bookId,
                    generationStatus: 'PENDING',
                },
            });

            for (const episode of pendingEpisodes) {
                await this.rabbitMQService.publishEpisodeGenerationJob({
                    episodeId: episode.id,
                    userId: episode.userId,
                    podcasterId: episode.podcasterId,
                    bookId: episode.bookId,
                    title: episode.title,
                    contentCoverage: episode.contentCoverage as any,
                    chapters: episode.chapters,
                    episodeType: episode.episodeType as any,
                    episodeTheme: episode.episodeTheme as any,
                    targetLengthMin: episode.targetLengthMin,
                    targetLengthMax: episode.targetLengthMax,
                    voiceTier: (episode.voiceTier as any) || 'STANDARD',
                });
                this.logger.log(`Queued pending episode ${episode.id} for generation`);
            }
        } catch (error) {
            this.logger.error(`Failed to extract book ${job.bookId}`);
            this.logger.error(error);

            // Store technical error in book for debugging
            await this.databaseService.book.update({
                where: { id: job.bookId },
                data: {
                    extractionStatus: 'FAILED',
                    extractionError: error.message,
                },
            });

            // Mark all pending episodes for this book as FAILED
            // so they don't remain stuck in "Queued" state indefinitely
            // Use user-friendly error message (not technical details)
            const userFriendlyError = this.getUserFriendlyError(error, job.sourceType);

            const failedEpisodes = await this.databaseService.episode.updateMany({
                where: {
                    bookId: job.bookId,
                    generationStatus: 'PENDING',
                },
                data: {
                    generationStatus: 'FAILED',
                    generationError: userFriendlyError,
                },
            });

            if (failedEpisodes.count > 0) {
                this.logger.warn(
                    `Marked ${failedEpisodes.count} pending episode(s) as FAILED due to book extraction failure`,
                );
            }

            throw error; // Re-throw for RabbitMQ retry logic
        }
    }

    /**
     * Clean up a title that may be URL-encoded or derived from a filename.
     * Examples:
     * - "The%2048%20Laws%20Of%20Power" → "The 48 Laws Of Power"
     * - "my-book-title.pdf" → "My Book Title"
     */
    private cleanupTitle(title: string): string {
        if (!title) return title;

        let cleaned = title;

        // URL-decode if it contains encoded characters
        if (cleaned.includes('%')) {
            try {
                cleaned = decodeURIComponent(cleaned);
            } catch {
                // If decoding fails, replace common URL-encoded chars manually
                cleaned = cleaned
                    .replace(/%20/g, ' ')
                    .replace(/%2F/g, '/')
                    .replace(/%26/g, '&')
                    .replace(/%27/g, "'")
                    .replace(/%22/g, '"');
            }
        }

        // Remove file extension if present
        cleaned = cleaned.replace(/\.(pdf|epub|txt)$/i, '');

        // Replace hyphens/underscores with spaces (common in filenames)
        cleaned = cleaned.replace(/[-_]+/g, ' ');

        // Clean up multiple spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned;
    }

    /**
     * Try to extract author name from the first portion of book content.
     * Looks for common patterns like "by Author Name" or "Author Name" after title.
     */
    private extractAuthorFromContent(fullText: string): string | null {
        if (!fullText || fullText.length < 500) return null;

        // Only look at first 2000 chars (title pages, copyright)
        const sample = fullText.slice(0, 2000);

        // Common patterns for author attribution
        const patterns = [
            // "by Author Name" pattern
            /\bby\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/,
            // "Author: Name" pattern
            /\bauthor[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/i,
            // "Written by Name" pattern
            /\bwritten\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/i,
        ];

        for (const pattern of patterns) {
            const match = sample.match(pattern);
            if (match && match[1]) {
                const author = match[1].trim();
                // Validate it looks like a real name (2-4 words, reasonable length)
                if (author.length >= 5 && author.length <= 50) {
                    this.logger.log(`Extracted author from content: "${author}"`);
                    return author;
                }
            }
        }

        return null;
    }

    /**
     * Convert technical error messages to user-friendly messages.
     * Keep messages SHORT for mobile UI display.
     * Technical details are still logged and stored in book.extractionError for debugging.
     */
    private getUserFriendlyError(error: Error, sourceType: string): string {
        const errorMessage = error.message?.toLowerCase() || '';

        // File format/parsing errors
        if (
            errorMessage.includes('is not a function') ||
            errorMessage.includes('cannot read') ||
            errorMessage.includes('undefined')
        ) {
            return `Unsupported ${sourceType} format. Try a different file.`;
        }

        // File corruption
        if (
            errorMessage.includes('invalid') ||
            errorMessage.includes('malformed') ||
            errorMessage.includes('corrupt')
        ) {
            return `File appears corrupted. Try a different copy.`;
        }

        // DRM/encryption
        if (
            errorMessage.includes('encrypted') ||
            errorMessage.includes('drm') ||
            errorMessage.includes('protected')
        ) {
            return `File is DRM protected. Use a DRM-free version.`;
        }

        // Empty/no content
        if (
            errorMessage.includes('empty') ||
            errorMessage.includes('no content') ||
            errorMessage.includes('no text')
        ) {
            return `No readable text found in this file.`;
        }

        // Timeout/resource
        if (errorMessage.includes('timeout') || errorMessage.includes('memory')) {
            return `File too large or complex. Try a smaller file.`;
        }

        // Generic fallback - don't expose technical details
        return `Could not process this file. Please try again.`;
    }
}
