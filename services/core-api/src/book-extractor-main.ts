import 'dotenv/config';
import './instrument';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { BookExtractionWorker } from './books/workers/book-extraction.worker';

/**
 * Entry point for the book-extractor Cloud Run Job.
 *
 * Reads BOOK_ID from env, bootstraps a NestJS application context,
 * runs extraction, then exits. Exit code 1 on failure triggers Cloud Run's
 * built-in retry (configured via --max-retries on the Job).
 */
async function main() {
    const logger = new Logger('BookExtractorJob');

    const bookId = process.env.BOOK_ID;
    if (!bookId) {
        logger.error('BOOK_ID environment variable is required');
        process.exit(1);
    }

    // Cloud Run Jobs sets these env vars for each task execution
    // https://cloud.google.com/run/docs/container-contract#services-env-vars
    const attempt = parseInt(process.env.CLOUD_RUN_TASK_ATTEMPT ?? '0', 10) + 1;
    const maxRetries = parseInt(process.env.JOB_MAX_RETRIES ?? '3', 10);

    logger.log(`Starting extraction for book ${bookId} (attempt ${attempt}/${maxRetries})`);

    // Bootstrap a standalone application context (no HTTP server)
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'error', 'warn'],
    });

    try {
        const worker = app.get(BookExtractionWorker);
        await worker.extractBook(bookId, { attempt, maxRetries });
        logger.log(`Extraction completed successfully for book ${bookId}`);
        await app.close();
        process.exit(0);
    } catch (error: any) {
        logger.error(`Extraction failed for book ${bookId}: ${error.message}`);
        await app.close();
        // Non-zero exit triggers Cloud Run Job retry (up to max-retries)
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Fatal error in book-extractor-main:', error);
    process.exit(1);
});
