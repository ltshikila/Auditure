import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { TextExtractionService } from './services/text-extraction.service';
import { CoverExtractionService } from './services/cover-extraction.service';
import { BookExtractionWorker } from './workers/book-extraction.worker';
import { MetadataProbeService } from './services/metadata-probe.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        MulterModule.register({
            storage: memoryStorage(),
        }),
        NotificationsModule,
    ],
    controllers: [BooksController],
    providers: [BooksService, TextExtractionService, CoverExtractionService, BookExtractionWorker, MetadataProbeService],
    exports: [BooksService], // For Episodes and Feed modules to consume
})
export class BooksModule {}
