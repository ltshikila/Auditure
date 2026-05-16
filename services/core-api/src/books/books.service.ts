import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../common/storage.service';
import { CreateBookDto } from './dto/create-book.dto';
import { GetTextDto } from './dto/get-text.dto';
import { randomUUID } from 'crypto';
import { normalizeBookTitle, booksMatch, computeBookQualityScore } from './utils/book-matching.utils';
import { MetadataProbeService } from './services/metadata-probe.service';
import { BookExtractionDispatcher } from './services/book-extraction-dispatcher.service';

@Injectable()
export class BooksService {
    private readonly logger = new Logger(BooksService.name);

    constructor(
        private databaseService: DatabaseService,
        private storageService: StorageService,
        private bookExtractionDispatcher: BookExtractionDispatcher,
        private metadataProbeService: MetadataProbeService,
    ) {}

    /**
     * Verify the uploaded file's first bytes match its declared MIME type.
     *
     * Multipart MIME types are client-controlled and trivially spoofed, so a
     * malicious upload can pass the upload-filter check by claiming
     * application/pdf while shipping an arbitrary payload. Reading the file's
     * magic bytes catches that. Runs before the file is stored in GCS or
     * dispatched to the extractor, so a bad upload never reaches downstream
     * parsers.
     */
    private verifyFileMagicBytes(buffer: Buffer, mimetype: string): void {
        if (mimetype === 'application/pdf') {
            // PDF files always begin with "%PDF-" per ISO 32000.
            if (buffer.length < 5 || buffer.slice(0, 5).toString('ascii') !== '%PDF-') {
                throw new BadRequestException(
                    'File does not appear to be a valid PDF (header check failed)',
                );
            }
            return;
        }

        if (mimetype === 'application/epub+zip') {
            // EPUB is a ZIP archive whose first entry must be a "mimetype"
            // file containing the string "application/epub+zip".
            const startsWithZip =
                buffer.length >= 4 &&
                buffer[0] === 0x50 && // P
                buffer[1] === 0x4b && // K
                buffer[2] === 0x03 &&
                buffer[3] === 0x04;
            if (!startsWithZip) {
                throw new BadRequestException(
                    'File does not appear to be a valid EPUB (not a ZIP archive)',
                );
            }
            // The mimetype string sits near offset 38 in a conforming EPUB.
            // Scan the first 200 bytes to be tolerant of minor structural
            // variants while still rejecting non-EPUB ZIPs.
            const header = buffer.subarray(0, Math.min(buffer.length, 200));
            if (!header.includes(Buffer.from('application/epub+zip'))) {
                throw new BadRequestException(
                    'File does not appear to be a valid EPUB (mimetype declaration missing)',
                );
            }
            return;
        }

        throw new BadRequestException(`Unsupported file type: ${mimetype}`);
    }

    /**
     * Clean up a book title that may be URL-encoded or from a filename.
     * Examples:
     * - "The%2048%20Laws%20Of%20Power" → "The 48 Laws Of Power"
     * - "my-book-title.pdf" → "My Book Title"
     */
    private cleanupTitle(title: string): string {
        if (!title) return title;

        let cleaned = title;

        // URL-decode if needed (handles %20, %2F, etc.)
        try {
            cleaned = decodeURIComponent(cleaned);
        } catch {
            // If decoding fails, continue with original
        }

        // Remove common file extensions
        cleaned = cleaned.replace(/\.(pdf|epub|mobi|azw3?)$/i, '');

        // Replace hyphens and underscores with spaces
        cleaned = cleaned.replace(/[-_]+/g, ' ');

        // Collapse multiple spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned;
    }

