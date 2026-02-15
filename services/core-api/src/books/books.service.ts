import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../common/storage.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { CreateBookDto } from './dto/create-book.dto';
import { GetTextDto } from './dto/get-text.dto';
import { randomUUID } from 'crypto';
import { normalizeBookTitle, booksMatch, computeBookQualityScore } from './utils/book-matching.utils';

@Injectable()
export class BooksService {
    private readonly logger = new Logger(BooksService.name);

    constructor(
        private databaseService: DatabaseService,
        private storageService: StorageService,
        private rabbitMQService: RabbitMQService,
    ) {}

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
     * Search for an existing COMPLETED book that matches the given title (and optional author).
     * Uses fuzzy matching. Returns the best match or null.
     */
    async findExistingBook(title: string, author?: string | null): Promise<any> {
        const normalizedTitle = normalizeBookTitle(title);
        const words = normalizedTitle.split(' ').filter((w) => w.length > 2);
        const searchTerm = words.slice(0, 3).join(' ');

        if (!searchTerm || searchTerm.length < 4) return null;

        const candidates = await this.databaseService.book.findMany({
            where: {
                extractionStatus: 'COMPLETED',
                title: { contains: searchTerm, mode: 'insensitive' },
            },
            take: 20,
        });

        return (
            candidates.find((c) =>
                booksMatch(
                    { title, author },
                    { title: c.title, author: c.author },
                ),
            ) || null
        );
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
        const searchTerm = words.slice(0, 3).join(' ');

        if (!searchTerm) return [bookId];

        const candidates = await this.databaseService.book.findMany({
            where: {
                extractionStatus: {
                    in: ['COMPLETED', 'PARTIALLY_COMPLETED'],
                },
                title: { contains: searchTerm, mode: 'insensitive' },
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

            // 1.5 Check for existing completed book with matching title
            const cleanedTitle = this.cleanupTitle(createBookDto.title);
            const existingBook = await this.findExistingBook(
                cleanedTitle,
                createBookDto.author,
            );

            if (existingBook) {
                this.logger.log(
                    `Found existing book "${existingBook.title}" (${existingBook.id}) matching upload title "${cleanedTitle}". Reusing.`,
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

            // 5. Queue extraction job
            this.logger.log('Publishing book extraction job to RabbitMQ...');
            try {
                await this.rabbitMQService.publishBookExtractionJob({
                    bookId: book.id,
                    userId,
                    fileStorageKey: storageKey,
                    sourceType: createBookDto.sourceType as 'PDF' | 'EPUB',
                });
                this.logger.log('Extraction job published successfully');
            } catch (mqError) {
                this.logger.error(`RabbitMQ publish failed: ${mqError.message}`);
                this.logger.error(`RabbitMQ error stack: ${mqError.stack}`);
                // Don't throw - the book is created, extraction can be retried
                this.logger.warn(
                    'Book created but extraction job failed to queue - can be retried later',
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
        return this.databaseService.book.findMany({
            where: { userId },
            include: { chapters: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(userId: string, id: string) {
        const book = await this.databaseService.book.findUnique({
            where: { id },
            include: { chapters: true },
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

        // Re-queue job
        await this.rabbitMQService.publishBookExtractionJob({
            bookId: book.id,
            userId: book.userId,
            fileStorageKey: book.fileStorageKey,
            sourceType: book.sourceType as 'PDF' | 'EPUB',
        });

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

        // Re-queue job
        await this.rabbitMQService.publishBookExtractionJob({
            bookId: book.id,
            userId: book.userId,
            fileStorageKey: book.fileStorageKey,
            sourceType: book.sourceType as 'PDF' | 'EPUB',
        });

        return this.findOne(userId, id);
    }
}
