import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { TextExtractionService } from '../services/text-extraction.service';
import { StorageService } from '../../common/storage.service';
import { DatabaseService } from '../../database/database.service';
import { BookExtractionJob } from '../../rabbitmq/interfaces/jobs.interface';

@Injectable()
export class BookExtractionWorker implements OnModuleInit {
    private readonly logger = new Logger(BookExtractionWorker.name);

    constructor(
        private rabbitMQService: RabbitMQService,
        private textExtractionService: TextExtractionService,
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
                throw new Error(`Unsupported source type: ${job.sourceType}`);
            }

            // 4. Store full text in storage
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
            const uniqueChapters = new Map<number, typeof extracted.chapters[0]>();
            for (const chapter of extracted.chapters) {
                if (!uniqueChapters.has(chapter.chapterNumber)) {
                    uniqueChapters.set(chapter.chapterNumber, chapter);
                }
            }
            this.logger.log(`Creating ${uniqueChapters.size} unique chapters (from ${extracted.chapters.length} detected)`);

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
            }

            // 6. Update book record
            await this.databaseService.book.update({
                where: { id: job.bookId },
                data: {
                    extractionStatus: 'COMPLETED',
                    extractedAt: new Date(),
                    fullTextKey,
                    pageCount: extracted.metadata.pageCount,
                    // Update metadata if not provided
                    ...(extracted.metadata.title && { title: extracted.metadata.title }),
                    ...(extracted.metadata.author && { author: extracted.metadata.author }),
                    ...(extracted.metadata.language && { language: extracted.metadata.language }),
                },
            });

            this.logger.log(`Successfully extracted book ${job.bookId}`);

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
                });
                this.logger.log(`Queued pending episode ${episode.id} for generation`);
            }
        } catch (error) {
            this.logger.error(`Failed to extract book ${job.bookId}`, error);

            await this.databaseService.book.update({
                where: { id: job.bookId },
                data: {
                    extractionStatus: 'FAILED',
                    extractionError: error.message,
                },
            });

            throw error; // Re-throw for RabbitMQ retry logic
        }
    }
}