    /**
     * Search for an existing book that matches the given title (and optional author).
     * Uses fuzzy matching. Checks completed books globally, and the same user's
     * in-progress books to prevent duplicates from rapid re-uploads.
     * Returns the best match or null.
     */
    async findExistingBook(title: string, author?: string | null, userId?: string): Promise<any> {
        const normalizedTitle = normalizeBookTitle(title);
        const words = normalizedTitle.split(' ').filter((w) => w.length > 2);
        const searchWords = words.slice(0, 3);

        if (searchWords.length === 0) return null;

        // Use individual word filters so punctuation in DB titles doesn't break matching
        // e.g. "computer", "security", "principles" each match independently in
        // "Computer Security: Principles and Practice" (colon between words)
        const titleFilter = {
            AND: searchWords.map((word) => ({
                title: { contains: word, mode: 'insensitive' as const },
            })),
        };

        // 1. Check completed books globally (any user)
        const completedCandidates = await this.databaseService.book.findMany({
            where: {
                extractionStatus: { in: ['COMPLETED', 'PARTIALLY_COMPLETED'] },
                ...titleFilter,
            },
            take: 20,
        });

        const completedMatch = completedCandidates.find((c) =>
            booksMatch(
                { title, author },
                { title: c.title, author: c.author },
            ),
        );
        if (completedMatch) return completedMatch;

        // 2. Check same user's in-progress books (prevents duplicates from re-uploads)
        if (userId) {
            const pendingCandidates = await this.databaseService.book.findMany({
                where: {
                    userId,
                    extractionStatus: { in: ['PENDING', 'PROCESSING'] },
                    ...titleFilter,
                },
                take: 10,
            });

            const pendingMatch = pendingCandidates.find((c) =>
                booksMatch(
                    { title, author },
                    { title: c.title, author: c.author },
                ),
            );
            if (pendingMatch) return pendingMatch;
        }

        return null;
    }

    /**
     * Find all book IDs that represent the same book as the given title+author.
     * Uses fuzzy matching via the shared utility.
     */
    private async findDuplicateBookIds(
        bookId: string,
        title: string,
        author: string | null | undefined,
    ): Promise<string[]> {
        const normalizedTitle = normalizeBookTitle(title);
        const words = normalizedTitle.split(' ').filter((w) => w.length > 2);
        const searchWords = words.slice(0, 3);

        if (searchWords.length === 0) return [bookId];

        const candidates = await this.databaseService.book.findMany({
            where: {
                extractionStatus: {
                    in: ['COMPLETED', 'PARTIALLY_COMPLETED'],
                },
                AND: searchWords.map((word) => ({
                    title: { contains: word, mode: 'insensitive' as const },
                })),
            },
            select: { id: true, title: true, author: true },
        });

        const matchingIds = candidates
            .filter((c) =>
                booksMatch({ title, author }, { title: c.title, author: c.author }),
            )
            .map((c) => c.id);

        if (!matchingIds.includes(bookId)) {
            matchingIds.push(bookId);
        }

        return matchingIds;
    }

