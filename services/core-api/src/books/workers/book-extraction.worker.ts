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
    await this.rabbitMQService.consumeBookExtractionQueue(
      this.handleExtractionJob.bind(this)
    );
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
        'text/plain'
      );

      // 5. Create chapter records
      for (const chapter of extracted.chapters) {
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
