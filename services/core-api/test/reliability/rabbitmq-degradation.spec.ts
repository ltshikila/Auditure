/**
 * RabbitMQ Degradation Tests
 *
 * Verifies that RabbitMQService gracefully handles a null/undefined channel.
 * When RabbitMQ fails to connect during onModuleInit(), the channel remains
 * undefined. All publish and consume methods guard against this with
 * `if (!this.channel)` and return early without throwing.
 *
 * We instantiate the service directly WITHOUT calling onModuleInit(), so the
 * internal `channel` remains undefined.
 */
import { RabbitMQService } from '../../src/rabbitmq/rabbitmq.service';
import { BookExtractionJob, EpisodeGenerationJob } from '../../src/rabbitmq/interfaces/jobs.interface';

describe('RabbitMQService - Degraded Mode (Channel Unavailable)', () => {
    let service: RabbitMQService;

    beforeEach(() => {
        // Create instance without calling onModuleInit() so channel is undefined.
        service = new RabbitMQService();
    });

    it('should be instantiated without errors', () => {
        expect(service).toBeDefined();
    });

    // ============================================
    // Publishing Jobs
    // ============================================

    describe('Publishing Jobs', () => {
        it('publishBookExtractionJob should throw when channel is null', async () => {
            const job: BookExtractionJob = {
                bookId: 'book-123',
                userId: 'user-456',
                fileStorageKey: 'users/user-456/book-123/original.pdf',
                sourceType: 'PDF',
            };

            await expect(service.publishBookExtractionJob(job)).rejects.toThrow(
                'Message queue unavailable',
            );
        });

        it('publishEpisodeGenerationJob should throw when channel is null', async () => {
            const job: EpisodeGenerationJob = {
                episodeId: 'episode-789',
                userId: 'user-456',
                podcasterId: 'podcaster-1',
                bookId: 'book-123',
                title: 'Test Episode',
                contentCoverage: 'ENTIRE_BOOK',
                chapters: [1, 2, 3],
                episodeType: 'DUO',
                episodeTheme: 'DISCUSSION',
                targetLengthMin: 10,
                targetLengthMax: 20,
                voiceTier: 'STANDARD',
            };

            await expect(service.publishEpisodeGenerationJob(job)).rejects.toThrow(
                'Message queue unavailable',
            );
        });
    });

    // ============================================
    // Consuming Queues
    // ============================================

    describe('Consuming Queues', () => {
        it('consumeBookExtractionQueue should not throw when channel is null', async () => {
            const handler = jest.fn();
            await expect(service.consumeBookExtractionQueue(handler)).resolves.toBeUndefined();
            expect(handler).not.toHaveBeenCalled();
        });

        it('consumeEpisodeGenerationQueue should not throw when channel is null', async () => {
            const handler = jest.fn();
            await expect(service.consumeEpisodeGenerationQueue(handler)).resolves.toBeUndefined();
            expect(handler).not.toHaveBeenCalled();
        });
    });

    // ============================================
    // Module Lifecycle
    // ============================================

    describe('Module Lifecycle', () => {
        it('onModuleDestroy should not throw when channel and connection are undefined', async () => {
            await expect(service.onModuleDestroy()).resolves.not.toThrow();
        });
    });
});