    async uploadBook(userId: string, file: any, createBookDto: CreateBookDto) {
        this.logger.log(`uploadBook() called for user ${userId}`);
        this.logger.log(`File: ${file?.originalname} (${file?.mimetype}, ${file?.size} bytes)`);
        this.logger.log(`DTO: ${JSON.stringify(createBookDto)}`);

        try {
            // 1. Validate file exists
            if (!file) {
                this.logger.error('No file provided');
                throw new BadRequestException('File is required');
            }

            if (!file.buffer) {
                this.logger.error('File buffer is missing');
                this.logger.error(`File object keys: ${Object.keys(file).join(', ')}`);
                throw new BadRequestException('File buffer is missing');
            }

            // 1.25 Verify magic bytes match the declared MIME type. The
            // controller's fileFilter checks file.mimetype only, which is
            // client-controlled and spoofable. This is the real type check.
            this.verifyFileMagicBytes(file.buffer, file.mimetype);

            // 1.5 Check for existing book with matching title (completed or in-progress)
            const cleanedTitle = this.cleanupTitle(createBookDto.title);
            const existingBook = await this.findExistingBook(
                cleanedTitle,
                createBookDto.author,
                userId,
            );

            if (existingBook) {
                // Probe completed books to see if re-extraction would improve data
                if (
                    ['COMPLETED', 'PARTIALLY_COMPLETED'].includes(
                        existingBook.extractionStatus,
                    )
                ) {
                    const probeResult =
                        await this.metadataProbeService.shouldReExtract(
                            file.buffer,
                            createBookDto.sourceType as 'PDF' | 'EPUB',
                            existingBook,
                        );

                    if (probeResult.reExtract) {
                        this.logger.log(
                            `Probe detected improvements for "${existingBook.title}": ${probeResult.reason}. Triggering re-extraction.`,
                        );
                        await this.forceReExtractInternal(existingBook.id);
                        return existingBook;
                    }
                }

                this.logger.log(
                    `Found existing book "${existingBook.title}" (${existingBook.id}) matching upload title "${cleanedTitle}". No improvements detected. Reusing.`,
                );
                return existingBook;
            }

            // 2. Generate storage key
            const bookId = randomUUID();
            const fileExtension = file.mimetype === 'application/pdf' ? 'pdf' : 'epub';
            const storageKey = `${userId}/${bookId}/original.${fileExtension}`;
            this.logger.log(`Generated storage key: ${storageKey}`);

            // 3. Upload file to storage
            this.logger.log(`Uploading file to storage (${file.buffer.length} bytes)...`);
            try {
                await this.storageService.uploadFile(file.buffer, storageKey, file.mimetype);
                this.logger.log('File uploaded to storage successfully');
            } catch (storageError) {
                this.logger.error(`Storage upload failed: ${storageError.message}`);
                this.logger.error(`Storage error stack: ${storageError.stack}`);
                throw new BadRequestException(
                    `Failed to upload file to storage: ${storageError.message}`,
                );
            }

            // 4. Create book record
            this.logger.log('Creating book record in database...');
            if (cleanedTitle !== createBookDto.title) {
                this.logger.log(`Title cleaned: "${createBookDto.title}" → "${cleanedTitle}"`);
            }
            let book;
            try {
                book = await this.databaseService.book.create({
                    data: {
                        id: bookId,
                        userId,
                        title: cleanedTitle,
                        author: createBookDto.author,
                        isbn: createBookDto.isbn,
                        language: createBookDto.language || 'en',
                        sourceType: createBookDto.sourceType,
                        originalFileName: file.originalname,
                        fileStorageKey: storageKey,
                        fileSize: file.size,
                        fileMimeType: file.mimetype,
                        extractionStatus: 'PENDING',
                    },
                });
                this.logger.log(`Book created with ID: ${book.id}`);
            } catch (dbError) {
                this.logger.error(`Database create failed: ${dbError.message}`);
                this.logger.error(`Database error stack: ${dbError.stack}`);
                // Try to clean up the uploaded file
                try {
                    await this.storageService.deleteFile(storageKey);
                    this.logger.log('Cleaned up uploaded file after database error');
                } catch (cleanupError) {
                    this.logger.error(`Failed to cleanup file: ${cleanupError.message}`);
                }
                throw new BadRequestException(`Failed to create book record: ${dbError.message}`);
            }

            // 5. Dispatch extraction as a Cloud Run Job
            this.logger.log('Dispatching book extraction job...');
            try {
                await this.bookExtractionDispatcher.dispatch(book.id);
                this.logger.log('Extraction job dispatched successfully');
            } catch (dispatchError: any) {
                this.logger.error(`Extraction dispatch failed: ${dispatchError.message}`);
                this.logger.error(`Dispatch error stack: ${dispatchError.stack}`);
                // Don't throw - the book is created, extraction can be retried
                this.logger.warn(
                    'Book created but extraction job failed to dispatch - can be retried later',
                );
            }

            this.logger.log(`uploadBook() completed successfully for book ${book.id}`);
            return book;
        } catch (error) {
            this.logger.error(`Error in uploadBook(): ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    async findAll(userId: string) {
        // Don't include chapters: each chapter row carries the full extracted
        // text (@db.Text), and for a user with dozens of books the payload
        // balloons into the tens of MB — long enough to time out on mobile
        // and leave the picker stuck on "No books in your library yet".
        // Per-book chapters are fetched separately via /books/:id/chapters.
        return this.databaseService.book.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(userId: string, id: string) {
        // Don't pull chapter extractedText (@db.Text): the mobile client only
        // needs chapter metadata for the picker, and the full text blows up
        // the JSON payload for books with many chapters. Internal callers that
        // need the text (getExtractedText) query the Chapter table separately.
        // Episodes service has its own getBookForEpisode() that still includes
        // full chapters by design.
        const book = await this.databaseService.book.findUnique({
            where: { id },
            include: {
                chapters: {
                    select: {
                        id: true,
                        chapterNumber: true,
                        title: true,
                        startPage: true,
                        endPage: true,
                        textLength: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: { chapterNumber: 'asc' },
                },
            },
        });

        if (!book) {
            throw new NotFoundException('Book not found');
        }

        if (book.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        return book;
    }

    async getExtractedText(userId: string, bookId: string, options?: GetTextDto): Promise<string> {
        const book = await this.findOne(userId, bookId);

        if (book.extractionStatus !== 'COMPLETED') {
            throw new BadRequestException('Book extraction is not completed yet');
        }

        // If specific chapters requested
        if (options?.chapterIds && options.chapterIds.length > 0) {
            const chapters = await this.databaseService.chapter.findMany({
                where: {
                    id: { in: options.chapterIds },
                    bookId,
                },
                orderBy: { chapterNumber: 'asc' },
            });

            return chapters.map(ch => ch.extractedText).join('\n\n');
        }

        // Return full text
        if (book.fullTextKey) {
            const textBuffer = await this.storageService.downloadFile(book.fullTextKey);
            return textBuffer.toString('utf-8');
        }

        // Fallback: concatenate all chapters
        const chapters = await this.databaseService.chapter.findMany({
            where: { bookId },
            orderBy: { chapterNumber: 'asc' },
        });

        return chapters.map(ch => ch.extractedText).join('\n\n');
    }

    // PUBLIC API for Episodes Service to consume
    async getBookForEpisode(bookId: string) {
        return this.databaseService.book.findUnique({
            where: { id: bookId },
            include: {
                chapters: true,
                user: { select: { id: true, firstName: true, lastName: true } },
            },
        });
    }

    // PUBLIC API for Feed Service to search/filter books
    async searchBooks(query: string, limit: number = 20) {
        return this.databaseService.book.findMany({
            where: {
                OR: [
                    { title: { contains: query, mode: 'insensitive' } },
                    { author: { contains: query, mode: 'insensitive' } },
                ],
                extractionStatus: 'COMPLETED',
            },
            take: limit,
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
        });
    }

    async getPopularBooks(limit: number = 10) {
        // Returns books that can be used by Feed service to find popular episodes
        return this.databaseService.book.findMany({
            where: { extractionStatus: 'COMPLETED' },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Validate that requested chapter numbers exist in the book.
     * Returns list of invalid chapter numbers (empty if all valid).
     */
    async validateChapterNumbers(
        bookId: string,
        chapterNumbers: number[],
    ): Promise<{ valid: boolean; invalidChapters: number[]; availableChapters: number[] }> {
        const chapters = await this.databaseService.chapter.findMany({
            where: { bookId },
            select: { chapterNumber: true },
        });

        const availableChapters = chapters.map(ch => ch.chapterNumber);
        const invalidChapters = chapterNumbers.filter(num => !availableChapters.includes(num));

        return {
            valid: invalidChapters.length === 0,
            invalidChapters,
            availableChapters,
        };
    }

    async getBookDetail(bookId: string, sectionLimit: number = 6, userId?: string) {
        const book = await this.databaseService.book.findUnique({
            where: { id: bookId },
            select: {
                id: true,
                title: true,
                author: true,
                coverImageUrl: true,
                language: true,
                pageCount: true,
                sourceType: true,
                createdAt: true,
            },
        });

        if (!book) {
            throw new NotFoundException('Book not found');
        }

        // Find all book IDs that represent the same book (across all users)
        const allBookIds = await this.findDuplicateBookIds(
            bookId,
            book.title,
            book.author,
        );

        // Pick best metadata from the highest-quality copy
        if (allBookIds.length > 1) {
            const allBooks = await this.databaseService.book.findMany({
                where: { id: { in: allBookIds } },
                include: {
                    _count: { select: { chapters: true } },
                },
            });
            // Find the highest-quality copy
            const scored = allBooks
                .map((b) => ({
                    ...b,
                    score: computeBookQualityScore({
                        extractionStatus: b.extractionStatus,
                        coverImageUrl: b.coverImageUrl,
                        author: b.author,
                        isbn: b.isbn,
                        pageCount: b.pageCount,
                        chapterCount: b._count.chapters,
                    }),
                }))
                .sort((a, b) => b.score - a.score);
            const best = scored[0];
            if (best.coverImageUrl) (book as any).coverImageUrl = best.coverImageUrl;
            if (best.author) (book as any).author = best.author;
            if (best.pageCount) (book as any).pageCount = best.pageCount;
        }

        // Show public episodes, episodes from public podcasters, + the current user's own episodes
        const episodeWhere = {
            bookId: { in: allBookIds },
            generationStatus: 'COMPLETED' as const,
            OR: [
                { isPublic: true },
                { podcaster: { isPublic: true } },
                ...(userId ? [{ userId }] : []),
            ],
        };

        const episodeInclude = {
            podcaster: {
                select: { id: true, name: true, profilePictureUrl: true },
            },
        };

        // Top episodes: all-time by play count
        const topEpisodes = await this.databaseService.episode.findMany({
            where: episodeWhere,
            orderBy: { playCount: 'desc' },
            take: sectionLimit,
            include: episodeInclude,
        });

        // Recent episodes: newest first
        const recentEpisodes = await this.databaseService.episode.findMany({
            where: episodeWhere,
            orderBy: { createdAt: 'desc' },
            take: sectionLimit,
            include: episodeInclude,
        });

        // Trending episodes: created in last 14 days, sorted by engagement
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const trendingEpisodes = await this.databaseService.episode.findMany({
            where: {
                ...episodeWhere,
                createdAt: { gte: fourteenDaysAgo },
            },
            orderBy: [{ playCount: 'desc' }, { likeCount: 'desc' }],
            take: sectionLimit,
            include: episodeInclude,
        });

        const totalEpisodeCount = await this.databaseService.episode.count({
            where: episodeWhere,
        });

        const playCountResult = await this.databaseService.episode.aggregate({
            where: episodeWhere,
            _sum: { playCount: true },
        });

        // Strip scriptContent from episodes
        const clean = (episodes: any[]) =>
            episodes.map(({ scriptContent: _scriptContent, ...rest }) => rest);

        return {
            book: {
                ...book,
                episodeCount: totalEpisodeCount,
                totalPlayCount: playCountResult._sum.playCount || 0,
            },
            sections: {
                top: clean(topEpisodes),
                recent: clean(recentEpisodes),
                trending: clean(trendingEpisodes),
            },
        };
    }

    async delete(userId: string, id: string): Promise<void> {
        const book = await this.findOne(userId, id);

        // Check if other users' episodes reference this book (from dedup consolidation)
        const otherUsersEpisodeCount = await this.databaseService.episode.count({
            where: {
                bookId: id,
                userId: { not: userId },
            },
        });

        if (otherUsersEpisodeCount > 0) {
            // Find an alternative copy of the same book to reassign those episodes
            const allDuplicateIds = await this.findDuplicateBookIds(
                id,
                book.title,
                book.author,
            );
            const alternativeId = allDuplicateIds.find((bid) => bid !== id);

            if (alternativeId) {
                await this.databaseService.episode.updateMany({
                    where: {
                        bookId: id,
                        userId: { not: userId },
                    },
                    data: { bookId: alternativeId },
                });
                this.logger.log(
                    `Moved ${otherUsersEpisodeCount} other users' episodes from book ${id} to alternative ${alternativeId} before deletion`,
                );
            } else {
                this.logger.warn(
                    `Deleting book ${id} will cascade-delete ${otherUsersEpisodeCount} episodes from other users (no alternative book found)`,
                );
            }
        }

