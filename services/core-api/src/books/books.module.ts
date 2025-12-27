import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { TextExtractionService } from './services/text-extraction.service';
import { BookExtractionWorker } from './workers/book-extraction.worker';

@Module({
  imports: [
    MulterModule.register({
      storage: require('multer').memoryStorage(), // Store in memory for processing
    }),
  ],
  controllers: [BooksController],
  providers: [
    BooksService,
    TextExtractionService,
    BookExtractionWorker,
  ],
  exports: [BooksService], // For Episodes and Feed modules to consume
})
export class BooksModule {}
