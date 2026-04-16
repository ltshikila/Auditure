import { Injectable, Logger } from '@nestjs/common';
import { JobsClient } from '@google-cloud/run';

/**
 * Dispatches book extraction work by triggering a Cloud Run Job execution.
 *
 * Why a Job (not an always-on Service): book extraction is bursty and idle most of the day.
 * Running it inside a scale-to-zero Service caused Cloud Run to kill the container
 * mid-extraction for large books. Each Job execution is independent and gets its own
 * 24h budget, so large PDFs can extract without being killed.
 */
@Injectable()
export class BookExtractionDispatcher {
    private readonly logger = new Logger(BookExtractionDispatcher.name);
    private readonly client: JobsClient;

    private readonly projectId = process.env.GCP_PROJECT_ID || 'auditure-483611';
    private readonly region = process.env.GCP_REGION || 'us-central1';
    private readonly jobName = process.env.BOOK_EXTRACTOR_JOB_NAME || 'book-extractor';

    constructor() {
        this.client = new JobsClient();
    }

    async dispatch(bookId: string): Promise<void> {
        const name = `projects/${this.projectId}/locations/${this.region}/jobs/${this.jobName}`;

        this.logger.log(`Dispatching extraction for book ${bookId} via Cloud Run Job ${name}`);

        try {
            const [operation] = await this.client.runJob({
                name,
                overrides: {
                    containerOverrides: [
                        {
                            env: [{ name: 'BOOK_ID', value: bookId }],
                        },
                    ],
                },
            });

            this.logger.log(
                `Dispatched extraction for book ${bookId} — execution: ${operation.name ?? 'unknown'}`,
            );
        } catch (error: any) {
            this.logger.error(
                `Failed to dispatch extraction for book ${bookId}: ${error.message}`,
            );
            throw error;
        }
    }
}