        // Mark any pending/in-progress episodes as failed before deleting the book
        // This prevents orphaned episodes that can never be processed
        await this.databaseService.episode.updateMany({
            where: {
                bookId: id,
                generationStatus: {
                    in: ['PENDING', 'SCRIPT_GENERATING', 'SCRIPT_GENERATED', 'AUDIO_GENERATING'],
                },
            },
            data: {
                generationStatus: 'FAILED',
                generationError: 'Book was deleted before episode generation completed',
            },
        });

        // Delete file from storage
        if (book.fileStorageKey) {
            await this.storageService.deleteFile(book.fileStorageKey);
        }

        // Delete extracted text
        if (book.fullTextKey) {
            await this.storageService.deleteFile(book.fullTextKey);
        }

        // Delete database record (cascade deletes chapters and remaining episodes)
        await this.databaseService.book.delete({ where: { id } });
    }

    async retryExtraction(userId: string, id: string) {
        const book = await this.findOne(userId, id);

        if (book.extractionStatus !== 'FAILED') {
            throw new BadRequestException('Can only retry failed extractions');
        }

        // Update status back to pending
        await this.databaseService.book.update({
            where: { id },
            data: {
                extractionStatus: 'PENDING',
                extractionError: null,
            },
        });

        // Re-dispatch extraction job
        await this.bookExtractionDispatcher.dispatch(book.id);

        return this.findOne(userId, id);
    }

    /**
     * Force re-extraction of a book, even if already completed.
     * Useful when extraction algorithm has been improved.
     * Clears existing chapters before re-processing.
     */
    async forceReExtract(userId: string, id: string) {
        const book = await this.findOne(userId, id);

        if (book.extractionStatus === 'PROCESSING') {
            throw new BadRequestException('Book is currently being processed');
        }

        // Delete existing chapters
        await this.databaseService.chapter.deleteMany({
            where: { bookId: id },
        });

        // Update status back to pending and clear any extracted text reference
        await this.databaseService.book.update({
            where: { id },
            data: {
                extractionStatus: 'PENDING',
                extractionError: null,
                fullTextKey: null,
            },
        });

        // Re-dispatch extraction job
        await this.bookExtractionDispatcher.dispatch(book.id);

        return this.findOne(userId, id);
    }

    /**
     * Internal force re-extraction without user permission checks.
     * Used by the metadata probe when it detects improvements.
     */
    private async forceReExtractInternal(bookId: string): Promise<void> {
        const book = await this.databaseService.book.findUnique({
            where: { id: bookId },
        });

        if (!book) return;

        if (book.extractionStatus === 'PROCESSING') {
            this.logger.log(
                `Book ${bookId} is already being processed, skipping re-extraction`,
            );
            return;
        }

        // Delete existing chapters
        await this.databaseService.chapter.deleteMany({
            where: { bookId },
        });

        // Reset status to pending
        await this.databaseService.book.update({
            where: { id: bookId },
            data: {
                extractionStatus: 'PENDING',
                extractionError: null,
                fullTextKey: null,
            },
        });

        // Dispatch extraction job
        await this.bookExtractionDispatcher.dispatch(book.id);

        this.logger.log(
            `Dispatched re-extraction for book ${bookId} (triggered by metadata probe)`,
        );
    }
}
